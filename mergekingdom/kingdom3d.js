// Merge Kingdom — realistic 3D diorama under the DOM board. The DOM grid keeps handling input;
// an orthographic camera tilted about X keeps every ground cell a screen-aligned rectangle, so the
// 3D board lines up exactly with the (transparent) DOM cells. Exposes window.Kingdom3D; fires "kingdom3d-ready".
import { THREE, createStage, keyLight, pbrMaterial, mats, glowSprite, driftParticles } from "../shared/realism.js";

export const TILT = 0.7; // sin(camera elevation): DOM rows are this much shorter than columns
const ELEV = Math.asin(TILT);
let stage, scene, camera, COLS, ROWS, board, cells = [], cellKeys = [], lifted = null, liftFrom = -1, sparkles = [], raidMeshes = new Map(), wildTiles = [];
const M = {}; // shared materials
const tmp = new THREE.Vector3();

function sh(m) { m.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } }); return m; }
function mesh(geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; }

function initMaterials() {
  M.plaster = pbrMaterial({ type: "plaster", color: "#f4ead8", color2: "#cbbba0", scale: 3, seed: 1 });
  M.stone = pbrMaterial({ type: "stone", color: "#b8b2a6", color2: "#6e685e", scale: 3, seed: 2 });
  M.darkStone = pbrMaterial({ type: "stone", color: "#8d8a84", color2: "#4a4640", scale: 4, seed: 3 });
  M.wood = pbrMaterial({ type: "wood", color: "#a57443", color2: "#5e3c1c", scale: 2, seed: 4 });
  M.roofRed = pbrMaterial({ type: "stone", color: "#c4553b", color2: "#7a2a1c", scale: 6, seed: 5 });
  M.roofBlue = pbrMaterial({ type: "stone", color: "#4f7fb8", color2: "#243f66", scale: 6, seed: 6 });
  M.thatch = pbrMaterial({ type: "bark", color: "#d8b060", color2: "#8a6a2a", scale: 3, seed: 7 });
  M.canvas = mats.fabric(0xe9dcc0);
  M.grass = pbrMaterial({ type: "dirt", color: "#86c96a", color2: "#3f7f32", scale: 3, seed: 8 });
  M.soil = pbrMaterial({ type: "dirt", color: "#8a5f3c", color2: "#4a2f1a", scale: 4, seed: 9 });
  M.leaf = pbrMaterial({ type: "dirt", color: "#6fbf4a", color2: "#2e6a24", scale: 3, seed: 10 });
  M.bark = pbrMaterial({ type: "bark", color: "#7a5230", color2: "#3a2412", scale: 2, seed: 11 });
  M.glass = new THREE.MeshPhysicalMaterial({ color: 0x9fd0ff, metalness: 0.9, roughness: 0.08, clearcoat: 1 });
  M.window = mats.emissive(0xffd98a, 0.9);
  M.gold = mats.gold(); M.steel = mats.steel();
  M.wheat = new THREE.MeshStandardMaterial({ color: 0xe8c25a, roughness: 0.8 });
  M.corn = new THREE.MeshStandardMaterial({ color: 0x4f9a3a, roughness: 0.7 });
  M.red = mats.plastic(0xd9342b); M.white = mats.plastic(0xf6f2ea); M.flag = mats.fabric(0xe5577a, { side: THREE.DoubleSide });
}

// ---------- building kit ----------
function house(w = 0.45, d = 0.4, h = 0.3, roof = M.roofRed) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(w, h, d), M.plaster, 0, h / 2, 0));
  const r = new THREE.Mesh(new THREE.CylinderGeometry(0.001, w * 0.72, h * 0.8, 4, 1), roof); r.rotation.y = Math.PI / 4; r.scale.z = d / w; r.position.y = h + h * 0.4; g.add(r);
  g.add(mesh(new THREE.BoxGeometry(w * 0.2, h * 0.5, 0.01), M.wood, 0, h * 0.25, d / 2 + 0.005));
  for (const s of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(w * 0.16, h * 0.22, 0.01), M.window, s * w * 0.3, h * 0.58, d / 2 + 0.006));
  return g;
}
function tower(r = 0.12, h = 0.6, mat = M.stone, roof = M.roofBlue) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(r, r * 1.08, h, 16), mat, 0, h / 2, 0));
  if (roof) g.add(mesh(new THREE.ConeGeometry(r * 1.3, r * 2.4, 16), roof, 0, h + r * 1.2, 0));
  else for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.add(mesh(new THREE.BoxGeometry(r * 0.35, r * 0.4, r * 0.35), mat, Math.cos(a) * r, h + r * 0.2, Math.sin(a) * r)); }
  return g;
}
function tree(s = 1, fruit) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.03 * s, 0.05 * s, 0.3 * s, 8), M.bark, 0, 0.15 * s, 0));
  const f = mesh(new THREE.IcosahedronGeometry(0.2 * s, 1), M.leaf, 0, 0.38 * s, 0); f.scale.y = 1.1; g.add(f);
  if (fruit) for (let i = 0; i < 6; i++) { const a = i * 1.1; g.add(mesh(new THREE.SphereGeometry(0.03 * s, 8, 6), fruit, Math.cos(a) * 0.17 * s, 0.35 * s + (i % 3) * 0.06 * s, Math.sin(a) * 0.17 * s)); }
  return g;
}
function flag(h, color = M.flag) {
  const g = new THREE.Group(); g.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, h, 6), M.steel, 0, h / 2, 0));
  const f = mesh(new THREE.PlaneGeometry(0.14, 0.09, 6, 2), color, 0.07, h - 0.05, 0); f.userData.wave = true; g.add(f); return g;
}
function field(mat, stalkH, n = 7, stalk = true) {
  const g = new THREE.Group(); g.add(mesh(new THREE.BoxGeometry(0.8, 0.04, 0.8), M.soil, 0, 0.02, 0));
  const geo = stalk ? new THREE.CylinderGeometry(0.008, 0.012, stalkH, 4) : new THREE.SphereGeometry(stalkH, 8, 6);
  const inst = new THREE.InstancedMesh(geo, mat, n * n); const d = new THREE.Object3D(); let k = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { d.position.set(-0.33 + i * 0.66 / (n - 1) + (Math.random() - .5) * 0.03, stalk ? stalkH / 2 + 0.04 : stalkH, -0.33 + j * 0.66 / (n - 1)); d.rotation.set((Math.random() - .5) * 0.2, 0, (Math.random() - .5) * 0.2); d.updateMatrix(); inst.setMatrixAt(k++, d.matrix); }
  g.add(inst); return g;
}
function cow() { const g = new THREE.Group(); const b = mesh(new THREE.CapsuleGeometry(0.05, 0.1, 6, 10), M.white, 0, 0.09, 0); b.rotation.z = Math.PI / 2; g.add(b); g.add(mesh(new THREE.SphereGeometry(0.035, 10, 8), M.white, 0.1, 0.12, 0)); for (const [x, z] of [[-0.05, 0.03], [-0.05, -0.03], [0.05, 0.03], [0.05, -0.03]]) g.add(mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.06, 6), M.bark, x, 0.03, z)); const spot = mesh(new THREE.SphereGeometry(0.03, 8, 6), mats.plastic(0x222222), -0.01, 0.13, 0.03); spot.scale.set(1.3, 0.5, 1); g.add(spot); return g; }

const HOME = [
  () => { const g = new THREE.Group(); const t = mesh(new THREE.ConeGeometry(0.28, 0.4, 4), M.canvas, 0, 0.2, 0); t.rotation.y = Math.PI / 4; g.add(t); g.add(mesh(new THREE.PlaneGeometry(0.12, 0.2), mats.fabric(0x5a3a1a, { side: THREE.DoubleSide }), 0, 0.1, 0.16)); return g; },
  () => { const g = new THREE.Group(); g.add(mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.22, 20), M.plaster, 0, 0.11, 0)); g.add(mesh(new THREE.ConeGeometry(0.3, 0.3, 20), M.thatch, 0, 0.37, 0)); g.add(mesh(new THREE.BoxGeometry(0.08, 0.14, 0.01), M.wood, 0, 0.07, 0.235)); return g; },
  () => house(),
  () => { const g = house(0.5, 0.42, 0.32); g.add(mesh(new THREE.BoxGeometry(0.07, 0.2, 0.07), M.stone, 0.14, 0.52, -0.05)); for (let i = 0; i < 7; i++) g.add(mesh(new THREE.BoxGeometry(0.015, 0.08, 0.015), M.wood, -0.35 + i * 0.11, 0.04, 0.33)); return g; },
  () => { const g = new THREE.Group(); [[-0.2, -0.15, 0.7], [0.18, -0.12, 0.8], [0, 0.2, 0.75]].forEach(([x, z, s]) => { const h = house(0.45 * s, 0.4 * s, 0.3 * s, x > 0 ? M.roofBlue : M.roofRed); h.position.set(x, 0, z); h.rotation.y = x * 2; g.add(h); }); return g; },
  () => { const g = new THREE.Group(); g.add(mesh(new THREE.BoxGeometry(0.7, 0.06, 0.55), M.stone, 0, 0.03, 0)); g.add(mesh(new THREE.BoxGeometry(0.6, 0.35, 0.45), M.plaster, 0, 0.23, 0)); const r = mesh(new THREE.CylinderGeometry(0.001, 0.46, 0.2, 4), M.roofRed, 0, 0.5, 0); r.rotation.y = Math.PI / 4; r.scale.z = 0.75; g.add(r); for (let i = 0; i < 5; i++) g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 10), M.white, -0.24 + i * 0.12, 0.23, 0.25)); return g; },
  () => { const g = new THREE.Group(); for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) { const t = tower(0.09, 0.45, M.stone, M.roofBlue); t.position.set(x, 0, z); g.add(t); } for (const [x, z, ry] of [[0, -0.3, 0], [0, 0.3, 0], [-0.3, 0, Math.PI / 2], [0.3, 0, Math.PI / 2]]) { const w = mesh(new THREE.BoxGeometry(0.5, 0.28, 0.06), M.stone, x, 0.14, z); w.rotation.y = ry; g.add(w); } const keep = tower(0.15, 0.6, M.stone, M.roofRed); g.add(keep); g.add(flag(0.35).translateY(0.85)); return g; },
  () => { const g = new THREE.Group(); g.add(mesh(new THREE.BoxGeometry(0.75, 0.3, 0.55), M.plaster, 0, 0.15, 0)); for (const x of [-0.25, 0, 0.25]) { g.add(mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.15, 16), M.plaster, x, 0.37, 0)); g.add(mesh(new THREE.SphereGeometry(0.1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.gold, x, 0.44, 0)); g.add(mesh(new THREE.ConeGeometry(0.02, 0.12, 8), M.gold, x, 0.58, 0)); } for (let i = 0; i < 6; i++) g.add(mesh(new THREE.BoxGeometry(0.06, 0.1, 0.01), M.window, -0.3 + i * 0.12, 0.17, 0.28)); return g; },
  () => { const g = new THREE.Group(); [[-0.22, -0.2, 0.7], [0.1, -0.22, 0.95], [0.28, 0.15, 0.55], [-0.2, 0.2, 0.5], [0.02, 0.1, 0.4]].forEach(([x, z, h]) => { g.add(mesh(new THREE.BoxGeometry(0.2, h, 0.2), M.plaster, x, h / 2, z)); for (let k = 0.1; k < h - 0.05; k += 0.1) g.add(mesh(new THREE.BoxGeometry(0.16, 0.04, 0.005), M.window, x, k, z + 0.101)); }); return g; },
  () => { const g = new THREE.Group(); [[-0.2, -0.18, 1.1], [0.15, -0.2, 1.45], [0.25, 0.18, 0.8], [-0.2, 0.2, 0.9], [0, 0.02, 1.25]].forEach(([x, z, h], i) => { const b = mesh(new THREE.BoxGeometry(0.19, h, 0.19), M.glass, x, h / 2, z); g.add(b); g.add(mesh(new THREE.BoxGeometry(0.2, 0.03, 0.2), M.steel, x, h, z)); if (i === 1) { g.add(mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.25, 6), M.steel, x, h + 0.12, z)); const l = glowSprite(0xff4f4f, 0.12, 1); l.position.set(x, h + 0.25, z); g.add(l); } }); return g; },
];
const FARM = [
  () => { const g = new THREE.Group(); g.add(mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.05, 20), M.soil, 0, 0.025, 0)); for (let i = 0; i < 5; i++) { const s = mesh(new THREE.SphereGeometry(0.035, 8, 6), M.leaf, Math.cos(i * 1.3) * 0.1, 0.07, Math.sin(i * 1.3) * 0.1); s.scale.y = 1.6; g.add(s); } return g; },
  () => field(M.leaf, 0.06, 4, false),
  () => field(M.wheat, 0.28, 8),
  () => field(M.corn, 0.42, 6),
  () => { const g = new THREE.Group(); g.add(mesh(new THREE.BoxGeometry(0.8, 0.03, 0.8), M.grass, 0, 0.015, 0)); [[-0.2, -0.2], [0.2, -0.15], [0, 0.2]].forEach(([x, z]) => { const t = tree(1, M.red); t.position.set(x, 0, z); g.add(t); }); return g; },
  () => { const g = new THREE.Group(); g.add(mesh(new THREE.BoxGeometry(0.8, 0.03, 0.8), M.grass, 0, 0.015, 0)); const barn = house(0.4, 0.35, 0.28, M.roofBlue); barn.children[0].material = mats.plastic(0xa8322a, { roughness: 0.6 }); barn.position.set(-0.12, 0, -0.1); g.add(barn); [[0.22, 0.2], [0.05, 0.28]].forEach(([x, z]) => { const c = cow(); c.position.set(x, 0, z); g.add(c); }); return g; },
  () => { const g = FARM[5](); g.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.55, 16), M.steel, 0.25, 0.275, -0.2)); g.add(mesh(new THREE.SphereGeometry(0.08, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.steel, 0.25, 0.55, -0.2)); return g; },
  () => { const g = new THREE.Group(); g.add(mesh(new THREE.BoxGeometry(0.8, 0.03, 0.8), M.grass, 0, 0.015, 0)); [[-0.2, -0.2], [0.2, -0.2], [0, 0.15]].forEach(([x, z]) => { g.add(mesh(new THREE.BoxGeometry(0.16, 0.2, 0.16), M.wood, x, 0.1, z)); g.add(mesh(new THREE.BoxGeometry(0.19, 0.03, 0.19), M.roofRed, x, 0.21, z)); }); for (let i = 0; i < 20; i++) g.add(mesh(new THREE.SphereGeometry(0.02, 6, 4), mats.plastic([0xff6fa8, 0xffe14a, 0xb56cff][i % 3]), (Math.random() - .5) * 0.7, 0.04, (Math.random() - .5) * 0.7)); return g; },
  () => { const g = new THREE.Group(); g.add(mesh(new THREE.BoxGeometry(0.8, 0.03, 0.8), M.grass, 0, 0.015, 0)); const t = tree(2.4); g.add(t); return g; },
  () => { const g = new THREE.Group(); g.add(mesh(new THREE.BoxGeometry(0.8, 0.03, 0.8), M.grass, 0, 0.015, 0)); const t = tree(2.6, mats.emissive(0xffd76a, 2)); t.children[1].material = pbrMaterial({ type: "dirt", color: "#9be86f", color2: "#3fa84a", scale: 3, seed: 12 }, { emissive: 0x2a8a3a, emissiveIntensity: 0.4 }); g.add(t); const gl = glowSprite(0xfff2a8, 1.4, 0.45); gl.position.y = 0.9; g.add(gl); g.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 20), new THREE.MeshPhysicalMaterial({ color: 0x6fd0ff, roughness: 0.05, transmission: 0.6 }), 0.25, 0.04, 0.25)); return g; },
];
const TOWER = [
  () => { const g = new THREE.Group(); for (let i = 0; i < 5; i++) { const s = mesh(new THREE.ConeGeometry(0.03, 0.3, 6), M.wood, -0.24 + i * 0.12, 0.15, 0); s.rotation.x = 0.1; g.add(s); } g.add(mesh(new THREE.BoxGeometry(0.55, 0.025, 0.025), M.wood, 0, 0.1, 0.02)); return g; },
  () => { const g = new THREE.Group(); g.add(mesh(new THREE.BoxGeometry(0.65, 0.25, 0.14), M.stone, 0, 0.125, 0)); for (let i = 0; i < 5; i++) g.add(mesh(new THREE.BoxGeometry(0.08, 0.07, 0.14), M.stone, -0.26 + i * 0.13, 0.285, 0)); return g; },
  () => { const g = new THREE.Group(); const s = mesh(new THREE.BoxGeometry(0.2, 0.55, 0.12), M.darkStone, 0, 0.27, 0); s.rotation.z = 0.05; g.add(s); g.add(mesh(new THREE.PlaneGeometry(0.08, 0.14), mats.emissive(0x5cf2ff, 2.5), 0, 0.33, 0.061)); const gl = glowSprite(0x5cf2ff, 0.5, 0.5); gl.position.set(0, 0.33, 0.08); g.add(gl); return g; },
  () => { const g = new THREE.Group(); for (const [x, z] of [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]]) g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), M.wood, x, 0.25, z)); g.add(mesh(new THREE.BoxGeometry(0.34, 0.04, 0.34), M.wood, 0, 0.5, 0)); g.add(mesh(new THREE.ConeGeometry(0.28, 0.18, 4), M.thatch, 0, 0.64, 0).rotateY(Math.PI / 4)); return g; },
  () => { const g = tower(0.14, 0.55, M.stone, null); g.add(flag(0.3).translateY(0.62)); return g; },
  () => tower(0.12, 0.95, M.stone, M.roofRed),
  () => { const g = new THREE.Group(); g.add(mesh(new THREE.BoxGeometry(0.6, 0.3, 0.45), M.stone, 0, 0.15, 0)); g.add(mesh(new THREE.BoxGeometry(0.64, 0.05, 0.49), M.wood, 0, 0.32, 0)); for (let i = 0; i < 3; i++) { const s = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 16), [M.red, M.roofBlue, M.gold][i], -0.18 + i * 0.18, 0.18, 0.23); s.rotation.x = Math.PI / 2; g.add(s); } g.add(flag(0.35).translateY(0.34).translateX(-0.25)); return g; },
  () => { const g = new THREE.Group(); const t = tower(0.2, 0.45, M.darkStone, null); g.add(t); const barrel = mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.35, 12), mats.steel({ color: 0x3a3f46 }), 0, 0.55, 0.12); barrel.rotation.x = Math.PI / 2.4; g.add(barrel); g.add(mesh(new THREE.SphereGeometry(0.035, 10, 8), mats.steel({ color: 0x222222 }), 0.3, 0.03, 0.3)); return g; },
  () => { const g = tower(0.16, 0.6, M.darkStone, null); const d = new THREE.Group(); const b = mesh(new THREE.SphereGeometry(0.12, 16, 12), mats.plastic(0xc0392b), 0, 0, 0); b.scale.set(1.4, 0.9, 1); d.add(b); d.add(mesh(new THREE.SphereGeometry(0.07, 12, 8), mats.plastic(0xc0392b), 0.16, 0.08, 0)); for (const s of [-1, 1]) { const w = mesh(new THREE.CircleGeometry(0.2, 3), mats.plastic(0xff7a4a, { side: THREE.DoubleSide }), 0, 0.08, s * 0.1); w.rotation.set(s * 1.1, 0, 0.3); d.add(w); } d.position.y = 0.8; g.add(d); g.userData.spin = d; return g; },
  () => { const g = new THREE.Group(); g.add(mesh(new THREE.CylinderGeometry(0.05, 0.16, 1.1, 8), M.darkStone, 0, 0.55, 0)); const orb = mesh(new THREE.SphereGeometry(0.09, 20, 14), mats.emissive(0x9b5cff, 4), 0, 1.22, 0); g.add(orb); const gl = glowSprite(0x9b5cff, 0.9, 0.8); gl.position.y = 1.22; g.add(gl); for (let i = 0; i < 3; i++) { const r = mesh(new THREE.TorusGeometry(0.16, 0.008, 6, 32), mats.emissive(0xc8a8ff, 2), 0, 1.22, 0); r.rotation.set(i, i * 0.7, 0); g.add(r); } g.userData.spin = g.children[3]; return g; },
];
function wonder() { const g = new THREE.Group(); g.add(mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.08, 6), M.stone, 0, 0.04, 0)); const ob = mesh(new THREE.CylinderGeometry(0.02, 0.1, 1.1, 4), M.gold, 0, 0.63, 0); ob.rotation.y = Math.PI / 4; g.add(ob); const gl = glowSprite(0xffd76a, 1.6, 0.6); gl.position.y = 1.2; g.add(gl); return g; }
const RAIDER_LOOK = { "👺": [0x5fae3a, 0.8, "horns"], "🐺": [0x777777, 0.8, "ears"], "👹": [0xb53b2a, 1.1, "horns"], "🧌": [0x6b7a4a, 1.3, "club"], "💀": [0xe8e2d0, 1.0, "sword"], "🐲": [0x8a2a8a, 1.35, "wings"] };
function raider(e) {
  const [col, s, extra] = RAIDER_LOOK[e] || [0x777777, 1];
  const g = new THREE.Group(), skin = mats.plastic(col, { roughness: 0.45 });
  g.add(mesh(new THREE.CapsuleGeometry(0.09, 0.14, 6, 12), skin, 0, 0.18, 0));
  g.add(mesh(new THREE.SphereGeometry(0.085, 16, 12), skin, 0, 0.38, 0));
  for (const x of [-1, 1]) g.add(mesh(new THREE.SphereGeometry(0.016, 8, 6), mats.emissive(0xffe14a, 3), x * 0.035, 0.4, 0.075));
  if (extra === "horns" || extra === "ears") for (const x of [-1, 1]) { const h = mesh(new THREE.ConeGeometry(0.025, 0.09, 8), extra === "horns" ? mats.plastic(0xf2ead8) : skin, x * 0.06, 0.47, 0); h.rotation.z = -x * 0.4; g.add(h); }
  if (extra === "club") { const c = mesh(new THREE.CylinderGeometry(0.02, 0.04, 0.3, 8), M.wood, 0.13, 0.25, 0.05); c.rotation.z = -0.5; g.add(c); }
  if (extra === "sword") { const b = mesh(new THREE.BoxGeometry(0.02, 0.28, 0.005), M.steel, 0.13, 0.28, 0.05); b.rotation.z = -0.4; g.add(b); }
  if (extra === "wings") for (const x of [-1, 1]) { const w = mesh(new THREE.CircleGeometry(0.16, 3), mats.plastic(0xb56cff, { side: THREE.DoubleSide }), x * 0.12, 0.3, -0.05); w.rotation.set(0, x * 0.6, x * 0.7); g.add(w); }
  g.scale.setScalar(s * 2.1); g.userData.phase = Math.random() * 6; return sh(g);
}
function build(key) {
  if (!key) return null;
  const [ch, t] = key.split(":"); const tier = +t;
  const g = ch === "wonder" ? wonder() : (ch === "home" ? HOME : ch === "farm" ? FARM : TOWER)[tier]();
  const wrap = new THREE.Group(); wrap.add(g); wrap.userData.spin = g.userData.spin; return sh(wrap);
}

// ---------- board ----------
function makeBoard() {
  board = new THREE.Group(); scene.add(board);
  const W = COLS, D = ROWS;
  const base = mesh(new THREE.BoxGeometry(W + 0.5, 0.5, D + 0.5), M.soil, (W - 1) / 2, -0.28, (D - 1) / 2); base.receiveShadow = true; board.add(base);
  const top = mesh(new THREE.BoxGeometry(W + 0.5, 0.06, D + 0.5), M.grass, (W - 1) / 2, -0.02, (D - 1) / 2); top.receiveShadow = true; board.add(top);
  // A big meadow beyond the board with a few trees.
  const meadow = mesh(new THREE.PlaneGeometry(60, 60), pbrMaterial({ type: "dirt", color: "#7cc36a", color2: "#3f7a32", scale: 6, repeat: 10, seed: 13 }), (W - 1) / 2, -0.53, (D - 1) / 2); meadow.rotation.x = -Math.PI / 2; meadow.receiveShadow = true; scene.add(meadow);
  for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2, r = 5.5 + Math.random() * 3; const t = sh(tree(2 + Math.random() * 2)); t.position.set((W - 1) / 2 + Math.cos(a) * r, -0.53, (D - 1) / 2 + Math.sin(a) * r * 0.8); scene.add(t); }
  for (let i = 0; i < COLS * ROWS; i++) {
    const x = i % COLS, z = Math.floor(i / COLS);
    const tile = mesh(new THREE.BoxGeometry(0.92, 0.05, 0.92), M.stone, x, 0.025, z); tile.receiveShadow = true; board.add(tile);
    const wild = new THREE.Group(); wild.position.set(x, 0, z); // locked land: shrubs and rocks
    const bush = mesh(new THREE.IcosahedronGeometry(0.2, 1), M.leaf, -0.15, 0.15, 0.1); wild.add(bush);
    const rk = mesh(new THREE.DodecahedronGeometry(0.13, 0), M.darkStone, 0.2, 0.08, -0.15); wild.add(rk);
    const t2 = tree(0.9); t2.position.set(0.15, 0, 0.2); wild.add(t2);
    sh(wild); board.add(wild); wildTiles.push({ tile, wild });
    const holder = new THREE.Group(); holder.position.set(x, 0.05, z); board.add(holder); cells.push(holder); cellKeys.push("");
  }
}
function sparkle(i) {
  const x = i % COLS, z = Math.floor(i / COLS);
  for (let k = 0; k < 14; k++) { let s = sparkles.find(p => p.life <= 0); if (!s) { s = { m: glowSprite(0xfff2a8, 0.18, 1), v: new THREE.Vector3(), life: 0 }; scene.add(s.m); sparkles.push(s); } s.m.visible = true; s.m.position.set(x, 0.4, z); s.v.set((Math.random() - .5) * 3, 1.5 + Math.random() * 2, (Math.random() - .5) * 3); s.life = 0.7; }
}


// ---------- living world around the board ----------
// World layout: cells span x 0..COLS-1, z 0..ROWS-1. North meadow strip z < -0.8, south riverbank z > ROWS - 0.2.
let hemi, key, dayT = 0.25, villagers = [], sheep = [], birds = [], smoke = [], clouds = [], ducks = [], windmillBlades, fireflies, riverMat, chests = new Map(), cart = null, holos = [];
const DAY = 360; // seconds per full day
function person(color) {
  const g = new THREE.Group(), skin = mats.skin(), cloth = mats.fabric(color);
  g.add(mesh(new THREE.CapsuleGeometry(0.045, 0.08, 4, 8), cloth, 0, 0.09, 0));
  g.add(mesh(new THREE.SphereGeometry(0.04, 12, 8), skin, 0, 0.2, 0));
  const legs = [-1, 1].map(s => { const l = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.07, 6), M.bark, s * 0.02, 0.035, 0); g.add(l); return l; });
  if (Math.random() < 0.5) g.add(mesh(new THREE.ConeGeometry(0.06, 0.05, 12), M.thatch, 0, 0.25, 0)); // straw hat
  g.userData.legs = legs; return sh(g);
}
function sheepModel() {
  const g = new THREE.Group(), wool = mats.fabric(0xf6f3ea, { roughness: 1 });
  for (let i = 0; i < 6; i++) g.add(mesh(new THREE.SphereGeometry(0.055, 10, 8), wool, (i % 3 - 1) * 0.05, 0.1 + (i > 2 ? 0.03 : 0), (i > 2 ? 0.02 : -0.02)));
  g.add(mesh(new THREE.SphereGeometry(0.035, 10, 8), mats.plastic(0x2a2622), 0.1, 0.11, 0));
  for (const [x, z] of [[-0.04, 0.03], [-0.04, -0.03], [0.04, 0.03], [0.04, -0.03]]) g.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.06, 6), mats.plastic(0x2a2622), x, 0.03, z));
  return sh(g);
}
function windmill() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.16, 0.26, 0.9, 12), M.plaster, 0, 0.45, 0));
  g.add(mesh(new THREE.ConeGeometry(0.22, 0.3, 12), M.roofRed, 0, 1.05, 0));
  const hub = new THREE.Group(); hub.position.set(0, 0.85, 0.2); g.add(hub); windmillBlades = hub;
  for (let i = 0; i < 4; i++) { const arm = new THREE.Group(); arm.rotation.z = i * Math.PI / 2; hub.add(arm); arm.add(mesh(new THREE.BoxGeometry(0.03, 0.55, 0.01), M.wood, 0, 0.28, 0)); arm.add(mesh(new THREE.BoxGeometry(0.12, 0.4, 0.005), M.canvas, 0.07, 0.32, 0)); }
  return sh(g);
}
function bird() { const g = new THREE.Group(); const w = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, side: THREE.DoubleSide }); for (const s of [-1, 1]) { const p = mesh(new THREE.PlaneGeometry(0.16, 0.05), w, s * 0.08, 0, 0); p.rotation.x = -Math.PI / 2; g.add(p); } g.add(mesh(new THREE.SphereGeometry(0.02, 6, 4), w)); return g; }
function duck() { const g = new THREE.Group(); const b = mesh(new THREE.SphereGeometry(0.05, 12, 8), mats.plastic(0xf2e8d0), 0, 0.03, 0); b.scale.set(1.4, 0.8, 1); g.add(b); g.add(mesh(new THREE.SphereGeometry(0.03, 10, 8), mats.plastic(0x2f7a3a), 0.06, 0.07, 0)); g.add(mesh(new THREE.ConeGeometry(0.012, 0.03, 6), mats.plastic(0xffa51f), 0.095, 0.07, 0).rotateZ(-Math.PI / 2)); return sh(g); }
function chestModel() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(0.34, 0.18, 0.24), M.wood, 0, 0.09, 0));
  const lid = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.34, 16, 1, false, 0, Math.PI), M.wood, 0, 0.18, 0); lid.rotation.z = Math.PI / 2; g.add(lid);
  for (const x of [-0.12, 0.12]) g.add(mesh(new THREE.BoxGeometry(0.03, 0.2, 0.25), M.gold, x, 0.13, 0));
  g.add(mesh(new THREE.BoxGeometry(0.05, 0.06, 0.02), M.gold, 0, 0.14, 0.125));
  const glow = glowSprite(0xffd76a, 0.9, 0.6); glow.position.y = 0.25; g.add(glow); g.userData.glow = glow;
  return sh(g);
}
function cartModel() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(0.5, 0.14, 0.3), M.wood, 0, 0.14, 0));
  const cover = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.5, 16, 1, false, 0, Math.PI), mats.fabric(0xe5577a, { side: THREE.DoubleSide }), 0, 0.22, 0); cover.rotation.z = Math.PI / 2; g.add(cover);
  for (const x of [-0.16, 0.16]) for (const z of [-0.16, 0.16]) g.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 14), M.wood, x, 0.07, z).rotateX(Math.PI / 2));
  const donkey = new THREE.Group(); donkey.position.x = 0.45; g.add(donkey);
  const fur = mats.fabric(0x8a7a6a); donkey.add(mesh(new THREE.CapsuleGeometry(0.05, 0.12, 4, 8), fur, 0, 0.12, 0).rotateZ(Math.PI / 2)); donkey.add(mesh(new THREE.SphereGeometry(0.04, 10, 8), fur, 0.11, 0.17, 0));
  for (const s of [-1, 1]) donkey.add(mesh(new THREE.ConeGeometry(0.012, 0.06, 6), fur, 0.11, 0.23, s * 0.02));
  const merchant = person(0x7b5cff); merchant.position.set(-0.05, 0.2, 0); g.add(merchant);
  return sh(g);
}
function buildWorld() {
  const W = COLS, D = ROWS;
  // River along the south with a wooden bridge and ducks.
  const wn = makeRiverNormals();
  riverMat = new THREE.MeshPhysicalMaterial({ color: 0x3f8fc0, roughness: 0.08, metalness: 0.1, clearcoat: 1, normalMap: wn, normalScale: new THREE.Vector2(0.6, 0.6) });
  const river = mesh(new THREE.PlaneGeometry(W + 12, 0.8), riverMat, (W - 1) / 2, -0.5, D + 0.95); river.rotation.x = -Math.PI / 2; river.receiveShadow = true; scene.add(river);
  for (const z of [D + 0.52, D + 1.38]) { const bank = mesh(new THREE.BoxGeometry(W + 12, 0.08, 0.1), M.soil, (W - 1) / 2, -0.5, z); scene.add(bank); }
  const bridge = new THREE.Group(); bridge.position.set(1, -0.45, D + 0.95); scene.add(bridge);
  for (let i = 0; i < 7; i++) bridge.add(mesh(new THREE.BoxGeometry(0.1, 0.04, 1.1), M.wood, -0.3 + i * 0.1, 0.05 + Math.sin(i / 6 * Math.PI) * 0.06, 0));
  for (const z of [-0.5, 0.5]) bridge.add(mesh(new THREE.BoxGeometry(0.75, 0.03, 0.03), M.wood, 0, 0.2, z));
  sh(bridge);
  for (let i = 0; i < 3; i++) { const d = duck(); d.position.set(-1 + i * 2.2, -0.47, D + 0.95); d.userData.phase = i * 2; scene.add(d); ducks.push(d); }
  // A dirt path along the north meadow, and one between the board and the river.
  for (const z of [-1.05, D - 0.05]) { const path = mesh(new THREE.PlaneGeometry(W + 8, 0.28), pbrMaterial({ type: "dirt", color: "#c9a878", color2: "#8a6a44", scale: 4, repeat: 2, seed: 30 }), (W - 1) / 2, -0.515, z); path.rotation.x = -Math.PI / 2; path.receiveShadow = true; scene.add(path); }
  // Windmill and a hay bale on the north meadow; grazing sheep.
  const wm = windmill(); wm.position.set(-0.6, -0.53, -2.2); scene.add(wm);
  for (let i = 0; i < 5; i++) { const s = sheepModel(); s.position.set(2.6 + Math.random() * 2.2, -0.53, -2.4 + Math.random() * 0.9); s.rotation.y = Math.random() * 6; s.userData.target = s.position.clone(); scene.add(s); sheep.push(s); }
  for (let i = 0; i < 2; i++) { const hay = mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.22, 16), M.thatch, 0.8 + i * 0.4, -0.39, -2.1); hay.rotation.z = Math.PI / 2; sh(hay); scene.add(hay); }
  // Invisible cloud shadow-casters drifting over everything (they cast shadows but draw nothing).
  const shadowOnly = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  for (let i = 0; i < 4; i++) { const c = new THREE.Group(); for (let k = 0; k < 5; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.6 + Math.random() * 0.4, 12, 8), shadowOnly); b.position.set(k * 0.7, Math.random() * 0.2, (Math.random() - .5) * 0.6); b.castShadow = true; c.add(b); } c.position.set(-6 + i * 5, 5, -1 + i * 2); scene.add(c); clouds.push(c); }
  for (let i = 0; i < 5; i++) { const b = bird(); b.userData.phase = i * 0.7; scene.add(b); birds.push(b); }
  fireflies = driftParticles(scene, { count: 70, size: 0.07, color: 0xfff27a, box: [W + 6, 1.2, D + 6], opacity: 0, speed: 0.25 });
  fireflies.position.set((W - 1) / 2, 0.3, (D - 1) / 2);
  for (let i = 0; i < 14; i++) { const s = glowSprite(0xdddddd, 0.22, 0); s.material.blending = THREE.NormalBlending; s.visible = false; scene.add(s); smoke.push({ m: s, life: 0 }); }
}
function makeRiverNormals() { return pbrMaterial({ type: "water", color: "#ffffff", color2: "#ffffff", scale: 4, normal: 4, seed: 40 }).normalMap; }
function walkers(homes) {
  const want = Math.min(10, 2 + homes);
  while (villagers.length < want) { const v = person([0xe5577a, 0x3a86ff, 0xffb938, 0x2ec4b6, 0x9b5cff][villagers.length % 5]); const lane = villagers.length % 2 ? -1.05 : ROWS - 0.05; v.position.set(-1.5 + Math.random() * (COLS + 2), -0.53, lane); v.userData = { ...v.userData, dir: Math.random() < .5 ? 1 : -1, speed: 0.25 + Math.random() * 0.2, lane }; scene.add(v); villagers.push(v); }
  while (villagers.length > want) scene.remove(villagers.pop());
}
function tickWorld(t, dt) {
  // Day/night: sun arcs across; windows glow, fireflies come out and the sky darkens at night.
  dayT = (dayT + dt / DAY) % 1;
  const sunA = dayT * Math.PI * 2, daylight = Math.max(0, Math.sin(sunA)), night = 1 - Math.min(1, daylight * 2.2);
  key.userData.offset.set(Math.cos(sunA) * 7, 3 + Math.max(0.5, Math.sin(sunA)) * 7, 4);
  key.follow((COLS - 1) / 2, 0, (ROWS - 1) / 2);
  key.intensity = 0.35 + daylight * 2.3; key.color.setHSL(0.1, 0.5 + night * 0.3, 0.7 + daylight * 0.25).lerp(new THREE.Color(0x8fa8ff), night * 0.6);
  hemi.intensity = 0.35 + daylight * 0.6; hemi.color.set(0xfff6e8).lerp(new THREE.Color(0x5a6aa8), night);
  scene.background.set(0x7cc36a).lerp(new THREE.Color(0x1c2a3a), night * 0.8);
  M.window.emissiveIntensity = 0.5 + night * 3.2;
  fireflies.material.opacity = night * 0.9; fireflies.tick(dt, (COLS - 1) / 2, 0.3, (ROWS - 1) / 2);
  if (windmillBlades) windmillBlades.rotation.z -= dt * 0.9;
  if (riverMat) riverMat.normalMap.offset.x = (riverMat.normalMap.offset.x + dt * 0.05) % 1;
  ducks.forEach(d => { d.position.x += Math.sin(t / 4000 + d.userData.phase) * dt * 0.15; d.rotation.y = Math.cos(t / 4000 + d.userData.phase) > 0 ? 0 : Math.PI; d.position.y = -0.47 + Math.sin(t / 400 + d.userData.phase) * 0.01; });
  villagers.forEach(v => { const u = v.userData; v.position.x += u.dir * u.speed * dt; if (v.position.x > COLS + 1.5 || v.position.x < -2.5) u.dir *= -1; v.rotation.y = u.dir > 0 ? Math.PI / 2 : -Math.PI / 2; u.legs.forEach((l, i) => l.rotation.x = Math.sin(t / 110 + i * Math.PI) * 0.6); v.position.y = -0.53 + Math.abs(Math.sin(t / 110)) * 0.01; });
  sheep.forEach(s => { const g = s.userData.target; if (s.position.distanceTo(g) < 0.05) { if (Math.random() < 0.005) g.set(2.6 + Math.random() * 2.2, -0.53, -2.4 + Math.random() * 0.9); } else { const d = g.clone().sub(s.position); s.position.addScaledVector(d.normalize(), dt * 0.12); s.rotation.y = Math.atan2(-d.z, d.x); } });
  clouds.forEach(c => { c.position.x += dt * 0.25; if (c.position.x > COLS + 8) c.position.x = -10; });
  birds.forEach((b, i) => { const a = t / 9000 + b.userData.phase; b.position.set((COLS - 1) / 2 + Math.cos(a) * 6, 2.5 + Math.sin(t / 900 + i) * 0.2, (ROWS - 1) / 2 + Math.sin(a) * 4); b.rotation.y = -a; b.children[0].rotation.z = Math.sin(t / 80 + i) * 0.5; b.children[1].rotation.z = -Math.sin(t / 80 + i) * 0.5; });
  // Chimney smoke from homes.
  if (Math.random() < dt * 2.5) { const homes = cells.map((c, i) => [c, cellKeys[i]]).filter(([, k]) => /^home:[1-7]$/.test(k)); if (homes.length) { const [c] = homes[Math.random() * homes.length | 0]; const p = smoke.find(p => p.life <= 0); if (p) { p.m.visible = true; p.life = 2.5; p.m.position.set(c.position.x + 0.12, 0.7, c.position.z - 0.05); } } }
  smoke.forEach(p => { if (p.life <= 0) return; p.life -= dt; p.m.position.y += dt * 0.3; p.m.position.x += dt * 0.08; p.m.scale.setScalar(0.18 + (2.5 - p.life) * 0.12); p.m.material.opacity = Math.min(0.5, p.life / 2.5 * 0.5); if (p.life <= 0) p.m.visible = false; });
  chests.forEach(c => { c.rotation.y = Math.sin(t / 500) * 0.2; c.userData.glow.material.opacity = 0.45 + Math.sin(t / 200) * 0.2; c.position.y = 0.05 + Math.abs(Math.sin(t / 350)) * 0.04; });
  if (cart) { const u = cart.userData; if (Math.abs(cart.position.x - u.stop) > 0.02) { cart.position.x += Math.sign(u.stop - cart.position.x) * dt * 0.6; cart.children.forEach(ch => { if (ch.geometry && ch.geometry.type === "CylinderGeometry" && ch.position.y < 0.1) ch.rotation.y += dt * 4; }); } }
  holos.forEach(h => { h.rotation.y += dt * 1.2; h.position.y = 0.8 + Math.sin(t / 300) * 0.06; });
}
// Translucent "what this merge makes" hologram.
function hologram(key) {
  const b = build(key); if (!b) return null;
  b.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.7; o.material.depthWrite = false; o.material.emissive = new THREE.Color(0x7ff4ff); o.material.emissiveIntensity = 0.9; o.castShadow = false; } });
  const ring = mesh(new THREE.RingGeometry(0.34, 0.4, 40), new THREE.MeshBasicMaterial({ color: 0x7ff4ff, transparent: true, opacity: 0.8, side: THREE.DoubleSide }), 0, -0.48, 0); ring.rotation.x = -Math.PI / 2; b.add(ring);
  const halo = glowSprite(0x7ff4ff, 1.3, 0.55); halo.position.y = 0.2; b.add(halo);
  b.scale.setScalar(1.15);
  return b;
}
// Thumbnails for the DOM (next Build!, next discovery): one small offscreen renderer shared by all.
let thumbR, thumbScene, thumbCam;
function thumbnail(key, target, silhouette = false) {
  if (!thumbR) {
    thumbR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); thumbR.setSize(128, 128, false); thumbR.toneMapping = THREE.ACESFilmicToneMapping;
    thumbScene = new THREE.Scene(); thumbScene.environment = new THREE.PMREMGenerator(thumbR).fromScene(new THREE.RoomEnvironment(), 0.04).texture;
    const l = new THREE.DirectionalLight(0xffffff, 2.2); l.position.set(-2, 4, 3); thumbScene.add(l, new THREE.HemisphereLight(0xffffff, 0x886644, 0.8));
    thumbCam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  }
  const b = build(key); if (!b) return;
  if (silhouette) b.traverse(o => { if (o.isMesh) o.material = new THREE.MeshBasicMaterial({ color: 0x2a2418 }); if (o.isSprite) o.visible = false; });
  const box = new THREE.Box3().setFromObject(b), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const r = Math.max(size.x, size.y, size.z) * 0.9 + 0.1;
  thumbCam.position.set(c.x + r * 1.1, c.y + r * 1.0, c.z + r * 1.9); thumbCam.lookAt(c);
  thumbScene.add(b); thumbR.render(thumbScene, thumbCam); thumbScene.remove(b);
  const g = target.getContext("2d"); g.clearRect(0, 0, target.width, target.height); g.drawImage(thumbR.domElement, 0, 0, target.width, target.height);
}

const Kingdom3D = {
  TILT,
  init(canvas, cols, rows) {
    COLS = cols; ROWS = rows;
    stage = createStage(canvas, { bloom: 0.35, bloomThreshold: 0.9, exposure: 1.08, env: 0.8, shadows: true });
    scene = stage.scene;
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100); stage.composer.passes[0].camera = camera; stage.camera = camera;
    scene.background = new THREE.Color(0x7cc36a); // no fog: the ortho camera sits 30 units away, fog would wash the board out
    hemi = new THREE.HemisphereLight(0xfff6e8, 0x5a7a3a, 0.9); scene.add(hemi);
    key = keyLight(scene, { size: 6, offset: [-3, 8, 4], mapSize: 2048, intensity: 2.4 }); key.follow((cols - 1) / 2, 0, (rows - 1) / 2);
    initMaterials(); makeBoard(); buildWorld();
  },
  // Align the ortho camera so each ground cell centre lands on its DOM cell centre.
  layout(canvas, cell0, cellN) {
    if (!stage) return;
    const cr = canvas.getBoundingClientRect(), a = cell0.getBoundingClientRect(), b = cellN.getBoundingClientRect();
    const ppu = ((b.left + b.width / 2) - (a.left + a.width / 2)) / (COLS - 1); // pixels per world unit horizontally
    if (!ppu || !cr.width) return;
    const cx = (a.left + a.width / 2 + b.left + b.width / 2) / 2 - cr.left, cy = (a.top + a.height / 2 + b.top + b.height / 2) / 2 - cr.top;
    const w = cr.width / ppu, h = cr.height / ppu;
    // Frustum shifted so the board centre sits at (cx, cy) on the canvas.
    camera.left = -cx / ppu; camera.right = w - cx / ppu; camera.top = cy / ppu; camera.bottom = cy / ppu - h;
    const target = new THREE.Vector3((COLS - 1) / 2, 0, (ROWS - 1) / 2);
    camera.position.copy(target).add(new THREE.Vector3(0, Math.sin(ELEV), Math.cos(ELEV)).multiplyScalar(30));
    camera.up.set(0, 1, 0); camera.lookAt(target); camera.updateProjectionMatrix();
  },
  sync(grid, unlocked, raiders) {
    if (!stage) return;
    for (let i = 0; i < grid.length; i++) {
      const open = i < unlocked;
      wildTiles[i].wild.visible = !open; wildTiles[i].tile.visible = open;
      const c = grid[i], key = open && c && !raiders[i] ? `${c[0]}:${c[1]}` : "";
      if (key !== cellKeys[i] && i !== liftFrom) {
        cells[i].clear(); const b = build(key); if (b) { cells[i].add(b); cells[i].userData.pop = cellKeys[i] ? 1 : 0.6; }
        if (key && cellKeys[i] && key !== cellKeys[i]) sparkle(i);
        cellKeys[i] = key;
      }
    }
    for (const [i, m] of raidMeshes) if (!raiders[i]) { board.remove(m); raidMeshes.delete(i); sparkle(+i); }
    for (const i of Object.keys(raiders)) if (!raidMeshes.has(i)) { const r = raider(raiders[i].e); r.position.set(i % COLS, 0.05, Math.floor(i / COLS)); board.add(r); raidMeshes.set(i, r); }
  },
  // Lift the building being dragged and move it under the pointer.
  drag(i, clientX, clientY, canvas) {
    if (!stage) return;
    if (liftFrom !== i) { this.drop(); liftFrom = i; lifted = cells[i].children[0] || null; if (lifted) { board.attach(lifted); } }
    if (!lifted) return;
    const r = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2((clientX - r.left) / r.width * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, camera);
    const hit = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), tmp);
    if (hit) lifted.position.set(hit.x, 0.35, hit.z);
  },
  drop() {
    if (lifted) { board.remove(lifted); lifted = null; }
    if (liftFrom >= 0) { cellKeys[liftFrom] = "__"; liftFrom = -1; } // force a rebuild on next sync
  },
  merged(i) { sparkle(i); },
  thumbnail, // (key, canvas, silhouette?)
  showHolo(indices, key) { this.clearHolo(); indices.forEach(i => { const h = hologram(key); if (!h) return; h.position.set(i % COLS, 0.8, Math.floor(i / COLS)); board.add(h); holos.push(h); }); },
  clearHolo() { holos.forEach(h => board.remove(h)); holos = []; },
  world({ homes, chestCells, merchant }) {
    walkers(homes);
    for (const [i, c] of chests) if (!chestCells.includes(+i)) { board.remove(c); chests.delete(i); sparkle(+i); }
    chestCells.forEach(i => { if (chests.has(i)) return; const c = chestModel(); c.position.set(i % COLS, 0.05, Math.floor(i / COLS)); board.add(c); chests.set(i, c); });
    if (merchant && !cart) { cart = cartModel(); cart.position.set(-3, -0.53, ROWS - 0.05); cart.userData.stop = COLS + 0.3; scene.add(cart); }
    if (!merchant && cart) { scene.remove(cart); cart = null; }
  },
  draw(t, dt) {
    if (!stage) return;
    tickWorld(t, dt);
    cells.forEach(c => { const p = c.userData.pop || 0; if (p > 0) { c.userData.pop = Math.max(0, p - dt * 3); const s = 1 + Math.sin(p * Math.PI) * 0.35; c.scale.set(s, s, s); } const b = c.children[0]; if (b && b.userData.spin) b.userData.spin.rotation.y += dt; });
    for (const [, r] of raidMeshes) { r.position.y = 0.05 + Math.abs(Math.sin(t / 150 + r.userData.phase)) * 0.06; r.rotation.y = Math.sin(t / 400 + r.userData.phase) * 0.6; }
    for (const s of sparkles) { if (s.life <= 0) continue; s.life -= dt; s.v.y -= 6 * dt; s.m.position.addScaledVector(s.v, dt); s.m.material.opacity = s.life / 0.7; if (s.life <= 0) s.m.visible = false; }
    scene.traverse(o => { if (o.userData.wave && o.geometry) { const p = o.geometry.attributes.position; for (let k = 0; k < p.count; k++) { const x = p.getX(k); p.setZ(k, Math.sin(t / 200 + x * 30) * 0.015 * (x + 0.07) / 0.14); } p.needsUpdate = true; } });
    if (lifted) lifted.rotation.y = Math.sin(t / 200) * 0.15;
    stage.render(t);
  },
};
window.Kingdom3D = Kingdom3D;
window.dispatchEvent(new Event("kingdom3d-ready"));
