// The things in the room, built from primitives. Every model faces +Z and sits on y = 0 at its footprint centre
// (wall pieces have their back on the wall at z = 0). Names on parts are what main.js looks up to animate them
// or paint their screens.
import { THREE, Builder, box, cyl, sphere, torus, cone, capsule, lathe, extrude, panel, tube, leafGeometry, mat, canvas, tex, rng, rrect, wrapLines, screenPlane, paintedPlane } from './kit.js';

const TAU = Math.PI * 2;
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const SANS = 'Archivo, system-ui, -apple-system, Arial, sans-serif';
function blank(w, h, name) { const s = screenPlane(w, h, null); s.material.color.set(0x0a0b0d); s.name = name; return s; }
function glowSprite(size, rgb = '255,186,100', name) {
  const [c, g] = canvas(128, 128), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, `rgba(${rgb},.85)`); gr.addColorStop(0.25, `rgba(${rgb},.35)`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(c), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, transparent: true }));
  s.scale.set(size, size, 1); if (name) s.name = name; return s;
}
/** a thin cylinder from p to q */
function rod(b, p, q, r, material, seg = 10) {
  const a = new THREE.Vector3(...p), c = new THREE.Vector3(...q), d = c.clone().sub(a), l = d.length();
  const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  b.add(cyl(r, r, l, seg), material, { position: a.add(c).multiplyScalar(0.5).toArray(), rotation: [e.x, e.y, e.z] });
}

// ---------------------------------------------------------------- shared furniture and objects
function desk(b, { w, h, d, top = 'walnut', frame = 'blackMetal' }) {
  const t = 0.032, s = 0.036, fx = w / 2 - 0.07, fz = d / 2 - 0.06;
  b.add(box(w, t, d, 0.01, 3), top, { position: [0, h - t / 2, 0] });
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) b.add(box(s, h - t - 0.012, s, 0.004), frame, { position: [sx * fx, (h - t - 0.012) / 2, sz * fz] });
    b.add(box(s, s * 0.7, 2 * fz + s, 0.004), frame, { position: [sx * fx, h - t - s * 0.35 - 0.012, 0] });
    b.add(box(s * 1.05, s * 0.7, 2 * fz + s * 1.6, 0.004), frame, { position: [sx * fx, s * 0.35, 0] });
    for (const sz of [-1, 1]) b.add(cyl(0.014, 0.014, 0.006, 14), 'rubber', { position: [sx * fx, 0.003, sz * (fz + s * 0.6)] });
  }
  b.add(box(2 * fx, s * 0.7, s, 0.004), frame, { position: [0, h - t - s * 0.35 - 0.012, -fz] });
}
function officeChair(p, fabric = 'fabric') {
  for (let i = 0; i < 5; i++) {
    const a = i * TAU / 5;
    p.add(box(0.29, 0.024, 0.042, 0.01, 3), 'chrome', { position: [Math.cos(a) * 0.145, 0.07, Math.sin(a) * 0.145], rotation: [0, -a, -0.08] });
    p.add(cyl(0.007, 0.007, 0.03, 8), 'chrome', { position: [Math.cos(a) * 0.285, 0.05, Math.sin(a) * 0.285] });
    p.add(sphere(0.024, 14, 10).scale(0.62, 1, 1), 'plasticBlack', { position: [Math.cos(a) * 0.285, 0.024, Math.sin(a) * 0.285], rotation: [0, -a + Math.PI / 2, 0] });
  }
  p.add(cyl(0.04, 0.05, 0.05, 20), 'plasticBlack', { position: [0, 0.075, 0] });
  p.add(cyl(0.022, 0.022, 0.3, 16), 'chrome', { position: [0, 0.25, 0] });
  p.add(box(0.2, 0.04, 0.22, 0.01), 'plasticBlack', { position: [0, 0.405, 0] });
  p.add(box(0.5, 0.075, 0.48, 0.032, 4), fabric, { position: [0, 0.46, 0.01] });
  p.add(box(0.46, 0.03, 0.44, 0.012, 3), 'plasticBlack', { position: [0, 0.42, 0.01] });
  // back: a shell and a cushion, leaning back, on a spine from the seat
  p.add(box(0.06, 0.26, 0.03, 0.01), 'plasticBlack', { position: [0, 0.52, -0.24], rotation: [-0.1, 0, 0] });
  p.add(box(0.46, 0.56, 0.045, 0.03, 4), 'plasticBlack', { position: [0, 0.86, -0.27], rotation: [-0.12, 0, 0] });
  p.add(box(0.42, 0.5, 0.04, 0.03, 4), fabric, { position: [0, 0.86, -0.243], rotation: [-0.12, 0, 0] });
  for (const s of [-1, 1]) {
    p.add(box(0.026, 0.2, 0.05, 0.008), 'plasticBlack', { position: [s * 0.255, 0.56, -0.02] });
    p.add(box(0.07, 0.026, 0.25, 0.012, 3), 'plasticBlack', { position: [s * 0.255, 0.672, 0.0] });
  }
}
function laptop(p, screenName) {
  const W = 0.304, D = 0.212;
  p.add(box(W, 0.0115, D, 0.005, 3), 'spaceGrey', { position: [0, 0.00575, 0] });
  p.add(box(W - 0.024, 0.0006, 0.118, 0.002, 1), 'blackMetal', { position: [0, 0.0116, -0.033] });
  for (let r = 0; r < 5; r++) for (let c = 0; c < 14; c++) {
    if (r === 4 && c >= 4 && c <= 9) continue;
    p.add(box(0.0158, 0.0011, 0.0154, 0.0025, 1), 'plasticBlack', { position: [-0.1205 + c * 0.0185, 0.0121, -0.0835 + r * 0.0193] });
  }
  p.add(box(0.108, 0.0011, 0.0154, 0.0025, 1), 'plasticBlack', { position: [0.0, 0.0121, -0.0835 + 4 * 0.0193] });
  p.add(box(0.13, 0.0004, 0.08, 0.004, 1), 'aluminumDark', { position: [0, 0.0117, 0.058] });
  const lid = p.part('laptopLid', { position: [0, 0.0115, -D / 2 + 0.003], rotation: [-0.3, 0, 0] });
  lid.add(box(W, 0.205, 0.0055, 0.005, 3), 'spaceGrey', { position: [0, 0.1025, 0] });
  lid.add(box(W - 0.005, 0.2, 0.0006), 'glassBlack', { position: [0, 0.1025, 0.0029] });
  lid.object(blank(0.284, 0.178, screenName), { position: [0, 0.106, 0.0034] });
  lid.add(box(0.03, 0.006, 0.0004, 0.002, 1), 'plasticBlack', { position: [0, 0.1985, 0.0034] });
}
function phone(p, screenName) {
  const W = 0.0716, H = 0.1476, D = 0.0078;
  p.add(panel(W, H, D, 0.011), 'spaceGrey', { position: [0, H / 2, 0] });
  p.add(panel(W - 0.0014, H - 0.0014, 0.0004, 0.0104), 'glassBlack', { position: [0, H / 2, D / 2 + 0.0002] });
  p.object(blank(W - 0.0055, H - 0.0055, screenName), { position: [0, H / 2, D / 2 + 0.0006] });
  p.add(box(0.019, 0.0055, 0.0004, 0.0027, 1), 'plasticBlack', { position: [0, H - 0.0105, D / 2 + 0.0009] });
  p.add(panel(0.034, 0.034, 0.0022, 0.008), 'glassBlack', { position: [-W / 2 + 0.021, H - 0.022, -D / 2 - 0.0011] });
  for (const [x, y] of [[-0.009, 0.008], [-0.009, -0.008], [0.008, 0]]) p.add(cyl(0.0058, 0.0058, 0.0028, 20), 'blackMetal', { position: [-W / 2 + 0.021 + x, H - 0.022 + y, -D / 2 - 0.0024], rotation: [Math.PI / 2, 0, 0] });
}
function mug(p, material = 'ceramic', band) {
  p.add(lathe([[0, 0], [0.036, 0], [0.039, 0.006], [0.04, 0.092], [0.037, 0.094], [0.036, 0.012], [0, 0.012]], 36), material);
  p.add(torus(0.024, 0.0065, 10, 24, Math.PI), material, { position: [0.04, 0.05, 0], rotation: [0, 0, -Math.PI / 2] });
  p.add(cyl(0.035, 0.035, 0.004, 32), 'woodDark', { position: [0, 0.08, 0] });
  if (band) p.add(cyl(0.0402, 0.0402, 0.018, 36, true), band, { position: [0, 0.05, 0] });
}
function pottedPlant(p, { r = 0.045, h = 0.07, leaves = 7, size = 0.08, pot = 'ceramic', kind = 'rosette' } = {}) {
  p.add(lathe([[0, 0], [r * 0.8, 0], [r, h * 0.92], [r * 1.05, h], [r * 0.95, h], [r * 0.88, h * 0.6], [0, h * 0.6]], 32), pot);
  p.add(cyl(r * 0.9, r * 0.9, 0.004, 24), 'soil', { position: [0, h * 0.92, 0] });
  const R = rng(leaves * 7 + 3);
  for (let i = 0; i < leaves; i++) {
    const a = i * 2.4, tilt = kind === 'tall' ? 0.08 + R() * 0.2 : 0.5 + R() * 0.5, l = size * (0.7 + R() * 0.6);
    const g = kind === 'tall' ? leafGeometry(l * 2.4, l * 0.28, 0.08, 0.2) : leafGeometry(l, l * 0.6, 0.35, 0.6);
    p.add(g, i % 2 ? 'leaf' : 'leafDark', { position: [Math.cos(a) * r * 0.25, h * 0.92, Math.sin(a) * r * 0.25], rotation: [tilt, -a + Math.PI / 2, 0], order: 'YXZ' });
  }
}
function book(p, x, y, z, w, h, d, material, tilt = 0, band) {
  p.add(box(w, h, d, 0.0025, 2), material, { position: [x, y + h / 2, z], rotation: [0, 0, tilt] });
  p.add(box(w - 0.004, 0.0012, d - 0.012), 'paper', { position: [x - Math.sin(tilt) * h / 2, y + h * Math.cos(tilt) + 0.0004, z - 0.004], rotation: [0, 0, tilt] });
  if (band) for (const k of [0.15, 0.85]) p.add(box(w + 0.0008, 0.006, 0.002), band, { position: [x - Math.sin(tilt) * h * k, y + h * k * Math.cos(tilt), z + d / 2 + 0.0004], rotation: [0, 0, tilt] });
}
function plaqueTexture(text, bg = '#1b1d22', fg = '#e9d9a6') {
  const [c, g] = canvas(512, 96); g.fillStyle = bg; g.fillRect(0, 0, 512, 96);
  g.strokeStyle = fg; g.globalAlpha = 0.5; g.lineWidth = 3; g.strokeRect(8, 8, 496, 80); g.globalAlpha = 1;
  g.fillStyle = fg; g.font = `700 34px ${MONO}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 50);
  return tex(c);
}

// ---------------------------------------------------------------- 01 Karana: the desk, the laptop, the phone on its stand, the diya
export function createKaranaDesk() {
  const W = 1.4, H = 0.75, D = 0.7, b = new Builder('karanaDesk');
  desk(b, { w: W, h: H, d: D, top: 'walnut' });
  b.add(box(0.86, 0.003, 0.38, 0.014, 2), 'felt', { position: [-0.12, H + 0.0015, 0.06] });
  const lap = b.part('laptop', { position: [-0.24, H + 0.003, 0.02], rotation: [0, 0.12, 0] }); laptop(lap, 'laptopScreen');
  // the phone, leaning on a stand
  const st = b.part('phoneStand', { position: [0.27, H, -0.07], rotation: [0, -0.24, 0] });
  st.add(cyl(0.045, 0.047, 0.009, 48), 'aluminum', { position: [0, 0.0045, 0] });
  const ph = st.part('phone', { position: [0, 0.016, 0.012], rotation: [-0.24, 0, 0] });
  phone(ph, 'phoneScreen');
  ph.add(box(0.012, 0.13, 0.006, 0.003), 'aluminum', { position: [0, 0.045, -0.0075] });
  ph.add(cyl(0.028, 0.028, 0.004, 32), 'aluminum', { position: [0, 0.085, -0.0062], rotation: [Math.PI / 2, 0, 0] });
  ph.add(box(0.05, 0.008, 0.016, 0.003), 'aluminum', { position: [0, -0.002, 0.003] });
  st.add(box(0.012, 0.03, 0.006, 0.003), 'aluminum', { position: [0, 0.014, -0.012] });
  // a brass diya, lit
  const dy = b.part('diya', { position: [0.55, H + 0.003, 0.17], rotation: [0, -0.5, 0] });
  dy.add(lathe([[0, 0], [0.028, 0], [0.04, 0.004], [0.05, 0.014], [0.052, 0.024], [0.047, 0.027], [0.04, 0.016], [0.02, 0.012], [0, 0.012]], 48), 'brass', { scale: [1.18, 1, 1] });
  dy.add(cyl(0.035, 0.04, 0.002, 32), 'copper', { position: [0, 0.019, 0], scale: [1.18, 1, 1] });
  dy.add(cone(0.014, 0.05, 16), 'brass', { position: [0.072, 0.021, 0], rotation: [0, 0, -Math.PI / 2 + 0.25], scale: [1, 1, 0.55] });
  dy.add(cyl(0.0016, 0.0016, 0.02, 6), 'woodDark', { position: [0.084, 0.03, 0], rotation: [0, 0, -0.9] });
  const fl = dy.part('flame', { position: [0.09, 0.033, 0] });
  fl.add(lathe([[0, 0], [0.0055, 0.004], [0.0065, 0.011], [0.0045, 0.019], [0, 0.03]], 18), 'flame');
  fl.add(lathe([[0, 0.001], [0.003, 0.004], [0.0034, 0.009], [0.002, 0.014], [0, 0.019]], 14), 'flameCore', { position: [0, 0, 0.0005] });
  dy.object(glowSprite(0.16, '255,170,80', 'flameGlow'), { position: [0.09, 0.05, 0] });
  // notebook and pen, a mug, earbuds, a succulent
  const nb = b.part('notebook', { position: [0.04, H + 0.003, 0.22], rotation: [0, 0.35, 0] });
  nb.add(box(0.15, 0.0016, 0.21, 0.004, 1), 'accentOrange', { position: [0, 0.0008, 0] });
  nb.add(box(0.146, 0.0094, 0.205), 'paper', { position: [0.0018, 0.0063, 0] });
  nb.add(box(0.15, 0.0016, 0.21, 0.004, 1), 'accentOrange', { position: [0, 0.0118, 0] });
  nb.add(box(0.003, 0.0126, 0.21, 0.0012, 1), 'accentOrange', { position: [-0.0745, 0.0063, 0] });
  nb.add(box(0.004, 0.0132, 0.2102), 'plasticBlack', { position: [0.056, 0.0063, 0] });
  const pen = b.part('pen', { position: [0.2, H + 0.0045, 0.26], rotation: [0, -0.4, 0] });
  pen.add(cyl(0.0045, 0.0045, 0.12, 14), 'navy', { rotation: [0, 0, Math.PI / 2] });
  pen.add(cone(0.0045, 0.016, 14), 'gold', { position: [0.068, 0, 0], rotation: [0, 0, -Math.PI / 2] });
  pen.add(box(0.04, 0.0015, 0.003), 'gold', { position: [-0.035, 0.0048, 0] });
  mug(b.part('mug', { position: [-0.6, H + 0.003, 0.18], rotation: [0, 2.2, 0] }), 'ceramicDark');
  b.add(box(0.046, 0.021, 0.054, 0.01, 4), 'plasticWhite', { position: [0.4, H + 0.0105, 0.03], rotation: [0, 0.6, 0] });
  pottedPlant(b.part('succulent', { position: [-0.6, H, -0.22] }), { r: 0.045, h: 0.075, leaves: 11, size: 0.05, pot: 'terracotta' });
  b.add(tube([[-0.36, H + 0.004, -0.04], [-0.45, H + 0.003, -0.2], [-0.38, H + 0.002, -0.33], [-0.3, H - 0.1, -0.35]], 0.0025, 40, 6), 'plasticWhite');
  officeChair(b.part('chair', { position: [-0.42, 0, 0.62], rotation: [0, 0.75, 0] }), 'fabric');
  return b.build();
}

// a navy backpack, leaning against something
export function createBackpack() {
  const b = new Builder('backpack');
  b.add(box(0.3, 0.42, 0.15, 0.06, 4), 'techNavy', { position: [0, 0.22, 0] });
  b.add(box(0.24, 0.18, 0.06, 0.03, 4), 'techNavy', { position: [0, 0.14, 0.08] });
  b.add(box(0.22, 0.004, 0.004), 'techGold', { position: [0, 0.225, 0.111] });
  b.add(box(0.24, 0.004, 0.004), 'techGold', { position: [0, 0.39, 0.06], rotation: [0.6, 0, 0] });
  b.add(box(0.05, 0.05, 0.004, 0.006), 'techGold', { position: [0.07, 0.17, 0.112] });
  b.add(torus(0.035, 0.007, 8, 20, Math.PI), 'plasticBlack', { position: [0, 0.43, -0.02], rotation: [0, 0, 0] });
  for (const s of [-1, 1]) b.add(tube([[s * 0.08, 0.4, -0.07], [s * 0.1, 0.25, -0.1], [s * 0.1, 0.05, -0.08]], 0.012, 20, 8), 'plasticBlack');
  return b.build();
}

// a framed print: wood frame, paper mount, the art lit by the room
export function createFrame(w, h, map, { border = 0.022, depth = 0.026, frame = 'walnut', mount = 0.05, name = 'frameArt' } = {}) {
  const b = new Builder('frame');
  b.add(box(w, border, depth, 0.003), frame, { position: [0, h / 2 - border / 2, depth / 2] });
  b.add(box(w, border, depth, 0.003), frame, { position: [0, -h / 2 + border / 2, depth / 2] });
  b.add(box(border, h, depth, 0.003), frame, { position: [-w / 2 + border / 2, 0, depth / 2] });
  b.add(box(border, h, depth, 0.003), frame, { position: [w / 2 - border / 2, 0, depth / 2] });
  b.add(box(w - 2 * border, h - 2 * border, 0.006), 'paper', { position: [0, 0, 0.006] });
  const art = screenPlane(w - 2 * border - 2 * mount, h - 2 * border - 2 * mount, map, { lit: true }); art.name = name;
  b.object(art, { position: [0, 0, 0.0095] });
  return b.build();
}

// ---------------------------------------------------------------- 02 FHIR: a wall whiteboard. main.js draws the diagram on 'boardFace'.
export function createWhiteboard(w = 1.5, h = 1.0) {
  const b = new Builder('whiteboard'), f = 0.02;
  b.add(box(w + 2 * f, f, 0.024, 0.005), 'aluminum', { position: [0, h / 2 + f / 2, 0.012] });
  b.add(box(w + 2 * f, f, 0.024, 0.005), 'aluminum', { position: [0, -h / 2 - f / 2, 0.012] });
  b.add(box(f, h, 0.024, 0.005), 'aluminum', { position: [-w / 2 - f / 2, 0, 0.012] });
  b.add(box(f, h, 0.024, 0.005), 'aluminum', { position: [w / 2 + f / 2, 0, 0.012] });
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) b.add(box(0.034, 0.034, 0.028, 0.008, 3), 'plasticGrey', { position: [sx * (w / 2 + f / 2), sy * (h / 2 + f / 2), 0.014] });
  b.add(box(w, h, 0.01), 'plasticWhite', { position: [0, 0, 0.005] });
  const face = screenPlane(w, h, null, { lit: true }); face.material.roughness = 0.35; face.name = 'boardFace';
  b.object(face, { position: [0, 0, 0.0102] });
  // tray, markers, eraser
  b.add(box(0.72, 0.01, 0.065, 0.003), 'aluminum', { position: [0, -h / 2 - f - 0.02, 0.035] });
  b.add(box(0.72, 0.02, 0.006, 0.002), 'aluminum', { position: [0, -h / 2 - f - 0.012, 0.067] });
  const marker = (x, color) => {
    b.add(cyl(0.0075, 0.0075, 0.1, 16), 'plasticWhite', { position: [x, -h / 2 - f - 0.007, 0.04], rotation: [0, 0, Math.PI / 2] });
    b.add(cyl(0.0085, 0.0085, 0.036, 16), color, { position: [x + 0.065, -h / 2 - f - 0.007, 0.04], rotation: [0, 0, Math.PI / 2] });
    b.add(box(0.03, 0.002, 0.004), color, { position: [x + 0.065, -h / 2 - f + 0.002, 0.04] });
  };
  marker(-0.28, 'accentOrange'); marker(-0.12, 'accentBlue'); marker(0.02, 'plasticBlack');
  b.add(box(0.12, 0.024, 0.05, 0.008, 3), 'oak', { position: [0.24, -h / 2 - f - 0.002, 0.038] });
  b.add(box(0.118, 0.008, 0.048, 0.002), 'felt', { position: [0.24, -h / 2 - f - 0.018, 0.038] });
  // magnets and sticky notes, top right
  [['accentOrange', -w / 2 + 0.04, h / 2 - 0.04], ['accentBlue', w / 2 - 0.04, -h / 2 + 0.04]].forEach(([m, x, y]) => b.add(cyl(0.012, 0.012, 0.01, 20), m, { position: [x, y, 0.016], rotation: [Math.PI / 2, 0, 0] }));
  [['#ffe27a', 0.55, 0.39, -0.06, ['Epic next', 'JWKS from', 'teammate']], ['#ffb3c7', 0.66, 0.36, 0.05, ['ship', 'meds tab']], ['#a9dcff', 0.44, 0.41, 0.03, ['scopes', 'x6 ✓']]].forEach(([col, x, y, r, lines]) => {
    const note = paintedPlane(0.085, 0.085, 192, (g, W, H) => {
      g.fillStyle = col; g.fillRect(0, 0, W, H); g.fillStyle = 'rgba(0,0,0,.06)'; g.fillRect(0, 0, W, 22);
      g.fillStyle = '#26282d'; g.font = `600 26px ${SANS}`; lines.forEach((l, i) => g.fillText(l, 14, 62 + i * 34));
    });
    note.rotation.z = r; b.object(note, { position: [x, y, 0.0125 + x * 0.001] });
  });
  return b.build();
}

// ---------------------------------------------------------------- 03 Cloud9: a wall display ('tvScreen'), a neon sign, a shelf with a cloud lamp
export function createCloudWall() {
  const b = new Builder('cloud9Wall'), w = 1.1, h = 0.62;
  b.add(box(0.36, 0.24, 0.034, 0.005), 'blackMetal', { position: [0, 0, 0.017] });
  b.add(box(w + 0.02, h + 0.02, 0.024, 0.008, 3), 'blackMetal', { position: [0, 0, 0.046] });
  b.add(box(w + 0.008, h + 0.008, 0.001), 'glassBlack', { position: [0, 0, 0.0585] });
  b.object(blank(w, h, 'tvScreen'), { position: [0, 0, 0.0592] });
  b.add(box(0.008, 0.003, 0.003), 'ledBlue', { position: [w / 2 - 0.03, -h / 2 - 0.006, 0.058] });
  // neon above
  const [c, g] = canvas(1024, 300);
  g.font = `italic 600 190px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = '#57b6ff'; g.shadowBlur = 40; g.fillStyle = '#d8efff';
  for (let i = 0; i < 3; i++) g.fillText('cloud9', 512, 150);
  g.shadowBlur = 0; g.fillStyle = '#ffffff'; g.fillText('cloud9', 512, 150);
  const neon = screenPlane(0.66, 0.19, tex(c), { transparent: true }); neon.material.depthWrite = false; neon.renderOrder = 2; neon.name = 'neon';
  b.object(neon, { position: [0, h / 2 + 0.27, 0.032] });
  b.add(box(0.7, 0.22, 0.006, 0.01), 'glass', { position: [0, h / 2 + 0.27, 0.024] });
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) b.add(cyl(0.007, 0.007, 0.022, 12), 'chrome', { position: [sx * 0.32, h / 2 + 0.27 + sy * 0.085, 0.012], rotation: [Math.PI / 2, 0, 0] });
  // floating shelf with a cloud lamp and a snake plant
  const sy = -h / 2 - 0.38;
  b.add(box(0.72, 0.032, 0.22, 0.006, 3), 'walnut', { position: [0, sy, 0.11] });
  const cl = b.part('cloudLamp', { position: [-0.14, sy + 0.016, 0.11] });
  cl.add(box(0.2, 0.012, 0.07, 0.005), 'plasticWhite', { position: [0, 0.006, 0] });
  for (const [x, y, r] of [[0, 0.07, 0.062], [0.07, 0.055, 0.05], [-0.07, 0.05, 0.047], [0.035, 0.105, 0.048], [-0.035, 0.1, 0.044], [0.105, 0.04, 0.035], [-0.105, 0.035, 0.032]]) cl.add(sphere(r, 24, 16), 'cloudGlow', { position: [x, y, 0], scale: [1, 1, 0.72] });
  cl.object(glowSprite(0.42, '220,236,255'), { position: [0, 0.07, 0.02] });
  pottedPlant(b.part('snakePlant', { position: [0.22, sy + 0.016, 0.1] }), { r: 0.05, h: 0.1, leaves: 8, size: 0.09, pot: 'ceramicDark', kind: 'tall' });
  b.add(box(0.07, 0.022, 0.05, 0.006), 'plasticWhite', { position: [0.05, sy + 0.027, 0.1] });
  for (let k = 0; k < 3; k++) b.add(box(0.004, 0.002, 0.002), 'ledBlue', { position: [0.03 + k * 0.012, sy + 0.032, 0.126] });
  return b.build();
}

// ---------------------------------------------------------------- 04 Politheon: a credenza under the window, a model of the Capitol, a stack of bills
export function createCredenza(w = 1.2, h = 0.6, d = 0.42) {
  const b = new Builder('credenza'), legH = 0.15, bh = h - legH, dw = (w - 0.04) / 3;
  b.add(box(w, bh, d, 0.012, 3), 'walnut', { position: [0, legH + bh / 2, 0] });
  for (let i = 0; i < 3; i++) {
    const cx = -w / 2 + 0.02 + dw * (i + 0.5);
    b.add(box(dw - 0.008, bh - 0.05, 0.006, 0.002), 'woodDark', { position: [cx, legH + bh / 2, d / 2 + 0.002] });
    const n = Math.floor((dw - 0.03) / 0.021);
    for (let k = 0; k < n; k++) b.add(box(0.012, bh - 0.07, 0.008, 0.003), 'oak', { position: [cx - (n - 1) * 0.0105 + k * 0.021, legH + bh / 2, d / 2 + 0.008] });
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.add(cyl(0.018, 0.011, legH, 16), 'walnut', { position: [sx * (w / 2 - 0.07), legH / 2, sz * (d / 2 - 0.07)], rotation: [sz * -0.06, 0, sx * 0.06] });
    b.add(cyl(0.0115, 0.0115, 0.025, 14), 'brass', { position: [sx * (w / 2 - 0.066), 0.0125, sz * (d / 2 - 0.066)] });
  }
  return b.build();
}
export function createCapitol() {
  const b = new Builder('capitol'), M = 'marble', C = 'plasticCream', base = 0.046;
  b.add(box(0.64, 0.03, 0.3, 0.006), 'walnut', { position: [0, 0.015, 0] });
  b.add(box(0.58, 0.016, 0.25, 0.003), M, { position: [0, 0.038, 0] });
  for (const s of [-1, 1]) {
    const cx = s * 0.19;
    b.add(box(0.17, 0.075, 0.13), C, { position: [cx, base + 0.0375, -0.01] });
    b.add(box(0.178, 0.008, 0.138), M, { position: [cx, base + 0.079, -0.01] });
    b.add(box(0.172, 0.006, 0.132), M, { position: [cx, base + 0.004, -0.01] });
    for (let i = 0; i < 6; i++) b.add(cyl(0.0042, 0.0046, 0.066, 10), M, { position: [cx - 0.065 + i * 0.026, base + 0.04, 0.061] });
    for (let i = 0; i < 5; i++) for (let r = 0; r < 2; r++) b.add(box(0.011, 0.017, 0.002), 'plasticGrey', { position: [cx - 0.052 + i * 0.026, base + 0.024 + r * 0.03, 0.0555] });
  }
  b.add(box(0.2, 0.1, 0.17), C, { position: [0, base + 0.05, 0] });
  for (let i = 0; i < 8; i++) b.add(cyl(0.0052, 0.0058, 0.088, 12), M, { position: [-0.084 + i * 0.024, base + 0.048, 0.1] });
  b.add(box(0.212, 0.012, 0.042), M, { position: [0, base + 0.098, 0.094] });
  const ped = new THREE.Shape(); ped.moveTo(-0.106, 0); ped.lineTo(0.106, 0); ped.lineTo(0, 0.034); ped.closePath();
  b.add(extrude(ped, 0.042), M, { position: [0, base + 0.104, 0.094] });
  b.add(box(0.21, 0.006, 0.17), M, { position: [0, base + 0.103, 0] });
  const y0 = base + 0.106;
  b.add(cyl(0.074, 0.078, 0.02, 48), M, { position: [0, y0 + 0.01, 0] });
  b.add(cyl(0.059, 0.061, 0.06, 48), C, { position: [0, y0 + 0.05, 0] });
  for (let i = 0; i < 24; i++) { const a = i * TAU / 24; b.add(cyl(0.0034, 0.0036, 0.056, 8), M, { position: [Math.cos(a) * 0.068, y0 + 0.048, Math.sin(a) * 0.068] }); }
  b.add(cyl(0.075, 0.075, 0.008, 48), M, { position: [0, y0 + 0.08, 0] });
  b.add(cyl(0.055, 0.058, 0.03, 48), C, { position: [0, y0 + 0.099, 0] });
  for (let i = 0; i < 16; i++) { const a = i * TAU / 16; b.add(box(0.008, 0.026, 0.002), 'plasticGrey', { position: [Math.cos(a) * 0.0565, y0 + 0.1, Math.sin(a) * 0.0565], rotation: [0, -a + Math.PI / 2, 0] }); }
  const dome = []; for (let i = 0; i <= 16; i++) { const a = i / 16 * Math.PI / 2; dome.push([Math.cos(a) * 0.056, Math.sin(a) * 0.075]); }
  b.add(lathe(dome, 48), M, { position: [0, y0 + 0.114, 0] });
  for (let i = 0; i < 16; i++) { const a = i * TAU / 16, pts = []; for (let k = 0; k <= 8; k++) { const t = k / 8 * Math.PI / 2 * 0.92; pts.push([Math.cos(a) * Math.cos(t) * 0.0568, y0 + 0.114 + Math.sin(t) * 0.0758, Math.sin(a) * Math.cos(t) * 0.0568]); } b.add(tube(pts, 0.0012, 10, 4), C); }
  b.add(cyl(0.012, 0.014, 0.028, 20), M, { position: [0, y0 + 0.2, 0] });
  for (let i = 0; i < 8; i++) { const a = i * TAU / 8; b.add(cyl(0.0016, 0.0016, 0.024, 6), C, { position: [Math.cos(a) * 0.0145, y0 + 0.2, Math.sin(a) * 0.0145] }); }
  b.add(cone(0.016, 0.02, 20), M, { position: [0, y0 + 0.224, 0] });
  b.add(cyl(0.0025, 0.0035, 0.026, 8), 'brass', { position: [0, y0 + 0.246, 0] });
  b.add(sphere(0.0045, 10, 8), 'brass', { position: [0, y0 + 0.262, 0] });
  const pl = screenPlane(0.16, 0.022, plaqueTexture('BILL PASSAGE · LightGBM'), { lit: true }); pl.material.metalness = 0.4; pl.material.roughness = 0.4;
  b.object(pl, { position: [0, 0.015, 0.1505] });
  return b.build();
}
export function createBills() {
  const b = new Builder('bills');
  for (let i = 0; i < 6; i++) b.add(box(0.215, 0.0018, 0.28), 'paper', { position: [i * 0.003, 0.0009 + i * 0.0018, -i * 0.002], rotation: [0, (i - 3) * 0.035, 0] });
  const top = paintedPlane(0.215, 0.28, 600, (g, W, H) => {
    g.fillStyle = '#f6f3ec'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#1b1d22'; g.textAlign = 'center';
    g.font = `500 20px ${MONO}`; g.fillText('IN THE HOUSE OF REPRESENTATIVES', W / 2, 60);
    g.font = `700 64px Georgia, serif`; g.fillText('A BILL', W / 2, 150);
    g.font = `italic 24px Georgia, serif`; g.fillText('Will it pass? Ask the model.', W / 2, 196);
    g.fillRect(60, 220, W - 120, 2);
    g.fillStyle = '#9a958b'; for (let y = 260; y < H - 120; y += 22) g.fillRect(60, y, (W - 120) * (0.6 + ((y * 37) % 40) / 100), 7);
    g.save(); g.translate(W - 150, H - 140); g.rotate(-0.25); g.strokeStyle = '#c9372c'; g.lineWidth = 6; g.strokeRect(-110, -40, 220, 80);
    g.fillStyle = '#c9372c'; g.font = `700 30px ${MONO}`; g.fillText('83% MACRO F1', 0, 12); g.restore();
  });
  top.rotation.x = -Math.PI / 2; top.position.set(0.015, 0.0114, -0.01); top.rotation.z = 0.035;
  b.object(top);
  b.add(torus(0.008, 0.0012, 6, 20), 'silver', { position: [-0.08, 0.0125, -0.13], rotation: [Math.PI / 2, 0, 0.3], scale: [1, 2.2, 1] });
  return b.build();
}

// ---------------------------------------------------------------- 05 Mizzou: an easel with the research poster
export function createEasel() {
  const b = new Builder('easel'), W = 'oak';
  const fr = b.part('easelFrame', { position: [0, 0, 0.1], rotation: [-0.12, 0, 0] });
  for (const s of [-1, 1]) fr.add(box(0.034, 1.78, 0.024, 0.004), W, { position: [s * 0.19, 0.89, 0], rotation: [0, 0, s * 0.13] });
  fr.add(box(0.03, 1.6, 0.02, 0.004), W, { position: [0, 0.98, -0.012] });
  fr.add(box(0.74, 0.03, 0.08, 0.005), W, { position: [0, 0.6, 0.03] });
  fr.add(box(0.74, 0.04, 0.008, 0.002), W, { position: [0, 0.622, 0.068] });
  fr.add(box(0.26, 0.032, 0.03, 0.004), W, { position: [0, 1.63, 0.0] });
  fr.add(box(0.07, 0.05, 0.04, 0.006), W, { position: [0, 1.56, 0.03] });
  fr.add(cyl(0.008, 0.008, 0.05, 12), 'brass', { position: [0.05, 1.56, 0.03], rotation: [0, 0, Math.PI / 2] });
  fr.add(box(0.66, 0.9, 0.01), 'plasticWhite', { position: [0, 1.085, 0.03] });
  const poster = paintedPlane(0.64, 0.88, 1100, drawPoster); poster.name = 'posterFace';
  fr.object(poster, { position: [0, 1.085, 0.0356] });
  b.add(box(0.03, 1.72, 0.024, 0.004), W, { position: [0, 0.83, -0.32], rotation: [0.3, 0, 0] });
  b.add(box(0.02, 0.02, 0.4, 0.003), W, { position: [0, 0.55, -0.12], rotation: [0.05, 0, 0] });
  return b.build();
}
function drawPoster(g, W, H) {
  g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#16171a'; g.fillRect(0, 0, W, 210);
  g.fillStyle = '#f1b82d'; g.fillRect(0, 210, W, 14);
  g.fillStyle = '#f1b82d'; g.font = `700 26px ${MONO}`; g.fillText('RESEARCH · TRULASKE COLLEGE OF BUSINESS · UNIVERSITY OF MISSOURI', 50, 60);
  g.fillStyle = '#ffffff'; g.font = `700 70px ${SANS}`; g.fillText('Reading the news to trade', 50, 140);
  g.fillStyle = '#c9c9c9'; g.font = `500 28px ${SANS}`; g.fillText('Daily news sentiment, per security, as a trading signal', 50, 190);
  const col = (x, y, title, lines, color = '#16171a') => {
    g.fillStyle = color; g.font = `700 30px ${SANS}`; g.fillText(title, x, y);
    g.fillStyle = '#3a3c42'; g.font = `400 24px ${SANS}`; lines.forEach((l, i) => g.fillText(l, x, y + 40 + i * 32));
  };
  col(50, 290, '1 · Data', ['13M+ news articles,', 'matched to securities', 'by day.']);
  col(400, 290, '2 · Scoring', ['FinBERT, finance', 'lexicons, and an LLM', 'score every article.']);
  col(750, 290, '3 · Signal', ['Sentiment aggregated', 'per security, per day,', 'into a trading signal.']);
  // the chart: an illustration of growth to 1.5x
  const cx = 50, cy = 500, cw = W - 100, ch = 520;
  g.fillStyle = '#f2efe6'; g.fillRect(cx, cy, cw, ch);
  g.strokeStyle = '#d6d1c4'; g.lineWidth = 2; for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(cx, cy + ch * i / 5); g.lineTo(cx + cw, cy + ch * i / 5); g.stroke(); }
  const line = (k, color, wv, seed) => { g.strokeStyle = color; g.lineWidth = wv; g.beginPath(); for (let i = 0; i <= 120; i++) { const t = i / 120, v = 1 + (k - 1) * Math.pow(t, 1.2) + Math.sin(i * 0.7 + seed) * 0.02 + Math.sin(i * 0.23 + seed) * 0.03; const x = cx + 20 + t * (cw - 40), y = cy + ch - 30 - (v - 0.9) / 0.75 * (ch - 60); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); };
  line(1.12, '#9a9a9a', 4, 1);
  line(1.5, '#d18a00', 7, 3);
  g.fillStyle = '#d18a00'; g.font = `700 64px ${SANS}`; g.fillText('1.5×', cx + cw - 190, cy + 90);
  g.fillStyle = '#5a5c62'; g.font = `500 22px ${MONO}`; g.fillText('BACKTEST', cx + cw - 190, cy + 124); g.fillText('STRATEGY', cx + 30, cy + 44);
  g.fillStyle = '#9a9a9a'; g.fillText('BENCHMARK', cx + cw - 200, cy + ch - 140);
  // results
  const stat = (x, v, l) => { g.fillStyle = '#16171a'; g.font = `300 86px ${SANS}`; g.fillText(v, x, 1150); g.fillStyle = '#5a5c62'; g.font = `500 22px ${MONO}`; g.fillText(l, x, 1186); };
  stat(50, '13M+', 'ARTICLES SCORED'); stat(390, '60%', 'SIGNAL ACCURACY'); stat(700, '1.5×', 'GROWTH IN BACKTESTS');
  g.fillStyle = '#16171a'; g.fillRect(0, H - 150, W, 150);
  g.fillStyle = '#f1b82d'; g.font = `700 26px ${MONO}`; g.fillText('CO-AUTHORED', 50, H - 96);
  g.fillStyle = '#ffffff'; g.font = `500 30px ${SANS}`; g.fillText('A Journal of Finance submission with Prof. Kuntara Pukthuanthong', 50, H - 52);
}
export function createNewspaperStack() {
  const b = new Builder('papers');
  for (let i = 0; i < 9; i++) b.add(box(0.3, 0.008, 0.4, 0.002), 'newsprint', { position: [Math.sin(i * 1.7) * 0.012, 0.004 + i * 0.008, Math.cos(i * 2.3) * 0.01], rotation: [0, Math.sin(i) * 0.08, 0] });
  const top = paintedPlane(0.3, 0.4, 480, (g, W, H) => {
    g.fillStyle = '#e4dfd3'; g.fillRect(0, 0, W, H); g.fillStyle = '#1b1d22'; g.textAlign = 'center';
    g.font = `700 64px Georgia, serif`; g.fillText('MARKETS', W / 2, 80); g.fillRect(24, 100, W - 48, 3);
    g.font = `700 30px Georgia, serif`; g.fillText('Sentiment moves stocks', W / 2, 150);
    g.fillStyle = '#9a958b'; for (let y = 190; y < H - 30; y += 16) for (const [x0, w] of [[24, 200], [256, 200]]) g.fillRect(x0, y, w * (0.7 + ((y * 13) % 30) / 100), 6);
  });
  top.rotation.x = -Math.PI / 2; top.position.y = 0.0725; b.object(top);
  return b.build();
}

// ---------------------------------------------------------------- 06 B2Alpha: a server rack, 'rackLeds' blink
export function createRack() {
  const W = 0.6, H = 1.42, D = 0.7, b = new Builder('rack');
  b.add(box(W, 0.04, D, 0.01, 3), 'blackMetal', { position: [0, H - 0.02, 0] });
  b.add(box(W, 0.07, D, 0.01, 3), 'blackMetal', { position: [0, 0.085, 0] });
  for (const s of [-1, 1]) b.add(box(0.02, H - 0.12, D - 0.02, 0.004), 'plasticBlack', { position: [s * (W / 2 - 0.01), H / 2 + 0.03, 0] });
  b.add(box(W - 0.04, H - 0.12, 0.01), 'plasticBlack', { position: [0, H / 2 + 0.03, -D / 2 + 0.005] });
  for (const s of [-1, 1]) b.add(box(0.026, H - 0.12, 0.03, 0.003), 'aluminumDark', { position: [s * (W / 2 - 0.036), H / 2 + 0.03, D / 2 - 0.03] });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { b.add(box(0.05, 0.02, 0.05, 0.004), 'steel', { position: [sx * (W / 2 - 0.06), 0.045, sz * (D / 2 - 0.06)] }); b.add(sphere(0.022, 14, 10), 'rubber', { position: [sx * (W / 2 - 0.06), 0.022, sz * (D / 2 - 0.06)] }); }
  for (let k = 0; k < 9; k++) b.add(box(0.44, 0.004, 0.006), 'plasticGrey', { position: [0, H - 0.002, -0.25 + k * 0.06] });
  const units = 12, u0 = 0.16, uh = 0.0445, gap = 0.01, leds = [];
  for (let i = 0; i < units; i++) {
    const y = u0 + i * (uh + gap) + uh / 2, kind = i % 4, z = D / 2 - 0.02;
    b.add(box(W - 0.07, uh, 0.02, 0.003), kind === 1 ? 'aluminumDark' : 'plasticGrey', { position: [0, y, z] });
    for (const s of [-1, 1]) {
      b.add(box(0.022, uh, 0.004, 0.001), 'aluminum', { position: [s * (W / 2 - 0.036), y, D / 2 - 0.007] });
      b.add(cyl(0.003, 0.003, 0.003, 8), 'steel', { position: [s * (W / 2 - 0.036), y, D / 2 - 0.004], rotation: [Math.PI / 2, 0, 0] });
      b.add(box(0.008, uh - 0.014, 0.012, 0.003), 'aluminum', { position: [s * (W / 2 - 0.068), y, z + 0.016] });
    }
    if (kind === 0) for (let k = 0; k < 8; k++) b.add(box(0.026, uh - 0.016, 0.004, 0.001), 'plasticBlack', { position: [-0.15 + k * 0.034, y, z + 0.011] });
    else if (kind === 2) for (let k = 0; k < 12; k++) b.add(box(0.013, 0.01, 0.004, 0.001), 'plasticBlack', { position: [-0.045 + k * 0.0185, y + 0.007, z + 0.011] });
    else for (let k = 0; k < 18; k++) b.add(box(0.0022, uh - 0.018, 0.003), 'plasticBlack', { position: [-0.16 + k * 0.0125, y, z + 0.011] });
    for (let k = 0; k < 3; k++) leds.push([-0.215 + k * 0.014, y + 0.008, z + 0.0115, [0x3ddc84, 0x4fb4ff, 0xffb347][k]]);
  }
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.007, 0.004, 0.003), new THREE.MeshBasicMaterial({ toneMapped: false }), leds.length);
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  leds.forEach((l, i) => { im.setMatrixAt(i, m4.makeTranslation(l[0], l[1], l[2])); im.setColorAt(i, col.set(l[3])); });
  im.name = 'rackLeds'; im.frustumCulled = false; im.castShadow = false;
  im.userData.base = leds.map(l => new THREE.Color(l[3])); im.userData.blink = leds.map(() => [Math.random() * 10, 1.5 + Math.random() * 7, Math.random() < 0.25]);
  b.object(im);
  for (let i = 0; i < 6; i++) {
    const x0 = -0.03 + i * 0.019, y0 = u0 + 2 * (uh + gap) + uh / 2 + 0.007, y1 = y0 - 0.12 - i * 0.05;
    b.add(tube([[x0, y0, D / 2 + 0.002], [x0 - 0.02, (y0 + y1) / 2, D / 2 + 0.05], [0.24, y1, D / 2 + 0.02], [0.27, y1 - 0.02, D / 2 - 0.02]], 0.0028, 24, 6), ['accentBlue', 'accentOrange', 'plasticWhite'][i % 3]);
  }
  const [c, g] = canvas(512, 128); g.fillStyle = '#15171b'; g.fillRect(0, 0, 512, 128);
  g.fillStyle = '#4fb4ff'; g.beginPath(); g.arc(40, 64, 12, 0, TAU); g.fill();
  g.fillStyle = '#ecebe6'; g.font = `700 42px ${MONO}`; g.textBaseline = 'middle'; g.fillText('B2ALPHA · RELAY', 70, 66);
  b.object(screenPlane(0.44, 0.11, tex(c), { lit: true }), { position: [0, H - 0.1, D / 2 + 0.002] });
  b.add(box(0.48, 0.13, 0.012, 0.004), 'plasticBlack', { position: [0, H - 0.1, D / 2 - 0.006] });
  return b.build();
}

// ---------------------------------------------------------------- 07/08 the trophy shelf over the workstation (and the bread, for 12)
function trophy(p, metal, label, h = 0.15) {
  p.add(box(0.13, 0.036, 0.13, 0.006, 3), 'walnut', { position: [0, 0.018, 0] });
  p.add(box(0.1, 0.042, 0.1, 0.004, 3), 'marble', { position: [0, 0.057, 0] });
  p.add(lathe([[0.034, 0], [0.032, 0.006], [0.014, 0.012], [0.009, 0.03], [0.015, 0.042], [0.009, 0.05], [0.008, 0.07], [0.022, 0.082]], 40), metal, { position: [0, 0.078, 0] });
  const y = 0.158;
  p.add(lathe([[0, 0], [0.022, 0.002], [0.04, 0.016], [0.052, 0.046], [0.058, 0.09], [0.062, h * 0.82], [0.064, h * 0.84], [0.059, h * 0.84], [0.054, 0.09], [0.046, 0.05], [0.022, 0.022], [0, 0.02]], 56), metal, { position: [0, y, 0] });
  for (const s of [-1, 1]) p.add(tube([[s * 0.05, y + 0.04, 0], [s * 0.085, y + 0.045, 0], [s * 0.095, y + 0.08, 0], [s * 0.075, y + 0.112, 0], [s * 0.058, y + 0.11, 0]], 0.0055, 32, 10), metal);
  const pl = screenPlane(0.1, 0.022, plaqueTexture(label), { lit: true }); pl.material.metalness = 0.5; pl.material.roughness = 0.35;
  p.object(pl, { position: [0, 0.018, 0.0655] });
  return y + h * 0.84;
}
export function createTrophyShelf() {
  const b = new Builder('trophyShelf'), W = 1.3, D = 0.24, ys = [1.66, 2.06];
  for (const y of ys) {
    b.add(box(W, 0.032, D, 0.006, 3), 'walnut', { position: [0, y, D / 2] });
    for (const x of [-W / 2 + 0.14, W / 2 - 0.14]) { b.add(box(0.026, 0.026, D - 0.03, 0.003), 'blackMetal', { position: [x, y - 0.03, D / 2 - 0.015] }); b.add(box(0.026, 0.14, 0.02, 0.003), 'blackMetal', { position: [x, y - 0.09, 0.01] }); }
  }
  // Sprout: a gold cup with a sprout growing out of it
  const sp = b.part('trophySprout', { position: [-0.38, ys[0] + 0.016, 0.12] });
  const top = trophy(sp, 'gold', 'MHACKS 2026 · WINNER');
  sp.add(cyl(0.056, 0.056, 0.004, 32), 'soil', { position: [0, top - 0.012, 0] });
  sp.add(tube([[0, top - 0.012, 0], [0.006, top + 0.03, 0.004], [-0.004, top + 0.07, -0.002], [0.004, top + 0.1, 0]], 0.0032, 20, 8), 'stem');
  [[top + 0.045, 0.4, 0.07], [top + 0.075, -2.6, 0.06], [top + 0.1, 1.2, 0.05], [top + 0.03, 2.4, 0.045]].forEach(([y, a, l]) => sp.add(leafGeometry(l, l * 0.62, 0.25, 0.5), 'leafLight', { position: [0, y, 0], rotation: [1.0, a, 0], order: 'YXZ' }));
  // Nexus: a silver cup with a gold star
  const nx = b.part('trophyNexus', { position: [0.38, ys[0] + 0.016, 0.12] });
  const ntop = trophy(nx, 'silver', 'HACKFAX 2026 · 1ST', 0.17);
  nx.add(cyl(0.004, 0.004, 0.05, 10), 'gold', { position: [0, ntop + 0.02, 0] });
  const star = new THREE.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.014 : 0.034, a = i * Math.PI / 5 + Math.PI / 2; i ? star.lineTo(Math.cos(a) * r, Math.sin(a) * r) : star.moveTo(Math.cos(a) * r, Math.sin(a) * r); } star.closePath();
  nx.add(extrude(star, 0.008, 0.003, 4), 'gold', { position: [0, ntop + 0.075, 0] });
  // between them: a little plant and two books
  pottedPlant(b.part('shelfPlant', { position: [-0.02, ys[0] + 0.016, 0.12] }), { r: 0.04, h: 0.07, leaves: 7, size: 0.07 });
  book(b, 0.12, ys[0] + 0.016, 0.12, 0.03, 0.2, 0.15, 'navy', -0.12);
  book(b, 0.16, ys[0] + 0.016, 0.12, 0.025, 0.21, 0.15, 'techGold', -0.12);
  // the upper shelf: books, a bookend, the bread on its board
  let x = -0.56;
  for (const [m, w, h, band] of [['navy', 0.032, 0.22, 'gold'], ['accentOrange', 0.024, 0.19], ['plasticWhite', 0.03, 0.21, 'plasticBlack'], ['techNavy', 0.026, 0.2], ['accentBlue', 0.028, 0.23, 'plasticWhite'], ['woodDark', 0.022, 0.18]]) { book(b, x + w / 2, ys[1] + 0.016, 0.12, w, h, 0.16, m, 0, band); x += w + 0.004; }
  b.add(box(0.012, 0.16, 0.14, 0.003), 'blackMetal', { position: [x + 0.01, ys[1] + 0.096, 0.12] });
  b.add(box(0.1, 0.008, 0.14, 0.003), 'blackMetal', { position: [x + 0.05, ys[1] + 0.02, 0.12] });
  const br = b.part('bread', { position: [0.3, ys[1] + 0.016, 0.12], rotation: [0, 0.15, 0] });
  br.add(box(0.26, 0.016, 0.16, 0.006, 3), 'oak', { position: [0, 0.008, 0] });
  br.add(box(0.03, 0.01, 0.03, 0.004), 'oak', { position: [0.14, 0.008, 0] });
  br.add(sphere(0.1, 32, 20).scale(1, 0.42, 0.55), 'breadCrust', { position: [0, 0.038, 0] });
  br.add(sphere(0.098, 32, 20).scale(0.98, 0.44, 0.5), 'bread', { position: [0, 0.042, 0] });
  for (let i = -2; i <= 2; i++) br.add(box(0.008, 0.006, 0.07, 0.002), 'breadCrust', { position: [i * 0.034, 0.083 - Math.abs(i) * 0.005, 0], rotation: [0, 0.5, 0] });
  b.add(box(0.07, 0.07, 0.06, 0.004), 'plasticCream', { position: [0.53, ys[1] + 0.051, 0.12], rotation: [0, -0.3, 0] });
  return b.build();
}

// ---------------------------------------------------------------- 09/10 the workstation: monitor (Vibez), the molecule (AEGIS), a lamp, a chair
function helix(p) {
  const atoms = [], N = 14, per = 3, rise = 0.0165, R = 0.036, turn = 100 * Math.PI / 180;
  const total = N * per;
  for (let j = 0; j < total; j++) { const a = j * turn / per, y = (j - total / 2) * rise / per * 3; atoms.push({ p: [Math.cos(a) * R, y * 0.9, Math.sin(a) * R], t: ['atomN', 'atomC', 'atomC'][j % 3] }); }
  const side = [];
  atoms.forEach((at, j) => {
    const [x, y, z] = at.p, k = Math.hypot(x, z);
    if (j % 3 === 1) side.push({ from: at.p, p: [x / k * 0.07, y + 0.008, z / k * 0.07], t: ['atomC', 'atomS', 'atomC', 'atomN', 'atomO'][(j / 3 | 0) % 5] });
    if (j % 3 === 2) side.push({ from: at.p, p: [x / k * 0.058, y + 0.016, z / k * 0.058], t: 'atomO' });
    if (j % 3 === 0) side.push({ from: at.p, p: [x / k * 0.05, y - 0.012, z / k * 0.05], t: 'atomH' });
  });
  for (const a of atoms) p.add(sphere(a.t === 'atomC' ? 0.0085 : 0.008, 16, 12), a.t, { position: a.p });
  for (const s of side) p.add(sphere(s.t === 'atomS' ? 0.011 : s.t === 'atomH' ? 0.0055 : 0.0078, 16, 12), s.t, { position: s.p });
  for (let j = 0; j < atoms.length - 1; j++) rod(p, atoms[j].p, atoms[j + 1].p, 0.0024, 'bond', 8);
  for (const s of side) rod(p, s.from, s.p, 0.0022, 'bond', 8);
}
export function createWorkstation() {
  const W = 1.6, H = 0.75, D = 0.75, b = new Builder('workstation');
  desk(b, { w: W, h: H, d: D, top: 'oak', frame: 'blackMetal' });
  b.add(box(0.92, 0.003, 0.42, 0.016, 2), 'fabric', { position: [0.1, H + 0.0015, 0.1] });
  // monitor on a slanted aluminium stand
  const mo = b.part('monitor', { position: [0.1, H, -0.2] });
  mo.add(box(0.2, 0.008, 0.18, 0.004, 2), 'aluminum', { position: [0, 0.004, 0.03] });
  mo.add(box(0.16, 0.34, 0.012, 0.005, 2), 'aluminum', { position: [0, 0.17, -0.02], rotation: [0.16, 0, 0] });
  mo.add(box(0.62, 0.36, 0.018, 0.008, 3), 'aluminum', { position: [0, 0.44, 0.012] });
  mo.add(box(0.617, 0.357, 0.001), 'glassBlack', { position: [0, 0.44, 0.0215] });
  mo.object(blank(0.598, 0.336, 'monitorScreen'), { position: [0, 0.442, 0.0222] });
  mo.add(cyl(0.0022, 0.0022, 0.001, 10), 'plasticGrey', { position: [0, 0.613, 0.0222], rotation: [Math.PI / 2, 0, 0] });
  // keyboard, mouse
  const kb = b.part('keyboard', { position: [0.1, H + 0.003, 0.14], rotation: [0, 0.02, 0] });
  kb.add(box(0.29, 0.007, 0.115, 0.004, 2), 'aluminum', { position: [0, 0.0035, 0] });
  for (let r = 0; r < 5; r++) for (let c = 0; c < 15; c++) { if (r === 4 && c > 3 && c < 11) continue; kb.add(box(0.0155, 0.004, 0.0155, 0.003, 1), 'plasticWhite', { position: [-0.13 + c * 0.0185, 0.008 + r * 0.0007, -0.04 + r * 0.0195] }); }
  kb.add(box(0.125, 0.004, 0.0155, 0.003, 1), 'plasticWhite', { position: [0.0, 0.011, -0.04 + 4 * 0.0195] });
  b.add(sphere(0.03, 32, 20).scale(0.92, 0.36, 1.9), 'plasticWhite', { position: [0.4, H + 0.012, 0.16], rotation: [0, 0.15, 0] });
  // lamp, articulated
  const lp = b.part('lamp', { position: [0.66, H, -0.25], rotation: [0, -0.6, 0] });
  lp.add(cyl(0.07, 0.076, 0.018, 40), 'blackMetal', { position: [0, 0.009, 0] });
  lp.add(tube([[0, 0.018, 0], [0, 0.17, -0.03], [0, 0.33, -0.06]], 0.006, 16, 8), 'blackMetal');
  lp.add(sphere(0.012, 14, 10), 'blackMetal', { position: [0, 0.33, -0.06] });
  lp.add(tube([[0, 0.33, -0.06], [0, 0.39, 0.06], [0, 0.42, 0.19]], 0.005, 16, 8), 'blackMetal');
  const head = lp.part('lampHead', { position: [0, 0.42, 0.2], rotation: [0.5, 0, 0] });
  head.add(lathe([[0.05, 0], [0.052, 0.004], [0.03, 0.07], [0.012, 0.085], [0, 0.088]], 32), 'blackMetal', { position: [0, -0.06, 0] });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.046, 32), mat('lampGlow')); disc.rotation.x = Math.PI / 2;
  head.object(disc, { position: [0, -0.056, 0], rotation: [Math.PI / 2, 0, 0] });
  lp.object(glowSprite(0.28, '255,226,180'), { position: [0, 0.31, 0.27] });
  // headphones, mug, a plant
  const hp = b.part('headphones', { position: [-0.3, H + 0.02, 0.2], rotation: [0, 0.4, 0] });
  hp.add(torus(0.085, 0.009, 10, 40, Math.PI), 'plasticBlack', { rotation: [Math.PI / 2 - 0.15, 0, 0] });
  for (const s of [-1, 1]) { hp.add(cyl(0.042, 0.042, 0.028, 32), 'plasticBlack', { position: [s * 0.085, 0.0, 0.01], rotation: [0, 0, Math.PI / 2] }); hp.add(cyl(0.038, 0.038, 0.012, 32), 'fabric', { position: [s * 0.068, 0.0, 0.01], rotation: [0, 0, Math.PI / 2] }); }
  mug(b.part('mug', { position: [0.56, H + 0.003, -0.02], rotation: [0, 2.6, 0] }), 'ceramic', 'techGold');
  pottedPlant(b.part('deskPlant', { position: [-0.66, H, -0.26] }), { r: 0.05, h: 0.09, leaves: 9, size: 0.09, pot: 'ceramic' });
  // the molecule on a museum stand
  const ms = b.part('moleculeStand', { position: [-0.56, H, 0.13] });
  ms.add(cyl(0.065, 0.072, 0.02, 40), 'walnut', { position: [0, 0.01, 0] });
  ms.add(box(0.06, 0.012, 0.0015), 'brass', { position: [0, 0.012, 0.069], rotation: [-0.25, 0, 0] });
  ms.add(cyl(0.004, 0.004, 0.13, 12), 'brass', { position: [0, 0.085, 0] });
  helix(ms.part('molecule', { position: [0, 0.25, 0] }));
  officeChair(b.part('chair', { position: [0.55, 0, 0.5], rotation: [0, -0.5, 0] }), 'fabric');
  return b.build();
}

// ---------------------------------------------------------------- 11 Khali: a side table with newspapers and a tablet; a floor lamp
export function createSideTable() {
  const b = new Builder('sideTable'), H = 0.58;
  b.add(cyl(0.3, 0.3, 0.03, 56), 'walnut', { position: [0, H - 0.015, 0] });
  b.add(torus(0.3, 0.008, 8, 64), 'walnut', { position: [0, H - 0.015, 0], rotation: [Math.PI / 2, 0, 0] });
  for (let i = 0; i < 3; i++) { const a = i * TAU / 3 + 0.5; rod(b, [Math.cos(a) * 0.16, H - 0.03, Math.sin(a) * 0.16], [Math.cos(a) * 0.24, 0.02, Math.sin(a) * 0.24], 0.014, 'walnut', 14); b.add(cyl(0.012, 0.012, 0.02, 12), 'brass', { position: [Math.cos(a) * 0.24, 0.01, Math.sin(a) * 0.24] }); }
  b.add(torus(0.2, 0.006, 8, 48), 'brass', { position: [0, 0.22, 0], rotation: [Math.PI / 2, 0, 0] });
  for (let i = 0; i < 5; i++) b.add(box(0.26, 0.006, 0.36, 0.002), 'newsprint', { position: [-0.06, H + 0.003 + i * 0.006, 0.03], rotation: [0, (i - 2) * 0.07, 0] });
  const paper = paintedPlane(0.255, 0.355, 512, (g, W, Hh) => {
    g.fillStyle = '#e9e4d8'; g.fillRect(0, 0, W, Hh); g.fillStyle = '#1b1d22'; g.textAlign = 'center';
    g.font = `700 92px Georgia, serif`; g.fillText('KHALI', W / 2, 105); g.fillRect(30, 124, W - 60, 4);
    g.font = `600 22px ${SANS}`; g.fillText('ONE STORY · EVERY OUTLET · BOTH SIDES', W / 2, 160);
    g.fillStyle = '#c9c2b4'; g.fillRect(30, 190, 214, 150); g.fillStyle = '#e6692b'; g.fillRect(268, 190, 214, 12);
    g.fillStyle = '#9a9388'; for (let y = 216; y < Hh - 20; y += 14) { g.fillRect(268, y, 214 * (0.7 + ((y * 7) % 30) / 100), 6); if (y > 350) g.fillRect(30, y, 214 * (0.7 + ((y * 11) % 30) / 100), 6); }
  });
  paper.rotation.set(-Math.PI / 2, 0, 0.14); paper.position.set(-0.06, H + 0.0335, 0.03); b.object(paper);
  const st = b.part('tabletStand', { position: [0.13, H, -0.12], rotation: [0, -0.5, 0] });
  st.add(box(0.11, 0.01, 0.1, 0.004), 'aluminum', { position: [0, 0.005, 0] });
  const tb = st.part('tablet', { position: [0, 0.014, 0.0], rotation: [-0.32, 0, 0] });
  tb.add(panel(0.16, 0.228, 0.007, 0.012), 'spaceGrey', { position: [0, 0.114, 0] });
  tb.add(panel(0.158, 0.226, 0.0004, 0.0115), 'glassBlack', { position: [0, 0.114, 0.0037] });
  tb.object(blank(0.148, 0.214, 'tabletScreen'), { position: [0, 0.114, 0.0041] });
  tb.add(box(0.1, 0.12, 0.008, 0.004), 'aluminum', { position: [0, 0.07, -0.0075] });
  tb.add(box(0.12, 0.008, 0.016, 0.003), 'aluminum', { position: [0, 0.0, 0.006] });
  const cup = b.part('cup', { position: [-0.18, H, -0.15] });
  cup.add(cyl(0.06, 0.055, 0.006, 40), 'ceramic', { position: [0, 0.003, 0] });
  cup.add(lathe([[0, 0], [0.03, 0], [0.04, 0.05], [0.042, 0.06], [0.039, 0.06], [0.037, 0.05], [0.028, 0.006], [0, 0.006]], 32), 'ceramic', { position: [0, 0.006, 0] });
  cup.add(torus(0.016, 0.004, 8, 18, Math.PI), 'ceramic', { position: [0.043, 0.037, 0], rotation: [0, 0, -Math.PI / 2] });
  cup.add(cyl(0.036, 0.036, 0.002, 24), 'breadCrust', { position: [0, 0.056, 0] });
  return b.build();
}
export function createFloorLamp() {
  // a tripod lamp with a linen drum shade, lit from inside
  const b = new Builder('floorLamp'), top = 1.12;
  for (let i = 0; i < 3; i++) { const a = i * TAU / 3 + 0.3; rod(b, [0, top - 0.08, 0], [Math.cos(a) * 0.26, 0.0, Math.sin(a) * 0.26], 0.011, 'walnut', 12); b.add(cyl(0.012, 0.012, 0.012, 12), 'brass', { position: [Math.cos(a) * 0.26, 0.006, Math.sin(a) * 0.26] }); }
  b.add(cyl(0.02, 0.02, 0.05, 16), 'brass', { position: [0, top - 0.08, 0] });
  b.add(cyl(0.006, 0.006, 0.16, 10), 'brass', { position: [0, top + 0.02, 0] });
  b.add(cyl(0.2, 0.2, 0.28, 48, true), 'lampShade', { position: [0, top + 0.12, 0] });
  for (const y of [top - 0.02, top + 0.26]) b.add(torus(0.2, 0.004, 6, 48), 'brass', { position: [0, y, 0], rotation: [Math.PI / 2, 0, 0] });
  b.object(glowSprite(0.8, '255,228,190'), { position: [0, top + 0.1, 0] });
  return b.build();
}

// ---------------------------------------------------------------- 14 About: a bookcase whose spines are the résumé, a pennant, a robot
function spineTexture(text, bg, fg = '#f3efe6') {
  const [c, g] = canvas(96, 640); g.fillStyle = bg; g.fillRect(0, 0, 96, 640);
  g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 30, 96, 6); g.fillRect(0, 604, 96, 6);
  g.save(); g.translate(48, 320); g.rotate(-Math.PI / 2); g.fillStyle = fg; g.font = `700 40px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 0, 0); g.restore();
  return tex(c);
}
export function createBookshelf() {
  const W = 0.96, H = 1.95, D = 0.32, b = new Builder('bookshelf');
  for (const s of [-1, 1]) b.add(box(0.026, H, D, 0.004), 'walnut', { position: [s * (W / 2 - 0.013), H / 2, 0] });
  b.add(box(W, 0.03, D, 0.004), 'walnut', { position: [0, H - 0.015, 0] });
  b.add(box(W - 0.05, 0.06, 0.02), 'walnut', { position: [0, 0.03, D / 2 - 0.02] });
  b.add(box(W - 0.05, H - 0.05, 0.012), 'woodDark', { position: [0, H / 2, -D / 2 + 0.006] });
  const shelves = [0.06, 0.44, 0.82, 1.2, 1.58];
  for (const y of shelves) b.add(box(W - 0.05, 0.024, D - 0.02, 0.003), 'walnut', { position: [0, y, 0.0] });
  const R = rng(4), palette = ['navy', 'accentOrange', 'techGold', 'plasticWhite', 'accentBlue', 'oak', 'felt', 'terracotta', 'woodDark', 'ceramicDark'];
  const keyed = [['GEORGIA TECH', '#003057'], ['KARANA', '#e6692b'], ['FHIR · HEALTH', '#2f6fb3'], ['CLOUD9', '#4a5b70'], ['POLITHEON', '#5b3f8a'], ['MIZZOU', '#f1b82d'], ['HACKATHONS', '#2a7a4b'], ['MINI MAKERS', '#c9372c']];
  let kI = 0;
  shelves.slice(0, 4).forEach((y, row) => {
    let x = -W / 2 + 0.04;
    const stackAt = row % 2 ? 0.22 : -0.2;
    while (x < W / 2 - 0.07) {
      if (Math.abs(x - stackAt) < 0.02) {   // a horizontal stack, and a gap
        for (let k = 0; k < 4; k++) b.add(box(0.2 - k * 0.012, 0.028, 0.16 - k * 0.006, 0.003), palette[(row * 3 + k) % palette.length], { position: [x + 0.1, y + 0.026 + k * 0.029, 0.03], rotation: [0, (k - 1.5) * 0.06, 0] });
        x += 0.23; continue;
      }
      const w = 0.02 + R() * 0.028, h = 0.2 + R() * 0.12, key = kI < keyed.length && R() < 0.35 && w > 0.03;
      if (key) {
        const [text, color] = keyed[kI++];
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.2), [mat('paper'), mat('paper'), mat('paper'), mat('paper'), new THREE.MeshStandardMaterial({ map: spineTexture(text, color, color === '#f1b82d' ? '#1b1d22' : '#f3efe6'), roughness: 0.75 }), mat('paper')]);
        m.castShadow = true; m.receiveShadow = true;
        b.object(m, { position: [x + w / 2, y + 0.012 + h / 2, 0.03] });
      } else book(b, x + w / 2, y + 0.012, 0.03, w, h, 0.2, palette[Math.floor(R() * palette.length)], 0, R() < 0.3 ? 'gold' : null);
      x += w + 0.003;
      if (R() < 0.08 && x < W / 2 - 0.2) { book(b, x + 0.03, y + 0.012, 0.03, 0.026, 0.24, 0.2, 'navy', -0.18); x += 0.07; }
    }
  });
  // the top shelf: a monogram in a frame, a robot from Mini Makers, a gold mug
  const yt = shelves[4] + 0.012;
  const mono = paintedPlane(0.13, 0.17, 256, (g, Wc, Hc) => { g.fillStyle = '#10121a'; g.fillRect(0, 0, Wc, Hc); g.fillStyle = '#ecebe6'; g.font = `300 120px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('PD', Wc / 2, Hc / 2 - 10); g.fillStyle = '#e6692b'; g.fillRect(Wc / 2 - 30, Hc - 60, 60, 6); });
  const fr = b.part('monogram', { position: [-0.28, yt, 0.03], rotation: [-0.12, 0.25, 0] });
  fr.add(box(0.16, 0.2, 0.02, 0.004), 'blackMetal', { position: [0, 0.1, 0] }); fr.object(mono, { position: [0, 0.1, 0.0105] });
  fr.add(box(0.02, 0.1, 0.06, 0.003), 'blackMetal', { position: [0, 0.05, -0.04], rotation: [0.4, 0, 0] });
  const rb = b.part('robot', { position: [0.0, yt, 0.04], rotation: [0, -0.3, 0] });
  rb.add(box(0.07, 0.07, 0.055, 0.012, 3), 'accentOrange', { position: [0, 0.07, 0] });
  rb.add(box(0.085, 0.06, 0.065, 0.016, 3), 'plasticWhite', { position: [0, 0.14, 0] });
  rb.add(box(0.06, 0.03, 0.002, 0.008), 'glassBlack', { position: [0, 0.142, 0.033] });
  for (const s of [-1, 1]) { rb.add(sphere(0.006, 10, 8), 'ledBlue', { position: [s * 0.014, 0.143, 0.035] }); rb.add(box(0.016, 0.035, 0.016, 0.005), 'plasticGrey', { position: [s * 0.016, 0.018, 0] }); rb.add(box(0.014, 0.05, 0.014, 0.005), 'plasticGrey', { position: [s * 0.047, 0.07, 0], rotation: [0, 0, s * 0.3] }); }
  rb.add(cyl(0.002, 0.002, 0.03, 6), 'plasticGrey', { position: [0, 0.185, 0] }); rb.add(sphere(0.007, 10, 8), 'ledOrange', { position: [0, 0.202, 0] });
  mug(b.part('mug', { position: [0.27, yt, 0.04], rotation: [0, 2.0, 0] }), 'techGold');
  // the pennant above
  const [pc, pg] = canvas(1024, 420); pg.fillStyle = '#003057'; pg.beginPath(); pg.moveTo(20, 20); pg.lineTo(1010, 210); pg.lineTo(20, 400); pg.closePath(); pg.fill();
  pg.fillStyle = '#b3a369'; pg.fillRect(20, 20, 70, 380); pg.font = `800 150px ${SANS}`; pg.textBaseline = 'middle'; pg.fillText('TECH', 130, 212);
  const pen = screenPlane(0.72, 0.295, tex(pc), { lit: true, transparent: true }); pen.material.side = THREE.DoubleSide;
  b.object(pen, { position: [0.06, H + 0.32, -D / 2 + 0.004], rotation: [0, 0, -0.06] });
  b.add(cyl(0.004, 0.004, 0.06, 8), 'brass', { position: [-0.29, H + 0.33, -D / 2 + 0.01], rotation: [Math.PI / 2, 0, 0] });
  return b.build();
}

// ---------------------------------------------------------------- 13 the school: a model on a table, a plane circling it ('planePivot', 'prop', 'flag')
export function createSchoolTable() {
  const W = 0.95, H = 0.72, D = 0.62, b = new Builder('schoolTable');
  desk(b, { w: W, h: H, d: D, top: 'wood', frame: 'blackMetal' });
  const m = b.part('schoolModel', { position: [0, H, 0] });
  m.add(box(0.82, 0.024, 0.52, 0.006), 'walnut', { position: [0, 0.012, 0] });
  m.add(box(0.79, 0.006, 0.49, 0.003), 'grass', { position: [0, 0.027, 0] });
  const g0 = 0.03;
  m.add(box(0.12, 0.002, 0.2), 'plasticCream', { position: [0, g0 + 0.001, 0.14] });
  m.add(box(0.5, 0.002, 0.06), 'plasticCream', { position: [0, g0 + 0.001, 0.215] });
  // the hall: brick, limestone trim, lit windows
  const bw = 0.42, bh = 0.15, bd = 0.2, bz = -0.06;
  m.add(box(bw, bh, bd), 'brick', { position: [0, g0 + bh / 2, bz] });
  m.add(box(bw + 0.012, 0.012, bd + 0.012), 'schoolWall', { position: [0, g0 + 0.006, bz] });
  m.add(box(bw + 0.016, 0.012, bd + 0.016), 'schoolWall', { position: [0, g0 + bh - 0.004, bz] });
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) for (let r = 0; r < 2; r++) {
    const x = s * (0.08 + i * 0.05), y = g0 + 0.045 + r * 0.055;
    m.add(box(0.03, 0.04, 0.004), 'schoolWall', { position: [x, y, bz + bd / 2 + 0.001] });
    m.add(box(0.022, 0.032, 0.004), 'ledWarm', { position: [x, y, bz + bd / 2 + 0.002] });
    m.add(box(0.026, 0.004, 0.006), 'schoolWall', { position: [x, y - 0.02, bz + bd / 2 + 0.003] });
  }
  const roof = new THREE.Shape(); roof.moveTo(-bd / 2 - 0.025, 0); roof.lineTo(bd / 2 + 0.025, 0); roof.lineTo(0, 0.09); roof.closePath();
  m.add(extrude(roof, bw + 0.04, 0.002), 'schoolRoof', { position: [0, g0 + bh + 0.002, bz], rotation: [0, Math.PI / 2, 0] });
  // portico
  m.add(box(0.14, 0.012, 0.06), 'schoolWall', { position: [0, g0 + 0.006, bz + bd / 2 + 0.03] });
  for (let i = 0; i < 4; i++) m.add(cyl(0.0055, 0.006, 0.1, 12), 'schoolWall', { position: [-0.051 + i * 0.034, g0 + 0.062, bz + bd / 2 + 0.048] });
  m.add(box(0.15, 0.012, 0.064), 'schoolWall', { position: [0, g0 + 0.118, bz + bd / 2 + 0.03] });
  const ped = new THREE.Shape(); ped.moveTo(-0.075, 0); ped.lineTo(0.075, 0); ped.lineTo(0, 0.035); ped.closePath();
  m.add(extrude(ped, 0.064), 'schoolWall', { position: [0, g0 + 0.124, bz + bd / 2 + 0.03] });
  m.add(box(0.036, 0.07, 0.004), 'schoolRoof', { position: [0, g0 + 0.035, bz + bd / 2 + 0.002] });
  // bell tower
  const tz = bz - 0.01, ty = g0 + bh + 0.06;
  m.add(box(0.07, 0.12, 0.07), 'schoolWall', { position: [0, ty + 0.03, tz] });
  for (const [x, z, ry] of [[0, 0.036, 0], [0.036, 0, Math.PI / 2], [0, -0.036, 0], [-0.036, 0, Math.PI / 2]]) m.add(box(0.03, 0.045, 0.004), 'plasticBlack', { position: [x, ty + 0.06, tz + z], rotation: [0, ry, 0] });
  m.add(lathe([[0, 0], [0.012, 0], [0.011, 0.006], [0.008, 0.02], [0.004, 0.024], [0, 0.025]], 20), 'gold', { position: [0, ty + 0.042, tz] });
  m.add(box(0.08, 0.01, 0.08), 'schoolWall', { position: [0, ty + 0.095, tz] });
  m.add(cone(0.06, 0.08, 4), 'schoolRoof', { position: [0, ty + 0.14, tz], rotation: [0, Math.PI / 4, 0] });
  m.add(cyl(0.0015, 0.0015, 0.04, 6), 'brass', { position: [0, ty + 0.2, tz] });
  m.add(box(0.016, 0.006, 0.001), 'brass', { position: [0.006, ty + 0.21, tz] });
  // flagpole and flag
  m.add(cyl(0.0022, 0.0022, 0.26, 8), 'aluminum', { position: [0.3, g0 + 0.13, 0.13] });
  m.add(sphere(0.004, 8, 6), 'gold', { position: [0.3, g0 + 0.262, 0.13] });
  const flagGeo = new THREE.PlaneGeometry(0.075, 0.046, 12, 4); flagGeo.translate(0.0375, 0, 0);
  const flag = new THREE.Mesh(flagGeo, new THREE.MeshStandardMaterial({ color: 0xe6692b, roughness: 0.7, side: THREE.DoubleSide })); flag.name = 'flag';
  flag.userData.rest = Float32Array.from(flagGeo.attributes.position.array);
  m.object(flag, { position: [0.3022, g0 + 0.23, 0.13] });
  // trees, benches, and three kids on the path
  const R = rng(21);
  for (const [x, z, s] of [[-0.34, 0.15, 1], [-0.33, -0.17, 0.85], [0.33, -0.16, 0.95], [0.26, 0.19, 0.7], [-0.2, 0.2, 0.62], [-0.36, 0.0, 0.7], [0.36, 0.02, 0.6]]) {
    m.add(cyl(0.006 * s, 0.009 * s, 0.05 * s, 8), 'bark', { position: [x, g0 + 0.025 * s, z] });
    for (let k = 0; k < 3; k++) m.add(cone((0.045 - k * 0.011) * s, (0.07 - k * 0.01) * s, 10), k % 2 ? 'leaf' : 'leafDark', { position: [x, g0 + (0.07 + k * 0.035) * s, z], rotation: [0, R() * 3, 0] });
  }
  for (const s of [-1, 1]) { m.add(box(0.06, 0.004, 0.016, 0.001), 'wood', { position: [s * 0.17, g0 + 0.016, 0.16] }); for (const k of [-1, 1]) m.add(box(0.004, 0.014, 0.012), 'blackMetal', { position: [s * 0.17 + k * 0.025, g0 + 0.007, 0.16] }); }
  [['accentOrange', 'skin1', -0.025, 0.2, 0.3], ['accentBlue', 'skin2', 0.02, 0.15, -0.4], ['techGold', 'skin3', 0.0, 0.25, 0.1], ['purple', 'skin1', 0.12, 0.215, 1.5], ['green', 'skin2', -0.14, 0.22, -1.2]].forEach(([c, sk, x, z, ry]) => {
    const k = m.part('kid', { position: [x, g0, z], rotation: [0, ry, 0] });
    k.add(capsule(0.0075, 0.016, 4, 10), c, { position: [0, 0.022, 0] });
    k.add(sphere(0.0085, 14, 10), sk, { position: [0, 0.046, 0] });
    k.add(box(0.012, 0.014, 0.007, 0.003), 'techNavy', { position: [0, 0.026, -0.009] });
  });
  // the plane, on a pivot main.js turns
  const pivot = b.part('planePivot', { position: [0, H + 0.5, -0.04] });
  const plane = pivot.part('plane', { position: [0.4, 0, 0], rotation: [0, 0, 0.25] });
  const pl = plane.part('planeBody');
  pl.add(lathe([[0, 0], [0.008, 0.004], [0.013, 0.02], [0.014, 0.05], [0.012, 0.08], [0.006, 0.11], [0.002, 0.12], [0, 0.12]], 24), 'plasticWhite', { position: [0, 0, 0.06], rotation: [-Math.PI / 2, 0, 0] });
  const wing = new THREE.Shape(); wing.moveTo(-0.075, -0.01); wing.lineTo(0.075, -0.01); wing.lineTo(0.065, 0.012); wing.lineTo(-0.065, 0.012); wing.closePath();
  pl.add(extrude(wing, 0.004, 0.001, 4), 'plasticWhite', { position: [0, -0.004, 0.025], rotation: [-Math.PI / 2, 0, 0] });
  pl.add(box(0.15, 0.0015, 0.008), 'accentOrange', { position: [0, -0.0015, 0.02] });
  const tail = new THREE.Shape(); tail.moveTo(-0.028, 0); tail.lineTo(0.028, 0); tail.lineTo(0.02, 0.012); tail.lineTo(-0.02, 0.012); tail.closePath();
  pl.add(extrude(tail, 0.003, 0.001, 4), 'plasticWhite', { position: [0, 0.002, -0.05], rotation: [-Math.PI / 2, 0, 0] });
  const fin = new THREE.Shape(); fin.moveTo(0, 0); fin.lineTo(0.026, 0); fin.lineTo(0.012, 0.03); fin.lineTo(0.0, 0.03); fin.closePath();
  pl.add(extrude(fin, 0.003, 0.001, 4), 'accentBlue', { position: [0, 0.006, -0.032], rotation: [0, Math.PI / 2, 0] });
  pl.add(box(0.02, 0.008, 0.002), 'glassBlack', { position: [0, 0.009, 0.045], rotation: [0.6, 0, 0] });
  pl.add(cone(0.007, 0.012, 14), 'accentOrange', { position: [0, 0, 0.069], rotation: [Math.PI / 2, 0, 0] });
  const prop = pl.part('prop', { position: [0, 0, 0.076] });
  for (const a of [0, Math.PI]) prop.add(box(0.004, 0.032, 0.0015, 0.0008), 'plasticBlack', { position: [0, 0.016 * Math.cos(a), 0], rotation: [0, 0, a] });
  return b.build();
}
// a floor globe, 'globeSpin' turns
function globeTexture() {
  const W = 1024, H = 512, [c, g] = canvas(W, H);
  const sea = g.createLinearGradient(0, 0, 0, H); sea.addColorStop(0, '#2c5c7a'); sea.addColorStop(0.5, '#3a7aa0'); sea.addColorStop(1, '#2c5c7a');
  g.fillStyle = sea; g.fillRect(0, 0, W, H);
  const land = (pts, col = '#d7c48f') => { g.fillStyle = col; g.beginPath(); pts.forEach(([lon, lat], i) => { const x = (lon + 180) / 360 * W, y = (90 - lat) / 180 * H; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.fill(); };
  land([[-168, 66], [-140, 70], [-95, 72], [-75, 62], [-60, 48], [-80, 25], [-97, 18], [-105, 22], [-117, 32], [-125, 45], [-140, 60]]);
  land([[-80, 10], [-60, 6], [-35, -6], [-40, -22], [-58, -38], [-70, -54], [-75, -20], [-80, -4]]);
  land([[-10, 36], [0, 44], [-5, 58], [10, 62], [30, 70], [60, 70], [100, 76], [140, 70], [160, 62], [140, 40], [120, 22], [105, 10], [90, 22], [75, 8], [60, 25], [45, 30], [35, 36], [25, 36], [10, 38]]);
  land([[-17, 15], [-10, 35], [10, 37], [32, 31], [43, 12], [51, 11], [40, -15], [32, -30], [20, -35], [12, -18], [8, 4]]);
  land([[114, -22], [130, -12], [145, -14], [153, -27], [146, -39], [130, -32], [115, -34]]);
  land([[-50, 60], [-25, 70], [-20, 82], [-60, 82], [-72, 76]], '#eef0ee');
  land([[-180, -70], [180, -70], [180, -90], [-180, -90]], '#eef0ee');
  g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 1.5;
  for (let lon = -180; lon <= 180; lon += 30) { const x = (lon + 180) / 360 * W; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  for (let lat = -60; lat <= 60; lat += 30) { const y = (90 - lat) / 180 * H; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  // Atlanta, marked
  { const x = (-84.4 + 180) / 360 * W, y = (90 - 33.7) / 180 * H; g.fillStyle = '#e6692b'; g.beginPath(); g.arc(x, y, 7, 0, TAU); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); }
  return tex(c);
}
export function createGlobe() {
  const b = new Builder('globe'), r = 0.17, cy = 0.78;
  b.add(cyl(0.15, 0.17, 0.03, 40), 'walnut', { position: [0, 0.015, 0] });
  b.add(lathe([[0.03, 0], [0.026, 0.06], [0.018, 0.12], [0.028, 0.2], [0.016, 0.32], [0.012, 0.46], [0.02, 0.5], [0, 0.5]], 32), 'walnut', { position: [0, 0.03, 0] });
  b.add(torus(r + 0.03, 0.009, 10, 64), 'walnut', { position: [0, cy, 0], rotation: [Math.PI / 2, 0, 0] });
  for (let i = 0; i < 3; i++) { const a = i * TAU / 3; rod(b, [0, 0.53, 0], [Math.cos(a) * (r + 0.03), cy, Math.sin(a) * (r + 0.03)], 0.007, 'walnut', 10); }
  const tilt = b.part('globeTilt', { position: [0, cy, 0], rotation: [0, 0, 0.41] });
  tilt.add(torus(r + 0.012, 0.004, 8, 64, Math.PI * 1.1), 'brass', { rotation: [0, Math.PI / 2, -Math.PI * 0.05] });
  tilt.add(cyl(0.004, 0.004, 2 * r + 0.04, 8), 'brass');
  const spin = tilt.part('globeSpin');
  const s = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 40), new THREE.MeshPhysicalMaterial({ map: globeTexture(), roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2 }));
  s.castShadow = true; s.receiveShadow = true; spin.object(s);
  return b.build();
}
// a wall clock that keeps real time: 'clockH', 'clockM', 'clockS'
export function createClock() {
  const b = new Builder('clock'), r = 0.17;
  b.add(cyl(r + 0.012, r + 0.012, 0.04, 64), 'walnut', { position: [0, 0, 0.02], rotation: [Math.PI / 2, 0, 0] });
  const face = paintedPlane(2 * r, 2 * r, 512, (g, W) => {
    g.fillStyle = '#f6f3ec'; g.beginPath(); g.arc(W / 2, W / 2, W / 2, 0, TAU); g.fill();
    for (let i = 0; i < 60; i++) { const a = i / 60 * TAU, long = i % 5 === 0; g.strokeStyle = long ? '#1b1d22' : '#8a8d94'; g.lineWidth = long ? 9 : 3; g.beginPath(); g.moveTo(W / 2 + Math.sin(a) * W * 0.45, W / 2 - Math.cos(a) * W * 0.45); g.lineTo(W / 2 + Math.sin(a) * W * (long ? 0.38 : 0.42), W / 2 - Math.cos(a) * W * (long ? 0.38 : 0.42)); g.stroke(); }
    g.fillStyle = '#1b1d22'; g.font = `500 30px ${MONO}`; g.textAlign = 'center'; g.fillText('ATLANTA', W / 2, W * 0.68);
  }, { transparent: true });
  b.object(face, { position: [0, 0, 0.0405] });
  b.add(torus(r + 0.004, 0.006, 10, 64), 'brass', { position: [0, 0, 0.041] });
  const hand = (name, len, w, m, z) => { const p = b.part(name, { position: [0, 0, z] }); p.add(box(w, len, 0.002, w * 0.4, 1), m, { position: [0, len / 2 - 0.02, 0] }); return p; };
  hand('clockH', 0.1, 0.012, 'plasticBlack', 0.044); hand('clockM', 0.14, 0.008, 'plasticBlack', 0.047); hand('clockS', 0.15, 0.003, 'accentOrange', 0.05);
  b.add(cyl(0.009, 0.009, 0.012, 16), 'brass', { position: [0, 0, 0.05], rotation: [Math.PI / 2, 0, 0] });
  return b.build();
}

// ---------------------------------------------------------------- 15 the door, hung in its frame; 'doorLeaf' swings on its hinge
export function createDoor(w = 0.96, h = 2.08) {
  const b = new Builder('door');
  for (const s of [-1, 1]) b.add(box(0.03, h, 0.13, 0.002), 'plasticWhite', { position: [s * (w / 2 + 0.015), h / 2, -0.065] });
  b.add(box(w + 0.06, 0.03, 0.13, 0.002), 'plasticWhite', { position: [0, h + 0.015, -0.065] });
  for (const s of [-1, 1]) { b.add(box(0.075, h + 0.075, 0.018, 0.004), 'plasticWhite', { position: [s * (w / 2 + 0.0375), (h + 0.075) / 2, 0.009] }); b.add(box(0.02, h + 0.06, 0.006, 0.002), 'plasticWhite', { position: [s * (w / 2 + 0.06), (h + 0.06) / 2, 0.02] }); }
  b.add(box(w + 0.15, 0.08, 0.02, 0.004), 'plasticWhite', { position: [0, h + 0.04, 0.01] });
  b.add(box(w + 0.18, 0.02, 0.026, 0.004), 'plasticWhite', { position: [0, h + 0.09, 0.013] });
  b.add(box(w + 0.02, 0.012, 0.15, 0.003), 'oak', { position: [0, 0.006, -0.06] });
  const leaf = b.part('doorLeaf', { position: [-w / 2 + 0.004, 0, -0.025] });
  const lw = w - 0.008, lh = h - 0.008, t = 0.042;
  leaf.add(box(lw, lh, t, 0.003), 'oak', { position: [lw / 2, lh / 2 + 0.006, 0] });
  for (const [y, ph] of [[0.16, 0.62], [0.88, 0.3], [1.28, 0.62]]) for (const z of [1, -1]) {
    leaf.add(box(lw - 0.24, ph, 0.006, 0.002), 'wood', { position: [lw / 2, y + ph / 2, z * (t / 2 - 0.002)] });
    leaf.add(box(lw - 0.21, 0.012, 0.01, 0.003), 'oak', { position: [lw / 2, y + ph + 0.006, z * (t / 2 + 0.001)] });
    leaf.add(box(lw - 0.21, 0.012, 0.01, 0.003), 'oak', { position: [lw / 2, y - 0.006, z * (t / 2 + 0.001)] });
    leaf.add(box(0.012, ph, 0.01, 0.003), 'oak', { position: [0.105, y + ph / 2, z * (t / 2 + 0.001)] });
    leaf.add(box(0.012, ph, 0.01, 0.003), 'oak', { position: [lw - 0.105, y + ph / 2, z * (t / 2 + 0.001)] });
  }
  for (const z of [1, -1]) {
    leaf.add(box(0.03, 0.14, 0.008, 0.004), 'brass', { position: [lw - 0.065, 1.02, z * (t / 2 + 0.004)] });
    leaf.add(cyl(0.01, 0.01, 0.03, 16), 'brass', { position: [lw - 0.065, 1.04, z * (t / 2 + 0.018)], rotation: [Math.PI / 2, 0, 0] });
    leaf.add(box(0.11, 0.016, 0.016, 0.007), 'brass', { position: [lw - 0.11, 1.04, z * (t / 2 + 0.032)] });
  }
  for (const y of [0.25, 1.04, 1.83]) { b.add(cyl(0.007, 0.007, 0.1, 12), 'brass', { position: [-w / 2 + 0.004, y, -0.002] }); leaf.add(box(0.03, 0.09, 0.003), 'brass', { position: [0.012, y, t / 2 + 0.001] }); }
  return b.build();
}

// ---------------------------------------------------------------- a big fiddle-leaf fig for the corner
export function createPlant() {
  const b = new Builder('plant');
  b.add(lathe([[0, 0], [0.13, 0], [0.16, 0.06], [0.175, 0.36], [0.182, 0.4], [0.17, 0.4], [0.16, 0.37], [0.14, 0.05], [0, 0.05]], 48), 'ceramicDark');
  b.add(cyl(0.16, 0.16, 0.02, 32), 'soil', { position: [0, 0.37, 0] });
  const R = rng(17);
  const branches = [[[0, 0.37, 0], [0.01, 0.8, 0.01], [-0.02, 1.25, 0.02], [0.02, 1.62, 0]], [[0, 0.9, 0], [0.12, 1.05, 0.05], [0.22, 1.28, 0.08]], [[0, 1.0, 0.01], [-0.12, 1.15, -0.04], [-0.22, 1.36, -0.06]]];
  for (const br of branches) {
    b.add(tube(br, 0.012, 24, 8), 'bark');
    const curve = new THREE.CatmullRomCurve3(br.map(p => new THREE.Vector3(...p)));
    const n = br === branches[0] ? 12 : 7;
    for (let i = 0; i < n; i++) {
      const t = 0.35 + 0.65 * i / (n - 1), p = curve.getPoint(t), a = i * 2.4 + R(), l = 0.18 + R() * 0.12;
      b.add(leafGeometry(l, l * 0.62, 0.22, 0.35), R() < 0.5 ? 'leaf' : 'leafDark', { position: p.toArray(), rotation: [0.8 + R() * 0.6, a, 0], order: 'YXZ' });
    }
  }
  return b.build();
}
// a sheer curtain panel, gathered in soft folds; hangs from y = 0 down by h
export function createCurtain(w, h) {
  const g = new THREE.PlaneGeometry(w, h, 40, 1); g.translate(0, -h / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, Math.sin(x / w * Math.PI * 7) * 0.035 + Math.sin(x / w * Math.PI * 2.3) * 0.012 * (1 - y / -h)); }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat('linen')); m.castShadow = false; m.receiveShadow = true; m.name = 'curtain';
  return m;
}
