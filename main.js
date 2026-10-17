(function () {
  'use strict';

  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var EMAIL = 'pranavdivichenchu@gmail.com';

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function smooth(a, b, v) { return ease(clamp((v - a) / (b - a), 0, 1)); }
  function pair(s) { return s ? s.split(',').map(Number) : null; }

  /* ---------- Split scatter headings into letters ---------- */
  var seed = 11;
  function rand() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }

  document.querySelectorAll('.scatter').forEach(function (el) {
    var text = el.textContent.trim().replace(/\s+/g, ' ');
    el.textContent = '';
    var sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = text;
    el.appendChild(sr);
    var wrap = document.createElement('span');
    wrap.setAttribute('aria-hidden', 'true');
    text.split(' ').forEach(function (word, wi) {
      if (wi) wrap.appendChild(document.createTextNode(' '));
      var w = document.createElement('span');
      w.className = 'word';
      Array.from(word).forEach(function (c) {
        var s = document.createElement('span');
        s.className = 'ch';
        s.textContent = c;
        s.style.setProperty('--dx', ((rand() - 0.5) * 3.2).toFixed(2) + 'em');
        s.style.setProperty('--dy', ((rand() - 0.5) * 2.2).toFixed(2) + 'em');
        s.style.setProperty('--r', ((rand() - 0.5) * 70).toFixed(1) + 'deg');
        w.appendChild(s);
      });
      wrap.appendChild(w);
    });
    el.appendChild(wrap);
  });

  /* ---------- Scene model ---------- */
  function makeItem(node) {
    return {
      node: node,
      inn: pair(node.dataset.in),
      out: pair(node.dataset.out),
      intro: node.hasAttribute('data-intro') || node.hasAttribute('data-intro-fade'),
      letters: node.classList.contains('scatter') ? Array.prototype.slice.call(node.querySelectorAll('.ch')) : null,
      last: []
    };
  }
  var scenes = Array.prototype.map.call(document.querySelectorAll('[data-scene]'), function (el) {
    var items = Array.prototype.map.call(el.querySelectorAll('[data-in], [data-intro], [data-intro-fade]'), makeItem);
    return { el: el, name: el.dataset.scene, items: items, lens: el.querySelector('.lens'), lensWin: pair(el.dataset.lens), p: 0 };
  });
  var byName = {};
  scenes.forEach(function (s) { byName[s.name] = s; });
  var contact = document.getElementById('contact');
  var cue = document.querySelector('[data-cue]');

  // Letter i of n gets its own slice of the window so they arrive one after another.
  function staggered(p, win, i, n) {
    if (!win) return 0;
    var a = win[0], b = win[1], span = b - a, spread = 0.5;
    var s = a + span * spread * (n > 1 ? i / (n - 1) : 0);
    var e = s + span * (1 - spread);
    return ease(clamp((p - s) / (e - s), 0, 1));
  }

  var introT = 0; // 0 → 1 over the first moments after load

  function setV(item, idx, node, v) {
    v = Math.round(v * 1000) / 1000;
    if (item.last[idx] === v) return;
    item.last[idx] = v;
    node.style.setProperty('--v', v);
  }

  function updateItem(item, p) {
    var n = item.letters ? item.letters.length : 1;
    for (var i = 0; i < n; i++) {
      var vin = item.intro ? staggered(introT, [0, 1], i, n) : staggered(p, item.inn, i, n);
      var vout = item.out ? staggered(p, item.out, i, n) : 0;
      var v = reduce ? (vin > 0.5 ? 1 : 0) * (vout > 0.5 ? 0 : 1) : vin * (1 - vout);
      setV(item, i, item.letters ? item.letters[i] : item.node, v);
    }
  }

  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav__links a[href^="#"]'));
  var navTargets = navLinks.map(function (a) { var id = a.getAttribute('href').slice(1); return { id: id, el: document.getElementById(id) }; })
    .filter(function (t) { return t.el; });
  var lastNav;

  /* ---------- Per-frame update ---------- */
  var queued = false;
  function frame() {
    queued = false;
    var vh = window.innerHeight;
    var w = window.world;

    scenes.forEach(function (s) {
      var r = s.el.getBoundingClientRect();
      s.p = clamp(-r.top / Math.max(1, r.height - vh), 0, 1);
      s.visible = r.bottom > -vh * 0.2 && r.top < vh * 1.2;
      if (s.visible || s.name === 'hero') s.items.forEach(function (it) { updateItem(it, s.p); });
    });

    var H = byName.hero.p, A = byName.about.p, B = byName.build.p, Nt = byName.night.p;
    var night = smooth(0, 0.3, Nt);
    var dawn = contact ? clamp(1 - contact.getBoundingClientRect().top / vh, 0, 1) : 0;

    // Story progress drives the camera rising above the ridges.
    var nightRect = byName.night.el.getBoundingClientRect();
    var storyLen = window.scrollY + nightRect.bottom - vh;
    var story = clamp(window.scrollY / Math.max(1, storyLen), 0, 1);
    var after = clamp((window.scrollY - storyLen) / Math.max(1, document.documentElement.scrollHeight - vh - storyLen), 0, 1);

    if (w) {
      var T = w.target;
      // Rise quickly out of the hero so the story text sits over open sky, then keep climbing slowly.
      T.cam = 0.32 * smooth(0, 1, H) + 0.2 * story + 0.06 * after;
      // Phones are tall, so the ridges need to sink further to clear the text.
      if (vh > window.innerWidth * 1.3) T.cam *= 1.4;
      T.fog = clamp(0.95 - 0.35 * H - 0.15 * A - 0.12 * B - 0.2 * Nt, 0.12, 1);
      T.night = night;
      T.graph = clamp((Nt - 0.15) / 0.4, 0, 1);
      T.dawn = dawn;

      // The lens follows whichever scene is on screen and has one.
      var lensR = 0, active = null;
      scenes.forEach(function (s) {
        if (!s.lens || !s.visible) return;
        var win = s.lensWin;
        var v = smooth(win[0], win[1], s.p) * (1 - smooth(win[2], win[3], s.p));
        if (v > 0.001) { active = s; lensR = v; }
      });
      if (active) {
        var lr = active.lens.getBoundingClientRect();
        T.lensX = lr.left + lr.width / 2;
        T.lensY = lr.top + lr.height / 2;
        T.lensR = (lr.width / 2) * lensR;
        T.sun = active.name === 'build' ? 0.55 + active.p * 0.3 : 0.1 + active.p * 0.35;
        T.ring = active.p;
      } else {
        T.lensR = 0;
      }
    }

    root.classList.toggle('is-night', night > 0.5);
    if (cue) cue.style.setProperty('--cue', String(1 - smooth(0.01, 0.1, H)));

    // Highlight the nav link for whatever is on screen.
    var mid = vh * 0.45, current = null;
    navTargets.forEach(function (t) {
      var r = t.el.getBoundingClientRect();
      if (r.top <= mid && r.bottom > mid) current = t.id;
    });
    if (current !== lastNav) {
      lastNav = current;
      navLinks.forEach(function (a) { a.classList.toggle('is-active', a.getAttribute('href') === '#' + current); });
    }
  }
  function request() { if (!queued) { queued = true; requestAnimationFrame(frame); } }
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);

  // Intro: the hero name assembles once the page loads.
  (function runIntro() {
    if (reduce) { introT = 1; request(); return; }
    var start = performance.now(), dur = 1200;
    (function step(now) {
      introT = clamp((now - start) / dur, 0, 1);
      frame();
      if (introT < 1) requestAnimationFrame(step);
    })(start);
    // Background tabs don't run rAF; don't leave the name invisible.
    setTimeout(function () { if (introT < 1) { introT = 1; frame(); } }, dur + 400);
  })();

  if (cue) cue.classList.add('is-on');

  /* ---------- Navigation ---------- */
  // Scenes are long, so jump to the point where their text is on screen.
  function jumpTo(id) {
    var el = document.getElementById(id);
    if (!el) return;
    var y = el.getBoundingClientRect().top + window.scrollY;
    var p = parseFloat(el.dataset.jump || '0');
    if (p) y += p * (el.offsetHeight - window.innerHeight);
    else y -= 72; // keep regular sections clear of the fixed nav
    window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href').slice(1);
    if (!id) return;
    e.preventDefault();
    closeMenu();
    if (id === 'top') window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    else jumpTo(id);
    history.replaceState(null, '', '#' + id);
  });

  var menu = document.getElementById('menu');
  var menuBtn = document.querySelector('[data-menu]');
  function closeMenu() {
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    root.classList.remove('menu-open');
    menuBtn.setAttribute('aria-expanded', 'false');
  }
  if (menuBtn) menuBtn.addEventListener('click', function () {
    var open = menu.hidden;
    menu.hidden = !open;
    root.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });

  /* ---------- Copy email ---------- */
  var toastEl = document.querySelector('.toast'), toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 1800);
  }
  document.querySelectorAll('[data-copy-email]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(EMAIL).then(function () { toast('Email copied'); }, function () { location.href = 'mailto:' + EMAIL; });
      } else {
        location.href = 'mailto:' + EMAIL;
      }
    });
  });

  var yr = document.getElementById('year');
  if (yr) yr.textContent = new Date().getFullYear();

  // On a reload partway down, jump straight to the right state.
  if (location.hash && location.hash.length > 1) setTimeout(function () { jumpTo(location.hash.slice(1)); }, 50);
  window.addEventListener('load', request);
  request();
})();
