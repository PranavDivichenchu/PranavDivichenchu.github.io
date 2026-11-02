// Modeling kit for the room's procedural models.
// Units: metres, +Y up. Every model faces +Z and sits on y = 0 at its footprint centre.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export { THREE };

export const PALETTE = {
  pr: 0xe6692b,   // product accent: Karana orange
  ai: 0x4fb4ff,   // systems / AI accent: blue
  ink: 0x101216,
};

// ---------------------------------------------------------------- canvas helpers
export function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
export function tex(c, { repeat, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
export function rng(seed = 1) { let s = seed; return () => (s = s * 16807 % 2147483647) / 2147483647; }
export function rrect(g, x, y, w, h, r) { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); }
export function wrapLines(g, text, maxW) {
  const out = []; let line = '';
  for (const w of text.split(' ')) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }
  if (line) out.push(line);
  return out;
}
function noise(g, w, h, cells, alpha, mode = 'overlay', r = Math.random) {
  const [n, ng] = canvas(cells, cells);
  const img = ng.createImageData(cells, cells);
  for (let i = 0; i < img.data.length; i += 4) { const v = r() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  ng.putImageData(img, 0, 0);
  g.save(); g.globalAlpha = alpha; g.globalCompositeOperation = mode; g.imageSmoothingEnabled = true; g.drawImage(n, 0, 0, w, h); g.restore();
}
// Wood: long wavy grain lines along u, a few darker growth bands, the odd knot.
function grainTexture(base, dark, light, seed = 3) {
  const W = 512, H = 512, [c, g] = canvas(W, H), r = rng(seed);
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 14; i++) { const y = r() * H, h = 8 + r() * 40; g.fillStyle = dark; g.globalAlpha = 0.05 + r() * 0.08; g.fillRect(0, y, W, h); }
  g.globalAlpha = 1;
  for (let i = 0; i < 220; i++) {
    const y0 = r() * H, amp = 2 + r() * 6, f = 0.004 + r() * 0.01, ph = r() * 6;
    g.strokeStyle = r() < 0.7 ? dark : light; g.globalAlpha = 0.08 + r() * 0.2; g.lineWidth = 0.6 + r() * 1.8;
    g.beginPath(); for (let x = 0; x <= W; x += 16) { const y = y0 + Math.sin(x * f + ph) * amp; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
  }
  for (let i = 0; i < 2; i++) {
    const cx = r() * W, cy = r() * H;
    for (let k = 0; k < 7; k++) { g.strokeStyle = dark; g.globalAlpha = 0.12; g.lineWidth = 1.4; g.beginPath(); g.ellipse(cx, cy, 30 + k * 9, 5 + k * 3, 0, 0, Math.PI * 2); g.stroke(); }
  }
  g.globalAlpha = 1; noise(g, W, H, 128, 0.06, 'overlay', r);
  return tex(c, { repeat: [1, 1] });
}
function speckleTexture(base, spread = 0.18, seed = 5, cells = 256, repeat = [2, 2]) {
  const W = 256, [c, g] = canvas(W, W), r = rng(seed);
  g.fillStyle = base; g.fillRect(0, 0, W, W);
  noise(g, W, W, cells, spread, 'overlay', r); noise(g, W, W, 32, spread * 0.6, 'overlay', r);
  return tex(c, { repeat });
}
function marbleTexture() {
  const W = 512, [c, g] = canvas(W, W), r = rng(11);
  g.fillStyle = '#f1efea'; g.fillRect(0, 0, W, W);
  for (let i = 0; i < 18; i++) {
    let x = r() * W, y = r() * W; g.strokeStyle = `rgba(120,118,112,${0.08 + r() * 0.18})`; g.lineWidth = 0.6 + r() * 2.2;
    g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 30; k++) { x += (r() - 0.3) * 30; y += (r() - 0.5) * 24; g.lineTo(x, y); } g.stroke();
  }
  noise(g, W, W, 128, 0.05, 'overlay', r);
  return tex(c);
}

// ---------------------------------------------------------------- materials
// One shared instance per name, so the whole room batches by material.
const std = (o) => new THREE.MeshStandardMaterial(o);
const phys = (o) => new THREE.MeshPhysicalMaterial(o);
const defs = {
  aluminum:     () => std({ color: 0xc8ccd1, metalness: 1, roughness: 0.32 }),
  aluminumDark: () => std({ color: 0x70767e, metalness: 1, roughness: 0.4 }),
  spaceGrey:    () => std({ color: 0x5c6068, metalness: 0.9, roughness: 0.36 }),
  chrome:       () => std({ color: 0xdfe3e8, metalness: 1, roughness: 0.12 }),
  steel:        () => std({ color: 0x8b9199, metalness: 1, roughness: 0.28 }),
  blackMetal:   () => std({ color: 0x1b1d21, metalness: 0.6, roughness: 0.42 }),
  plasticBlack: () => std({ color: 0x141518, metalness: 0, roughness: 0.5 }),
  plasticGrey:  () => std({ color: 0x3a3d43, metalness: 0, roughness: 0.55 }),
  plasticWhite: () => std({ color: 0xebe8e2, metalness: 0, roughness: 0.45 }),
  plasticCream: () => std({ color: 0xf2eee6, metalness: 0, roughness: 0.55 }),
  glassBlack:   () => phys({ color: 0x08090b, metalness: 0, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.05 }),
  gold:         () => std({ color: 0xe0ad48, metalness: 1, roughness: 0.22 }),
  silver:       () => std({ color: 0xd6dade, metalness: 1, roughness: 0.18 }),
  brass:        () => std({ color: 0xc09040, metalness: 1, roughness: 0.3 }),
  copper:       () => std({ color: 0xc27a45, metalness: 1, roughness: 0.3 }),
  accentOrange: () => std({ color: PALETTE.pr, metalness: 0, roughness: 0.45 }),
  accentBlue:   () => std({ color: PALETTE.ai, metalness: 0, roughness: 0.45 }),
  navy:         () => std({ color: 0x1c2a5c, metalness: 0, roughness: 0.55 }),
  techGold:     () => std({ color: 0xb3a369, metalness: 0.15, roughness: 0.5 }),
  techNavy:     () => std({ color: 0x003057, metalness: 0, roughness: 0.6 }),
  mizzouGold:   () => std({ color: 0xf1b82d, metalness: 0, roughness: 0.5 }),
  red:          () => std({ color: 0xc9372c, metalness: 0, roughness: 0.5 }),
  green:        () => std({ color: 0x3d9a5b, metalness: 0, roughness: 0.5 }),
  purple:       () => std({ color: 0x7b5cd6, metalness: 0, roughness: 0.5 }),
  rubber:       () => std({ color: 0x111112, metalness: 0, roughness: 0.92 }),
  walnut:       () => std({ map: grainTexture('#6b4a34', '#2e1c10', '#8a6448', 3), roughness: 0.5, metalness: 0 }),
  oak:          () => std({ map: grainTexture('#d2ad7c', '#8e6438', '#ead0a6', 7), roughness: 0.55, metalness: 0 }),
  wood:         () => std({ map: grainTexture('#9c6d45', '#5a3a20', '#bf8f62', 9), roughness: 0.6, metalness: 0 }),
  woodDark:     () => std({ map: grainTexture('#4a3222', '#24160c', '#6a4a34', 13), roughness: 0.6, metalness: 0 }),
  fabric:       () => std({ map: speckleTexture('#45484f', 0.35, 5), roughness: 1, metalness: 0 }),
  fabricLight:  () => std({ map: speckleTexture('#d9d2c4', 0.25, 6), roughness: 1, metalness: 0 }),
  linen:        () => std({ map: speckleTexture('#f3efe6', 0.12, 8, 256, [3, 3]), roughness: 1, metalness: 0, side: THREE.DoubleSide }),
  felt:         () => std({ map: speckleTexture('#2c3b2f', 0.3, 9), roughness: 1, metalness: 0 }),
  grass:        () => std({ map: speckleTexture('#5a8a3c', 0.45, 10, 256, [3, 3]), roughness: 1, metalness: 0 }),
  marble:       () => std({ map: marbleTexture(), roughness: 0.22, metalness: 0 }),
  paper:        () => std({ color: 0xf4f1ea, metalness: 0, roughness: 0.9 }),
  newsprint:    () => std({ color: 0xdcd6ca, metalness: 0, roughness: 0.95 }),
  ceramic:      () => phys({ color: 0xf4f1ea, metalness: 0, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
  ceramicDark:  () => phys({ color: 0x2b2d31, metalness: 0, roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.25 }),
  terracotta:   () => std({ color: 0xb2643f, metalness: 0, roughness: 0.85 }),
  soil:         () => std({ color: 0x2e2118, metalness: 0, roughness: 1 }),
  leaf:         () => std({ color: 0x3f8a3a, metalness: 0, roughness: 0.55, side: THREE.DoubleSide }),
  leafDark:     () => std({ color: 0x2a6431, metalness: 0, roughness: 0.55, side: THREE.DoubleSide }),
  leafLight:    () => std({ color: 0x6bb04f, metalness: 0, roughness: 0.55, side: THREE.DoubleSide }),
  stem:         () => std({ color: 0x4e7a3a, metalness: 0, roughness: 0.8 }),
  bark:         () => std({ color: 0x5a3e2b, metalness: 0, roughness: 0.9 }),
  bread:        () => std({ color: 0xcf9150, metalness: 0, roughness: 0.85 }),
  breadCrust:   () => std({ color: 0x9a5a26, metalness: 0, roughness: 0.8 }),
  schoolWall:   () => std({ color: 0xf3eadb, metalness: 0, roughness: 0.8 }),
  brick:        () => std({ color: 0xa3523d, metalness: 0, roughness: 0.85 }),
  schoolRoof:   () => std({ color: 0xb33a2e, metalness: 0, roughness: 0.7 }),
  skin1:        () => std({ color: 0xc58c64, metalness: 0, roughness: 0.7 }),
  skin2:        () => std({ color: 0x8d5a3b, metalness: 0, roughness: 0.7 }),
  skin3:        () => std({ color: 0xe8b996, metalness: 0, roughness: 0.7 }),
  screenOff:    () => std({ color: 0x040506, metalness: 0.2, roughness: 0.18 }),
  glass:        () => std({ color: 0xcfe6ff, metalness: 0, roughness: 0.05, transparent: true, opacity: 0.14, depthWrite: false }),
  ledWarm:      () => std({ color: 0x000000, emissive: 0xffd6a0, emissiveIntensity: 2.2 }),
  ledOrange:    () => std({ color: 0x000000, emissive: PALETTE.pr, emissiveIntensity: 3 }),
  ledBlue:      () => std({ color: 0x000000, emissive: PALETTE.ai, emissiveIntensity: 3 }),
  ledGreen:     () => std({ color: 0x000000, emissive: 0x3ddc84, emissiveIntensity: 3 }),
  lampGlow:     () => std({ color: 0xfff6e8, emissive: 0xffe2b8, emissiveIntensity: 1.6, roughness: 0.6 }),
  lampShade:    () => std({ color: 0xf6efe2, emissive: 0xffd9a8, emissiveIntensity: 0.9, roughness: 1, side: THREE.DoubleSide }),
  cloudGlow:    () => std({ color: 0xffffff, emissive: 0xfff1de, emissiveIntensity: 1.25, roughness: 0.9 }),
  flame:        () => std({ color: 0xffb347, emissive: 0xff8c1a, emissiveIntensity: 3 }),
  flameCore:    () => std({ color: 0xfff3c4, emissive: 0xfff0b0, emissiveIntensity: 3.5 }),
  atomC:        () => phys({ color: 0x34373d, metalness: 0, roughness: 0.3, clearcoat: 0.8 }),
  atomN:        () => phys({ color: 0x3b6cf6, metalness: 0, roughness: 0.3, clearcoat: 0.8 }),
  atomO:        () => phys({ color: 0xe24a3b, metalness: 0, roughness: 0.3, clearcoat: 0.8 }),
  atomS:        () => phys({ color: 0xe8c23a, metalness: 0, roughness: 0.3, clearcoat: 0.8 }),
  atomH:        () => phys({ color: 0xf2f2f2, metalness: 0, roughness: 0.3, clearcoat: 0.8 }),
  bond:         () => std({ color: 0xbfc4ca, metalness: 0.4, roughness: 0.4 }),
};
const cache = new Map();
export function mat(name) {
  if (!cache.has(name)) {
    if (!defs[name]) throw new Error('kit: unknown material "' + name + '"');
    const m = defs[name](); m.name = name; cache.set(name, m);
  }
  return cache.get(name);
}

// ---------------------------------------------------------------- geometry helpers
export const box = (w, h, d, r = 0, seg = 2) =>
  r > 0 ? new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4)) : new THREE.BoxGeometry(w, h, d);
export const cyl = (rt, rb, h, seg = 24, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
export const sphere = (r, ws = 24, hs = 16) => new THREE.SphereGeometry(r, ws, hs);
export const torus = (r, t, rs = 12, ts = 36, arc = Math.PI * 2) => new THREE.TorusGeometry(r, t, rs, ts, arc);
export const cone = (r, h, seg = 24) => new THREE.ConeGeometry(r, h, seg);
export const capsule = (r, len, cs = 6, rs = 12) => new THREE.CapsuleGeometry(r, len, cs, rs);
export const lathe = (points, seg = 40) => new THREE.LatheGeometry(points.map(p => new THREE.Vector2(p[0], p[1])), seg);
/** Extrude a 2D shape (in the XY plane) by `depth` along +Z, centred on z = 0. */
export function extrude(shape, depth, bevel = 0, curveSegments = 16) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments });
  g.translate(0, 0, -depth / 2);
  return g;
}
export function roundedRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
/** A slab with rounded corners in its own plane: w × h, `d` thick, facing +Z. */
export const panel = (w, h, d, r, bevel = 0) => extrude(roundedRect(w, h, r), d, bevel, 10);
/** Tube along a smooth curve through points. */
export function tube(points, r, seg = 48, radial = 10, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), closed);
  return new THREE.TubeGeometry(curve, seg, r, radial, closed);
}
/** A leaf that grows along +Y and faces +Z, bent back along its length and cupped across it. */
export function leafGeometry(len, width, bend = 0.3, cup = 0.5, segs = 12) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(width * 0.62, len * 0.18, width * 0.58, len * 0.72, 0, len);
  s.bezierCurveTo(-width * 0.58, len * 0.72, -width * 0.62, len * 0.18, 0, 0);
  const g = new THREE.ShapeGeometry(s, segs);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), t = y / len; p.setZ(i, -bend * len * t * t + cup * (x * x) / width); }
  g.computeVertexNormals();
  return g;
}
/** A plane that shows a canvas, unlit (screens, signs) or lit (posters, paper). */
export function screenPlane(w, h, texture, { lit = false, color = 0xffffff, transparent = false } = {}) {
  const m = lit ? new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85, color, transparent })
    : new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, color, transparent });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
}
/** A canvas-textured plane, drawn once by `draw(g, w, h)`. */
export function paintedPlane(w, h, px, draw, opts = {}) {
  const [c, g] = canvas(px, Math.round(px * h / w)); draw(g, c.width, c.height);
  return screenPlane(w, h, tex(c), { lit: true, ...opts });
}

// ---------------------------------------------------------------- builder
// Collects geometry per material, then merges each material into one mesh.
// Parts (Builder.part) stay separate objects so the room can animate them.
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
function matrixOf(t = {}) {
  _p.fromArray(t.position || [0, 0, 0]);
  _q.setFromEuler(_e.set(...(t.rotation || [0, 0, 0]), t.order || 'XYZ'));
  const s = t.scale == null ? [1, 1, 1] : typeof t.scale === 'number' ? [t.scale, t.scale, t.scale] : t.scale;
  _s.fromArray(s);
  return _m.compose(_p, _q, _s).clone();
}

export class Builder {
  constructor(name = 'model') { this.name = name; this.items = []; this.parts = []; this.objects = []; }
  /** add(geometry, materialName, { position, rotation, scale, order }) */
  add(geometry, material, t) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    g.morphAttributes = {};
    g.applyMatrix4(matrixOf(t));
    this.items.push({ g, material });
    return this;
  }
  /** A named, separately-transformable sub-assembly. Geometry added to it is local to its pivot. */
  part(name, t = {}) { const b = new Builder(name); b.transform = t; this.parts.push(b); return b; }
  /** Add a ready-made Object3D (e.g. a textured screen plane) with its own material. */
  object(obj, t = {}) {
    if (t.position) obj.position.fromArray(t.position);
    if (t.rotation) obj.rotation.set(...t.rotation);
    if (t.scale != null) typeof t.scale === 'number' ? obj.scale.setScalar(t.scale) : obj.scale.fromArray(t.scale);
    this.objects.push(obj); return obj;
  }
  build() {
    const group = new THREE.Group(); group.name = this.name;
    const byMat = new Map();
    for (const it of this.items) { if (!byMat.has(it.material)) byMat.set(it.material, []); byMat.get(it.material).push(it.g); }
    for (const [name, gs] of byMat) {
      const merged = gs.length === 1 ? gs[0] : mergeGeometries(gs, false);
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mat(name));
      mesh.name = this.name + ':' + name; mesh.castShadow = true; mesh.receiveShadow = true;
      group.add(mesh);
    }
    for (const o of this.objects) group.add(o);
    for (const p of this.parts) {
      const child = p.build();
      const t = p.transform || {};
      if (t.position) child.position.fromArray(t.position);
      if (t.rotation) child.rotation.set(...t.rotation);
      if (t.scale != null) typeof t.scale === 'number' ? child.scale.setScalar(t.scale) : child.scale.fromArray(t.scale);
      group.add(child);
    }
    return group;
  }
}
