/* ============================================================
   The background world: procedurally drawn Blue Ridge ridgelines,
   drifting mist, stars, and a constellation graph. main.js sets
   window.world.target.* from scroll position; this file eases
   toward those targets and draws every frame.
   ============================================================ */
(function () {
  'use strict';

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function mix(c1, c2, t) { return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)]; }
  function rgb(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (a == null ? 1 : a) + ')'; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  var N = 7; // ridge layers, far to near

  var PAL = {
    daySkyTop: [164, 180, 196], daySkyBot: [224, 229, 233],
    dayNear: [30, 40, 52], dayFog: [204, 212, 220], dayMist: [237, 241, 244],
    nightSkyTop: [2, 4, 9], nightSkyBot: [12, 19, 34],
    nightNear: [3, 5, 10], nightFog: [24, 34, 54], nightMist: [36, 48, 72],
    dawnBot: [86, 52, 60], dawnGlow: [226, 146, 92],
    lensSkyTop: [88, 124, 166], lensSkyBot: [252, 204, 146],
    lensNear: [24, 38, 46], lensFog: [170, 186, 192],
    gold: [212, 191, 127]
  };

  function World(canvas) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.p = { cam: 0, fog: 0.95, night: 0, dawn: 0, graph: 0, lensX: 0, lensY: 0, lensR: 0, sun: 0.3, ring: 0, px: 0 };
    this.target = Object.assign({}, this.p);
    this.t = 0;
    this.motion = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resize();
  }

  World.prototype.resize = function () {
    var w = window.innerWidth, h = window.innerHeight;
    this.w = w; this.h = h;
    this.dpr = Math.min(window.devicePixelRatio || 1, w < 700 ? 1.5 : 2);
    this.c.width = Math.round(w * this.dpr);
    this.c.height = Math.round(h * this.dpr);
    this.c.style.width = w + 'px';
    this.c.style.height = h + 'px';
    this.build();
  };

  World.prototype.build = function () {
    var w = this.w, h = this.h, self = this;
    this.layers = [];
    this.mist = [];

    for (var i = 0; i < N; i++) {
      var t = i / (N - 1);
      var rnd = mulberry32(1000 + i * 97);
      var base = h * (0.4 + 0.44 * Math.pow(t, 0.95));
      var amp = h * (0.035 + 0.1 * t);
      var waves = [];
      var wl = [1.3, 2.9, 6.1, 12.5];
      var wa = [1, 0.42, 0.17, 0.07];
      for (var k = 0; k < 4; k++) {
        waves.push({ f: (wl[k] + rnd() * wl[k] * 0.6) * Math.PI * 2 / Math.max(w, 900) * (0.8 + t * 0.5), a: wa[k], ph: rnd() * Math.PI * 2 });
      }
      var yAt = (function (base, amp, waves) {
        return function (x) {
          var s = 0, n = 0;
          for (var q = 0; q < waves.length; q++) { s += waves[q].a * Math.sin(x * waves[q].f + waves[q].ph); n += waves[q].a; }
          return base - amp * (0.4 + s / n);
        };
      })(base, amp, waves);

      var path = new Path2D();
      var x0 = -80, x1 = w + 80;
      path.moveTo(x0, h * 3);
      for (var x = x0; x <= x1; x += 4) path.lineTo(x, yAt(x));
      path.lineTo(x1, h * 3);
      path.closePath();

      // Conifers on the nearer ridges, in clumps.
      if (i >= N - 4) {
        var near = (i - (N - 4)) / 3;
        var size = (h / 900) * (7 + 38 * Math.pow(near, 1.5));
        var tx = x0;
        while (tx < x1) {
          tx += (1.5 + rnd() * 6) * (0.5 + size / 16);
          var clump = Math.sin(tx * 0.006 + i * 2.1) + Math.sin(tx * 0.017 + i);
          if (clump > -0.6 && rnd() < 0.85) {
            addTree(path, tx, yAt(tx) + size * 0.2, size * (0.55 + rnd() * 0.8));
          }
        }
      }

      this.layers.push({ path: path, t: t, depth: 0.1 + 0.9 * Math.pow(t, 1.5), base: base, yAt: yAt });
    }

    var mr = mulberry32(42);
    for (var m = 0; m < 18; m++) {
      var li = 1 + Math.floor(mr() * (N - 1));
      this.mist.push({
        layer: li,
        x: mr() * w,
        y: this.layers[li].base - h * 0.02 + mr() * h * 0.06,
        r: Math.max(w, 700) * (0.18 + mr() * 0.3),
        v: (mr() - 0.5) * 16,
        a: 0.35 + mr() * 0.45
      });
    }

    var sr = mulberry32(7);
    var count = Math.min(340, Math.round(w * h / 5000));
    this.stars = [];
    for (var s = 0; s < count; s++) {
      this.stars.push({ x: sr() * w, y: sr() * h * 0.78, r: 0.35 + Math.pow(sr(), 3) * 1.4, sp: 0.4 + sr() * 2, ph: sr() * 6.28 });
    }

    // Constellation graph: spaced points, each linked to its two nearest neighbours.
    var gr = mulberry32(99);
    var target = w < 700 ? 14 : 22;
    var minD = Math.min(w, h) * (w < 700 ? 0.13 : 0.1);
    this.nodes = [];
    var guard = 0;
    while (this.nodes.length < target && guard++ < 2000) {
      var nx = w * (0.06 + gr() * 0.88), ny = h * (0.1 + gr() * 0.42);
      var ok = this.nodes.every(function (n) { return Math.hypot(n.x - nx, n.y - ny) > minD; });
      if (ok) this.nodes.push({ x: nx, y: ny, delay: (nx / w) * 0.5, seed: gr() });
    }
    var seen = {};
    this.edges = [];
    this.nodes.forEach(function (n, ai) {
      var order = self.nodes.map(function (m, bi) { return { bi: bi, d: Math.hypot(m.x - n.x, m.y - n.y) }; })
        .filter(function (o) { return o.bi !== ai; })
        .sort(function (a, b) { return a.d - b.d; })
        .slice(0, 2);
      order.forEach(function (o) {
        var key = Math.min(ai, o.bi) + '-' + Math.max(ai, o.bi);
        if (seen[key]) return;
        seen[key] = 1;
        self.edges.push({ a: ai, b: o.bi, delay: Math.min(n.delay, self.nodes[o.bi].delay), seed: gr() });
      });
    });
  };

  function addTree(path, x, y, hgt) {
    var w = hgt * 0.36, tiers = 3, k, yy, ww, inner = [];
    path.moveTo(x, y - hgt);
    for (k = 1; k <= tiers; k++) {
      yy = y - hgt + (hgt * 0.92 * k) / tiers;
      ww = (w * (0.42 + 0.58 * k / tiers)) / 2;
      path.lineTo(x + ww, yy);
      if (k < tiers) { path.lineTo(x + ww * 0.42, yy); inner[k] = [ww * 0.42, yy]; }
    }
    path.lineTo(x + w * 0.07, y - hgt * 0.08);
    path.lineTo(x + w * 0.07, y + hgt * 0.1);
    path.lineTo(x - w * 0.07, y + hgt * 0.1);
    path.lineTo(x - w * 0.07, y - hgt * 0.08);
    for (k = tiers; k >= 1; k--) {
      yy = y - hgt + (hgt * 0.92 * k) / tiers;
      ww = (w * (0.42 + 0.58 * k / tiers)) / 2;
      path.lineTo(x - ww, yy);
      if (k > 1) path.lineTo(x - inner[k - 1][0], inner[k - 1][1]);
    }
    path.closePath();
  }

  World.prototype.layerColor = function (i, night, fog, lens) {
    var t = i / (N - 1);
    if (lens) return mix(PAL.lensNear, PAL.lensFog, Math.pow(1 - t, 1.1) * 0.72);
    var day = mix(PAL.dayNear, PAL.dayFog, Math.pow(1 - t, 1.15) * (0.3 + 0.7 * fog));
    var nite = mix(PAL.nightNear, PAL.nightFog, Math.pow(1 - t, 1.3) * 0.9);
    return mix(day, nite, night);
  };

  World.prototype.drawScene = function (lens) {
    var ctx = this.ctx, P = this.p, w = this.w, h = this.h, i;
    var night = lens ? 0 : P.night;
    var fog = lens ? 0.2 : P.fog;
    var camY = P.cam * h;

    // Sky
    var top = lens ? PAL.lensSkyTop : mix(PAL.daySkyTop, PAL.nightSkyTop, night);
    var bot = lens ? PAL.lensSkyBot : mix(mix(PAL.daySkyBot, PAL.nightSkyBot, night), PAL.dawnBot, P.dawn * night);
    // Inside the lens the sky is a warm dawn centred on the lens itself.
    var g = lens
      ? ctx.createLinearGradient(0, P.lensY - P.lensR, 0, P.lensY + P.lensR * 0.3)
      : ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, rgb(top));
    g.addColorStop(0.75, rgb(bot));
    g.addColorStop(1, rgb(bot));
    ctx.fillStyle = g;
    ctx.fillRect(-w, -h, w * 3, h * 3);

    if (!lens && P.dawn > 0.01) {
      // Dawn comes up just behind the farthest ridge.
      var gy = this.layers[0].base + camY * this.layers[0].depth - h * 0.04;
      var dg = ctx.createRadialGradient(w * 0.5, gy, 0, w * 0.5, gy, Math.max(w, h) * 0.6);
      dg.addColorStop(0, rgb(PAL.dawnGlow, 0.42 * P.dawn));
      dg.addColorStop(1, rgb(PAL.dawnGlow, 0));
      ctx.fillStyle = dg;
      ctx.fillRect(0, 0, w, h);
    }

    if (lens) {
      var sx = P.lensX + P.lensR * 0.2, sy = P.lensY + P.lensR * (0.12 - P.sun * 0.6), sr = Math.max(10, P.lensR * 0.12);
      var sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 6);
      sg.addColorStop(0, 'rgba(255,236,190,0.9)');
      sg.addColorStop(0.18, 'rgba(255,214,150,0.45)');
      sg.addColorStop(1, 'rgba(255,214,150,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,244,220,0.95)';
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, 6.283); ctx.fill();
    }

    // Stars + graph
    if (night > 0.01) {
      var drift = camY * 0.05;
      for (i = 0; i < this.stars.length; i++) {
        var s = this.stars[i];
        var a = night * (1 - P.dawn * 0.6) * (0.5 + 0.5 * Math.sin(this.t * s.sp + s.ph));
        ctx.fillStyle = 'rgba(235,240,255,' + a.toFixed(3) + ')';
        if (s.r > 1.1) { ctx.beginPath(); ctx.arc(s.x, s.y + drift, s.r, 0, 6.283); ctx.fill(); }
        else ctx.fillRect(s.x, s.y + drift, s.r * 1.6, s.r * 1.6);
      }
      // The graph fades out at the end so it doesn't run through the contact text.
      if (P.graph > 0.001 && P.dawn < 0.98) this.drawGraph(night * (1 - P.dawn), drift);
    }
    if (!lens && P.dawn > 0.2) this.drawPlane(clamp((P.dawn - 0.2) / 0.5, 0, 1));

    // Ridges, with mist between them
    for (i = 0; i < N; i++) {
      var L = this.layers[i];
      // In the lens, put the farthest ridge just below the lens centre so it shows dawn sky above hills,
      // wherever the lens happens to sit on screen.
      var offY = lens ? (P.lensY + P.lensR * 0.1 - this.layers[0].base) + camY * 0.15 * L.depth : camY * L.depth;
      var offX = P.px * L.depth * 16;
      ctx.save();
      ctx.translate(offX, offY);
      ctx.fillStyle = rgb(this.layerColor(i, night, fog, lens));
      ctx.fill(L.path);
      // The school sits on this ridge at dawn, at the very end of the page.
      if (!lens && i === 2 && P.dawn > 0.15) this.drawSchool(L, clamp((P.dawn - 0.15) / 0.6, 0, 1), this.layerColor(i, night, fog, false));
      ctx.restore();

      var mc = lens ? PAL.dayMist : mix(PAL.dayMist, PAL.nightMist, night);
      for (var m = 0; m < this.mist.length; m++) {
        var M = this.mist[m];
        if (M.layer !== i) continue;
        var ma = M.a * (lens ? 0.25 : (0.15 + 0.85 * fog)) * (1 - night * 0.55);
        if (ma < 0.01) continue;
        var mx = M.x + offX, my = M.y + offY;
        var mg = ctx.createRadialGradient(mx, my, 0, mx, my, M.r);
        mg.addColorStop(0, rgb(mc, ma));
        mg.addColorStop(1, rgb(mc, 0));
        ctx.fillStyle = mg;
        ctx.fillRect(mx - M.r, my - M.r, M.r * 2, M.r * 2);
      }
    }

    // Overall fog wash, thickest at the very top of the page
    if (!lens && fog > 0.5) {
      ctx.fillStyle = rgb(mix(PAL.dayMist, PAL.nightMist, night), (fog - 0.5) * 0.7);
      ctx.fillRect(0, 0, w, h);
    }
  };

  // A one-room schoolhouse with a bell tower, drawn as part of the ridge, with warm lit windows.
  World.prototype.drawSchool = function (L, a, color) {
    var ctx = this.ctx, w = this.w, h = this.h;
    var narrow = w < 700;
    var x = w * (narrow ? 0.5 : 0.82);
    var u = Math.min(h * 0.11, w * (narrow ? 0.16 : 0.075));
    var y = Math.min(L.yAt(x - u), L.yAt(x), L.yAt(x + u)) + u * 0.08; // ground under the whole building
    var bw = u * 1.7, bh = u * 0.85, roof = u * 0.5;
    var tw = u * 0.34, th = u * 0.38, tRoof = u * 0.32;
    ctx.save();
    ctx.globalAlpha = a;
    // warm halo so the dark silhouette reads against the hills
    var hy = y - bh * 0.8;
    var halo = ctx.createRadialGradient(x, hy, 0, x, hy, u * 3.2);
    halo.addColorStop(0, 'rgba(255, 190, 120, 0.42)');
    halo.addColorStop(0.45, 'rgba(255, 170, 100, 0.14)');
    halo.addColorStop(1, 'rgba(255, 170, 100, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(x - u * 3.2, hy - u * 3.2, u * 6.4, u * 6.4);
    ctx.fillStyle = rgb(color);
    ctx.beginPath();
    // body and gable roof
    ctx.moveTo(x - bw / 2 - u * 0.08, y - bh);
    ctx.lineTo(x, y - bh - roof);
    ctx.lineTo(x + bw / 2 + u * 0.08, y - bh);
    ctx.lineTo(x + bw / 2, y - bh);
    ctx.lineTo(x + bw / 2, y + u * 0.3);
    ctx.lineTo(x - bw / 2, y + u * 0.3);
    ctx.lineTo(x - bw / 2, y - bh);
    ctx.closePath();
    ctx.fill();
    // bell tower
    var tb = y - bh - roof * 0.55;
    ctx.fillRect(x - tw / 2, tb - th, tw, th + roof * 0.3);
    ctx.beginPath();
    ctx.moveTo(x - tw / 2 - u * 0.05, tb - th);
    ctx.lineTo(x, tb - th - tRoof);
    ctx.lineTo(x + tw / 2 + u * 0.05, tb - th);
    ctx.closePath();
    ctx.fill();
    // flagpole
    ctx.fillRect(x - u * 0.012, tb - th - tRoof - u * 0.32, u * 0.024, u * 0.34);
    ctx.beginPath();
    ctx.moveTo(x + u * 0.012, tb - th - tRoof - u * 0.32);
    ctx.lineTo(x + u * 0.2, tb - th - tRoof - u * 0.25);
    ctx.lineTo(x + u * 0.012, tb - th - tRoof - u * 0.18);
    ctx.fill();
    // lit windows, a door, and the bell
    var glow = 'rgba(255, 196, 120, ' + (0.9 * a) + ')';
    ctx.shadowColor = 'rgba(255, 180, 90, ' + (0.8 * a) + ')';
    ctx.shadowBlur = u * 0.35;
    ctx.fillStyle = glow;
    var ww = u * 0.22, wh = u * 0.28, wy = y - bh + u * 0.2;
    [-0.62, -0.32, 0.32, 0.62].forEach(function (k) { ctx.fillRect(x + k * bw / 1.45 - ww / 2, wy, ww, wh); });
    ctx.fillRect(x - u * 0.13, y - u * 0.4, u * 0.26, u * 0.4);
    ctx.beginPath(); ctx.arc(x, tb - th * 0.5, u * 0.07, 0, 6.283); ctx.fill();
    ctx.restore();
  };

  // A small plane crossing the dawn sky with a fading contrail.
  World.prototype.drawPlane = function (a) {
    var ctx = this.ctx, w = this.w, h = this.h;
    var period = 18, q = ((this.t % period) / period);
    var x = -0.1 * w + q * 1.2 * w;
    var y = h * (0.16 + 0.04 * Math.sin(q * Math.PI));
    var tail = w * 0.28;
    var g = ctx.createLinearGradient(x - tail, y, x, y);
    g.addColorStop(0, 'rgba(255, 236, 214, 0)');
    g.addColorStop(1, 'rgba(255, 236, 214, ' + (0.45 * a) + ')');
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - tail, y + h * 0.01);
    ctx.quadraticCurveTo(x - tail * 0.5, y + h * 0.004, x - 8, y);
    ctx.stroke();
    var s = Math.max(7, Math.min(w, h) * 0.011);
    ctx.fillStyle = 'rgba(255, 244, 228, ' + a + ')';
    ctx.beginPath();
    ctx.moveTo(x + s * 1.4, y);              // nose
    ctx.lineTo(x - s * 1.2, y - s * 0.18);
    ctx.lineTo(x - s * 1.2, y + s * 0.18);
    ctx.closePath();
    ctx.moveTo(x + s * 0.2, y);              // wings
    ctx.lineTo(x - s * 0.5, y - s * 1.1);
    ctx.lineTo(x - s * 0.15, y);
    ctx.lineTo(x - s * 0.5, y + s * 1.1);
    ctx.closePath();
    ctx.moveTo(x - s * 0.9, y);              // tail
    ctx.lineTo(x - s * 1.3, y - s * 0.5);
    ctx.lineTo(x - s * 1.1, y);
    ctx.closePath();
    ctx.fill();
  };

  World.prototype.drawGraph = function (night, drift) {
    var ctx = this.ctx, g = this.p.graph, nodes = this.nodes, self = this;
    ctx.lineWidth = 1;
    this.edges.forEach(function (e) {
      var k = clamp((g - e.delay) / 0.45, 0, 1);
      if (k <= 0) return;
      var a = nodes[e.a], b = nodes[e.b];
      ctx.strokeStyle = rgb(PAL.gold, 0.3 * night);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y + drift);
      ctx.lineTo(lerp(a.x, b.x, k), lerp(a.y, b.y, k) + drift);
      ctx.stroke();
      // Packets travelling along finished links
      if (k >= 1 && self.motion) {
        var q = (self.t * (0.12 + e.seed * 0.18) + e.seed) % 1;
        ctx.fillStyle = rgb(PAL.gold, 0.85 * night);
        ctx.beginPath();
        ctx.arc(lerp(a.x, b.x, q), lerp(a.y, b.y, q) + drift, 1.6, 0, 6.283);
        ctx.fill();
      }
    });
    nodes.forEach(function (n) {
      var a = clamp((g - n.delay) / 0.2, 0, 1) * night;
      if (a <= 0) return;
      var ng = ctx.createRadialGradient(n.x, n.y + drift, 0, n.x, n.y + drift, 10);
      ng.addColorStop(0, rgb(PAL.gold, 0.35 * a));
      ng.addColorStop(1, rgb(PAL.gold, 0));
      ctx.fillStyle = ng;
      ctx.fillRect(n.x - 10, n.y + drift - 10, 20, 20);
      ctx.fillStyle = rgb([245, 235, 205], a);
      ctx.beginPath(); ctx.arc(n.x, n.y + drift, 2, 0, 6.283); ctx.fill();
    });
  };

  World.prototype.draw = function () {
    var ctx = this.ctx, P = this.p;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawScene(false);

    if (P.lensR > 1) {
      var lx = P.lensX, ly = P.lensY, r = P.lensR;
      ctx.save();
      ctx.beginPath(); ctx.arc(lx, ly, r, 0, 6.283); ctx.clip();
      ctx.translate(lx, ly); ctx.scale(1.25, 1.25); ctx.translate(-lx, -ly);
      this.drawScene(true);
      ctx.restore();

      var ringA = clamp(r / 40, 0, 1);
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.8 * ringA) + ')';
      ctx.lineWidth = 1.25;
      ctx.beginPath(); ctx.arc(lx, ly, r + 10, 0, 6.283); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.22 * ringA) + ')';
      ctx.beginPath(); ctx.arc(lx, ly, r + 26, 0, 6.283); ctx.stroke();
      var ang = P.ring * Math.PI * 2 - Math.PI / 2;
      ctx.fillStyle = rgb([24, 30, 40], ringA);
      ctx.beginPath(); ctx.arc(lx + Math.cos(ang) * (r + 10), ly + Math.sin(ang) * (r + 10), 5, 0, 6.283); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,' + ringA + ')';
      ctx.beginPath(); ctx.arc(lx + Math.cos(ang) * (r + 10), ly + Math.sin(ang) * (r + 10), 2, 0, 6.283); ctx.fill();
    }
  };

  World.prototype.tick = function (dt) {
    if (this.motion) this.t += dt;
    var k = 1 - Math.exp(-dt * 7);
    for (var key in this.target) {
      if (key === 'lensX' || key === 'lensY') this.p[key] = this.target[key];
      else this.p[key] += (this.target[key] - this.p[key]) * k;
    }
    if (this.motion) {
      for (var m = 0; m < this.mist.length; m++) {
        var M = this.mist[m];
        M.x += M.v * dt;
        if (M.x - M.r > this.w + 80) M.x = -M.r;
        if (M.x + M.r < -80) M.x = this.w + M.r;
      }
    }
    this.draw();
  };

  var canvas = document.getElementById('world');
  if (!canvas || !canvas.getContext) return;
  var world = new World(canvas);
  window.world = world;

  var last = performance.now();
  function loop(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    world.tick(dt);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { world.resize(); }, 120);
  });
})();
