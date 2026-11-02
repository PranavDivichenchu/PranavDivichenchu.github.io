// Pranav Divichenchu — the studio.
// A room you can look around. Each station is a project or a job; clicking one flies the camera in and opens its
// panel. Content lives in the page's HTML (so it also works as a plain list view).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildShell, pinCards, blob, place, onWall, ROOM, DOORWAY, WALLS } from './shell.js';
import * as M from './models.js';
import { canvas, rrect, wrapLines } from './kit.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const tier = new URLSearchParams(location.search).get('tier') || (coarse || (navigator.hardwareConcurrency || 8) <= 4 ? 'low' : 'high');
const X0 = -ROOM.W / 2, X1 = ROOM.W / 2, Z0 = -ROOM.D / 2, Z1 = ROOM.D / 2;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------ stations, clockwise from the first wall
// back wall 01 Karana, 02 FHIR · right wall 03 Cloud9, 04 Politheon (under the window), 05 Mizzou (the easel) ·
// front wall 06 B2Alpha (the rack), 07 Sprout and 08 Nexus (the trophies), 09 Vibez and 10 AEGIS (the workstation),
// 11 Khali (the side table), 12 More (the pinboard), 13 About (the bookcase) · left wall 14 the school, 15 the door.
// fit = the [w, h] in metres that must stay in frame. Every view is aimed once its object is placed.
const STATIONS = {
  karana:    { label: 'Karana', sub: '1M views · 5,000 users', disc: 'pr', fit: [1.15, 0.62] },
  fhir:      { label: 'FHIR', sub: 'Real health records', disc: 'ai', fit: [1.65, 1.15] },
  cloud9:    { label: 'Cloud9', sub: 'AI intern · infrastructure', disc: 'ai', fit: [1.2, 1.3] },
  politheon: { label: 'Politheon', sub: 'ML intern · bill passage', disc: 'ai', fit: [1.0, 0.55] },
  mizzou:    { label: 'Mizzou', sub: 'Research · 13M articles', disc: 'ai', fit: [0.78, 1.0] },
  b2alpha:   { label: 'B2Alpha', sub: 'Agents that pay businesses', disc: 'ai', fit: [0.8, 1.5] },
  sprout:    { label: 'Sprout', sub: 'Winner · MHacks 2026', disc: 'ai', fit: [0.34, 0.46] },
  nexus:     { label: 'Nexus', sub: '1st place · HackFax 2026', disc: 'ai', fit: [0.34, 0.48] },
  vibez:     { label: 'Vibez', sub: 'A visual IDE', disc: 'pr', fit: [0.72, 0.44] },
  aegis:     { label: 'AEGIS', sub: 'GANs for drug discovery', disc: 'ai', fit: [0.26, 0.3] },
  khali:     { label: 'Khali', sub: 'TikTok for news', disc: 'pr', fit: [0.56, 0.42] },
  more:      { label: 'More', sub: 'Awards & earlier work', disc: '', fit: [1.42, 0.92] },
  about:     { label: 'About', sub: 'Education & skills', disc: '', fit: [1.15, 2.35] },
  school:    { label: 'The school', sub: 'One day', disc: 'pr', fit: [0.98, 0.78] },
  contact:   { label: 'Contact', sub: 'Open the door', disc: '', fit: [1.3, 2.25] },
};
const ids = Object.keys(STATIONS);
ids.forEach((id, i) => { STATIONS[id].n = String(i + 1).padStart(2, '0'); });
// a little in front of the middle, facing the first wall: name, welcome note and 01–02 in view
const HOME = { pos: V(0, 1.6, 1.0), yaw: 0, pitch: -0.14 };

// ------------------------------------------------------------------ renderer
const canvasEl = $('#room');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, powerPreference: 'high-performance' }); }
catch (e) { window.listOnly?.(); throw e; }
const DPR = { max: tier === 'high' ? 1.75 : 1.5, budget: tier === 'high' ? 2.2e6 : 1.1e6, cap: Infinity, drops: 0 };
const minDpr = () => Math.min(0.85, devicePixelRatio);
const pickDpr = () => Math.max(minDpr(), Math.min(devicePixelRatio, DPR.max, DPR.cap, Math.sqrt(DPR.budget / (innerWidth * innerHeight))));
renderer.setPixelRatio(pickDpr());
renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;   // nothing big moves: shadows are drawn once, and again only while the door swings

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9e6e0);
let environmentTarget;
function rebuildEnvironment() {
  try {
    environmentTarget?.dispose();
    const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
    environmentTarget = pmrem.fromScene(room, 0.04);
    scene.environment = environmentTarget.texture;
    room.dispose(); pmrem.dispose();
  } catch (e) { console.warn('environment', e); }
}
rebuildEnvironment();
scene.environmentIntensity = 0.55;
const camera = new THREE.PerspectiveCamera(innerWidth < 760 ? 70 : 56, innerWidth / innerHeight, 0.02, 30);
camera.position.copy(HOME.pos);
camera.layers.enable(2);   // the walls and ceiling live on layer 2 (they block the sun, not the key light)

// ------------------------------------------------------------------ loading
const loader = $('#loader'), bar = $('#loadbar');
let loaded = 0; const TOTAL = 5;
function progress(label) { loaded++; if (bar) bar.style.transform = `scaleX(${Math.min(1, loaded / TOTAL)})`; const l = $('#loadlabel'); if (label && l) l.textContent = label; }
const fontsLoaded = Promise.all(['500 40px Archivo', '600 40px Archivo', '700 40px Archivo', '300 40px Archivo', 'italic 600 40px Archivo', '600 20px "JetBrains Mono"', '700 20px "JetBrains Mono"'].map(f => document.fonts.load(f))).catch(() => {});
await Promise.race([fontsLoaded, new Promise(r => setTimeout(r, 2500))]);
progress('Wiring the lights');
const loadImage = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
const iconReady = loadImage('images/karana-icon.png');

function make(fn, ...a) { try { return fn(...a); } catch (e) { console.warn('model', fn.name, e); return new THREE.Group(); } }
const desk = make(M.createKaranaDesk), backpack = make(M.createBackpack), board = make(M.createWhiteboard);
const cloud = make(M.createCloudWall), credenza = make(M.createCredenza), capitol = make(M.createCapitol), bills = make(M.createBills);
const easel = make(M.createEasel), papers = make(M.createNewspaperStack), rack = make(M.createRack), shelf = make(M.createTrophyShelf);
const work = make(M.createWorkstation), side = make(M.createSideTable), lamp = make(M.createFloorLamp), books = make(M.createBookshelf);
const school = make(M.createSchoolTable), globe = make(M.createGlobe), clock = make(M.createClock), plant = make(M.createPlant);
const door = make(M.createDoor, DOORWAY.w, DOORWAY.h);
progress('Framing the room');

const shell = buildShell(scene, { tier, touch: coarse, door });
progress('Placing the work');

const icon = await iconReady;
const iconTex = icon ? new THREE.CanvasTexture((() => { const [c, g] = canvas(512, 640); g.fillStyle = '#f6efe6'; g.fillRect(0, 0, 512, 640); g.drawImage(icon, 56, 56, 400, 400); g.fillStyle = '#1b1d22'; g.font = '600 46px Archivo, Arial'; g.textAlign = 'center'; g.fillText('Karana', 256, 540); g.fillStyle = '#8a857c'; g.font = '500 22px "JetBrains Mono", monospace'; g.fillText('EST. AUGUST 2026', 256, 584); return c; })()) : null;
if (iconTex) iconTex.colorSpace = THREE.SRGBColorSpace;
const print = M.createFrame(0.42, 0.52, iconTex, { mount: 0.03 });

place(desk, 'back', -1.75, 0, 0.37);                      // 01
place(print, 'back', -1.75, 1.6, 0);
backpack.position.set(-0.86, 0, -2.56); backpack.rotation.set(-0.12, -0.35, 0);
place(board, 'back', 1.6, 1.5, 0);                        // 02
place(cloud, 'right', -1.75, 1.5, 0);                     // 03
place(credenza, 'right', 0.2, 0, 0.215);                  // 04
place(capitol, 'right', 0.02, 0.6, 0.21);
place(bills, 'right', 0.58, 0.6, 0.22, -0.25);
place(easel, 'right', 1.12, 0, 0.62, -0.4);              // 05
papers.position.set(2.62, 0, 1.78); papers.rotation.y = 0.4;
place(rack, 'front', -2.5, 0, 0.37);                      // 06
place(shelf, 'front', -1.2, 0, 0);                        // 07, 08 (and the bread, 12)
place(work, 'front', -1.2, 0, 0.4);                       // 09, 10
place(side, 'front', 0.25, 0, 0.42);                      // 11, under the pinboard (12)
lamp.position.set(-0.92, 0, 2.42);
place(books, 'front', 1.85, 0, 0.17);                     // 13
place(school, 'left', -1.4, 0, 0.32);                     // 14
place(clock, 'left', -1.4, 2.14, 0);
place(globe, 'left', -0.25, 0, 0.36);
plant.position.set(X0 + 0.38, 0, Z1 - 0.36); plant.rotation.y = 0.6;
const placed = [desk, print, backpack, board, cloud, credenza, capitol, bills, easel, papers, rack, shelf, work, side, lamp, books, school, clock, globe, plant];
scene.add(...placed);
for (const o of [...placed, door]) o.traverse(m => { if (m.isMesh) m.receiveShadow = true; });
// what moves stays out of the (static) shadow maps
for (const [root, name] of [[desk, 'flame'], [work, 'molecule'], [school, 'planePivot'], [school, 'flag'], [globe, 'globeSpin'], [clock, 'clockH'], [clock, 'clockM'], [clock, 'clockS'], [rack, 'rackLeds']]) root.getObjectByName(name)?.traverse(m => { m.castShadow = false; });
for (const [o, w, d, op] of [[plant, 0.5, 0.5, 0.42], [desk, 1.5, 0.8, 0.3], [rack, 0.7, 0.8, 0.45], [work, 1.7, 0.85, 0.28], [side, 0.65, 0.65, 0.32], [books, 1.0, 0.4, 0.38], [school, 1.0, 0.7, 0.3], [credenza, 1.3, 0.5, 0.36], [globe, 0.4, 0.4, 0.35], [easel, 0.8, 0.7, 0.25], [lamp, 0.35, 0.35, 0.35], [backpack, 0.35, 0.25, 0.35]]) {
  const s = blob(w, d, op); s.position.x = o.position.x; s.position.z = o.position.z; s.rotation.z = o.rotation.y; scene.add(s);
}
scene.updateMatrixWorld(true);

// ------------------------------------------------------------------ aim every station at its object
const worldOf = (root, name) => { const o = name ? root.getObjectByName(name) : root; return o ? o.getWorldPosition(V(0, 0, 0)) : V(0, 1, 0); };
const centerOf = o => new THREE.Box3().setFromObject(o).getCenter(V(0, 0, 0));
function aimWall(id, look, wall, dist, up = 0.1, sideways = 0) {
  const w = WALLS[wall];
  STATIONS[id].view = { look: look.toArray(), pos: look.clone().add(V(w.n[0] * dist + w.t[0] * sideways, up, w.n[1] * dist + w.t[1] * sideways)).toArray() };
}
const phonePos = worldOf(desk, 'phoneScreen'), laptopPos = worldOf(desk, 'laptopScreen');
const deskLook = phonePos.clone().lerp(laptopPos, 0.5); deskLook.y = 0.86;
aimWall('karana', deskLook, 'back', 0.95, 0.62, -0.12);
aimWall('fhir', worldOf(board), 'back', 1.45, 0.04);
const tvPos = worldOf(cloud, 'tvScreen');
aimWall('cloud9', tvPos.clone().add(V(0, 0.13, 0)), 'right', 1.45, 0.0);
const capPos = worldOf(capitol).add(V(0, 0.14, 0));
aimWall('politheon', capPos.clone().add(V(0, 0, 0.2)), 'right', 1.0, 0.34, 0.0);
const posterPos = worldOf(easel, 'posterFace');
{ const f = V(Math.sin(easel.rotation.y), 0, Math.cos(easel.rotation.y)); STATIONS.mizzou.view = { look: posterPos.toArray(), pos: posterPos.clone().addScaledVector(f, 1.4).add(V(0, 0.08, 0)).toArray() }; }
aimWall('b2alpha', centerOf(rack).add(V(0, 0.05, 0)), 'front', 1.35, 0.28, 0.85);
const sproutPos = worldOf(shelf, 'trophySprout').add(V(0, 0.2, 0)), nexusPos = worldOf(shelf, 'trophyNexus').add(V(0, 0.21, 0));
aimWall('sprout', sproutPos, 'front', 0.62, 0.05, -0.08);
aimWall('nexus', nexusPos, 'front', 0.62, 0.05, 0.08);
const monitorPos = worldOf(work, 'monitorScreen');
aimWall('vibez', monitorPos, 'front', 0.85, 0.05);
const molPos = worldOf(work, 'molecule');
aimWall('aegis', molPos, 'front', 0.42, 0.1, 0.12);
const tabletPos = worldOf(side, 'tabletScreen');
aimWall('khali', tabletPos.clone().add(V(0.05, -0.04, 0)), 'front', 0.62, 0.28, -0.06);
const boardPos = onWall('front', 0.25, 1.85, 0.03);
aimWall('more', boardPos, 'front', 1.4, 0.0);
const booksPos = centerOf(books).add(V(0, 0.1, 0));
aimWall('about', booksPos, 'front', 2.0, 0.1, -0.1);
const schoolPos = worldOf(school, 'schoolModel').add(V(0, 0.18, 0));
aimWall('school', schoolPos, 'left', 1.05, 0.42, 0.1);
aimWall('contact', onWall('left', DOORWAY.u, 1.1, 0), 'left', 1.95, 0.25, -0.25);

// ------------------------------------------------------------------ screens (canvases redrawn while they're seen)
const SANS = 'Archivo, system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
function canvasTex(w, h, scale = 1) { const [c, g] = canvas(w, h); g.scale(scale, scale); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; return { c, g, t, W: w / scale, H: h / scale }; }
function lightScreen(mesh, tx, color = 0xd8d8d8) { if (mesh) mesh.material = new THREE.MeshBasicMaterial({ map: tx.t, toneMapped: false, color }); }

// 01 the phone: Karana's home screen
const phone = canvasTex(480, 1032, 0.8);
const SADHANA = [['Breathwork', 'Guided pranayama, follow the circle', '#3ddc84'], ['Gita 2.47', 'Today’s verse, with its meaning', '#4fb4ff'], ['Hinduism 101', 'Next episode you have not finished', '#9b6cf6'], ['Silent meditation', 'Three minutes with a soft bell', '#f2b23d']];
function drawPhone(t, done) {
  const { g, t: tx, W, H } = phone;
  g.fillStyle = '#fff6ee'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#1b1d22'; g.font = `600 30px ${SANS}`; g.textBaseline = 'middle'; g.fillText('9:41', 56, 58);
  g.textAlign = 'right'; g.font = `600 22px ${SANS}`; g.fillText('5G  ▮▮▮▮', W - 50, 58); g.textAlign = 'left';
  g.fillStyle = '#1b1d22'; g.font = `700 46px ${SANS}`; g.fillText('Namaste', 40, 150);
  if (icon) { g.save(); rrect(g, W - 118, 118, 68, 68, 18); g.clip(); g.drawImage(icon, W - 118, 118, 68, 68); g.restore(); }
  const grd = g.createLinearGradient(32, 210, W - 32, 420); grd.addColorStop(0, '#f07a2c'); grd.addColorStop(1, '#e65a1f');
  g.fillStyle = grd; rrect(g, 32, 210, W - 64, 220, 30); g.fill();
  g.fillStyle = 'rgba(255,255,255,.75)'; g.font = `700 20px ${MONO}`; g.fillText('KINDLED LIGHT', 64, 252);
  g.fillStyle = '#fff'; g.font = `800 62px ${SANS}`; g.fillText('12 days', 64, 312);
  g.font = `500 24px ${SANS}`; g.fillStyle = 'rgba(255,255,255,.85)'; g.fillText('The flame is lit', 64, 362);
  const fx = W - 150, fy = 330, fl = 1 + Math.sin(t * 9) * 0.06 + Math.sin(t * 23) * 0.04;
  g.fillStyle = '#7a3a12'; g.beginPath(); g.ellipse(fx, fy + 36, 70, 22, 0, 0, Math.PI); g.fill();
  g.fillStyle = '#ffd36b'; g.beginPath(); g.moveTo(fx, fy - 58 * fl); g.bezierCurveTo(fx + 40, fy - 20, fx + 30, fy + 20, fx, fy + 26); g.bezierCurveTo(fx - 30, fy + 20, fx - 40, fy - 20, fx, fy - 58 * fl); g.fill();
  g.fillStyle = '#fff3c4'; g.beginPath(); g.moveTo(fx, fy - 26 * fl); g.bezierCurveTo(fx + 16, fy, fx + 14, fy + 18, fx, fy + 22); g.bezierCurveTo(fx - 14, fy + 18, fx - 16, fy, fx, fy - 26 * fl); g.fill();
  for (let i = 0; i < 7; i++) { g.fillStyle = i < 5 ? '#fff' : 'rgba(255,255,255,.4)'; g.beginPath(); g.arc(70 + i * 30, 400, 9, 0, 7); g.fill(); }
  g.fillStyle = '#1b1d22'; g.font = `700 32px ${SANS}`; g.fillText('Today’s Sadhana', 40, 490);
  g.fillStyle = '#9a9388'; g.font = `600 22px ${MONO}`; g.textAlign = 'right'; g.fillText(`${done}/4`, W - 40, 490); g.textAlign = 'left';
  SADHANA.forEach(([k, s, col], i) => {
    const y = 530 + i * 120;
    g.fillStyle = '#fff'; rrect(g, 32, y, W - 64, 104, 24); g.fill();
    g.fillStyle = col + '33'; rrect(g, 56, y + 24, 56, 56, 16); g.fill();
    g.fillStyle = col; g.beginPath(); g.arc(84, y + 52, 10, 0, 7); g.fill();
    g.fillStyle = '#1b1d22'; g.font = `700 26px ${SANS}`; g.fillText(k, 132, y + 40);
    g.fillStyle = '#8a857c'; g.font = `500 19px ${SANS}`; g.fillText(s, 132, y + 72);
    if (i < done) { g.fillStyle = '#3ddc84'; g.beginPath(); g.arc(W - 76, y + 52, 16, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.moveTo(W - 84, y + 52); g.lineTo(W - 79, y + 58); g.lineTo(W - 68, y + 46); g.stroke(); }
    else { g.strokeStyle = '#d8d2c6'; g.lineWidth = 3; g.beginPath(); g.arc(W - 76, y + 52, 15, 0, 7); g.stroke(); }
  });
  g.fillStyle = '#fff'; rrect(g, 32, 1030, W - 64, 150, 24); g.fill();
  g.fillStyle = '#e6692b'; g.font = `700 18px ${MONO}`; g.fillText('TODAY’S GITA VERSE', 56, 1068);
  g.fillStyle = '#1b1d22'; g.font = `italic 500 24px ${SANS}`; wrapLines(g, 'You have a right to your work, never to its fruits.', W - 120).forEach((l, i) => g.fillText(l, 56, 1108 + i * 32));
  g.fillStyle = '#fff'; rrect(g, 32, H - 96, W - 64, 76, 38); g.fill();
  ['⌂', '☰', '♪', '☉', '☺'].forEach((ch, i) => { const x = 90 + i * ((W - 180) / 4); if (i === 0) { g.fillStyle = '#ffe6d3'; g.beginPath(); g.arc(x, H - 58, 26, 0, 7); g.fill(); } g.fillStyle = i === 0 ? '#e6692b' : '#b8b1a6'; g.font = `600 30px ${SANS}`; g.textAlign = 'center'; g.fillText(ch, x, H - 56); });
  g.textAlign = 'left';
  tx.needsUpdate = true;
}
lightScreen(desk.getObjectByName('phoneScreen'), phone, 0xe2e2e2);

// 01 the laptop: Karana's numbers, counting up
const lap = canvasTex(900, 564);
function drawLaptop(k) {
  const { g, t: tx, W, H } = lap;
  g.fillStyle = '#121418'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#1c1f25'; g.fillRect(0, 0, W, 30);
  ['#ff5f57', '#febc2e', '#28c840'].forEach((col, i) => { g.fillStyle = col; g.beginPath(); g.arc(22 + i * 22, 15, 6, 0, 7); g.fill(); });
  g.fillStyle = 'rgba(255,255,255,.5)'; g.font = `500 14px ${SANS}`; g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillText('karana — dashboard', W / 2, 15); g.textAlign = 'left';
  g.fillStyle = '#9aa0a8'; g.font = `600 16px ${MONO}`; g.fillText('KARANA  ·  LIVE', 40, 70);
  g.fillStyle = '#3ddc84'; g.beginPath(); g.arc(28, 70, 5, 0, 7); g.fill();
  const e = 1 - Math.pow(1 - k, 3);
  const stat = (x, label, value, sub) => { g.fillStyle = '#6f757e'; g.font = `500 15px ${MONO}`; g.fillText(label, x, 120); g.fillStyle = '#ecebe6'; g.font = `300 60px ${SANS}`; g.fillText(value, x, 170); g.fillStyle = '#9aa0a8'; g.font = `500 15px ${SANS}`; g.fillText(sub, x, 214); };
  stat(40, 'VIEWS', Math.round(1000000 * e).toLocaleString('en-US'), 'App Store and Google Play');
  stat(450, 'USERS', Math.round(5000 * e).toLocaleString('en-US'), '11 languages');
  stat(680, 'PROFIT', '$' + Math.round(1500 * e).toLocaleString('en-US'), 'so far');
  g.strokeStyle = '#e6692b'; g.lineWidth = 3; g.beginPath();
  for (let i = 0; i <= 60; i++) { const x = 40 + i * (W - 80) / 60, y = H - 60 - (Math.pow(i / 60, 2.2) * 200 + Math.sin(i * 0.9) * 10) * e; i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke();
  const fill = g.createLinearGradient(0, H - 300, 0, H - 40); fill.addColorStop(0, 'rgba(230,105,43,.35)'); fill.addColorStop(1, 'rgba(230,105,43,0)');
  g.lineTo(W - 40, H - 40); g.lineTo(40, H - 40); g.closePath(); g.fillStyle = fill; g.fill();
  g.fillStyle = '#6f757e'; g.font = `500 13px ${MONO}`; g.fillText('AUG 2026', 40, H - 22); g.textAlign = 'right'; g.fillText('NOW', W - 40, H - 22); g.textAlign = 'left';
  tx.needsUpdate = true;
}
lightScreen(desk.getObjectByName('laptopScreen'), lap, 0xd8d8d8);

// 02 the whiteboard: how the FHIR backend signs in, in marker
{
  const [c, g] = canvas(1500, 1000);
  g.fillStyle = '#f7f6f2'; g.fillRect(0, 0, 1500, 1000);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const boxAt = (x, y, w, h, title, lines, col) => {
    g.strokeStyle = col; g.lineWidth = 6; g.beginPath(); g.moveTo(x + 3, y); g.lineTo(x + w - 2, y + 2); g.lineTo(x + w, y + h - 3); g.lineTo(x - 1, y + h); g.closePath(); g.stroke();
    g.fillStyle = col; g.font = `700 34px ${SANS}`; g.textBaseline = 'top'; g.fillText(title, x + 20, y + 16);
    g.fillStyle = '#2a2d33'; g.font = `500 24px ${MONO}`; lines.forEach((l, i) => g.fillText(l, x + 20, y + 64 + i * 32));
  };
  const arrow = (x0, y0, x1, y1, col, label) => {
    g.strokeStyle = col; g.lineWidth = 5; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2, y0 - 10, x1, y1); g.stroke();
    const a = Math.atan2(y1 - y0, x1 - x0); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 - 22 * Math.cos(a - 0.4), y1 - 22 * Math.sin(a - 0.4)); g.moveTo(x1, y1); g.lineTo(x1 - 22 * Math.cos(a + 0.4), y1 - 22 * Math.sin(a + 0.4)); g.stroke();
    if (label) { g.fillStyle = col; g.font = `600 22px ${MONO}`; g.textAlign = 'center'; g.fillText(label, (x0 + x1) / 2, Math.min(y0, y1) - 44); g.textAlign = 'left'; }
  };
  g.fillStyle = '#1b1d22'; g.font = `700 44px ${SANS}`; g.textBaseline = 'top'; g.fillText('SMART on FHIR · backend auth', 50, 44);
  g.strokeStyle = '#1b1d22'; g.lineWidth = 5; g.beginPath(); g.moveTo(50, 104); g.lineTo(690, 100); g.stroke();
  boxAt(60, 200, 330, 190, 'iOS app', ['Swift · async client', '4 patient tabs', 'JSON contracts'], '#2f6fb3');
  boxAt(570, 200, 360, 190, 'Flask API', ['RS384 JWT', 'JWKS (hosted)', '6 scopes'], '#1b1d22');
  boxAt(1110, 200, 330, 190, 'Cerner FHIR', ['R4 · sandbox', 'MedicationRequest', 'Patient · Condition'], '#e6692b');
  arrow(400, 295, 560, 295, '#2f6fb3', 'GET /meds');
  arrow(940, 295, 1100, 295, '#e6692b', 'bearer token');
  arrow(760, 400, 760, 520, '#1b1d22', '');
  g.fillStyle = '#1b1d22'; g.font = `600 26px ${MONO}`; g.fillText('client_assertion → token', 790, 450);
  g.strokeStyle = '#e6692b'; g.lineWidth = 6; g.beginPath(); g.moveTo(120, 560); g.lineTo(520, 560); g.lineTo(400, 760); g.lineTo(240, 760); g.closePath(); g.stroke();
  g.fillStyle = '#e6692b'; g.font = `700 54px ${SANS}`; g.fillText('742', 250, 580);
  g.fillStyle = '#2a2d33'; g.font = `500 22px ${MONO}`; g.fillText('medication records', 215, 640);
  g.fillStyle = '#e6692b'; g.font = `700 46px ${SANS}`; g.fillText('14', 290, 700);
  g.fillStyle = '#2a2d33'; g.font = `500 22px ${MONO}`; g.fillText('active orders, filtered by intent + status', 100, 800);
  g.fillStyle = '#1b1d22'; g.font = `700 30px ${SANS}`; g.fillText('tabs', 620, 600);
  ['Medications', 'Conditions', 'Labs', 'Vitals'].forEach((t, i) => { g.strokeStyle = '#2f6fb3'; g.lineWidth = 4; g.strokeRect(620 + i * 200, 650, 180, 70); g.fillStyle = '#2f6fb3'; g.font = `600 24px ${SANS}`; g.fillText(t, 636 + i * 200, 672); });
  g.fillStyle = '#2a2d33'; g.font = `500 22px ${MONO}`; g.fillText('contracts first, so both teams build in parallel', 620, 760);
  g.fillStyle = '#e6692b'; g.font = `700 28px ${SANS}`; g.fillText('✓ Cerner sandbox reads unlocked', 620, 860);
  for (let i = 0; i < 12; i++) { g.fillStyle = 'rgba(40,40,40,.03)'; g.beginPath(); g.ellipse(Math.random() * 1500, Math.random() * 1000, 60 + Math.random() * 80, 10 + Math.random() * 20, Math.random(), 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const face = board.getObjectByName('boardFace'); if (face) { face.material.map = t; face.material.needsUpdate = true; }
}

// 03 the wall display: Cloud9's marketplace, matching buyers to ranked vendors
const tv = canvasTex(1280, 720, 1);
const BUYERS = ['Restaurant group', 'Clinic network', 'Retail chain', 'Campus dining', 'Hotel group', 'Logistics co.'];
const VENDORS = [['Vendor 041', 0.94], ['Vendor 017', 0.91], ['Vendor 203', 0.88], ['Vendor 088', 0.84], ['Vendor 005', 0.81], ['Vendor 132', 0.77], ['Vendor 064', 0.73]];
function drawTV(t) {
  const { g, t: tx, W, H } = tv;
  g.fillStyle = '#0c1016'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#121822'; g.fillRect(0, 0, W, 70);
  g.fillStyle = '#3ddc84'; g.beginPath(); g.arc(40, 35, 7, 0, 7); g.fill();
  g.fillStyle = '#ecebe6'; g.font = `700 28px ${SANS}`; g.textBaseline = 'middle'; g.fillText('Marketplace', 60, 35);
  g.fillStyle = '#7d848d'; g.font = `500 18px ${MONO}`; g.fillText('MATCHING · LIVE', 248, 37);
  g.textAlign = 'right'; g.fillText('CLOUD RUN · CLOUD FUNCTIONS', W - 36, 37); g.textAlign = 'left';
  const active = Math.floor(t / 1.6) % BUYERS.length, k = (t / 1.6) % 1, match = (active * 3 + 1) % VENDORS.length;
  g.fillStyle = '#7d848d'; g.font = `600 16px ${MONO}`; g.fillText('BUYERS', 40, 112); g.fillText('VENDORS · RANKED ON PRICE + FIT', 760, 112);
  BUYERS.forEach((b, i) => {
    const y = 140 + i * 72, on = i === active;
    g.fillStyle = on ? '#16263a' : '#121822'; rrect(g, 36, y, 380, 58, 12); g.fill();
    if (on) { g.strokeStyle = '#4fb4ff'; g.lineWidth = 2; rrect(g, 36, y, 380, 58, 12); g.stroke(); }
    g.fillStyle = '#ecebe6'; g.font = `600 22px ${SANS}`; g.fillText(b, 58, y + 22);
    g.fillStyle = '#7d848d'; g.font = `500 15px ${MONO}`; g.fillText(i <= active ? 'matched' : 'waiting', 58, y + 44);
    if (i < active || (on && k > 0.6)) { g.fillStyle = '#3ddc84'; g.beginPath(); g.arc(392, y + 29, 8, 0, 7); g.fill(); }
  });
  VENDORS.forEach(([v, s], i) => {
    const y = 140 + i * 62, on = i === match;
    g.fillStyle = on ? '#1b2a1f' : '#121822'; rrect(g, 756, y, 488, 50, 10); g.fill();
    g.fillStyle = '#7d848d'; g.font = `600 16px ${MONO}`; g.fillText(String(i + 1).padStart(2, '0'), 774, y + 26);
    g.fillStyle = '#ecebe6'; g.font = `600 20px ${SANS}`; g.fillText(v, 812, y + 26);
    g.fillStyle = '#26303d'; rrect(g, 990, y + 18, 180, 14, 7); g.fill();
    g.fillStyle = on ? '#3ddc84' : '#4fb4ff'; rrect(g, 990, y + 18, 180 * s, 14, 7); g.fill();
    g.fillStyle = '#ecebe6'; g.font = `600 16px ${MONO}`; g.fillText(s.toFixed(2), 1182, y + 26);
  });
  const y0 = 140 + active * 72 + 29, y1 = 140 + match * 62 + 25, e = Math.min(1, k / 0.6);
  g.strokeStyle = 'rgba(79,180,255,.5)'; g.lineWidth = 3; g.beginPath(); g.moveTo(416, y0); g.bezierCurveTo(580, y0, 600, y1, 756, y1); g.stroke();
  const u = 1 - e, px = u ** 3 * 416 + 3 * u * u * e * 580 + 3 * u * e * e * 600 + e ** 3 * 756, py = u ** 3 * y0 + 3 * u * u * e * y0 + 3 * u * e * e * y1 + e ** 3 * y1;
  g.fillStyle = '#4fb4ff'; g.beginPath(); g.arc(px, py, 8, 0, 7); g.fill();
  ['INGEST', 'STORE', 'SCORE', 'MATCH'].forEach((s, i) => {
    const x = 36 + i * 196, on = Math.floor(t * 1.2) % 4 === i;
    g.fillStyle = on ? '#4fb4ff' : '#16202b'; rrect(g, x, H - 96, 176, 54, 27); g.fill();
    g.fillStyle = on ? '#0c1016' : '#9aa0a8'; g.font = `700 18px ${MONO}`; g.textAlign = 'center'; g.fillText(s, x + 88, H - 68); g.textAlign = 'left';
  });
  g.fillStyle = '#ecebe6'; g.font = `300 44px ${SANS}`; g.fillText('100+', 860, H - 76); g.fillText('200+', 1060, H - 76);
  g.fillStyle = '#7d848d'; g.font = `500 14px ${MONO}`; g.fillText('BUYERS MATCHED', 860, H - 40); g.fillText('VENDORS RANKED', 1060, H - 40);
  tx.needsUpdate = true;
}
lightScreen(cloud.getObjectByName('tvScreen'), tv, 0xdadada);

// 09 the monitor: Vibez, a codebase as a node graph, with two people in it
const mon = canvasTex(1280, 736, 0.8);
const NODES = [['fetchProducts', 160, 300, '#4fb4ff'], ['filterByCategory', 520, 180, '#4fb4ff'], ['renderGrid', 900, 300, '#9b6cf6'], ['onAddToCart', 520, 520, '#e6692b'], ['cart.update', 900, 620, '#e6692b'], ['checkout()', 1280, 470, '#3ddc84']];
const EDGES = [[0, 1], [1, 2], [0, 3], [3, 4], [4, 5], [2, 5]];
function drawMonitor(t) {
  const { g, t: tx, W, H } = mon;
  g.fillStyle = '#0d0f13'; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,255,255,.04)'; for (let x = 0; x < W; x += 40) g.fillRect(x, 0, 1, H); for (let y = 0; y < H; y += 40) g.fillRect(0, y, W, 1);
  g.fillStyle = '#15171c'; g.fillRect(0, 0, W, 54);
  g.fillStyle = '#ecebe6'; g.font = `700 24px ${SANS}`; g.textBaseline = 'middle'; g.fillText('vibez', 24, 27);
  g.fillStyle = '#9aa0a8'; g.font = `500 17px ${MONO}`; g.fillText('shop · main · graph built from what ran', 110, 27);
  const node = i => NODES[i].slice(1, 3);
  EDGES.forEach(([a, b], k) => {
    const [x0, y0] = node(a), [x1, y1] = node(b);
    g.strokeStyle = 'rgba(236,235,230,.3)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x0 + 130, y0); g.bezierCurveTo(x0 + 230, y0, x1 - 230, y1, x1 - 130, y1); g.stroke();
    const p = (t * 0.35 + k * 0.17) % 1, u = 1 - p;
    const px = u ** 3 * (x0 + 130) + 3 * u * u * p * (x0 + 230) + 3 * u * p * p * (x1 - 230) + p ** 3 * (x1 - 130);
    const py = u ** 3 * y0 + 3 * u * u * p * y0 + 3 * u * p * p * y1 + p ** 3 * y1;
    g.fillStyle = NODES[b][3]; g.beginPath(); g.arc(px, py, 6, 0, 7); g.fill();
  });
  NODES.forEach(([name, x, y, col]) => {
    g.fillStyle = '#1a1d24'; rrect(g, x - 130, y - 44, 260, 88, 16); g.fill();
    g.strokeStyle = col; g.lineWidth = 3; rrect(g, x - 130, y - 44, 260, 88, 16); g.stroke();
    g.fillStyle = col; g.fillRect(x - 130, y - 44, 8, 88);
    g.fillStyle = '#ecebe6'; g.font = `600 24px ${MONO}`; g.fillText(name, x - 108, y - 10);
    g.fillStyle = '#7d848d'; g.font = `500 16px ${MONO}`; g.fillText('ran 3 min ago · 2 edits', x - 108, y + 22);
  });
  const cur = (x, y, col, name) => { g.fillStyle = col; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 18, y + 14); g.lineTo(x + 8, y + 15); g.lineTo(x + 12, y + 26); g.lineTo(x + 7, y + 28); g.lineTo(x + 3, y + 17); g.lineTo(x - 2, y + 22); g.closePath(); g.fill(); g.font = `700 16px ${SANS}`; rrect(g, x + 18, y + 20, g.measureText(name).width + 20, 30, 8); g.fill(); g.fillStyle = '#0d0f13'; g.fillText(name, x + 28, y + 35); };
  cur(520 + Math.sin(t * 0.7) * 140, 330 + Math.cos(t * 0.5) * 60, '#e6692b', 'Pranav');
  cur(1000 + Math.sin(t * 0.4 + 2) * 180, 430 + Math.cos(t * 0.6 + 1) * 90, '#4fb4ff', 'Pranav’s agent');
  g.fillStyle = '#15171c'; g.fillRect(0, H - 44, W, 44);
  g.fillStyle = '#7d848d'; g.font = `500 16px ${MONO}`; g.fillText('3 teammates · 3 agents · presence, file claims and live edits over Supabase', 24, H - 22);
  tx.needsUpdate = true;
}
lightScreen(work.getObjectByName('monitorScreen'), mon, 0xd8d8d8);

// 11 the tablet: a Khali card
const tab = canvasTex(480, 688, 0.8);
function drawTablet(t) {
  const { g, t: tx, W, H } = tab;
  g.fillStyle = '#101216'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#1b1e25'; rrect(g, 24, 70, W - 48, H - 140, 32); g.fill();
  g.fillStyle = '#ecebe6'; g.font = `700 30px ${SANS}`; g.textBaseline = 'middle'; g.fillText('Khali', 40, 40);
  g.fillStyle = '#e6692b'; g.font = `700 16px ${MONO}`; g.fillText('ONE STORY · 50+ OUTLETS', 48, 110);
  g.fillStyle = '#ecebe6'; g.font = `700 34px ${SANS}`; wrapLines(g, 'City council approves a new transit line through Midtown', W - 110).forEach((l, i) => g.fillText(l, 48, 160 + i * 42));
  g.fillStyle = '#2a2e38'; rrect(g, 48, 320, W - 96, 180, 20); g.fill();
  g.fillStyle = '#9aa0a8'; g.font = `500 20px ${SANS}`; wrapLines(g, 'Supporters say it cuts commutes; critics point to the cost. Both sides, one card.', W - 140).forEach((l, i) => g.fillText(l, 68, 352 + i * 28));
  g.fillStyle = '#121419'; rrect(g, 48, 530, W - 96, 60, 30); g.fill();
  const k = (Math.sin(t * 0.8) + 1) / 2, x = 52 + k * ((W - 104) / 2);
  g.fillStyle = '#e6692b'; rrect(g, x, 534, (W - 104) / 2, 52, 26); g.fill();
  g.fillStyle = '#ecebe6'; g.font = `700 20px ${SANS}`; g.textAlign = 'center'; g.fillText('Left', 48 + (W - 96) / 4, 560); g.fillText('Right', 48 + 3 * (W - 96) / 4, 560); g.textAlign = 'left';
  g.fillStyle = '#9aa0a8'; g.font = `600 16px ${MONO}`; g.fillText('TWO-VOICE AUDIO · SYNCED CAPTIONS', 48, 630);
  g.fillStyle = '#2a2e38'; rrect(g, 48, 650, W - 96, 8, 4); g.fill();
  g.fillStyle = '#4fb4ff'; rrect(g, 48, 650, (W - 96) * ((t * 0.05) % 1), 8, 4); g.fill();
  g.fillStyle = '#ecebe6'; g.beginPath(); g.arc(70, 700, 22, 0, 7); g.fill(); g.fillStyle = '#101216'; g.beginPath(); g.moveTo(64, 690); g.lineTo(80, 700); g.lineTo(64, 710); g.closePath(); g.fill();
  g.fillStyle = '#9aa0a8'; g.font = `500 16px ${SANS}`; g.fillText('"…and here’s what the other side says."', 108, 700);
  g.fillStyle = '#1f3b2c'; rrect(g, 48, H - 120, (W - 112) / 2, 56, 28); g.fill(); g.fillStyle = '#3ddc84'; g.font = `700 20px ${SANS}`; g.textAlign = 'center'; g.fillText('Agree · 62%', 48 + (W - 112) / 4, H - 92);
  g.fillStyle = '#3b2224'; rrect(g, 64 + (W - 112) / 2, H - 120, (W - 112) / 2, 56, 28); g.fill(); g.fillStyle = '#ff6b6b'; g.fillText('Disagree · 38%', 64 + 3 * (W - 112) / 4, H - 92); g.textAlign = 'left';
  tx.needsUpdate = true;
}
lightScreen(side.getObjectByName('tabletScreen'), tab, 0xd8d8d8);

// 12 the pinboard
pinCards(shell.pinboard, [
  { note: 'Bread to Dough, Mini Makers, Cognicade and more', kicker: 'MORE', x: -0.52, y: 0.2, r: -0.05 },
  { src: 'images/karana-site.webp', title: 'Karana', sub: 'getkarana.org', x: -0.02, y: 0.36, r: 0.04 },
  { src: 'images/sprout-site.webp', title: 'Sprout', sub: 'MHacks 2026', x: 0.5, y: 0.3, r: -0.06 },
  { draw: (g, w, h) => { g.fillStyle = '#f4e9cf'; g.fillRect(0, 0, w, h); const cols = ['#e6692b', '#4fb4ff', '#3ddc84', '#f2b23d', '#9b6cf6']; for (let i = 0; i < 24; i++) { g.fillStyle = cols[i % 5]; rrect(g, 20 + (i % 6) * 62, 24 + Math.floor(i / 6) * 60, 48, 44, 10); g.fill(); } g.fillStyle = '#1b1d22'; g.font = '700 30px Archivo, Arial, sans-serif'; g.fillText('400+ kids taught to code', 20, h - 24); }, title: 'Mini Makers', sub: '2024 – 25', x: -0.06, y: -0.36, r: -0.03 },
  { src: 'images/vibez-site.webp', title: 'Vibez', sub: 'HackGT 13', x: 0.44, y: -0.34, r: 0.05, dark: true },
]).then(() => progress('Pinning projects'));

// ------------------------------------------------------------------ picking: one box per station, the smallest box under the cursor wins
const hitRoots = {
  karana: [desk, print, backpack], fhir: [board], cloud9: [cloud], politheon: [credenza, capitol, bills], mizzou: [easel, papers],
  b2alpha: [rack], sprout: [shelf.getObjectByName('trophySprout')], nexus: [shelf.getObjectByName('trophyNexus')],
  vibez: [work], aegis: [work.getObjectByName('moleculeStand')], khali: [side], more: [shell.pinboard.group, shelf.getObjectByName('bread')],
  about: [books], school: [school, globe, clock], contact: [door],
};
const proxies = [], boxGeo = new THREE.BoxGeometry(1, 1, 1), proxyMat = new THREE.MeshBasicMaterial();
for (const [id, roots] of Object.entries(hitRoots)) for (const r of roots) {
  if (!r) continue;
  // a desk's hit box leaves out its chair, so the chair doesn't swallow what's on the desk
  const bb = new THREE.Box3(); for (const c of (r.isGroup && r.getObjectByName('chair') ? r.children.filter(c => c.name !== 'chair') : [r])) bb.expandByObject(c);
  if (bb.isEmpty()) continue;
  bb.expandByScalar(0.02);
  const m = new THREE.Mesh(boxGeo, proxyMat); bb.getCenter(m.position); bb.getSize(m.scale); m.updateMatrixWorld(true);
  m.userData.id = id; m.userData.vol = m.scale.x * m.scale.y * m.scale.z; proxies.push(m);
}
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function pickAt(nx, ny) {
  ndc.set(nx, ny); ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(proxies, false); if (!hits.length) return null;
  const near = hits[0].distance; let best = hits[0];
  for (const h of hits) if (h.distance < near + 1.0 && h.object.userData.vol < best.object.userData.vol) best = h;
  return best.object.userData.id;
}

// ------------------------------------------------------------------ floating labels
const anchors = {
  karana: V(-1.45, 1.17, -2.35),
  fhir: V(1.6 + 0.62, 2.12, -2.7),
  cloud9: V(X1 - 0.1, 1.02, -1.45),
  politheon: capPos.clone().add(V(-0.05, 0.3, 0.1)),
  mizzou: posterPos.clone().add(V(0, 0.58, 0)),
  b2alpha: V(2.5, 1.62, 2.36),
  sprout: sproutPos.clone().add(V(0, 0.2, -0.12)),
  nexus: nexusPos.clone().add(V(0, 0.22, -0.12)),
  vibez: monitorPos.clone().add(V(-0.25, 0.28, 0)),
  aegis: molPos.clone().add(V(0, 0.16, 0)),
  khali: tabletPos.clone().add(V(0, 0.3, 0)),
  more: shell.anchors.more,
  about: V(-1.35, 2.08, 2.5),
  school: schoolPos.clone().add(V(0.15, 0.36, 0)),
  contact: shell.anchors.contact,
};
const hotspots = $('#hotspots'), hs = {};
for (const [id, s] of Object.entries(STATIONS)) {
  const b = document.createElement('button');
  b.className = 'hs ' + (s.disc || ''); b.type = 'button'; b.dataset.st = id;
  b.innerHTML = `<i></i><span><b><em>${s.n}</em>${s.label}</b><small>${s.sub}</small></span>`;
  b.addEventListener('click', () => openStation(id));
  hotspots.appendChild(b); hs[id] = { el: b, w: 0, oy: 0, ty: 0, x: 0, y: 0, vis: false, flip: false };
}

// ------------------------------------------------------------------ camera
const look = { yaw: HOME.yaw, pitch: HOME.pitch, vy: 0, vp: 0 };
const cam = { mode: 'home', station: null, off: new THREE.Vector2(), offTarget: new THREE.Vector2(), quat: new THREE.Quaternion() };
const par = { x: 0, y: 0, tx: 0, ty: 0 };
const eul = new THREE.Euler(0, 0, 0, 'YXZ'), qTmp = new THREE.Quaternion(), mTmp = new THREE.Matrix4(), UP = V(0, 1, 0);
const quatYawPitch = (yaw, pitch, out) => out.setFromEuler(eul.set(pitch, -yaw, 0, 'YXZ'));
const quatLook = (from, to, out) => out.setFromRotationMatrix(mTmp.lookAt(from, to, UP));
let intro = null, nowMs = 0, flight = null;
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const ROOM_MID = V(0, 1.45, 0.3);
function fly(toPos, toQuat, dur) {
  const from = camera.position.clone(), d = from.distanceTo(toPos);
  // long hops swing through the middle of the room instead of cutting past the furniture
  const ctrl = from.clone().add(toPos).multiplyScalar(0.5).lerp(ROOM_MID, Math.min(0.65, d / 5));
  flight = { from, ctrl, to: toPos.clone(), q0: camera.quaternion.clone(), q1: toQuat.clone(), t0: nowMs, dur: reduce ? 1 : (dur ?? (0.85 + Math.min(0.75, d * 0.16))) * 1000 };
}

let drag = null, pointer = { x: -9, y: -9 }, pointerMoved = false;
canvasEl.addEventListener('pointerdown', e => {
  intro = null;
  drag = { x: e.clientX, y: e.clientY, t: performance.now(), last: e.timeStamp, moved: 0 };
  look.vy = look.vp = 0;
  canvasEl.setPointerCapture(e.pointerId);
});
canvasEl.addEventListener('pointermove', e => {
  pointer.x = e.clientX / innerWidth * 2 - 1; pointer.y = -(e.clientY / innerHeight) * 2 + 1; pointerMoved = true;
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
  drag.moved += Math.abs(dx) + Math.abs(dy);
  if (cam.mode === 'home' && !flight && drag.moved > 4) {
    const k = (coarse ? 0.0055 : 0.0036) * (camera.fov / 60);
    const elapsed = Math.max(8, e.timeStamp - drag.last);
    look.vy = look.vy * 0.5 + (-dx * k * (1000 / 60) / elapsed) * 0.5; look.vp = look.vp * 0.5 + (dy * k * (1000 / 60) / elapsed) * 0.5;
    look.yaw -= dx * k; look.pitch = THREE.MathUtils.clamp(look.pitch + dy * k, -0.6, 0.45);
    drag.last = e.timeStamp;
    canvasEl.classList.add('dragging');
  }
});
canvasEl.addEventListener('pointerup', e => {
  if (!drag) return;
  const click = drag.moved < 7 && performance.now() - drag.t < 600;
  if (e.timeStamp - drag.last > 70) look.vy = look.vp = 0;
  drag = null; canvasEl.classList.remove('dragging');
  if (click) { const id = pickAt(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); if (id) openStation(id); else if (cam.mode === 'station') closeStation(); }
});
function cancelDrag() { drag = null; look.vy = look.vp = 0; canvasEl.classList.remove('dragging'); }
canvasEl.addEventListener('pointercancel', cancelDrag);
canvasEl.addEventListener('lostpointercapture', () => { if (drag) cancelDrag(); });
canvasEl.addEventListener('pointerleave', () => { pointer.x = pointer.y = -9; pointerMoved = true; });

addEventListener('keydown', e => {
  if (document.body.classList.contains('list') || e.target.closest('input,textarea') || $('#lb').classList.contains('open')) return;
  if (e.key === 'Escape') closeStation();
  if (cam.mode === 'home' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { look.vy = (e.key === 'ArrowLeft' ? 1 : -1) * 0.05; }
  else if (cam.mode === 'station' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); stepTour(e.key === 'ArrowRight' ? 1 : -1); }
  const i = e.key === '0' ? 9 : +e.key - 1;
  if (!e.metaKey && !e.ctrlKey && !e.altKey && i >= 0 && i < ids.length && !e.target.closest('#panel')) openStation(ids[i]);
});

// ------------------------------------------------------------------ panels
const panel = $('#panel'), pscroll = $('#pscroll'), dock = $('#dock');
let homeLook = null;
function sideMode() { return innerWidth >= 900 || innerWidth > innerHeight; }
function panelWidth() { return sideMode() ? panel.offsetWidth : 0; }
function sheetFrac() { return sideMode() ? 0 : 0.58; }
function viewOffset() { return cam.offTarget.set(panelWidth() / 2, sheetFrac() * innerHeight / 2); }
function stationPose(s) {
  const lk = V(...s.view.look), dir = V(...s.view.pos).sub(lk);
  const base = dir.length(); dir.normalize();
  const t = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const needW = (s.fit[0] / 2) / (t * camera.aspect * (1 - panelWidth() / innerWidth));
  const needH = (s.fit[1] / 2) / (t * (1 - sheetFrac()));
  let d = Math.max(base, needW, needH);
  const lim = { x: [X0 + 0.15, X1 - 0.15], y: [0.35, ROOM.H - 0.15], z: [Z0 + 0.15, Z1 - 0.15] };
  for (const k of ['x', 'y', 'z']) { const v = dir[k]; if (Math.abs(v) > 1e-4) { const m = ((v > 0 ? lim[k][1] : lim[k][0]) - lk[k]) / v; if (m > 0) d = Math.min(d, m); } }
  const pos = lk.clone().addScaledVector(dir, d);
  return { pos, quat: quatLook(pos, lk, new THREE.Quaternion()) };
}
const DOOR = { amt: 0, to: 0 };
function openStation(id) {
  const s = STATIONS[id]; if (!s) return;
  if (document.body.classList.contains('list')) { $('#p-' + id)?.scrollIntoView(); return; }
  if (cam.mode === 'home') homeLook = { yaw: look.yaw, pitch: look.pitch };
  cam.mode = 'station'; cam.station = id; intro = null; look.vy = look.vp = 0;
  $$('.sec', pscroll).forEach(sec => sec.hidden = sec.id !== 'p-' + id);
  pscroll.scrollTop = 0;
  panel.classList.add('open'); document.body.classList.add('in-station');
  panel.setAttribute('aria-hidden', 'false');
  viewOffset();
  const pose = stationPose(s); cam.quat.copy(pose.quat);
  fly(pose.pos, pose.quat);
  DOOR.to = id === 'contact' ? 1 : 0;
  $$('#dock button').forEach(b => b.classList.toggle('on', b.dataset.st === id));
  const btn = $(`#dock button[data-st="${id}"]`);
  if (btn && dock.scrollWidth > dock.clientWidth) dock.scrollTo({ left: btn.offsetLeft - dock.clientWidth / 2 + btn.offsetWidth / 2, behavior: reduce ? 'auto' : 'smooth' });
  history.replaceState(null, '', '#' + id);
  setTimeout(() => $('#pclose').focus({ preventScroll: true }), 50);
  tour.at = ids.indexOf(id); updateTour();
}
function closeStation() {
  if (cam.mode !== 'station') return;
  cam.mode = 'home'; cam.station = null;
  DOOR.to = 0;
  if (homeLook) { look.yaw = homeLook.yaw; look.pitch = homeLook.pitch; }
  fly(HOME.pos, quatYawPitch(look.yaw, look.pitch, new THREE.Quaternion()));
  panel.classList.remove('open'); document.body.classList.remove('in-station');
  panel.setAttribute('aria-hidden', 'true');
  $$('#dock button').forEach(b => b.classList.remove('on'));
  cam.offTarget.set(0, 0);
  history.replaceState(null, '', location.pathname + location.search);
}
$('#pclose').addEventListener('click', closeStation);

// ------------------------------------------------------------------ the tour: always one clear next step
const tour = { at: -1, btn: $('#tour'), prev: $('#pprev'), next: $('#pnext'), count: $('#pcount') };
function stepTour(d) { const i = ids.indexOf(cam.station); openStation(ids[((i < 0 ? -1 : i) + d + ids.length) % ids.length]); }
function updateTour() {
  const i = ids.indexOf(cam.station), N = ids.length;
  if (i >= 0) {
    tour.prev.querySelector('span').textContent = STATIONS[ids[(i - 1 + N) % N]].label;
    tour.next.querySelector('span').textContent = i === N - 1 ? 'Back to 01' : 'Next: ' + STATIONS[ids[i + 1]].label;
    tour.count.textContent = STATIONS[ids[i]].n + ' / ' + N;
  }
  const n = (tour.at + 1) % N;
  tour.btn.dataset.st = ids[n];
  tour.btn.innerHTML = tour.at < 0 ? 'Start the tour <span aria-hidden="true">→</span>'
    : tour.at === N - 1 ? 'Take the tour again <span aria-hidden="true">↺</span>'
    : `Next: <b>${STATIONS[ids[n]].n}</b> ${STATIONS[ids[n]].label} <span aria-hidden="true">→</span>`;
}
tour.btn.addEventListener('click', () => openStation(tour.btn.dataset.st));
tour.prev.addEventListener('click', () => stepTour(-1));
tour.next.addEventListener('click', () => stepTour(1));
updateTour();
addEventListener('hashchange', () => { const id = location.hash.slice(1); if (STATIONS[id]) openStation(id); else closeStation(); });
$$('#dock button').forEach(b => b.addEventListener('click', () => openStation(b.dataset.st)));
$$('[data-open]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); if (document.body.classList.contains('list')) { const t = $('#p-' + b.dataset.open); t && t.scrollIntoView({ behavior: 'smooth' }); } else openStation(b.dataset.open); }));

// ------------------------------------------------------------------ resize
function resize() {
  const w = innerWidth, h = innerHeight, d = pickDpr();
  if (d !== renderer.getPixelRatio()) renderer.setPixelRatio(d);
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.fov = w < 760 ? 70 : 56; camera.updateProjectionMatrix();
  for (const s of Object.values(hs)) s.w = 0;
  if (cam.mode === 'station' && !flight) { viewOffset(); const p = stationPose(STATIONS[cam.station]); cam.quat.copy(p.quat); fly(p.pos, p.quat, 0.35); }
}
addEventListener('resize', resize); resize();

// ------------------------------------------------------------------ the loop
const frustum = new THREE.Frustum(), pv = new THREE.Matrix4(), v3 = V(0, 0, 0);
const parts = {
  flame: desk.getObjectByName('flame'), glow: desk.getObjectByName('flameGlow'), molecule: work.getObjectByName('molecule'),
  pivot: school.getObjectByName('planePivot'), plane: school.getObjectByName('plane'), prop: school.getObjectByName('prop'), flag: school.getObjectByName('flag'),
  globe: globe.getObjectByName('globeSpin'), h: clock.getObjectByName('clockH'), m: clock.getObjectByName('clockM'), s: clock.getObjectByName('clockS'),
  leaf: door.getObjectByName('doorLeaf'), leds: rack.getObjectByName('rackLeds'),
};
const sphereOf = o => new THREE.Box3().setFromObject(o).getBoundingSphere(new THREE.Sphere());
const zones = { desk: sphereOf(desk), cloud: sphereOf(cloud), work: sphereOf(work), side: sphereOf(side), rack: sphereOf(rack), school: sphereOf(school), globe: sphereOf(globe), clock: sphereOf(clock) };
const clocks = { phone: -1, tv: -1, mon: -1, tab: -1, flag: -1, leds: -1 };
let hovered = null, hoverAt = 0, frames = 0, simTime = 0, lapK = 0, lapDone = false;
const ledCol = new THREE.Color();

function updateDoor(dt) {
  if (DOOR.amt === DOOR.to) return;
  DOOR.amt += Math.sign(DOOR.to - DOOR.amt) * Math.min(Math.abs(DOOR.to - DOOR.amt), dt * (reduce ? 10 : 0.8));
  const k = ease(DOOR.amt);
  if (parts.leaf) parts.leaf.rotation.y = k * 1.5;
  shell.door.glow.intensity = k * 12; shell.door.patchMat.opacity = k * 0.9;
  renderer.shadowMap.needsUpdate = true;
}

function frame(dt) {
  nowMs += dt * 1000;
  if (!reduce) simTime += dt;
  // parallax: a few degrees toward the pointer, eased in and out so nothing ever snaps
  const lively = !coarse && !reduce && !flight && !drag && pointer.x > -2;
  par.tx = lively ? -pointer.x * (cam.mode === 'home' ? 0.04 : 0.012) : 0;
  par.ty = lively ? pointer.y * (cam.mode === 'home' ? 0.025 : 0.008) : 0;
  const pk = 1 - Math.pow(0.9, dt * 60); par.x += (par.tx - par.x) * pk; par.y += (par.ty - par.y) * pk;
  // camera
  if (flight) {
    const k = Math.min(1, (nowMs - flight.t0) / flight.dur), e = ease(k), u = 1 - e;
    camera.position.set(0, 0, 0).addScaledVector(flight.from, u * u).addScaledVector(flight.ctrl, 2 * u * e).addScaledVector(flight.to, e * e);
    camera.quaternion.slerpQuaternions(flight.q0, flight.q1, e);
    if (k >= 1) flight = null;
  } else if (cam.mode === 'home') {
    if (intro) {
      const k = Math.max(0, Math.min(1, (nowMs - intro.t0) / intro.dur));
      look.yaw = intro.from + (intro.to - intro.from) * (1 - Math.pow(1 - k, 3));
      if (k >= 1) intro = null;
    }
    if (!drag && !intro) {
      const decay = Math.pow(0.92, dt * 60), travel = (1 - decay) / 0.08;
      look.yaw += look.vy * travel; look.pitch = THREE.MathUtils.clamp(look.pitch + look.vp * travel, -0.6, 0.45);
      look.vy *= decay; look.vp *= decay; if (Math.abs(look.vy) < 1e-5) look.vy = 0; if (Math.abs(look.vp) < 1e-5) look.vp = 0;
    }
    camera.position.copy(HOME.pos);
    quatYawPitch(look.yaw, look.pitch, camera.quaternion);
  } else camera.quaternion.copy(cam.quat);
  if (!flight && (par.x || par.y)) camera.quaternion.multiply(qTmp.setFromEuler(eul.set(par.y, par.x, 0, 'YXZ')));
  cam.off.lerp(cam.offTarget, reduce ? 1 : 1 - Math.pow(0.86, dt * 60));
  if (cam.off.lengthSq() > 0.25) camera.setViewOffset(innerWidth, innerHeight, cam.off.x, cam.off.y, innerWidth, innerHeight); else camera.clearViewOffset();
  camera.updateMatrixWorld();
  pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(pv);
  const seen = (z, id) => cam.station === id || frustum.intersectsSphere(z);

  // the room's small motions
  if (!reduce) {
    if (parts.flame && seen(zones.desk, 'karana')) { const f = 1 + Math.sin(simTime * 11) * 0.08 + Math.sin(simTime * 27) * 0.05; parts.flame.scale.set(1 - (f - 1) * 0.5, f, 1 - (f - 1) * 0.5); parts.flame.rotation.z = Math.sin(simTime * 7) * 0.07; if (parts.glow) parts.glow.material.opacity = 0.8 + (f - 1) * 2; }
    if (parts.molecule && seen(zones.work, 'aegis')) { parts.molecule.rotation.y += dt * 0.45; parts.molecule.rotation.x = Math.sin(simTime * 0.4) * 0.18; }
    if (parts.pivot && seen(zones.school, 'school')) {
      parts.pivot.rotation.y -= dt * 0.6; parts.pivot.position.y = 0.72 + 0.5 + Math.sin(simTime * 1.3) * 0.025;
      if (parts.plane) parts.plane.rotation.x = Math.sin(simTime * 1.3) * 0.08;
      if (parts.prop) parts.prop.rotation.z += dt * 45;
      if (parts.flag && simTime - clocks.flag > 1 / 24) {
        clocks.flag = simTime; const p = parts.flag.geometry.attributes.position, rest = parts.flag.userData.rest;
        for (let i = 0; i < p.count; i++) { const x = rest[i * 3]; p.setZ(i, Math.sin(x * 90 - simTime * 7) * 0.006 * (x / 0.075)); }
        p.needsUpdate = true; parts.flag.geometry.computeVertexNormals();
      }
    }
    if (parts.globe && seen(zones.globe, 'school')) parts.globe.rotation.y += dt * 0.22;
    if (parts.leds && seen(zones.rack, 'b2alpha') && simTime - clocks.leds > 0.08) {
      clocks.leds = simTime; const { base, blink } = parts.leds.userData;
      for (let i = 0; i < base.length; i++) { const [ph, rate, steady] = blink[i]; const on = steady || Math.sin(simTime * rate + ph) > -0.3; parts.leds.setColorAt(i, ledCol.copy(base[i]).multiplyScalar(on ? 1 : 0.12)); }
      parts.leds.instanceColor.needsUpdate = true;
    }
  }
  if (parts.s && seen(zones.clock, 'school')) {
    const d = new Date(), s = d.getSeconds() + d.getMilliseconds() / 1000, m = d.getMinutes() + s / 60, h = d.getHours() % 12 + m / 60;
    parts.s.rotation.z = -s / 60 * Math.PI * 2; parts.m.rotation.z = -m / 60 * Math.PI * 2; parts.h.rotation.z = -h / 12 * Math.PI * 2;
  }
  updateDoor(dt);
  // screens: each redraws a few times a second, and only while it's seen
  if (seen(zones.desk, 'karana')) {
    const key = Math.floor(simTime * 8); if (key !== clocks.phone) { clocks.phone = key; drawPhone(simTime, Math.min(4, Math.floor((simTime % 16) / 3))); }
    if (!lapDone) { lapK = Math.min(1, lapK + dt * 0.45); drawLaptop(lapK); lapDone = lapK >= 1; }
  }
  if (seen(zones.cloud, 'cloud9')) { const key = Math.floor(simTime * 12); if (key !== clocks.tv) { clocks.tv = key; drawTV(simTime); } }
  if (seen(zones.work, 'vibez')) { const key = Math.floor(simTime * 12); if (key !== clocks.mon) { clocks.mon = key; drawMonitor(simTime); } }
  if (seen(zones.side, 'khali')) { const key = Math.floor(simTime * 10); if (key !== clocks.tab) { clocks.tab = key; drawTablet(simTime); } }

  // hover: label + cursor (a few boxes, 20 times a second)
  if (pointerMoved && !drag && !flight && nowMs - hoverAt > 50) {
    pointerMoved = false; hoverAt = nowMs;
    const id = pointer.x > -2 ? pickAt(pointer.x, pointer.y) : null;
    if (id !== hovered) { hovered = id; canvasEl.style.cursor = id ? 'pointer' : ''; for (const [k, s] of Object.entries(hs)) s.el.classList.toggle('hot', k === id); }
  }
  // floating labels: follow their anchors, and push apart where they'd overlap
  const showHs = cam.mode === 'home' && !flight, vis = [];
  for (const [id, s] of Object.entries(hs)) {
    v3.copy(anchors[id]).project(camera);
    const on = showHs && v3.z < 1 && Math.abs(v3.x) < 1.02 && Math.abs(v3.y) < 1.02;
    if (on !== s.vis) { s.vis = on; s.el.classList.toggle('vis', on); if (on) s.oy = 0; }
    if (!on) continue;
    if (!s.w) s.w = s.el.offsetWidth || 150;
    s.x = (v3.x * 0.5 + 0.5) * innerWidth; s.y = (-v3.y * 0.5 + 0.5) * innerHeight; s.flip = v3.x > 0.3; s.ty = 0;
    vis.push(s);
  }
  vis.sort((a, b) => a.y - b.y);
  for (let i = 0; i < vis.length; i++) {
    const B = vis[i], bl = B.flip ? B.x + 18 - B.w : B.x - 18;
    for (let j = 0; j < i; j++) {
      const A = vis[j], al = A.flip ? A.x + 18 - A.w : A.x - 18;
      if (bl < al + A.w && al < bl + B.w && Math.abs(B.y + B.ty - (A.y + A.ty)) < 42) B.ty = A.y + A.ty + 42 - B.y;
    }
  }
  const lk = 1 - Math.pow(0.8, dt * 60);
  for (const s of vis) {
    s.oy += (s.ty - s.oy) * lk;
    s.el.style.transform = `translate3d(${s.x.toFixed(1)}px, ${(s.y + s.oy).toFixed(1)}px, 0)`;
    s.el.classList.toggle('flip', s.flip);
  }
  renderer.render(scene, camera);
  if (++frames === 3) enter();
}

function enter() {
  if (!reduce && !STATIONS[location.hash.slice(1)]) { intro = { t0: nowMs + 250, from: HOME.yaw - 0.55, to: HOME.yaw, dur: 2600 }; look.yaw = intro.from; }
  progress('');
  loader.classList.add('done');
  document.body.classList.add('ready');
  setTimeout(() => loader.remove(), 1200);
  const id = location.hash.slice(1);
  if (STATIONS[id]) setTimeout(() => openStation(id), reduce ? 0 : 600);
}

// ------------------------------------------------------------------ pacing: draw every frame; if frames run long for a while, lower the resolution
const clock3 = new THREE.Clock(false), pace = { samples: [] };
function tick() {
  const raw = clock3.getDelta(), dt = Math.min(raw, 1 / 20);
  frame(dt);
  if (raw > 0 && raw < 0.25 && !document.hidden) {
    pace.samples.push(raw);
    if (pace.samples.length >= 120) {
      const sorted = pace.samples.sort((a, b) => a - b), med = sorted[60]; pace.samples = [];
      if (med > 1 / 42 && DPR.drops < 3) { const now = renderer.getPixelRatio(); if (now > minDpr() + 0.01) { DPR.cap = Math.max(minDpr(), now - 0.25); DPR.drops++; resize(); } }
    }
  }
}

// list view (and the no-WebGL fallback share it)
let roomRunning = false, initialized = false;
function updateActivity() {
  if (!initialized) return;
  const list = document.body.classList.contains('list'), available = !document.hidden && !document.body.classList.contains('no3d');
  const run = available && !list && !renderer.getContext().isContextLost();
  if (run !== roomRunning) { roomRunning = run; pace.samples = []; if (run) clock3.start(); else clock3.stop(); renderer.setAnimationLoop(run ? tick : null); }
}
$('#listBtn').addEventListener('click', e => {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  const on = !document.body.classList.contains('list');
  if (on) closeStation();
  document.body.classList.toggle('list', on);
  $('#listBtn').textContent = on ? '3D room' : 'List view';
  panel.setAttribute('aria-hidden', String(!on));
  if (on) { $$('.sec', pscroll).forEach(s => s.hidden = false); scrollTo(0, 0); }
  updateActivity();
});
document.addEventListener('visibilitychange', updateActivity);
addEventListener('pageonly', updateActivity);

// compile every shader and upload every texture behind the loader, so the first turn never hitches
drawPhone(0, 0); drawLaptop(0); drawMonitor(0); drawTablet(0); drawTV(0);
const warm = [];
scene.traverse(o => { warm.push([o, o.visible, o.frustumCulled]); o.visible = true; o.frustumCulled = false; });
try { await renderer.compileAsync(scene, camera); } catch (e) { console.warn('compile', e); }
renderer.shadowMap.needsUpdate = true;
for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) { quatYawPitch(yaw, -0.1, camera.quaternion); camera.updateMatrixWorld(); renderer.render(scene, camera); }
for (const [o, visible, culled] of warm) { o.visible = visible; o.frustumCulled = culled; }
warm.length = 0;
camera.quaternion.copy(quatYawPitch(HOME.yaw, HOME.pitch, new THREE.Quaternion()));
renderer.shadowMap.needsUpdate = true;
canvasEl.addEventListener('webglcontextrestored', () => { rebuildEnvironment(); renderer.shadowMap.needsUpdate = true; updateActivity(); });
canvasEl.addEventListener('webglcontextlost', () => { environmentTarget?.dispose(); environmentTarget = null; scene.environment = null; updateActivity(); });
initialized = true;
updateActivity();
// dev hook: step the loop by hand (a hidden browser tab barely ticks requestAnimationFrame)
window.__room = { scene, camera, renderer, openStation, closeStation, look, STATIONS, tier, pickAt, get frames() { return frames; }, advance(sec, step = 1 / 60) { for (let t = 0; t < sec; t += step) frame(step); } };
