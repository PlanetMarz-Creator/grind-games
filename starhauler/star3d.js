// Star Hauler — realistic 3D galaxy map. Game logic (index.html) keeps its 400×360 map coordinates;
// this maps them onto the XZ plane and renders planets, the home star, ships and space. Exposes window.Star3D.
import { THREE, createStage, glowSprite, mats } from "../shared/realism.js";

const U = 40; // map px per world unit
let stage, scene, camera, canvas, labelsEl, HOME, PLANETS, star, station, planets = [], routeLines = [], shipMeshes = [], mystery, pirate, nebula = [];
let found = 0, gateAt = -1;
const ray = new THREE.Raycaster(), tmp = new THREE.Vector3();
const toW = (p) => new THREE.Vector3((p.x - HOME.x) / U, 0, (p.y - HOME.y) / U);

// ---------- procedural planet surfaces (equirectangular canvases) ----------
function noise2(seed) {
  const r = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453; return s - Math.floor(s); };
  const sm = (t) => t * t * (3 - 2 * t);
  const n = (x, y, px) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, w = (v) => ((v % px) + px) % px;
    const a = r(w(xi), yi), b = r(w(xi + 1), yi), c = r(w(xi), yi + 1), d = r(w(xi + 1), yi + 1), u = sm(xf), v = sm(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
  return (x, y, px, oct = 5) => { let s = 0, amp = 0.5, f = 1, norm = 0; for (let o = 0; o < oct; o++) { s += n(x * f, y * f, px * f) * amp; norm += amp; amp *= 0.5; f *= 2; } return s / norm; };
}
function planetTexture(kind, seed) {
  const Wd = 256, Hd = 128, c = document.createElement("canvas"); c.width = Wd; c.height = Hd;
  const g = c.getContext("2d"), img = g.createImageData(Wd, Hd), fbm = noise2(seed), P = 6;
  const bump = new Float32Array(Wd * Hd);
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * Math.min(1, Math.max(0, t)));
  for (let y = 0; y < Hd; y++) for (let x = 0; x < Wd; x++) {
    const u = x / Wd * P, v = y / Hd * P / 2, lat = Math.abs(y / Hd - 0.5) * 2;
    let h = fbm(u, v, P), col;
    switch (kind) {
      case "earth": {
        const land = h > 0.52, ice = lat > 0.82 - h * 0.15;
        col = ice ? [236, 244, 250] : land ? mix([86, 140, 62], [170, 150, 100], (h - 0.52) * 5) : mix([18, 60, 120], [40, 110, 170], h * 1.6);
        break; }
      case "gas": { const band = Math.sin(v * 9 + fbm(u * 2, v * 2, P * 2) * 4) * 0.5 + 0.5; col = mix([200, 150, 100], [240, 220, 190], band); if (fbm(u * 3, v * 3, P * 3) > 0.72) col = [190, 90, 60]; h = band; break; }
      case "ice": col = mix([160, 200, 230], [248, 252, 255], h * 1.3); break;
      case "lava": { const crack = 1 - Math.abs(fbm(u * 2, v * 2, P * 2) * 2 - 1); col = crack > 0.86 ? [255, 140, 40] : mix([30, 14, 10], [80, 40, 30], h); h = crack; break; }
      case "crystal": col = mix([40, 60, 140], [120, 200, 255], Math.pow(h, 1.5) * 1.6); break;
      case "desert": col = mix([170, 100, 50], [240, 180, 110], h + Math.sin(v * 20 + h * 6) * 0.08); break;
      case "rock": col = mix([70, 55, 45], [165, 140, 115], h * 1.2); break;
      case "violet": col = mix([40, 20, 70], [170, 110, 220], h * 1.3); break;
      case "void": col = mix([4, 2, 10], [40, 20, 70], h); break;
      default: col = mix([90, 90, 90], [200, 200, 200], h);
    }
    const i = (y * Wd + x) * 4; img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255; bump[y * Wd + x] = h;
  }
  g.putImageData(img, 0, 0);
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = THREE.RepeatWrapping;
  // Normal map from the height field for lit relief.
  const nc = document.createElement("canvas"); nc.width = Wd; nc.height = Hd; const ng = nc.getContext("2d"), ni = ng.createImageData(Wd, Hd);
  for (let y = 0; y < Hd; y++) for (let x = 0; x < Wd; x++) { const at = (xx, yy) => bump[Math.min(Hd - 1, Math.max(0, yy)) * Wd + ((xx + Wd) % Wd)]; const dx = (at(x + 1, y) - at(x - 1, y)) * 4, dy = (at(x, y + 1) - at(x, y - 1)) * 4, l = Math.hypot(dx, dy, 1), i = (y * Wd + x) * 4; ni.data[i] = (-dx / l * .5 + .5) * 255; ni.data[i + 1] = (dy / l * .5 + .5) * 255; ni.data[i + 2] = (1 / l * .5 + .5) * 255; ni.data[i + 3] = 255; }
  ng.putImageData(ni, 0, 0); const normalMap = new THREE.CanvasTexture(nc); normalMap.wrapS = THREE.RepeatWrapping;
  return { map, normalMap };
}
function cloudTexture(seed) {
  const Wd = 256, Hd = 128, c = document.createElement("canvas"); c.width = Wd; c.height = Hd; const g = c.getContext("2d"), img = g.createImageData(Wd, Hd), fbm = noise2(seed + 9);
  for (let y = 0; y < Hd; y++) for (let x = 0; x < Wd; x++) { const h = fbm(x / Wd * 8, y / Hd * 4, 8); const a = Math.max(0, (h - 0.5) * 3.2); const i = (y * Wd + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = Math.min(255, a * 255); }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const LOOK = { // per planet: surface kind, radius, extras
  Dustbowl: ["rock", 0.34], Frostline: ["ice", 0.36], "Bazaar Prime": ["desert", 0.42], Glimmer: ["crystal", 0.38, "crystal"], Cinder: ["lava", 0.38, "lava"],
  "Old Earth": ["earth", 0.46, "clouds"], Mirage: ["violet", 0.36, "glow"], "Titan's Ring": ["gas", 0.6, "ring"], "The Shroud": ["void", 0.44, "void"],
  Nexus: ["violet", 0.4, "ringGlow"], "Eden-9": ["earth", 0.42, "clouds"], Edge: ["void", 0.5, "void"],
};
function makePlanet(p, i) {
  const [kind, r, extra] = LOOK[p.n] || ["rock", 0.35];
  const g = new THREE.Group(); g.position.copy(toW(p)); g.position.y = 0.3;
  const { map, normalMap } = planetTexture(kind, i + 1);
  const mat = new THREE.MeshStandardMaterial({ map, normalMap, roughness: kind === "ice" || kind === "crystal" ? 0.35 : 0.85, metalness: kind === "crystal" ? 0.3 : 0 });
  if (extra === "lava") { mat.emissive = new THREE.Color(0xff5a10); mat.emissiveMap = map; mat.emissiveIntensity = 1.2; }
  const body = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), mat); body.rotation.z = 0.35; g.add(body); g.userData.body = body;
  if (extra === "clouds") { const cl = new THREE.Mesh(new THREE.SphereGeometry(r * 1.03, 48, 32), new THREE.MeshStandardMaterial({ map: cloudTexture(i), transparent: true, depthWrite: false })); g.add(cl); g.userData.clouds = cl; }
  if (extra === "ring" || extra === "ringGlow") {
    const rc = document.createElement("canvas"); rc.width = 256; rc.height = 4; const rg = rc.getContext("2d");
    for (let x = 0; x < 256; x++) { const a = (Math.sin(x * 0.35) * 0.3 + 0.5) * (x > 20 && x < 240 ? 1 : 0); rg.fillStyle = extra === "ring" ? `rgba(230,200,160,${a})` : `rgba(180,140,255,${a})`; rg.fillRect(x, 0, 1, 4); }
    const rt = new THREE.CanvasTexture(rc); rt.colorSpace = THREE.SRGBColorSpace;
    const geo = new THREE.RingGeometry(r * 1.4, r * 2.3, 64); const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let k = 0; k < pos.count; k++) { const d = Math.hypot(pos.getX(k), pos.getY(k)); uv.setXY(k, (d - r * 1.4) / (r * 0.9), 0.5); }
    const ring = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: rt, transparent: true, side: THREE.DoubleSide, depthWrite: false, emissive: extra === "ringGlow" ? 0x9b5cff : 0x000000, emissiveMap: extra === "ringGlow" ? rt : null, emissiveIntensity: 1.5 }));
    ring.rotation.x = -Math.PI / 2 + 0.35; g.add(ring);
  }
  const atmoCol = { earth: 0x7fc8ff, ice: 0xcfefff, lava: 0xff6a2a, crystal: 0x5cc8ff, violet: 0xb68cff, void: 0x7a3aff, gas: 0xffd6a0, desert: 0xffb070, rock: 0xd8c8b0 }[kind];
  const atmo = glowSprite(atmoCol, r * (extra === "void" ? 4.2 : 3.2), extra === "void" || extra === "glow" ? 0.6 : 0.35); g.add(atmo);
  if (extra === "crystal") for (let k = 0; k < 7; k++) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(r * 0.2), mats.glass({ color: 0x9fe0ff, thickness: 0.3 })); const d = new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize(); s.position.copy(d).multiplyScalar(r * 0.98); s.scale.y = 2.2; s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d); body.add(s); }
  body.userData.index = i;
  return g;
}
function makeShip() {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.26, 12), mats.plastic(0xf4e9d8, { metalness: 0.4, roughness: 0.3 })); hull.rotation.z = -Math.PI / 2; g.add(hull);
  for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.01, 0.12), mats.plastic(0xe8612c)); w.position.set(-0.05, 0, s * 0.07); g.add(w); }
  const flame = glowSprite(0x6fd6ff, 0.35, 0.95); flame.position.x = -0.15; g.add(flame); g.userData.flame = flame;
  return g;
}
function makePirate() {
  const g = new THREE.Group(); const dark = new THREE.MeshStandardMaterial({ color: 0x1a1a22, metalness: 0.8, roughness: 0.35 });
  const hull = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.8, 6), dark); hull.rotation.z = -Math.PI / 2; g.add(hull);
  for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.03, 0.4), dark); w.position.set(-0.15, 0, s * 0.25); w.rotation.y = s * 0.4; g.add(w); const l = glowSprite(0xff3b3b, 0.3, 1); l.position.set(-0.2, 0.03, s * 0.42); g.add(l); }
  const eng = glowSprite(0xff5a3b, 0.7, 0.9); eng.position.x = -0.45; g.add(eng);
  return g;
}

function buildSpace() {
  // Starfield on a big sphere + colourful nebula clouds.
  const N = 1800, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { const v = new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize().multiplyScalar(60 + Math.random() * 20); pos.set([v.x, v.y, v.z], i * 3); const c = new THREE.Color().setHSL(0.55 + Math.random() * 0.15, 0.4, 0.75 + Math.random() * 0.25); col.set([c.r, c.g, c.b], i * 3); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(pos, 3)); sg.setAttribute("color", new THREE.BufferAttribute(col, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.25, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false })));
  [[0xe8612c, -18, -30, 26], [0x7b5cff, 20, -34, 30], [0x2a9d8f, 0, -40, 34], [0xf2b134, -26, -20, 18]].forEach(([c, x, z, s]) => { const n = glowSprite(c, s, 0.16); n.position.set(x, -10, z); scene.add(n); nebula.push(n); });
  // Home star with corona, and the trading station orbiting it.
  star = new THREE.Group();
  star.add(new THREE.Mesh(new THREE.SphereGeometry(0.42, 48, 32), new THREE.MeshBasicMaterial({ color: 0xfff1c8 })));
  star.add(glowSprite(0xffc46b, 3.4, 0.9)); star.add(glowSprite(0xe8612c, 6, 0.35));
  star.position.y = 0.3; scene.add(star);
  const sun = new THREE.PointLight(0xfff0d8, 60, 30, 1.4); sun.position.y = 0.3; scene.add(sun);
  station = new THREE.Group();
  const ringS = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 12, 40), mats.steel()); station.add(ringS);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.25, 12), mats.steel()); hub.rotation.x = Math.PI / 2; station.add(hub);
  for (let i = 0; i < 4; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.005, 0.08), new THREE.MeshStandardMaterial({ color: 0x1a3a7a, metalness: 0.8, roughness: 0.2, emissive: 0x0a1a44 })); p.position.set(Math.cos(i * Math.PI / 2) * 0.33, 0, Math.sin(i * Math.PI / 2) * 0.33); p.rotation.y = -i * Math.PI / 2; station.add(p); }
  scene.add(station);
  // Faint orbit guides.
  [1.5, 2.75, 4].forEach(r => { const o = new THREE.Mesh(new THREE.RingGeometry(r - 0.005, r + 0.005, 128), new THREE.MeshBasicMaterial({ color: 0xf4e9d8, transparent: true, opacity: 0.08, side: THREE.DoubleSide })); o.rotation.x = -Math.PI / 2; scene.add(o); });
  mystery = new THREE.Group(); const mr = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.015, 8, 48), mats.emissive(0xe8612c, 2)); mr.rotation.x = Math.PI / 2; mystery.add(mr); mystery.add(glowSprite(0xe8612c, 1.2, 0.35)); scene.add(mystery);
  pirate = makePirate(); pirate.visible = false; scene.add(pirate);
}


// ---------- asteroid belt, moons, traffic, wormhole, comets and salvage ----------
let belt, moons = [], traffic = [], wormhole, comet = null, crates = [], streaks = [];
const MOONS = { "Old Earth": [0.12, 0.8, 0xd8d8d0], "Titan's Ring": [0.14, 1.4, 0xc8b89a], Nexus: [0.1, 0.8, 0xb8a8e8], "Eden-9": [0.09, 0.75, 0xe8e0d0] };
function buildExtras() {
  // Asteroid belt: instanced rocks on a ring between the inner and outer worlds.
  const rockGeo = new THREE.DodecahedronGeometry(0.06, 0); const rp = rockGeo.attributes.position;
  for (let i = 0; i < rp.count; i++) rp.setXYZ(i, rp.getX(i) * (0.8 + Math.random() * 0.5), rp.getY(i) * (0.6 + Math.random() * 0.5), rp.getZ(i));
  rockGeo.computeVertexNormals();
  belt = new THREE.InstancedMesh(rockGeo, new THREE.MeshStandardMaterial({ color: 0x8a7a6a, roughness: 0.9, flatShading: true }), 420);
  const d = new THREE.Object3D();
  for (let i = 0; i < 420; i++) { const a = Math.random() * Math.PI * 2, r = 3.3 + (Math.random() - .5) * 0.7; d.position.set(Math.cos(a) * r, 0.3 + (Math.random() - .5) * 0.15, Math.sin(a) * r); d.rotation.set(Math.random() * 6, Math.random() * 6, 0); d.scale.setScalar(0.3 + Math.random() * 0.9); d.updateMatrix(); belt.setMatrixAt(i, d.matrix); }
  scene.add(belt);
  // Moons around the bigger worlds.
  PLANETS.forEach((p, i) => { const m = MOONS[p.n]; if (!m) return; const moon = new THREE.Mesh(new THREE.SphereGeometry(m[0], 24, 16), new THREE.MeshStandardMaterial({ color: m[2], roughness: 0.9 })); moon.userData = { planet: i, r: m[1], ph: i * 1.7 }; scene.add(moon); moons.push(moon); });
  // NPC traffic: small ships crossing the map.
  for (let i = 0; i < 4; i++) { const t = makeShip(); t.scale.setScalar(0.7); t.children.forEach(c => { if (c.material && c.material.color && !c.isSprite) c.material = c.material.clone(); }); t.children[0].material.color.set([0x9fd0ff, 0x7aff9a, 0xff9a7a, 0xd8c8ff][i]); t.userData = { from: new THREE.Vector3(), to: new THREE.Vector3(), k: Math.random() }; retarget(t); scene.add(t); traffic.push(t); }
  // Wormhole near the galaxy's edge.
  wormhole = new THREE.Group(); wormhole.position.set(4.6, 0.3, 3.6);
  for (let i = 0; i < 4; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.35 + i * 0.12, 0.02, 8, 48), mats.emissive([0x7b5cff, 0x3ef2ff, 0xff4fd8, 0x7b5cff][i], 2.5)); r.rotation.x = -Math.PI / 2 + 0.3; wormhole.add(r); }
  wormhole.add(glowSprite(0x7b5cff, 2.2, 0.6)); scene.add(wormhole);
  for (let i = 0; i < 3; i++) { const st = glowSprite(0xffffff, 0.15, 0); scene.add(st); streaks.push({ m: st, v: new THREE.Vector3(), life: 0 }); }
}
function retarget(t) { const edge = () => { const a = Math.random() * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * 7, 0.6 + Math.random() * 0.6, Math.sin(a) * 5.5); }; t.userData.from.copy(edge()); t.userData.to.copy(edge()); t.userData.k = 0; }
function spawnComet() {
  const g = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshStandardMaterial({ color: 0xe8fbff, emissive: 0x9fe8ff, emissiveIntensity: 2 })); g.add(head);
  g.add(glowSprite(0x9fe8ff, 0.9, 0.9));
  const tail = []; for (let i = 0; i < 14; i++) { const t = glowSprite(0x7fd0ff, 0.5 - i * 0.025, 0.6 - i * 0.04); g.add(t); tail.push(t); }
  const a = Math.random() * Math.PI * 2; const from = new THREE.Vector3(Math.cos(a) * 8, 1.2, Math.sin(a) * 6), to = from.clone().multiplyScalar(-1).add(new THREE.Vector3((Math.random() - .5) * 4, 0, (Math.random() - .5) * 3));
  g.userData = { from, to, k: 0, tail, hit: head }; scene.add(g); comet = g;
}
function spawnCrate() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), mats.steel({ color: 0x9aa3b0 })));
  for (const ax of ["x", "y", "z"]) { const band = new THREE.Mesh(new THREE.BoxGeometry(ax === "x" ? 0.24 : 0.05, ax === "y" ? 0.24 : 0.05, ax === "z" ? 0.24 : 0.05), mats.plastic(0xe8612c)); g.add(band); }
  g.add(glowSprite(0xf2b134, 0.9, 0.7));
  const a = Math.random() * Math.PI * 2, r = 1.8 + Math.random() * 2.5; g.position.set(Math.cos(a) * r, 0.9, Math.sin(a) * r * 0.8);
  g.userData = { until: performance.now() + 20000, ph: Math.random() * 6 }; scene.add(g); crates.push(g);
}
let cometT = 25, crateT = 15;
function tickExtras(t, dt) {
  belt.rotation.y += dt * 0.02;
  moons.forEach(m => { const p = planets[m.userData.planet]; m.visible = p.visible; const a = t / 2500 + m.userData.ph; m.position.set(p.position.x + Math.cos(a) * m.userData.r, 0.3 + Math.sin(a) * 0.15, p.position.z + Math.sin(a) * m.userData.r); });
  traffic.forEach(tr => { const u = tr.userData; u.k += dt * 0.05; if (u.k >= 1) retarget(tr); const p = u.from.clone().lerp(u.to, u.k); tr.position.copy(p); const dir = u.to.clone().sub(u.from); tr.rotation.set(0, -Math.atan2(dir.z, dir.x), 0); });
  wormhole.children.forEach((r, i) => { if (r.isMesh) r.rotation.z += dt * (0.6 + i * 0.3) * (i % 2 ? -1 : 1); });
  cometT -= dt; if (!comet && cometT <= 0) { spawnComet(); cometT = 35 + Math.random() * 40; }
  if (comet) { const u = comet.userData; u.k += dt * 0.07; const p = u.from.clone().lerp(u.to, u.k); comet.position.copy(p); const back = u.from.clone().sub(u.to).normalize(); u.tail.forEach((s, i) => s.position.copy(back).multiplyScalar(0.08 * (i + 1))); if (u.k >= 1) { scene.remove(comet); comet = null; } }
  crateT -= dt; if (crateT <= 0) { if (crates.length < 2) spawnCrate(); crateT = 25 + Math.random() * 30; }
  crates = crates.filter(c => { if (c.userData.until < performance.now()) { scene.remove(c); return false; } c.rotation.set(t / 900, t / 700, 0); c.position.y = 0.9 + Math.sin(t / 500 + c.userData.ph) * 0.1; return true; });
  streaks.forEach(s => { if (s.life <= 0) { if (Math.random() < dt * 0.15) { s.life = 0.7; s.m.position.set((Math.random() - .5) * 12, 2.5, (Math.random() - .5) * 8); s.v.set((Math.random() - .5) * 8, -2, (Math.random() - .5) * 6); } return; } s.life -= dt; s.m.position.addScaledVector(s.v, dt); s.m.material.opacity = s.life; });
}

const Star3D = {
  init(cv, labels, home, planetList) {
    canvas = cv; labelsEl = labels; HOME = home; PLANETS = planetList;
    stage = createStage(canvas, { bloom: 0.9, bloomThreshold: 0.7, bloomRadius: 0.55, exposure: 1.0, env: 0.25, shadows: false, fov: 40 });
    ({ scene, camera } = stage);
    scene.background = new THREE.Color(0x05070f);
    scene.add(new THREE.AmbientLight(0x6070a0, 0.35));
    buildSpace();
    PLANETS.forEach((p, i) => { const m = makePlanet(p, i); scene.add(m); planets.push(m); });
    buildExtras();
    canvas.addEventListener("click", (e) => {
      const r = canvas.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      // Comets and salvage crates take priority over planets.
      if (comet && ray.intersectObject(comet.userData.hit, false).length) { scene.remove(comet); comet = null; if (Star3D.onBonus) Star3D.onBonus("comet", e.clientX, e.clientY); return; }
      const ch = crates.find(c => ray.intersectObject(c, true).length); if (ch) { scene.remove(ch); crates = crates.filter(c => c !== ch); if (Star3D.onBonus) Star3D.onBonus("crate", e.clientX, e.clientY); return; }
      const hit = ray.intersectObjects(planets.filter((_, i) => i < found).map(p => p.userData.body), false)[0];
      if (hit && Star3D.onPick) Star3D.onPick(hit.object.userData.index);
    });
    labelsEl.innerHTML = PLANETS.map((p, i) => `<span data-l="${i}"></span>`).join("");
  },
  sync(foundCount, routes, gate) {
    if (!stage) return; found = foundCount; gateAt = gate ? gate.at : -1;
    planets.forEach((m, i) => { m.visible = i < found; });
    routeLines.forEach(l => scene.remove(l)); routeLines = [];
    Object.keys(routes).forEach(i => { if (+i >= found) return; const a = new THREE.Vector3(0, 0.3, 0), b = toW(PLANETS[i]).setY(0.3);
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineDashedMaterial({ color: 0xf2b134, dashSize: 0.12, gapSize: 0.1, transparent: true, opacity: 0.55 })); line.computeLineDistances(); scene.add(line); routeLines.push(line); });
    const next = PLANETS[found]; mystery.visible = !!next; if (next) mystery.position.copy(toW(next)).setY(0.3);
    pirate.visible = gateAt >= 0; if (gateAt >= 0) pirate.position.copy(toW(PLANETS[gateAt])).add(new THREE.Vector3(0, 0.9, 0));
    labelsEl.querySelectorAll("[data-l]").forEach(el => { const i = +el.dataset.l; el.hidden = i >= found; el.textContent = PLANETS[i].n + (routes[i] ? ` · ${routes[i]}🚀` : ""); });
  },
  project(p) { tmp.copy(toW(p)).setY(0.3).project(camera); const r = canvas.getBoundingClientRect(); return [r.left + (tmp.x + 1) / 2 * r.width, r.top + (1 - tmp.y) / 2 * r.height]; },
  draw(ships, t, dt) {
    if (!stage) return;
    // Camera: tilted view that frames the whole map, with a slow drift.
    const fitW = 11 / (2 * Math.tan(camera.fov * Math.PI / 360) * camera.aspect), dist = Math.max(10, fitW);
    camera.position.set(Math.sin(t / 9000) * 0.6, dist * 0.78, dist * 0.62 + 0.9); camera.lookAt(0, 0, 1.1); // aimed a little south so the bottom world clears the scout bar
    tickExtras(t, dt);
    star.rotation.y += dt * 0.2; star.children[1].material.opacity = 0.85 + Math.sin(t / 400) * 0.08;
    station.position.set(Math.cos(t / 3000) * 0.75, 0.3, Math.sin(t / 3000) * 0.75); station.rotation.set(Math.PI / 2.4, t / 2000, 0);
    planets.forEach(m => { m.userData.body.rotation.y += dt * 0.15; if (m.userData.clouds) m.userData.clouds.rotation.y += dt * 0.2; });
    mystery.rotation.y += dt; mystery.scale.setScalar(1 + Math.sin(t / 300) * 0.1);
    if (pirate.visible) { pirate.rotation.y = t / 1500; pirate.position.y = 0.9 + Math.sin(t / 500) * 0.1; }
    // Ships fly from the station out to their planet and back, facing their heading.
    while (shipMeshes.length < ships.length) { const s = makeShip(); scene.add(s); shipMeshes.push(s); }
    shipMeshes.forEach((m, k) => {
      const s = ships[k]; m.visible = !!s; if (!s) return;
      const a = new THREE.Vector3(0, 0.3, 0), b = toW(PLANETS[s.route]).setY(0.3), p = a.clone().lerp(b, s.t);
      p.y += Math.sin(s.t * Math.PI) * 0.35; m.position.copy(p);
      const dir = b.clone().sub(a).multiplyScalar(s.dir); m.rotation.set(0, -Math.atan2(dir.z, dir.x), 0);
      m.userData.flame.material.opacity = s.paused > 0 ? 0.1 : 0.8 + Math.random() * 0.2;
    });
    // Planet name labels follow their planets.
    labelsEl.querySelectorAll("[data-l]").forEach(el => { const i = +el.dataset.l; if (i >= found) return; const [x, y] = this.project({ x: PLANETS[i].x, y: PLANETS[i].y + 16 }); const r = canvas.getBoundingClientRect(); el.style.transform = `translate(${x - r.left}px, ${y - r.top + 14}px) translate(-50%, 0)`; });
    stage.render(t);
  },
};
window.Star3D = Star3D;
window.dispatchEvent(new Event("star3d-ready"));
