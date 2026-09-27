// Abyss Diver — realistic 3D renderer. Game logic (index.html) keeps its 2D coordinates:
// x in [0, W], screen-y in px with the sub at SUBY. This module maps them onto the z = 0 plane (60 px = 1 unit)
// and draws a real underwater scene around them. Exposes window.Abyss3D and fires "abyss3d-ready".
import { THREE, createStage, keyLight, pbrMaterial, mats, glowSprite } from "../shared/realism.js";

const PX = 60; // game pixels per world unit
let stage, scene, camera, W, H, SUBY, sub, prop, headlight, beam, shield, pulse, harpoon, walls = [], rays = [], snow, snowPos, bubbles = [], hemi, key, fill, bossLight, bossHalo;
const meshes = new Map(); // game object -> mesh
let bossMesh = null, bossName = "", shotMeshes = [], escorts = new Map();
const tmpV = new THREE.Vector3();

const toX = (x) => (x - W / 2) / PX;
const toY = (sy) => -(sy - SUBY) / PX;

// ---------- creature builders ----------
function fishBody(len, girth, color, o = {}) {
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(1, 32, 20); // stretch + taper the back half for a fish silhouette
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i); const taper = x < 0 ? 1 + x * 0.55 : 1; p.setY(i, p.getY(i) * taper); p.setZ(i, p.getZ(i) * taper * 0.75); }
  geo.computeVertexNormals();
  const skin = new THREE.MeshPhysicalMaterial({ color, roughness: 0.35, metalness: 0.15, clearcoat: 0.8, clearcoatRoughness: 0.25, iridescence: o.irid ?? 0.4, iridescenceIOR: 1.3, emissive: o.glow || 0x000000, emissiveIntensity: o.glow ? 0.6 : 0 });
  const body = new THREE.Mesh(geo, skin); body.scale.set(len / 2, girth / 2, girth / 2); g.add(body);
  const finMat = new THREE.MeshPhysicalMaterial({ color: o.fin || color, roughness: 0.4, transmission: 0.3, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
  const tailShape = new THREE.Shape(); tailShape.moveTo(0, 0); tailShape.lineTo(-girth * 0.9, girth * 0.6); tailShape.lineTo(-girth * 0.7, 0); tailShape.lineTo(-girth * 0.9, -girth * 0.6); tailShape.closePath();
  const tail = new THREE.Mesh(new THREE.ShapeGeometry(tailShape), finMat); tail.position.x = -len / 2 + 0.05; g.add(tail); g.userData.tail = tail;
  if (o.dorsal) { const ds = new THREE.Shape(); ds.moveTo(-girth * 0.3, 0); ds.lineTo(0, girth * 0.7); ds.lineTo(girth * 0.3, 0); const d = new THREE.Mesh(new THREE.ShapeGeometry(ds), finMat); d.position.y = girth / 2 - 0.02; g.add(d); }
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(girth * 0.1, 12, 8), new THREE.MeshPhysicalMaterial({ color: 0x111111, roughness: 0.05, clearcoat: 1 }));
    eye.position.set(len * 0.32, girth * 0.1, s * girth * 0.3); g.add(eye);
  }
  if (o.stripes) for (let i = 0; i < 3; i++) { const st = new THREE.Mesh(new THREE.TorusGeometry(girth * 0.42 * (1 - i * 0.12), girth * 0.05, 6, 20), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })); st.rotation.y = Math.PI / 2; st.position.x = len * (0.15 - i * 0.2); g.add(st); }
  return g;
}
function jelly(color) {
  const g = new THREE.Group();
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.32, 32, 16, 0, Math.PI * 2, 0, Math.PI / 1.9),
    new THREE.MeshPhysicalMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.1, transmission: 0.6, thickness: 0.4, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  g.add(bell); g.userData.bell = bell;
  const tm = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6 });
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const t = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.004, 0.7, 4), tm); t.position.set(Math.cos(a) * 0.2, -0.35, Math.sin(a) * 0.2); g.add(t); }
  g.add(glowSprite(color, 1.4, 0.35));
  return g;
}
function tentacled(color, n = 8, len = 0.9, headR = 0.3) { // squid / kraken
  const g = new THREE.Group();
  const skin = pbrMaterial({ type: "plaster", color: "#ffffff", color2: "#c8c8c8", scale: 3, normal: 3, seed: 44 }, { color, roughness: 0.45 });
  skin.clearcoat = 0.5;
  const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 32, 24), skin); head.scale.set(1, 1.4, 1); head.position.y = headR * 0.8; g.add(head);
  const arms = [];
  for (let i = 0; i < n; i++) {
    let parent = new THREE.Group(); parent.rotation.y = i / n * Math.PI * 2; parent.rotation.z = 0.25; g.add(parent);
    const segs = [];
    for (let k = 0; k < 6; k++) {
      const seg = new THREE.Group(); seg.position.y = k ? -len / 6 : 0; parent.add(seg);
      const r = headR * 0.28 * (1 - k / 7);
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.85, len / 6, 10), skin); cyl.position.y = -len / 12; seg.add(cyl);
      segs.push(seg); parent = seg;
    }
    arms.push(segs);
  }
  for (const s of [-1, 1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.2, 16, 12), new THREE.MeshPhysicalMaterial({ color: 0xfff3a0, emissive: 0xffc400, emissiveIntensity: 1.2, roughness: 0.1, clearcoat: 1 })); eye.position.set(s * headR * 0.55, headR * 0.7, headR * 0.75); g.add(eye); }
  g.userData.arms = arms;
  return g;
}
function eel(color) {
  const g = new THREE.Group(); const mat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, clearcoat: 1, emissive: color, emissiveIntensity: 0.15 });
  const segs = [];
  for (let i = 0; i < 9; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.11 * (1 - i / 12), 16, 10), mat); s.position.x = -i * 0.13; g.add(s); segs.push(s); }
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffee88 })); eye.position.set(0.05, 0.05, 0.07); g.add(eye);
  g.userData.segs = segs; return g;
}
function angler(color, lure) {
  const g = fishBody(0.9, 0.6, color, { irid: 0, fin: 0x221111 });
  const teeth = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.12, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0xeeeedd, side: THREE.DoubleSide })); teeth.rotation.z = -Math.PI / 2; teeth.position.x = 0.45; g.add(teeth);
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.45, 6), new THREE.MeshStandardMaterial({ color })); stalk.position.set(0.25, 0.42, 0); stalk.rotation.z = -0.6; g.add(stalk);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), mats.emissive(lure, 6)); bulb.position.set(0.42, 0.6, 0); g.add(bulb);
  const gl = glowSprite(lure, 0.9, 0.8); gl.position.copy(bulb.position); g.add(gl);
  const pl = new THREE.PointLight(lure, 2, 2.5); pl.position.copy(bulb.position); g.add(pl);
  return g;
}
function watcher() {
  const g = new THREE.Group();
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.35, 32, 24), new THREE.MeshPhysicalMaterial({ color: 0xf2efe6, roughness: 0.15, clearcoat: 1 })); g.add(eye);
  const iris = new THREE.Mesh(new THREE.CircleGeometry(0.17, 32), new THREE.MeshStandardMaterial({ color: 0xff3b6b, emissive: 0xff3b6b, emissiveIntensity: 1.5 })); iris.position.z = 0.351; g.add(iris);
  const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.07, 24), new THREE.MeshBasicMaterial({ color: 0x000000 })); pupil.position.z = 0.352; g.add(pupil);
  g.add(glowSprite(0xff3b6b, 1.3, 0.35)); g.userData.look = true; return g;
}
function radiolarian(color) {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 1), new THREE.MeshPhysicalMaterial({ color, emissive: color, emissiveIntensity: 2, transmission: 0.5, roughness: 0.1 })); g.add(core);
  const sp = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.2 });
  const ico = new THREE.IcosahedronGeometry(1, 0).attributes.position;
  for (let i = 0; i < ico.count; i += 3) { const d = tmpV.fromBufferAttribute(ico, i).normalize(); const s = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.28, 5), sp); s.position.copy(d).multiplyScalar(0.28); s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d); g.add(s); }
  g.add(glowSprite(color, 1.2, 0.5)); return g;
}
function bonefish() {
  const g = new THREE.Group(); const bone = new THREE.MeshStandardMaterial({ color: 0xe8e2d0, roughness: 0.6 });
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), bone); skull.scale.set(1.3, 1, 0.9); skull.position.x = 0.35; g.add(skull);
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.8, 8), bone); spine.rotation.z = Math.PI / 2; g.add(spine);
  for (let i = 0; i < 6; i++) { const rib = new THREE.Mesh(new THREE.TorusGeometry(0.13 * (1 - i * 0.1), 0.012, 6, 16, Math.PI * 1.4), bone); rib.rotation.y = Math.PI / 2; rib.rotation.x = Math.PI * 0.8; rib.position.x = 0.2 - i * 0.1; g.add(rib); }
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mats.emissive(0x7affc8, 4)); eye.position.set(0.45, 0.04, 0.1); g.add(eye);
  return g;
}
function puffer() {
  const g = new THREE.Group(); const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), new THREE.MeshPhysicalMaterial({ color: 0xf2c94c, roughness: 0.4, clearcoat: 0.6 })); g.add(body);
  const sp = new THREE.MeshStandardMaterial({ color: 0xc9a227 });
  for (let i = 0; i < 40; i++) { const d = new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize(); const s = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.12, 4), sp); s.position.copy(d).multiplyScalar(0.3); s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d); g.add(s); }
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshPhysicalMaterial({ color: 0x111111, clearcoat: 1 })); e.position.set(0.2, 0.1, s * 0.17); g.add(e); }
  return g;
}
const MOBS = {
  "🐟": () => fishBody(0.8, 0.34, 0x8fb6d6, { irid: 0.8 }),
  "🐠": () => fishBody(0.7, 0.42, 0xff8a1f, { stripes: true, fin: 0xffb347 }),
  "🪼": () => jelly(0xff6fd8),
  "🦈": () => fishBody(1.6, 0.5, 0x7c8b99, { dorsal: true, irid: 0, fin: 0x6b7885 }),
  "🐡": () => puffer(),
  "🦑": () => tentacled(0xd9453b, 8, 0.7, 0.18),
  "🐍": () => eel(0x3aa35a),
  "👾": () => angler(0x2d2a3a, 0x7affc8),
  "👁️": () => watcher(),
  "🦠": () => radiolarian(0x5cf2ff),
  "💀": () => bonefish(),
  "👹": () => angler(0x5a1a1a, 0xff5533),
};
const FRIEND_MODELS = { "🐬": () => fishBody(1.0, 0.36, 0x9aa7b4, { dorsal: true, irid: 0.2 }), "🐙": () => tentacled(0xff7a5a, 8, 0.5, 0.16), "🐢": () => turtle(), "🐋": () => fishBody(1.6, 0.8, 0x3d5a80, { dorsal: false }), "🦄": () => seahorse() };
function turtle() {
  const g = new THREE.Group(); const shell = new THREE.Mesh(new THREE.SphereGeometry(0.35, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), pbrMaterial({ type: "stone", color: "#6b8e4e", color2: "#3a5a2a", scale: 4, seed: 61 })); shell.scale.y = 0.6; g.add(shell);
  const skin = mats.skin(0x9bb07a); const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), skin); head.position.set(0.4, 0.05, 0); g.add(head);
  for (const [x, z] of [[0.2, 0.3], [0.2, -0.3], [-0.2, 0.28], [-0.2, -0.28]]) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), skin); f.scale.set(1.4, 0.3, 0.6); f.position.set(x, 0, z); g.add(f); }
  return g;
}
function seahorse() {
  const g = new THREE.Group(); const m = new THREE.MeshPhysicalMaterial({ color: 0xff9ad5, emissive: 0xff5cc0, emissiveIntensity: 0.4, clearcoat: 1, roughness: 0.3, iridescence: 1 });
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.4, 0), new THREE.Vector3(0.1, 0.2, 0), new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.08, -0.25, 0), new THREE.Vector3(0.05, -0.38, 0)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.07, 10), m));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), m); head.position.set(0.02, 0.42, 0); g.add(head);
  const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.18, 8), m); snout.rotation.z = Math.PI / 2.2; snout.position.set(0.14, 0.42, 0); g.add(snout);
  const horn = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.18, 8), mats.gold()); horn.position.set(0.02, 0.56, 0); g.add(horn);
  return g;
}
function makeCoin() {
  const g = new THREE.Group();
  const gold = mats.gold({ color: 0xffb41f, metalness: 0.75, emissive: 0xb07800, emissiveIntensity: 0.8, fog: false }); // warm glow, no fog: coins are the thing to chase
  const c = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.035, 32), gold); c.rotation.x = Math.PI / 2; g.add(c);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.012, 8, 32), mats.gold({ color: 0xffc34d, roughness: 0.15, emissive: 0xb07800, emissiveIntensity: 0.6, fog: false })); g.add(rim);
  g.add(glowSprite(0xffc34d, 0.6, 0.25)); return g;
}
function makePearl() { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 32, 24), new THREE.MeshPhysicalMaterial({ color: 0xfbf6ee, roughness: 0.15, iridescence: 1, iridescenceIOR: 1.8, clearcoat: 1, emissive: 0xffe8f4, emissiveIntensity: 0.2 }))); g.add(glowSprite(0xffd6f0, 0.8, 0.5)); return g; }
function makeRelic() {
  const g = new THREE.Group();
  const pts = [[0, -0.3], [0.12, -0.28], [0.2, -0.1], [0.2, 0.08], [0.1, 0.2], [0.07, 0.3], [0.1, 0.34]].map(([x, y]) => new THREE.Vector2(x, y));
  g.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 32), mats.gold({ roughness: 0.3 })));
  g.add(glowSprite(0xffd76a, 1.4, 0.6)); return g;
}
function makeRock(w) {
  const geo = new THREE.DodecahedronGeometry(1, 1); const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { tmpV.fromBufferAttribute(p, i); const n = 1 + Math.sin(tmpV.x * 5 + tmpV.y * 3) * 0.12 + Math.cos(tmpV.z * 4) * 0.1; p.setXYZ(i, tmpV.x * n, tmpV.y * n, tmpV.z * n); }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, pbrMaterial({ type: "rock", color: "#6b7a80", color2: "#2a3238", scale: 2, seed: 71, normal: 4 }));
  m.scale.set(w / PX / 2, 26 / PX, 0.6); m.castShadow = true; m.receiveShadow = true; return m;
}
function makeSub() {
  const g = new THREE.Group();
  const paint = mats.plastic(0xffb300, { roughness: 0.25, clearcoat: 1, fog: false });
  const hull = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.7, 12, 32), paint); hull.rotation.z = Math.PI / 2; g.add(hull);
  const tower = new THREE.Mesh(new THREE.RoundedBoxGeometry(0.28, 0.2, 0.22, 3, 0.05), paint); tower.position.set(0.05, 0.3, 0); g.add(tower);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mats.glass({ color: 0xbfefff })); dome.rotation.z = -Math.PI / 2; dome.position.x = 0.62; g.add(dome);
  const steel = mats.steel();
  for (let i = 0; i < 3; i++) { const port = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.015, 8, 20), steel); port.position.set(-0.2 + i * 0.22, 0.02, 0.28); g.add(port);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.05, 20), mats.emissive(0xfff0b0, 1.5)); glass.position.set(-0.2 + i * 0.22, 0.02, 0.281); g.add(glass); }
  prop = new THREE.Group(); prop.position.x = -0.7; g.add(prop);
  for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.22, 0.06), steel); b.rotation.x = i * Math.PI * 2 / 3; prop.add(b); }
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.36), paint); fin.position.x = -0.55; g.add(fin);
  headlight = new THREE.SpotLight(0xfff6dd, 40, 14, 0.55, 0.6, 1.3); headlight.position.set(0.5, -0.1, 0); g.add(headlight, headlight.target);
  headlight.target.position.set(0.8, -3, 0);
  beam = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff6dd, transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  beam.position.set(0.7, -2, 0); beam.rotation.z = 0.12; g.add(beam);
  shield = new THREE.Mesh(new THREE.SphereGeometry(0.75, 32, 24), new THREE.MeshPhysicalMaterial({ color: 0x3ef2ff, emissive: 0x3ef2ff, emissiveIntensity: 0.5, transparent: true, opacity: 0.18, roughness: 0, depthWrite: false })); g.add(shield);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
function makeBoss(name) {
  if (/Megalodon/.test(name)) { const m = fishBody(5, 1.6, 0x5b6b78, { dorsal: true, irid: 0 }); return m; }
  if (/Leviathan/.test(name)) { const m = eel(0x2a6e5e); m.scale.setScalar(4.5); return m; }
  if (/Old One/.test(name)) return tentacled(0x3a1f5c, 10, 3.2, 0.9);
  return tentacled(0xb3322a, 8, 2.8, 0.8); // the Kraken
}

// ---------- environment ----------
function buildWorld() {
  hemi = new THREE.HemisphereLight(0x9fdcff, 0x08131c, 1.0); scene.add(hemi);
  fill = new THREE.DirectionalLight(0x9fd8ff, 0.6); scene.add(fill, fill.target); // soft front fill so shapes stay readable in the dark
  bossLight = new THREE.PointLight(0xff5fb0, 0, 12, 1.5); scene.add(bossLight);
  bossHalo = glowSprite(0xff4fd8, 9, 0); scene.add(bossHalo);
  key = keyLight(scene, { color: 0xbfe8ff, intensity: 1.6, size: 8, offset: [2, 10, 6] });
  // Canyon walls on both sides; their texture scrolls with depth so you feel the descent.
  const wallMat = pbrMaterial({ type: "rock", color: "#6c7f86", color2: "#1d2a30", scale: 3, normal: 4, seed: 83, repeat: 1 });
  for (const s of [-1, 1]) {
    const geo = new THREE.PlaneGeometry(6, 26, 30, 120); const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i), x = p.getX(i); p.setZ(i, Math.sin(y * 0.9 + s) * 0.6 + Math.sin(y * 2.3) * 0.25 + Math.cos(x * 2 + y) * 0.2); }
    geo.computeVertexNormals();
    const mat = wallMat.clone(); for (const k of ["map", "normalMap", "roughnessMap"]) { mat[k] = wallMat[k].clone(); mat[k].repeat.set(1.5, 6); mat[k].needsUpdate = true; }
    const w = new THREE.Mesh(geo, mat); w.receiveShadow = true;
    w.rotation.y = -s * 1.2; w.position.set(s * 5.2, 0, -2.5); scene.add(w); walls.push(w);
  }
  // Light shafts from the surface (fade out as you go deeper).
  const rayTex = (() => { const c = document.createElement("canvas"); c.width = 64; c.height = 256; const g = c.getContext("2d"); const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "rgba(255,255,255,.9)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 256); const h = g.createLinearGradient(0, 0, 64, 0); h.addColorStop(0, "rgba(0,0,0,1)"); h.addColorStop(.5, "rgba(0,0,0,0)"); h.addColorStop(1, "rgba(0,0,0,1)"); g.globalCompositeOperation = "destination-out"; g.fillStyle = h; g.fillRect(0, 0, 64, 256); return new THREE.CanvasTexture(c); })();
  for (let i = 0; i < 6; i++) { const r = new THREE.Mesh(new THREE.PlaneGeometry(0.8 + Math.random(), 16), new THREE.MeshBasicMaterial({ map: rayTex, color: 0xcff6ff, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending })); r.position.set(-3 + i * 1.3, 4, -3 - Math.random() * 2); r.rotation.z = 0.25; scene.add(r); rays.push(r); }
  // Marine snow: streams upward past the camera as you dive.
  const N = 500; snowPos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { snowPos[i * 3] = (Math.random() - 0.5) * 12; snowPos[i * 3 + 1] = (Math.random() - 0.5) * 16; snowPos[i * 3 + 2] = -Math.random() * 6 + 1.5; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(snowPos, 3));
  snow = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xd8f6ff, size: 0.035, transparent: true, opacity: 0.55, depthWrite: false, sizeAttenuation: true }));
  snow.frustumCulled = false; scene.add(snow);
  for (let i = 0; i < 30; i++) { const b = glowSprite(0xe8fbff, 0.08, 0.7); b.visible = false; scene.add(b); bubbles.push({ m: b, life: 0 }); }
  sub = makeSub(); scene.add(sub);
  pulse = new THREE.Mesh(new THREE.TorusGeometry(1, 0.03, 8, 64), mats.emissive(0xb6ff5c, 3)); pulse.visible = false; scene.add(pulse);
  harpoon = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineDashedMaterial({ color: 0xb6ff5c, dashSize: 0.15, gapSize: 0.1 }));
  harpoon.visible = false; scene.add(harpoon);
}


// ---------- scenery that scrolls past with depth (anchored to world depth, placed near the walls) ----------
let sceneryRoot, bands = new Map(), schools = [], whale;
const BAND = 3; // world units per scenery band
function coral(color) {
  const g = new THREE.Group(), mat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.55, clearcoat: 0.3, emissive: color, emissiveIntensity: 0.08 });
  const branch = (x, y, z, len, ang, depth) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.045, len, 6), mat); c.position.set(x, y + len / 2, z); c.rotation.z = ang; g.add(c); if (depth < 2) for (const a of [-0.5, 0.5]) branch(x - Math.sin(ang) * len, y + Math.cos(ang) * len, z, len * 0.7, ang + a, depth + 1); };
  for (let i = 0; i < 3; i++) branch((i - 1) * 0.12, 0, 0, 0.35, (i - 1) * 0.3, 0);
  return g;
}
function anemone(color) { const g = new THREE.Group(), mat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.4, transmission: 0.3, emissive: color, emissiveIntensity: 0.25 }); g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.12, 12), mat)); for (let i = 0; i < 14; i++) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.008, 0.25, 5), mat); const a = i / 14 * Math.PI * 2; t.position.set(Math.cos(a) * 0.08, 0.18, Math.sin(a) * 0.08); t.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4); g.add(t); } g.userData.sway = true; return g; }
function wreck() {
  const g = new THREE.Group(), wood = pbrMaterial({ type: "wood", color: "#6a5040", color2: "#2a1e14", scale: 3, seed: 90 });
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 3.2, 20, 1, true, 0, Math.PI), wood); hull.rotation.set(0, 0, Math.PI / 2); hull.material.side = THREE.DoubleSide; g.add(hull);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.4, 8), wood); mast.position.set(0.3, 0.6, 0); mast.rotation.z = 0.6; g.add(mast);
  for (let i = 0; i < 5; i++) { const plank = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.14), wood); plank.position.set(-1.8 + Math.random() * 3.6, -0.8, (Math.random() - .5) * 0.8); plank.rotation.y = Math.random() * 3; g.add(plank); }
  g.rotation.z = -0.25; g.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } }); return g;
}
function column(broken) { const g = new THREE.Group(), stone = pbrMaterial({ type: "plaster", color: "#b8c4c0", color2: "#5a6a68", scale: 3, seed: 91 }); const h = broken ? 0.9 + Math.random() * 0.6 : 1.8; g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, h, 14), stone).translateY(h / 2)); g.add(new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.1, 0.44), stone)); if (!broken) g.add(new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.1, 0.44), stone).translateY(h)); return g; }
function vent() {
  const g = new THREE.Group(), rock = pbrMaterial({ type: "rock", color: "#3a3a40", color2: "#101014", scale: 2, seed: 92 });
  g.add(new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 10, 1, true), rock).translateY(0.4));
  g.add(new THREE.Mesh(new THREE.CircleGeometry(0.12, 12), mats.emissive(0xff6a1a, 3)).rotateX(-Math.PI / 2).translateZ(0.8));
  const worms = new THREE.MeshStandardMaterial({ color: 0xf2f0e8 }), red = mats.emissive(0xd9342b, 0.6);
  for (let i = 0; i < 7; i++) { const a = i * 0.9, x = Math.cos(a) * 0.42, z = Math.sin(a) * 0.42; g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 6), worms).translateX(x).translateZ(z).translateY(0.17)); g.add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), red).translateX(x).translateZ(z).translateY(0.36)); }
  const plume = []; for (let i = 0; i < 6; i++) { const p = glowSprite(0x2a2a30, 0.5, 0.5); p.material.blending = THREE.NormalBlending; p.userData.k = i / 6; g.add(p); plume.push(p); }
  g.userData.plume = plume; return g;
}
function whaleBones() { const g = new THREE.Group(), bone = new THREE.MeshStandardMaterial({ color: 0xd8d2c0, roughness: 0.6 }); g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 3, 8), bone).rotateZ(Math.PI / 2)); for (let i = 0; i < 9; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.55 - Math.abs(i - 4) * 0.07, 0.035, 8, 20, Math.PI), bone); r.position.x = -1.2 + i * 0.3; r.rotation.y = Math.PI / 2; r.rotation.z = Math.PI; g.add(r); } const skull = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), bone); skull.scale.set(1.8, 0.8, 0.9); skull.position.x = 1.8; g.add(skull); return g; }
function kelpStrand() { const pts = []; for (let i = 0; i < 8; i++) pts.push(new THREE.Vector3(Math.sin(i * 0.8) * 0.12, i * 0.35, 0)); const k = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.04, 6), new THREE.MeshPhysicalMaterial({ color: 0x4f8a3a, roughness: 0.5, transmission: 0.2 })); k.userData.sway = true; return k; }
function bandProps(b) {
  const g = new THREE.Group(), depthM = b * BAND * PX / 10; // metres (world px / 10)
  const h = (k) => Math.abs(Math.sin(b * 12.9898 + k * 78.233) * 43758.5453) % 1;
  const side = h(1) < 0.5 ? -1 : 1, x = side * (2.3 + h(2) * 1.6), y = -h(3) * BAND, z = -2.6 - h(4) * 2.4; // behind the playfield, inside the wider far view
  let o = null;
  if (depthM < 200) o = h(5) < 0.45 ? coral([0xff6f91, 0xffa94d, 0xb56cff, 0xff4f4f][Math.floor(h(6) * 4)]) : h(5) < 0.7 ? anemone([0xff8ad8, 0x7ae7ff, 0xffd23f][Math.floor(h(6) * 3)]) : kelpStrand();
  else if (depthM < 1000) o = h(5) < 0.12 ? wreck() : h(5) < 0.4 ? anemone(0x7ae7ff) : null;
  else if (depthM < 3000) o = h(5) < 0.25 ? column(h(6) < 0.6) : h(5) < 0.45 ? vent() : null;
  else o = h(5) < 0.12 ? whaleBones() : h(5) < 0.4 ? vent() : null;
  if (o) { o.scale.multiplyScalar(1.4); o.position.set(x, y, z); o.rotation.y = h(7) * 6; if (o.userData.plume === undefined) o.rotation.z += side * 0.2; g.add(o); o.traverse(c => { if (c.isMesh) c.receiveShadow = true; }); }
  return g;
}
function makeSchool() {
  const g = new THREE.Group(), mat = new THREE.MeshPhysicalMaterial({ color: 0xc8dcea, metalness: 0.5, roughness: 0.3, iridescence: 1 });
  const geo = new THREE.SphereGeometry(0.06, 10, 6); geo.scale(2.4, 0.8, 0.6);
  for (let i = 0; i < 16; i++) { const f = new THREE.Mesh(geo, mat); f.userData.off = new THREE.Vector3((Math.random() - .5) * 1.4, (Math.random() - .5) * 0.8, (Math.random() - .5) * 0.6); g.add(f); }
  g.userData.dir = Math.random() < .5 ? 1 : -1; g.position.set(-g.userData.dir * 7, (Math.random() - .5) * 6, -2.5 - Math.random() * 2); return g;
}
function initScenery() {
  sceneryRoot = new THREE.Group(); scene.add(sceneryRoot);
  for (let i = 0; i < 2; i++) { const sc = makeSchool(); scene.add(sc); schools.push(sc); }
  whale = fishBody(6, 1.8, 0x1e3444, { dorsal: false, irid: 0 }); whale.position.set(-9, 1, -9); scene.add(whale);
}
function tickScenery(worldY, t, dt, depthM) {
  const top = Math.floor((worldY / PX - 9) / BAND), bottom = Math.ceil((worldY / PX + 12) / BAND);
  for (let b = top; b <= bottom; b++) if (b > 0 && !bands.has(b)) { const g = bandProps(b); g.position.y = -b * BAND; sceneryRoot.add(g); bands.set(b, g); }
  for (const [b, g] of bands) if (b < top - 1 || b > bottom + 1) { sceneryRoot.remove(g); bands.delete(b); }
  sceneryRoot.position.y = worldY / PX; // world-anchored: rises as you descend
  sceneryRoot.traverse(o => { if (o.userData.sway) o.rotation.z = Math.sin(t / 900 + o.id) * 0.12; if (o.userData.plume) o.userData.plume.forEach(p => { p.userData.k = (p.userData.k + dt * 0.25) % 1; p.position.set(Math.sin(p.userData.k * 9) * 0.1, 0.8 + p.userData.k * 2, 0); p.scale.setScalar(0.3 + p.userData.k * 0.9); p.material.opacity = 0.5 * (1 - p.userData.k); }); });
  schools.forEach((sc, k) => { const u = sc.userData; sc.position.x += u.dir * dt * 0.9; sc.children.forEach((f, i) => { f.position.copy(f.userData.off); f.position.y += Math.sin(t / 400 + i) * 0.08; f.rotation.y = u.dir > 0 ? 0 : Math.PI; }); if (Math.abs(sc.position.x) > 8) { u.dir *= -1; sc.position.y = (Math.random() - .5) * 6; } sc.visible = depthM < 1200; });
  whale.visible = depthM > 150 && depthM < 1500; if (whale.visible) { whale.position.x += dt * 0.6; if (whale.position.x > 14) whale.position.x = -14; if (whale.userData.tail) whale.userData.tail.rotation.y = Math.sin(t / 700) * 0.3; }
}
function makeAir() { const g = new THREE.Group(); for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.06 + Math.random() * 0.06, 16, 12), new THREE.MeshPhysicalMaterial({ color: 0xe8fbff, roughness: 0, transmission: 0.9, thickness: 0.05, iridescence: 1, emissive: 0x9fe8ff, emissiveIntensity: 0.3 })); b.position.set((Math.random() - .5) * 0.25, (Math.random() - .5) * 0.25, 0); g.add(b); } g.add(glowSprite(0x9fe8ff, 0.8, 0.5)); return g; }
function makeChest() { const g = new THREE.Group(), wood = pbrMaterial({ type: "wood", color: "#7a5230", color2: "#3a2412", scale: 2, seed: 93 }); g.add(new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.26, 0.3), wood)); const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.44, 16, 1, false, 0, Math.PI), wood); lid.rotation.z = Math.PI / 2; lid.position.y = 0.13; g.add(lid); for (const x of [-0.15, 0.15]) g.add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.3, 0.32), mats.gold({ fog: false })).translateX(x).translateY(0.05)); g.add(glowSprite(0xffd76a, 1.2, 0.6)); return g; }

// ---------- per-frame ----------
function meshFor(o) {
  let m = meshes.get(o); if (m) return m;
  if (o.k === "air") m = makeAir(); else if (o.k === "chest") m = makeChest(); else if (o.k === "coin") m = makeCoin(); else if (o.k === "pearl") m = makePearl(); else if (o.k === "relic") m = makeRelic();
  else if (o.k === "rock") m = makeRock(o.w);
  else if (o.k === "friend") { m = new THREE.Group(); const inner = (FRIEND_MODELS[o.e] || MOBS["🐟"])(); inner.scale.setScalar(0.6); m.add(inner); m.add(new THREE.Mesh(new THREE.SphereGeometry(0.6, 32, 24), mats.glass({ color: 0xd8fbff, thickness: 0.05 }))); m.add(glowSprite(0x7ff4ff, 2, 0.4)); }
  else m = (MOBS[o.e] || MOBS["🐟"])();
  m.userData.phase = Math.random() * 10;
  m.traverse(c => { if (c.isMesh) c.castShadow = true; });
  scene.add(m); meshes.set(o, m); return m;
}
function animateCreature(m, t, dirX) {
  const u = m.userData, ph = u.phase + t * 0.001;
  if (u.tail) u.tail.rotation.y = Math.sin(ph * 12) * 0.5;
  m.children.forEach(c => { if (c.userData && c.userData.tail) c.userData.tail.rotation.y = Math.sin(ph * 12) * 0.5; });
  if (u.bell) { const s = 1 + Math.sin(ph * 5) * 0.12; u.bell.scale.set(s, 1 / s, s); }
  if (u.arms) u.arms.forEach((segs, i) => segs.forEach((sg, k) => { sg.rotation.x = Math.sin(ph * 3 + i + k * 0.7) * 0.25; }));
  if (u.segs) u.segs.forEach((s, i) => { s.position.z = Math.sin(ph * 6 - i * 0.7) * 0.06; s.position.y = Math.sin(ph * 4 - i * 0.5) * 0.03; });
  if (dirX !== undefined && !u.look) m.rotation.y = THREE.MathUtils.lerp(m.rotation.y, dirX < 0 ? Math.PI : 0, 0.15);
}

const Abyss3D = {
  init(canvas, dims) {
    ({ W, H, SUBY } = dims);
    stage = createStage(canvas, { bloom: 0.8, bloomThreshold: 0.75, bloomRadius: 0.6, exposure: 1.05, env: 0.5, fov: 40 });
    ({ scene, camera } = stage);
    scene.background = new THREE.Color(0x0e5a80); scene.fog = new THREE.FogExp2(0x0e5a80, 0.07);
    buildWorld(); initScenery();
  },
  // Screen position of a game point (for floating text).
  project(x, sy) {
    tmpV.set(toX(x), toY(sy), 0).project(camera);
    const r = stage.renderer.domElement.getBoundingClientRect();
    return [r.left + (tmpV.x + 1) / 2 * r.width, r.top + (1 - tmpV.y) / 2 * r.height];
  },
  // Canvas x (0..1 across) -> game x, so steering matches what you see.
  gameX(fx) { const halfW = Math.tan(camera.fov * Math.PI / 360) * camera.position.z * camera.aspect; return W / 2 + (fx * 2 - 1) * halfW * PX; },
  draw(R, worldY, t, dt, zone, deepness) {
    if (!stage) return;
    // Camera frames the playfield width exactly; the sub sits 30% from the top.
    const halfW = (W / PX) / 2, dist = halfW / (Math.tan(camera.fov * Math.PI / 360) * camera.aspect);
    const visH = 2 * dist * Math.tan(camera.fov * Math.PI / 360);
    camera.position.set(0, -0.2 * visH, dist); camera.lookAt(0, -0.2 * visH, 0);
    // Water colour, fog and light fall off with depth.
    const col = new THREE.Color(zone.c[0]).lerp(new THREE.Color(zone.c[1]), 0.5).multiplyScalar(1 - deepness * 0.45).lerp(new THREE.Color(0x06202e), deepness * 0.35);
    scene.background.copy(col); scene.fog.color.copy(col); scene.fog.density = 0.04 + deepness * 0.035;
    hemi.intensity = 1.1 * (1 - deepness) + 0.35; key.intensity = 1.8 * (1 - deepness) + 0.25;
    fill.position.set(0, 2, 10); fill.intensity = 0.5 + deepness * 0.5;
    key.follow(0, 0, 0);
    rays.forEach((r, i) => { r.material.opacity = 0.13 * Math.max(0, 1 - R.depth / 250); r.position.x = -3 + i * 1.3 + Math.sin(t / 3000 + i) * 0.3; });
    walls.forEach(w => { for (const k of ["map", "normalMap", "roughnessMap"]) w.material[k].offset.y = -worldY / PX / 26 * 6; w.material.color.setScalar(1 - deepness * 0.6); });
    // Marine snow drifts up relative to the sub while descending.
    const rise = (R.boss ? 0.3 : R.st.speed * 0.16) * dt;
    for (let i = 0; i < snowPos.length; i += 3) { snowPos[i + 1] += rise + Math.sin(t / 900 + i) * 0.001; if (snowPos[i + 1] > 8) snowPos[i + 1] -= 16; }
    snow.geometry.attributes.position.needsUpdate = true;
    // Sub: bank into turns, propeller spins, headlight widens with Floodlight upgrades.
    sub.position.set(toX(R.x), 0, 0);
    sub.rotation.z = THREE.MathUtils.lerp(sub.rotation.z, -0.35 + (R.x - R.tx) / 400, 0.1);
    sub.rotation.y = THREE.MathUtils.lerp(sub.rotation.y, R.tx < R.x - 4 ? Math.PI * 0.85 : 0, 0.08);
    prop.rotation.x += dt * 30;
    headlight.intensity = 25 + deepness * 50; headlight.distance = R.st.lamp / PX * 2.2; headlight.angle = 0.45 + R.st.lamp / 2000;
    beam.visible = false; // the spotlight itself lights the water; a visible cone read as a flat triangle
    sub.visible = !(R.inv > 0 && Math.floor(R.t * 12) % 2);
    shield.visible = !!R.until && (R.until.shield || 0) > R.t; shield.material.opacity = 0.14 + Math.sin(t / 80) * 0.05;
    const pulseOn = (R.until.pulse || 0) > R.t; pulse.visible = pulseOn;
    if (pulseOn) { pulse.position.copy(sub.position); const s = R.st.magnet * 4 / PX * (0.6 + ((t / 400) % 1) * 0.4); pulse.scale.setScalar(s); pulse.material.opacity = 1; }
    // Bubbles from the propeller.
    if (Math.random() < 0.5) { const b = bubbles.find(b => b.life <= 0); if (b) { b.m.visible = true; b.life = 1.2; b.m.position.set(sub.position.x - 0.7 * Math.cos(sub.rotation.y), 0.05, 0.1); b.m.scale.setScalar(0.05 + Math.random() * 0.07); } }
    bubbles.forEach(b => { if (b.life <= 0) return; b.life -= dt; b.m.position.y += dt * (0.8 + rise * 20); b.m.position.x += Math.sin(t / 150 + b.life * 10) * 0.004; b.m.material.opacity = b.life / 1.2 * 0.7; if (b.life <= 0) b.m.visible = false; });
    tickScenery(worldY, t, dt, R.depth);
    // Game objects.
    const seen = new Set();
    for (const o of R.objs) {
      const sy = o.y - worldY + SUBY; if (sy < -200 || sy > H + 200) continue;
      const m = meshFor(o); seen.add(o);
      m.position.set(toX(o.x), toY(sy), 0);
      if (o.k === "coin") { m.rotation.y = Math.sin(t / 400 + m.userData.phase) * 0.9; m.children[2].material.opacity = 0.25 + deepness * 0.45; } // wobble, never edge-on
      else if (o.k === "air") { m.position.y += Math.sin(t / 300 + m.userData.phase) * 0.06; m.children.forEach((b, i) => b.scale && i < 5 && b.scale.setScalar(1 + Math.sin(t / 200 + i) * 0.1)); }
      else if (o.k === "chest") { m.rotation.y = Math.sin(t / 900) * 0.5; m.position.y += Math.sin(t / 500) * 0.05; }
      else if (o.k === "pearl" || o.k === "relic") { m.rotation.y = t / 700; m.position.y += Math.sin(t / 400 + m.userData.phase) * 0.05; }
      else if (o.k === "friend") { m.rotation.y = Math.sin(t / 800) * 0.6; m.position.y += Math.sin(t / 500) * 0.08; animateCreature(m.children[0], t); }
      else if (o.k === "mob") { animateCreature(m, t, o.vx); }
    }
    for (const [o, m] of meshes) if (!seen.has(o)) { scene.remove(m); meshes.delete(o); }
    // Friends escort the sub.
    let k = 0;
    for (const [id, make] of Object.entries(R.escortList || {})) {
      let m = escorts.get(id); if (!m) { m = make(); m.scale.setScalar(0.45); scene.add(m); escorts.set(id, m); }
      m.position.set(sub.position.x + Math.cos(R.t * 1.6 + k) * 1.0, Math.sin(R.t * 1.6 + k) * 0.55, 0.3); m.rotation.y = Math.cos(R.t * 1.6 + k) > 0 ? Math.PI : 0; animateCreature(m, t); k += 1.3;
    }
    // Boss fight.
    if (R.boss) {
      if (!bossMesh || bossName !== R.boss.name) { if (bossMesh) scene.remove(bossMesh); bossMesh = makeBoss(R.boss.name); bossMesh.traverse(c => { if (c.isMesh) c.castShadow = true; }); scene.add(bossMesh); bossName = R.boss.name; }
      bossMesh.position.set(toX(R.boss.x), toY(H * 0.82) - 0.5, -0.5); animateCreature(bossMesh, t);
      bossMesh.rotation.y = Math.sin(t / 900) * 0.4;
      bossLight.position.copy(bossMesh.position).add(tmpV.set(0, 2, 3)); bossLight.intensity = 30;
      bossHalo.position.copy(bossMesh.position).add(tmpV.set(0, 0.5, -2)); bossHalo.material.opacity = 0.35 + Math.sin(t / 300) * 0.08;
      while (shotMeshes.length < R.boss.shots.length) { const s = new THREE.Group(); s.add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), mats.emissive(0xff4fd8, 4))); s.add(glowSprite(0xff4fd8, 0.9, 0.8)); scene.add(s); shotMeshes.push(s); }
      shotMeshes.forEach((s, i) => { const sh = R.boss.shots[i]; s.visible = !!sh; if (sh) s.position.set(toX(sh.x), toY(sh.y), 0); });
      harpoon.visible = true; harpoon.geometry.setFromPoints([sub.position.clone().add(new THREE.Vector3(0, -0.3, 0)), bossMesh.position.clone().add(new THREE.Vector3(0, 0.8, 0))]); harpoon.computeLineDistances();
    } else { bossLight.intensity = 0; bossHalo.material.opacity = 0; if (bossMesh) { scene.remove(bossMesh); bossMesh = null; bossName = ""; } shotMeshes.forEach(s => s.visible = false); harpoon.visible = false; }
    stage.render(t);
  },
  reset() { for (const [, g] of bands) sceneryRoot.remove(g); bands.clear(); for (const [, m] of meshes) scene.remove(m); meshes.clear(); for (const [, m] of escorts) scene.remove(m); escorts.clear(); },
  friendModel: (e) => FRIEND_MODELS[e],
};

window.Abyss3D = Abyss3D;
window.dispatchEvent(new Event("abyss3d-ready"));
