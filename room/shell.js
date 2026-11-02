// The room itself: architecture, daylight and lighting, and the wall pieces that carry content
// (name sign, welcome note, the pinboard, the window onto campus, the door).
// World: metres, +Y up. Room spans x ∈ [-W/2, W/2], z ∈ [-D/2, D/2], floor y = 0.
// Visitors start a little in front of the middle, facing the back wall (-Z), and the stations run clockwise
// from there: back wall 01–02, right wall 03–05, front wall 06–12, left wall 13–14 and the door (15).
import * as THREE from 'three';
import { Builder, box, cyl, lathe, mat, canvas, tex, rrect, wrapLines } from './kit.js';
import { createCurtain } from './models.js';

export const ROOM = { W: 6.0, D: 5.6, H: 2.8 };
const X0 = -ROOM.W / 2, X1 = ROOM.W / 2, Z0 = -ROOM.D / 2, Z1 = ROOM.D / 2;
// The walls from inside. n points into the room, t runs to your right as you face the wall, and ry turns
// anything built facing +Z (every model, every plane) to face into the room. A spot on a wall is u metres
// along t from its centre, y up, d out into the room.
export const WALLS = {
  back:  { c: [0, Z0], n: [0, 1],  t: [1, 0],  ry: 0,            len: ROOM.W },
  right: { c: [X1, 0], n: [-1, 0], t: [0, 1],  ry: -Math.PI / 2, len: ROOM.D },
  front: { c: [0, Z1], n: [0, -1], t: [-1, 0], ry: Math.PI,      len: ROOM.W },
  left:  { c: [X0, 0], n: [1, 0],  t: [0, -1], ry: Math.PI / 2,  len: ROOM.D },
};
export function onWall(wall, u, y = 0, d = 0, v = new THREE.Vector3()) {
  const w = WALLS[wall]; return v.set(w.c[0] + w.t[0] * u + w.n[0] * d, y, w.c[1] + w.t[1] * u + w.n[1] * d);
}
/** Stand `obj` against a wall (u along it, d out from it), facing into the room. */
export function place(obj, wall, u, y = 0, d = 0, turn = 0) { onWall(wall, u, y, d, obj.position); obj.rotation.y = WALLS[wall].ry + turn; return obj; }
// The openings: the door on the left wall toward the back, the window on the right wall.
export const DOORWAY = { wall: 'left', u: 0.75, w: 0.96, h: 2.08 };
export const WINDOW = { wall: 'right', u: 0.2, y0: 1.0, w: 1.3, h: 1.42, ledge: 0.08 };
const D2R = Math.PI / 180;

// ---------------------------------------------------------------- textures
// value noise, blurred by canvas scaling: cheap, organic
function noise(g, w, h, cells, alpha, light = true) {
  const [n, ng] = canvas(cells, cells);
  const img = ng.createImageData(cells, cells);
  for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  ng.putImageData(img, 0, 0);
  g.save(); g.globalAlpha = alpha; g.globalCompositeOperation = light ? 'overlay' : 'multiply';
  g.imageSmoothingEnabled = true; g.drawImage(n, 0, 0, w, h); g.restore();
}

// White oak boards, random lengths, running front to back. The texture covers 4 m.
function oakTextures(S = 2048) {
  const B = 2048, M = 4, px = B / M, cols = 21, pw = B / cols, k = S / B;
  const [c, g] = canvas(S, S), [r, rg] = canvas(S / 2, S / 2);
  g.setTransform(k, 0, 0, k, 0, 0); rg.setTransform(k, 0, 0, k, 0, 0);
  g.fillStyle = '#b68c60'; g.fillRect(0, 0, B, B);
  rg.fillStyle = '#7a7a7a'; rg.fillRect(0, 0, B / 2, B / 2);
  const plank = (x, y, len) => {
    const l = 53 + Math.random() * 9, h = 30 + Math.random() * 5, s = 22 + Math.random() * 12;
    g.fillStyle = `hsl(${h},${s}%,${l}%)`; g.fillRect(x, y, pw, len);
    for (let k = 0; k < 34; k++) {
      const gx = x + Math.random() * pw, dark = Math.random() < 0.65;
      g.strokeStyle = dark ? `rgba(92,58,28,${0.05 + Math.random() * 0.11})` : `rgba(240,214,170,${0.04 + Math.random() * 0.08})`;
      g.lineWidth = 0.6 + Math.random() * 1.6;
      g.beginPath(); g.moveTo(gx, y);
      g.bezierCurveTo(gx + (Math.random() - 0.5) * 9, y + len * 0.33, gx + (Math.random() - 0.5) * 9, y + len * 0.66, gx + (Math.random() - 0.5) * 6, y + len); g.stroke();
    }
    if (Math.random() < 0.5) {
      const cx = x + pw * (0.3 + Math.random() * 0.4), cy = y + len * Math.random();
      for (let k = 0; k < 6; k++) { g.strokeStyle = `rgba(96,60,30,${0.08 + k * 0.012})`; g.lineWidth = 1.2; g.beginPath(); g.ellipse(cx, cy, 4 + k * 5, 30 + k * 26, 0, 0, Math.PI * 2); g.stroke(); }
    }
    if (Math.random() < 0.12) { g.fillStyle = 'rgba(70,42,20,.55)'; g.beginPath(); g.ellipse(x + pw * Math.random(), y + len * Math.random(), 3 + Math.random() * 4, 6 + Math.random() * 6, 0, 0, Math.PI * 2); g.fill(); }
    const v = 92 + Math.random() * 40;
    rg.fillStyle = `rgb(${v},${v},${v})`; rg.fillRect(x / 2, y / 2, pw / 2, len / 2);
    g.fillStyle = 'rgba(52,32,16,.62)'; g.fillRect(x, y, 2, len); g.fillRect(x, y, pw, 2);
    rg.fillStyle = '#e0e0e0'; rg.fillRect(x / 2, y / 2, 1.5, len / 2); rg.fillRect(x / 2, y / 2, pw / 2, 1.5);
  };
  for (let i = 0; i < cols; i++) {
    let y = -Math.random() * 1.6 * px;
    while (y < B) {
      const len = (0.9 + Math.random() * 1.3) * px;
      plank(i * pw, y, len);
      if (y + len > B) plank(i * pw, y - B, len);
      if (y < 0) plank(i * pw, y + B, len);
      y += len;
    }
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  noise(g, S, S, 512 * k, 0.08); noise(g, S, S, 64, 0.06);
  const rep = [ROOM.W / M, ROOM.D / M];
  return { map: tex(c, { repeat: rep }), rough: tex(r, { repeat: rep, srgb: false }) };
}

// Painted drywall: warm white, a faint roller texture, and soft occlusion at the floor, ceiling and corners.
function wallTexture(w, h) {
  const W = 1024, H = Math.round(1024 * h / w), [c, g] = canvas(W, H);
  g.fillStyle = '#eeebe5'; g.fillRect(0, 0, W, H);
  noise(g, W, H, 96, 0.05); noise(g, W, H, 512, 0.035);
  const ao = (x0, y0, x1, y1, a) => { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, `rgba(70,58,46,${a})`); gr.addColorStop(1, 'rgba(70,58,46,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); };
  const k = W / w;
  ao(0, H, 0, H - 0.35 * k, 0.16); ao(0, 0, 0, 0.4 * k, 0.12); ao(0, 0, 0.45 * k, 0, 0.12); ao(W, 0, W - 0.45 * k, 0, 0.12);
  return tex(c);
}
function ceilingTexture() {
  const [c, g] = canvas(512, 512);
  g.fillStyle = '#f1efea'; g.fillRect(0, 0, 512, 512);
  noise(g, 512, 512, 128, 0.04);
  const gr = g.createRadialGradient(256, 256, 60, 256, 256, 360); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(60,50,40,.16)');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  return tex(c);
}
function corkTexture() {
  const [c, g] = canvas(1024, 640);
  g.fillStyle = '#8a6440'; g.fillRect(0, 0, 1024, 640);
  noise(g, 1024, 640, 128, 0.55); noise(g, 1024, 640, 512, 0.5, false);
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${40 + Math.random() * 40},${25 + Math.random() * 20},10,${Math.random() * 0.35})`; g.fillRect(Math.random() * 1024, Math.random() * 640, 2 + Math.random() * 3, 2 + Math.random() * 3); }
  return tex(c);
}

// ---------------------------------------------------------------- content surfaces
// Wall lettering: solid charcoal with enough weight to survive minification from across the room.
function signTexture() {
  const [c, g] = canvas(2048, 400);
  g.clearRect(0, 0, 2048, 400);
  g.font = '600 118px Archivo, Arial, sans-serif';
  if ('fontStretch' in g) g.fontStretch = 'ultra-expanded';
  g.textBaseline = 'middle'; g.textAlign = 'left';
  g.fillStyle = '#16191e';
  g.fillText('PRANAV DIVICHENCHU', 196, 164);
  // the mark: a lamp. a ring for the diya, an orange flame above it, a blue dot for the night sky it burns in
  g.lineWidth = 12; g.strokeStyle = '#202227'; g.beginPath(); g.arc(78, 196, 40, 0.15 * Math.PI, 0.85 * Math.PI, false); g.stroke();
  g.beginPath(); g.moveTo(40, 214); g.lineTo(116, 214); g.stroke();
  g.fillStyle = '#e6692b'; g.beginPath(); g.moveTo(78, 112); g.bezierCurveTo(108, 142, 100, 176, 78, 182); g.bezierCurveTo(56, 176, 48, 142, 78, 112); g.fill();
  g.fillStyle = '#4fb4ff'; g.beginPath(); g.arc(136, 112, 13, 0, Math.PI * 2); g.fill();
  g.font = '600 46px "JetBrains Mono", ui-monospace, monospace';
  g.fillStyle = '#30343a';
  g.fillText('FOUNDER OF KARANA  ·  COMPUTER SCIENCE AT GEORGIA TECH', 200, 302);
  return tex(c);
}
// wall lettering on the first wall visitors see: what this place is and how to use it
function welcomeTexture(touch) {
  const W = 1600, H = 900, [c, g] = canvas(W, H);
  g.clearRect(0, 0, W, H);
  g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  g.fillStyle = '#e6692b'; g.beginPath(); g.arc(16, 44, 13, 0, Math.PI * 2); g.fill();
  g.font = '600 58px "JetBrains Mono", ui-monospace, monospace'; g.fillStyle = '#30343a';
  g.fillText('WELCOME TO MY STUDIO', 52, 62);
  const text = 'Start at 01 on the left and follow the numbers around the room.';
  if ('fontStretch' in g) g.fontStretch = 'semi-expanded';
  let size = 150, lines;
  for (; size > 70; size -= 4) {
    g.font = `500 ${size}px Archivo, Arial, sans-serif`;
    lines = wrapLines(g, text, W - 8);
    if (lines.length <= 3) break;
  }
  g.fillStyle = '#16191e';
  lines.forEach((l, i) => g.fillText(l, 0, 110 + size + i * size * 1.06));
  const y = 110 + size + (lines.length - 1) * size * 1.06 + 120;
  g.font = '600 44px "JetBrains Mono", ui-monospace, monospace'; g.fillStyle = '#30343a';
  g.fillText((touch ? 'SWIPE TO TURN' : 'DRAG TO TURN') + '  ·  ' + (touch ? 'TAP A NUMBER' : 'CLICK A NUMBER') + '  ·  OR START THE TOUR', 0, y);
  return tex(c);
}

// ---------------------------------------------------------------- the view out of the window
// Late afternoon over Georgia Tech: the lawn, Tech Tower with its sign, trees, and Midtown's towers in the haze.
function atlantaView() {
  const W = 2048, H = 1024, [c, g] = canvas(W, H);
  let seed = 7; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  const horizon = H * 0.56;
  // sky: deeper overhead, pale at the horizon, brighter toward the sun
  const sg = g.createLinearGradient(0, 0, 0, horizon);
  sg.addColorStop(0, '#5b97d2'); sg.addColorStop(0.5, '#8dbbe4'); sg.addColorStop(0.85, '#c3dbee'); sg.addColorStop(1, '#e4ecf1');
  g.fillStyle = sg; g.fillRect(0, 0, W, H);
  { const sx = W * 0.3, sy = H * 0.16, sr = 520, gl = g.createRadialGradient(sx, sy, 0, sx, sy, sr);
    gl.addColorStop(0, 'rgba(255,250,235,.7)'); gl.addColorStop(1, 'rgba(255,250,235,0)'); g.fillStyle = gl; g.fillRect(0, 0, W, H); }
  // fair-weather clouds, smaller toward the horizon
  for (let i = 0; i < 26; i++) {
    const y = H * (0.06 + Math.pow(rnd(), 1.5) * 0.42), x = rnd() * W, s = (30 + rnd() * 70) * (0.35 + (1 - y / horizon));
    for (let j = 0; j < 7; j++) {
      const cx = x + (rnd() - 0.5) * s * 3, cy = y - rnd() * s * 0.6, r = s * (0.45 + rnd() * 0.6);
      const cg = g.createRadialGradient(cx, cy, 0, cx, cy, r); cg.addColorStop(0, 'rgba(255,255,255,.8)'); cg.addColorStop(0.6, 'rgba(250,251,253,.42)'); cg.addColorStop(1, 'rgba(245,248,252,0)');
      g.fillStyle = cg; g.beginPath(); g.ellipse(cx, cy, r * 1.4, r * 0.8, 0, 0, Math.PI * 2); g.fill();
    }
  }
  // Midtown in the haze: a row of towers, the tallest near the middle
  const haze = (rgb, k) => `rgb(${rgb.map(v => Math.round(v + (205 - v) * k)).join(',')})`;
  const towers = [[0.05, 0.09, 0.07], [0.13, 0.12, 0.05], [0.2, 0.17, 0.04], [0.26, 0.11, 0.06], [0.34, 0.22, 0.045], [0.4, 0.15, 0.05], [0.47, 0.3, 0.05], [0.53, 0.19, 0.04], [0.6, 0.26, 0.06], [0.68, 0.13, 0.05], [0.75, 0.21, 0.045], [0.83, 0.1, 0.06], [0.9, 0.16, 0.05], [0.97, 0.08, 0.07]];
  for (const [x, h, w] of towers) {
    const px = x * W, ph = h * H, pw = w * W, k = 0.55 + rnd() * 0.15;
    g.fillStyle = haze([74, 86, 104], k); g.fillRect(px - pw / 2, horizon - ph, pw, ph + 10);
    g.fillStyle = haze([120, 132, 150], k); g.fillRect(px - pw / 2, horizon - ph, pw * 0.3, ph + 10);
    if (h > 0.2) { g.fillStyle = haze([74, 86, 104], k); g.fillRect(px - 4, horizon - ph - ph * 0.3, 8, ph * 0.3); }   // a spire on the tall ones
    for (let yy = horizon - ph + 14; yy < horizon; yy += 16) for (let xx = px - pw / 2 + 6; xx < px + pw / 2 - 4; xx += 12) { g.fillStyle = `rgba(230,238,246,${0.35 + rnd() * 0.3})`; g.fillRect(xx, yy, 5, 7); }
  }
  // a far tree line
  for (let x = 0; x < W; x += 10 + rnd() * 14) { const r = 18 + rnd() * 26; g.fillStyle = haze([62, 96, 58], 0.45 + rnd() * 0.1); g.beginPath(); g.ellipse(x, horizon + 4, r, r * 0.6, 0, 0, Math.PI * 2); g.fill(); }
  // the lawn, with a walkway curving across it
  const lg = g.createLinearGradient(0, horizon, 0, H); lg.addColorStop(0, '#7d9c57'); lg.addColorStop(1, '#5b7a3d');
  g.fillStyle = lg; g.fillRect(0, horizon, W, H - horizon);
  g.strokeStyle = '#d9d2c3'; g.lineWidth = 34; g.beginPath(); g.moveTo(W * 0.1, H); g.quadraticCurveTo(W * 0.5, horizon + 120, W * 0.95, horizon + 70); g.stroke();
  // Tech Tower: red brick, limestone trim, the little tower on top with its sign
  const tx = W * 0.3, ty = horizon + 8, tw = 260, th = 230;
  g.fillStyle = '#8f3a2b'; g.fillRect(tx - tw / 2, ty - th, tw, th);
  g.fillStyle = '#a84a36'; g.fillRect(tx - tw / 2, ty - th, tw * 0.28, th);
  g.fillStyle = '#e5dcc8'; g.fillRect(tx - tw / 2 - 6, ty - th - 10, tw + 12, 10);
  for (let r = 0; r < 4; r++) for (let cI = 0; cI < 7; cI++) { g.fillStyle = '#2b2f36'; g.fillRect(tx - tw / 2 + 16 + cI * 35, ty - th + 22 + r * 50, 16, 30); }
  const sw = 110, sh = 170, sx = tx - sw / 2, sy = ty - th - sh;
  g.fillStyle = '#8f3a2b'; g.fillRect(sx, sy, sw, sh);
  g.fillStyle = '#e5dcc8'; g.fillRect(sx - 4, sy - 8, sw + 8, 8);
  g.fillStyle = '#6e7a86'; g.beginPath(); g.moveTo(sx - 6, sy - 8); g.lineTo(tx, sy - 70); g.lineTo(sx + sw + 6, sy - 8); g.closePath(); g.fill();
  g.fillStyle = '#1a1d22'; g.fillRect(sx + 20, sy + 20, sw - 40, 30);
  g.fillStyle = '#f2b23d'; g.font = '700 26px Archivo, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('TECH', tx, sy + 35); g.textAlign = 'left';
  // trees in front, bigger nearer: a trunk, a layered canopy, and a soft shadow on the lawn
  const treeAt = (x, y, s) => {
    g.fillStyle = 'rgba(40,60,30,.28)'; g.beginPath(); g.ellipse(x + s * 0.3, y + s * 0.05, s * 0.6, s * 0.14, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#5a3a24'; g.fillRect(x - s * 0.05, y - s * 0.55, s * 0.1, s * 0.6);
    for (let j = 0; j < 5; j++) {
      const k = j / 4, r = s * (0.5 - k * 0.22), cy = y - s * (0.55 + k * 0.5), cx = x + (j % 2 ? -1 : 1) * s * 0.1 * (1 - k);
      g.fillStyle = `hsl(${108 + j * 5},${40 + j * 3}%,${26 + j * 5}%)`; g.beginPath(); g.ellipse(cx, cy, r, r * 0.85, 0, 0, Math.PI * 2); g.fill();
    }
  };
  const treeSpots = [];
  for (let i = 0; i < 14; i++) { const d = rnd(); treeSpots.push([rnd() * W, horizon + 30 + d * (H - horizon - 80), 40 + d * 120]); }
  treeSpots.sort((a, b) => a[1] - b[1]).forEach(([x, y, s]) => treeAt(x, y, s));
  noise(g, W, H, 256, 0.05);
  return tex(c);
}
// a bright, blurry outdoors for the doorway: the Atlanta sky and a path, seen from inside
function outsideTexture() {
  const [c, g] = canvas(512, 512);
  const sg = g.createLinearGradient(0, 0, 0, 512); sg.addColorStop(0, '#a9cdee'); sg.addColorStop(0.5, '#e9f0f3'); sg.addColorStop(0.6, '#a9c27f'); sg.addColorStop(1, '#6f8f4e');
  g.fillStyle = sg; g.fillRect(0, 0, 512, 512);
  const gl = g.createRadialGradient(256, 190, 20, 256, 190, 300); gl.addColorStop(0, 'rgba(255,250,235,.95)'); gl.addColorStop(1, 'rgba(255,250,235,0)');
  g.fillStyle = gl; g.fillRect(0, 0, 512, 512);
  return tex(c);
}
function lightPatchTexture() {
  const [c, g] = canvas(256, 256);
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(255,240,210,0)'); gr.addColorStop(0.5, 'rgba(255,240,210,.65)'); gr.addColorStop(1, 'rgba(255,240,210,.9)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  return tex(c);
}

function wallGeometry(len, { notches = [], holes = [] } = {}) {
  const H = ROOM.H, s = new THREE.Shape();
  s.moveTo(-len / 2, 0);
  for (const n of [...notches].sort((a, b) => a.x - b.x)) { s.lineTo(n.x - n.w / 2, 0); s.lineTo(n.x - n.w / 2, n.h); s.lineTo(n.x + n.w / 2, n.h); s.lineTo(n.x + n.w / 2, 0); }
  s.lineTo(len / 2, 0); s.lineTo(len / 2, H); s.lineTo(-len / 2, H); s.closePath();
  for (const o of holes) {
    const p = new THREE.Path(), x0 = o.x - o.w / 2, x1 = o.x + o.w / 2, y0 = o.y0, y1 = o.y0 + o.h;
    p.moveTo(x0, y0); p.lineTo(x0, y1); p.lineTo(x1, y1); p.lineTo(x1, y0); p.closePath(); s.holes.push(p);
  }
  const g = new THREE.ShapeGeometry(s);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + len / 2) / len, pos.getY(i) / H);
  return g;
}

/** A soft contact shadow on the floor under something. */
export function blob(w, d, opacity = 0.35) {
  const [c, g] = canvas(128, 128);
  const gr = g.createRadialGradient(64, 64, 10, 64, 64, 64); gr.addColorStop(0, `rgba(30,22,16,${opacity})`); gr.addColorStop(1, 'rgba(30,22,16,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.5, d * 1.5), new THREE.MeshBasicMaterial({ map: tex(c), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.002; m.renderOrder = 1;
  return m;
}

// ---------------------------------------------------------------- the room
export function buildShell(scene, { tier = 'high', touch = false, door = null } = {}) {
  const out = { anchors: {} };
  const hi = tier === 'high';
  // a group standing on a wall, so what's inside it can be built facing +Z with the wall at z = 0
  const onto = (wall, u, y = 0, d = 0) => { const g = new THREE.Group(); place(g, wall, u, y, d); scene.add(g); return g; };

  // ---------- floor, walls, ceiling
  const oak = oakTextures(hi ? 2048 : 1024);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.W, ROOM.D), new THREE.MeshStandardMaterial({ map: oak.map, roughnessMap: oak.rough, roughness: 1, metalness: 0, envMapIntensity: 0.9 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const wallMat = (w) => new THREE.MeshStandardMaterial({ map: wallTexture(w, ROOM.H), roughness: 0.93, metalness: 0 });
  const openings = {
    [DOORWAY.wall]: { notches: [{ x: DOORWAY.u, w: DOORWAY.w, h: DOORWAY.h }] },
    [WINDOW.wall]: { holes: [{ x: WINDOW.u, y0: WINDOW.y0, w: WINDOW.w, h: WINDOW.h }] },
  };
  for (const [k, w] of Object.entries(WALLS)) {
    const mesh = place(new THREE.Mesh(wallGeometry(w.len, openings[k]), wallMat(w.len)), k, 0);
    mesh.receiveShadow = true; mesh.castShadow = true; mesh.layers.set(2); scene.add(mesh);
  }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.W, ROOM.D), new THREE.MeshStandardMaterial({ map: ceilingTexture(), roughness: 0.95, emissive: 0x6b6762 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = ROOM.H; ceil.castShadow = true; ceil.layers.set(2); scene.add(ceil);

  // painted baseboards, with a gap for the door
  const trim = new Builder('trim');
  const bb = (wall, u0, u1) => trim.add(box(u1 - u0, 0.11, 0.016, 0.003), 'plasticWhite', { position: onWall(wall, (u0 + u1) / 2, 0.055, 0.008).toArray(), rotation: [0, WALLS[wall].ry, 0] });
  for (const [k, w] of Object.entries(WALLS)) {
    if (k !== DOORWAY.wall) { bb(k, -w.len / 2, w.len / 2); continue; }
    bb(k, -w.len / 2, DOORWAY.u - DOORWAY.w / 2 - 0.075); bb(k, DOORWAY.u + DOORWAY.w / 2 + 0.075, w.len / 2);
  }
  scene.add(trim.build());

  // ---------- the window (right wall): deep white reveals, a slim black frame, a ledge, and campus beyond
  const win = onto(WINDOW.wall, WINDOW.u);
  {
    const { y0, w, h, ledge } = WINDOW, D = 0.14, fz = -0.09, t = new Builder('window');
    t.add(box(w, 0.012, D), 'plasticWhite', { position: [0, y0 + h - 0.006, -D / 2] });
    t.add(box(0.012, h, D), 'plasticWhite', { position: [-w / 2 + 0.006, y0 + h / 2, -D / 2] });
    t.add(box(0.012, h, D), 'plasticWhite', { position: [w / 2 - 0.006, y0 + h / 2, -D / 2] });
    t.add(box(w, 0.045, 0.05, 0.004), 'blackMetal', { position: [0, y0 + h - 0.022, fz] });
    t.add(box(w, 0.045, 0.05, 0.004), 'blackMetal', { position: [0, y0 + 0.022, fz] });
    t.add(box(0.045, h, 0.05, 0.004), 'blackMetal', { position: [-w / 2 + 0.022, y0 + h / 2, fz] });
    t.add(box(0.045, h, 0.05, 0.004), 'blackMetal', { position: [w / 2 - 0.022, y0 + h / 2, fz] });
    t.add(box(0.035, h, 0.04, 0.003), 'blackMetal', { position: [0, y0 + h / 2, fz] });
    t.add(box(w, 0.035, 0.04, 0.003), 'blackMetal', { position: [0, y0 + 0.42, fz] });
    win.add(t.build());
    const sill = new Builder('windowLedge');
    sill.add(box(w + 0.16, 0.04, D + ledge, 0.006), 'plasticWhite', { position: [0, y0 - 0.02, (ledge - D) / 2] });
    sill.add(box(w + 0.16, 0.07, 0.018, 0.004), 'plasticWhite', { position: [0, y0 - 0.075, ledge - 0.012] });
    out.ledge = sill.build(); win.add(out.ledge);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat('glass')); glass.position.set(0, y0 + h / 2, fz + 0.005); win.add(glass);
    // the view: a big bright plane well past the glass, so it slides as you move (campus, not a poster)
    const view = new THREE.Mesh(new THREE.PlaneGeometry(w * 3.2, w * 1.6), new THREE.MeshBasicMaterial({ map: atlantaView(), toneMapped: false }));
    view.position.set(-0.2, y0 + h / 2 + 0.1, -0.9); win.add(view);
    const rod = new Builder('curtainRod');
    rod.add(cyl(0.011, 0.011, w + 0.9, 20), 'brass', { position: [0, y0 + h + 0.16, 0.09], rotation: [0, 0, Math.PI / 2] });
    for (const s of [-1, 1]) { rod.add(cyl(0.02, 0.02, 0.03, 20), 'brass', { position: [s * (w / 2 + 0.47), y0 + h + 0.16, 0.09], rotation: [0, 0, Math.PI / 2] }); rod.add(cyl(0.006, 0.006, 0.09, 10), 'brass', { position: [s * (w / 2 + 0.3), y0 + h + 0.16, 0.045], rotation: [Math.PI / 2, 0, 0] }); }
    win.add(rod.build());
    for (const s of [-1, 1]) { const c = createCurtain(0.34, y0 + h + 0.15 - 0.66); c.position.set(s * (w / 2 + 0.24), y0 + h + 0.15, 0.095); win.add(c); }
  }

  // ---------- light. Everything is static, so the two shadow maps are drawn once (main.js), not every frame:
  // a soft fill from the sky, a key light just under the ceiling for the contact shadows, the sun through the
  // window, the window's skylight, and five accent spots that pool light on the walls.
  scene.add(new THREE.HemisphereLight(0xf6f3ee, 0xb7a58e, hi ? 0.8 : 1.05));
  {
    const key = new THREE.DirectionalLight(0xfff3e4, hi ? 0.95 : 1.15);
    key.position.set(0.5, ROOM.H - 0.08, 0.7); key.target.position.set(0, 0, 0);
    key.castShadow = true; key.shadow.mapSize.set(hi ? 2048 : 1024, hi ? 2048 : 1024);
    const sc = key.shadow.camera; sc.left = -3.4; sc.right = 3.4; sc.top = 3.4; sc.bottom = -3.4; sc.near = 0.02; sc.far = 4;
    key.shadow.bias = -0.0005; key.shadow.normalBias = 0.025; key.shadow.radius = 5; key.shadow.blurSamples = 16;
    scene.add(key, key.target); out.key = key;
  }
  {
    const c = onWall(WINDOW.wall, WINDOW.u, WINDOW.y0 + WINDOW.h / 2);
    const n = WALLS[WINDOW.wall].n, outward = new THREE.Vector3(-n[0], 0, -n[1]);
    const toSun = outward.clone().multiplyScalar(Math.cos(34 * D2R)).add(new THREE.Vector3(0, Math.sin(34 * D2R), 0)).add(new THREE.Vector3(0, 0, -0.35)).normalize();
    const sun = new THREE.SpotLight(0xfff0dc, 3.6, 0, 0.11, 0.25, 0);
    sun.position.copy(c).addScaledVector(toSun, 14); sun.target.position.copy(c).addScaledVector(toSun, -2);
    sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4;
    sun.shadow.camera.near = 11; sun.shadow.camera.far = 22; sun.shadow.camera.layers.enable(2);   // the walls block it, so it only comes in through the glass
    scene.add(sun, sun.target); out.sun = sun;
    const sky = new THREE.SpotLight(0xcfe0ff, 5, 9, 1.25, 1, 2);
    onWall(WINDOW.wall, WINDOW.u, WINDOW.y0 + WINDOW.h - 0.05, 0.04, sky.position); onWall(WINDOW.wall, WINDOW.u - 0.25, 0, 3.0, sky.target.position);
    scene.add(sky, sky.target);
  }
  function spot(at, to, intensity, angle = 0.55) {
    const l = new THREE.SpotLight(0xffe2c0, intensity, 0, angle, 0.85, 2);
    l.position.set(...at); l.target.position.set(...to); scene.add(l, l.target); return l;
  }
  const T = ROOM.H - 0.12;
  spot([-1.75, T, -1.75], [-1.75, 0.8, Z0], 7.5, 0.6);       // Karana
  spot([1.6, T, -1.75], [1.6, 1.45, Z0], 6.5, 0.55);         // the whiteboard
  spot([2.0, T, -1.75], [X1, 1.35, -1.75], 6, 0.55);         // Cloud9
  spot([1.2, T, 1.75], [1.2, 1.3, Z1], 7, 0.75);             // the workstation and the trophies
  spot([-2.0, T, 1.4], [X0, 0.9, 1.4], 6, 0.6);              // the school

  // ---------- the one ceiling fixture: a pendant with an opal globe, centred in the room
  {
    const H = ROOM.H, fix = new Builder('pendant');
    fix.add(cyl(0.05, 0.075, 0.04, 32), 'blackMetal', { position: [0, H - 0.02, 0] });
    fix.add(cyl(0.004, 0.004, 0.42, 8), 'blackMetal', { position: [0, H - 0.24, 0] });
    fix.add(lathe([[0, 0], [0.06, 0], [0.07, 0.02], [0.04, 0.05]], 32), 'blackMetal', { position: [0, H - 0.5, 0] });
    const bowlMat = new THREE.MeshStandardMaterial({ name: 'pendant:opal', color: 0xf3eee6, roughness: 0.55, emissive: 0xffe6c4, emissiveIntensity: 2.2 });
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.12, 40, 24), bowlMat);
    fix.object(bowl, { position: [0, H - 0.6, 0] });
    scene.add(fix.build());

  }

  // ---------- the door (left wall, toward the back: the last stop) and the daylight waiting behind it
  {
    const g = onto(DOORWAY.wall, DOORWAY.u);
    const outsideMat = new THREE.MeshBasicMaterial({ map: outsideTexture(), toneMapped: false, side: THREE.BackSide });
    const outside = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.4, 2.4), outsideMat);
    outside.position.set(0, 1.5, -1.32); g.add(outside);
    if (door) g.add(door);
    const glow = new THREE.SpotLight(0xfff1dc, 0, 8, 1.15, 1, 2);
    glow.position.set(0, DOORWAY.h - 0.05, 0.04); glow.target.position.set(0.2, 0, 2.6); g.add(glow, glow.target);
    const patchMat = new THREE.MeshBasicMaterial({ map: lightPatchTexture(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const pg = new THREE.BufferGeometry();
    const near = DOORWAY.w * 0.46, far = DOORWAY.w * 0.78, len = 2.1;
    pg.setAttribute('position', new THREE.Float32BufferAttribute([-near, 0, 0, near, 0, 0, -far, 0, -len, far, 0, -len], 3));
    pg.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 0, 0, 1, 0], 2));
    pg.setIndex([0, 1, 2, 1, 3, 2]);
    const patch = new THREE.Mesh(pg, patchMat); patch.position.set(-0.12, 0.003, 0); patch.rotation.y = Math.PI + 0.08; patch.renderOrder = 2; g.add(patch);
    out.door = { outsideMat, glow, patchMat, group: g };
    out.anchors.contact = onWall(DOORWAY.wall, DOORWAY.u + 0.05, 1.55, 0.2);
  }

  // ---------- name sign and the welcome note: the first wall, centred
  {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.508), new THREE.MeshBasicMaterial({ map: signTexture(), transparent: true, toneMapped: false, depthWrite: false }));
    place(sign, 'back', 0.0, 2.3, 0.005); sign.renderOrder = 1; scene.add(sign);
    const w = 1.22, h = w * 900 / 1600;
    const note = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: welcomeTexture(touch), transparent: true, toneMapped: false, depthWrite: false }));
    place(note, 'back', -0.35, 1.62, 0.004); note.renderOrder = 1; scene.add(note);
  }

  // ---------- 09: pinboard, "more projects" (front wall, over the side table)
  {
    const bw = 1.3, bh = 0.8, g = onto('front', 0.25, 1.85, 0.03);
    const frame = new Builder('pinboardFrame');
    for (const [x, y, w, h] of [[0, bh / 2 + 0.02, bw + 0.08, 0.04], [0, -bh / 2 - 0.02, bw + 0.08, 0.04], [-bw / 2 - 0.02, 0, 0.04, bh], [bw / 2 + 0.02, 0, 0.04, bh]]) frame.add(box(w, h, 0.034, 0.006, 3), 'walnut', { position: [x, y, 0.005] });
    frame.add(box(bw, bh, 0.01), 'woodDark', { position: [0, 0, 0.005] });
    g.add(frame.build());
    const cork = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), new THREE.MeshStandardMaterial({ map: corkTexture(), roughness: 1 }));
    cork.position.set(0, 0, 0.0145); cork.receiveShadow = true; g.add(cork);
    g.name = 'pinboard';
    out.pinboard = { group: g, center: new THREE.Vector3(0, 0, 0.02), w: bw, h: bh };
    out.anchors.more = onWall('front', 0.25 - 0.38, 2.32, 0.2);
  }

  // ---------- wool rug in the middle, where visitors stand
  {
    const [c, g] = canvas(512, 512);
    g.fillStyle = '#cfc6b8'; g.fillRect(0, 0, 512, 512); noise(g, 512, 512, 512, 0.3); noise(g, 512, 512, 128, 0.15);
    g.strokeStyle = 'rgba(60,52,44,.35)'; g.lineWidth = 10; g.strokeRect(20, 20, 472, 472);
    g.strokeStyle = 'rgba(230,105,43,.5)'; g.lineWidth = 3; g.strokeRect(36, 36, 440, 440);
    const rug = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.01, 1.5), [mat('fabric'), mat('fabric'), new THREE.MeshStandardMaterial({ map: tex(c), roughness: 1 }), mat('fabric'), mat('fabric'), mat('fabric')]);
    rug.position.set(-0.2, 0.005, 0.35); rug.receiveShadow = true; scene.add(rug);
  }

  return out;
}

/** Polaroid-style cards pinned to the cork, each a canvas composed from a project image + caption. */
export async function pinCards(board, items) {
  const { center, w, h } = board;
  const loads = items.map(it => it.src ? new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = it.src; }) : Promise.resolve(null));
  const imgs = await Promise.all(loads);
  items.forEach((it, i) => {
    const im = imgs[i];
    const cw = 420, chh = it.note ? 420 : 380;
    const [c, g] = canvas(cw, chh);
    if (it.note) {
      g.fillStyle = '#f7d154'; g.fillRect(0, 0, cw, chh);
      g.fillStyle = 'rgba(0,0,0,.05)'; g.fillRect(0, 0, cw, 36);
      g.fillStyle = '#1b1d22'; g.textBaseline = 'top';
      g.font = '700 30px "JetBrains Mono", ui-monospace, monospace'; g.fillText(it.kicker || 'MORE', 34, 58);
      g.font = '600 54px Archivo, Arial, sans-serif';
      let y = 118; for (const l of wrapLines(g, it.note, cw - 68)) { g.fillText(l, 34, y); y += 60; }
      g.fillStyle = '#c8321a'; g.font = '700 40px Archivo, Arial, sans-serif'; g.fillText('→', cw - 80, chh - 80);
    } else {
      g.fillStyle = '#f3f1ec'; g.fillRect(0, 0, cw, chh);
      const iw = cw - 36, ih = 280;
      if (im) {
        const s = Math.max(iw / im.width, ih / im.height), dw = im.width * s, dh = im.height * s;
        g.save(); g.beginPath(); g.rect(18, 18, iw, ih); g.clip();
        g.fillStyle = it.dark ? '#111' : '#ddd'; g.fillRect(18, 18, iw, ih);
        g.drawImage(im, 18 + (iw - dw) / 2, 18, dw, dh); g.restore();
      } else if (it.draw) { g.save(); g.beginPath(); g.rect(18, 18, iw, ih); g.clip(); g.translate(18, 18); it.draw(g, iw, ih); g.restore(); }
      g.fillStyle = '#1b1d22'; g.font = '600 34px Archivo, Arial, sans-serif'; g.textBaseline = 'middle'; g.fillText(it.title, 22, 336);
      if (it.sub) { g.fillStyle = '#6b6f76'; g.font = '500 20px "JetBrains Mono", ui-monospace, monospace'; g.textAlign = 'right'; g.fillText(it.sub, cw - 22, 338); g.textAlign = 'left'; }
    }
    const t = tex(c);
    const sc = it.note ? 0.36 : 0.3;
    const card = new THREE.Mesh(new THREE.PlaneGeometry(sc, sc * chh / cw), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 }));
    card.position.set(center.x + it.x * w / 2, center.y + it.y * h / 2, center.z + 0.004 + i * 0.0015);
    card.rotation.z = it.r || 0; card.castShadow = true; card.receiveShadow = true;
    board.group.add(card);
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.011, 12, 8), mat(it.note ? 'accentBlue' : 'accentOrange'));
    pin.position.set(card.position.x + Math.sin(-card.rotation.z) * 0.1, card.position.y + (sc * chh / cw) / 2 - 0.02, card.position.z + 0.01);
    pin.castShadow = true; board.group.add(pin);
  });
}
