// Slime Slayer — realistic 3D battle view. Game logic stays in index.html; this draws it.
// Exposes window.Slime3D and fires "slime3d-ready".
import { THREE, createStage, keyLight, pbrMaterial, makePBR, mats, glowSprite, driftParticles } from "../shared/realism.js";

let stage, scene, camera, key, hemi, sky, ground, props = new THREE.Group(), slime = null, hero, heroParts = {}, party = new THREE.Group(), dust, crownGeo;
let biomeIdx = -1, heroPath = null, partyKey = "";
const drops = [], coins = [], sparks = [];
let lunge = 0, squash = 0, flash = 0, shake = 0, entering = 0, dying = 0, bob = 0;
const tmp = new THREE.Vector3();

// ---------- arenas ----------
const ARENAS = [
  { sky: [0x7cc6ff, 0xd8f2ff], fog: 0xcfeeff, ground: { type: "dirt", color: "#7fc35e", color2: "#3f7a2c", seed: 1 }, sun: 0xfff1d6, sunI: 2.6, hemiI: 1.1, env: 0.9, props: "meadow" },
  { sky: [0x2c4a33, 0x6d9b5a], fog: 0x3b5e3f, ground: { type: "dirt", color: "#5a4a2a", color2: "#2a1f10", seed: 2 }, sun: 0xd8f0b0, sunI: 1.6, hemiI: 0.7, env: 0.6, props: "forest" },
  { sky: [0x0e0e1c, 0x2a2a44], fog: 0x1c1c30, ground: { type: "stone", color: "#6a6a78", color2: "#2e2e3a", seed: 3 }, sun: 0x9fb0ff, sunI: 0.9, hemiI: 0.45, env: 0.35, props: "crypt" },
  { sky: [0x3a0c05, 0xc2410c], fog: 0x4a140a, ground: { type: "rock", color: "#3a2a24", color2: "#120806", seed: 4 }, sun: 0xffa060, sunI: 1.4, hemiI: 0.5, env: 0.4, props: "ember" },
  { sky: [0x9fd4f2, 0xeaf7ff], fog: 0xdcefff, ground: { type: "ice", color: "#ffffff", color2: "#b8d8ef", seed: 5 }, sun: 0xffffff, sunI: 2.4, hemiI: 1.1, env: 1, props: "frost" },
  { sky: [0xff9a55, 0xffe4b8], fog: 0xffd6a8, ground: { type: "plaster", color: "#ffffff", color2: "#e8dcff", seed: 6 }, sun: 0xffe0b0, sunI: 2.4, hemiI: 1.0, env: 0.9, props: "sky" },
  { sky: [0x030008, 0x240046], fog: 0x12002a, ground: { type: "rock", color: "#2a1a44", color2: "#07020f", seed: 7 }, sun: 0xb68cff, sunI: 0.8, hemiI: 0.4, env: 0.4, props: "void" },
];

function gradientSky(top, bottom) {
  const c = document.createElement("canvas"); c.width = 4; c.height = 256; const g = c.getContext("2d");
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "#" + new THREE.Color(top).getHexString()); gr.addColorStop(1, "#" + new THREE.Color(bottom).getHexString());
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function tree(h = 2) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, h, 10), pbrMaterial({ type: "bark", color: "#6a4a2a", color2: "#2e1e10", scale: 2, seed: 9 }));
  trunk.position.y = h / 2; g.add(trunk);
  const leaf = pbrMaterial({ type: "dirt", color: "#5fa84a", color2: "#1f4a1a", scale: 3, seed: 10 });
  for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7 - i * 0.08, 1), leaf); f.position.set((Math.random() - .5) * 0.5, h + i * 0.25, (Math.random() - .5) * 0.5); g.add(f); }
  return g;
}
function rock(s, tex) {
  const geo = new THREE.DodecahedronGeometry(s, 1); const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { tmp.fromBufferAttribute(p, i); const n = 1 + Math.sin(tmp.x * 7) * 0.1 + Math.cos(tmp.z * 6 + tmp.y) * 0.1; p.setXYZ(i, tmp.x * n, tmp.y * n * 0.7, tmp.z * n); }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, pbrMaterial(tex || { type: "rock", color: "#9a948a", color2: "#4a453e", scale: 2, seed: 12 }));
}
function buildProps(kind) {
  props.clear();
  const place = (m, x, z, s = 1) => { m.position.set(x, 0, z); m.scale.multiplyScalar(s); m.rotation.y = Math.random() * 6; m.traverse(c => { if (c.isMesh) { c.castShadow = c.receiveShadow = true; } }); props.add(m); };
  const spots = [[-5, -5], [5.5, -6], [-7, -2], [7.5, -3], [-3, -8], [3, -9], [0, -11], [-9, -7], [9, -8]];
  if (kind === "meadow") { spots.forEach(([x, z], i) => place(i % 3 ? rock(0.5 + Math.random() * 0.4) : tree(1.6), x, z));
    for (let i = 0; i < 30; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), mats.plastic([0xff6fa8, 0xffe14a, 0xffffff][i % 3])); f.position.set((Math.random() - .5) * 16, 0.08, -2 - Math.random() * 8); props.add(f); } }
  if (kind === "forest") spots.forEach(([x, z]) => place(tree(2.6 + Math.random()), x, z, 1.1));
  if (kind === "crypt") spots.forEach(([x, z], i) => { const st = new THREE.Mesh(new THREE.RoundedBoxGeometry(0.7, 1.1, 0.2, 3, 0.1), pbrMaterial({ type: "stone", color: "#8a8a94", color2: "#3a3a44", scale: 3, seed: 14 })); st.position.y = 0.5; const g = new THREE.Group(); g.add(st); g.rotation.z = (Math.random() - .5) * 0.2; place(g, x, z); if (i % 3 === 0) { const c = glowSprite(0x7affc8, 1.6, 0.5); c.position.set(x, 1.2, z); props.add(c); } });
  if (kind === "ember") spots.forEach(([x, z], i) => { const r = rock(0.7, { type: "rock", color: "#3a2a24", color2: "#0a0402", scale: 2, seed: 15 }); place(r, x, z); if (i % 2) { const l = glowSprite(0xff6a1a, 2.4, 0.6); l.position.set(x, 0.4, z); props.add(l); } });
  if (kind === "frost") spots.forEach(([x, z]) => { const g = new THREE.Group(); for (let k = 0; k < 4; k++) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.3 + Math.random() * 0.4, 0), mats.glass({ color: 0xcdefff, roughness: 0.05, thickness: 0.6 })); c.scale.y = 2; c.position.set((Math.random() - .5) * 0.6, 0.4, (Math.random() - .5) * 0.6); c.rotation.z = (Math.random() - .5) * 0.5; g.add(c); } place(g, x, z); });
  if (kind === "sky") spots.forEach(([x, z]) => { const g = new THREE.Group(); for (let k = 0; k < 5; k++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.5 + Math.random() * 0.4, 20, 14), mats.fabric(0xffffff, { sheenColor: new THREE.Color(0xffe0f0) })); p.position.set(k * 0.5 - 1, Math.random() * 0.3, (Math.random() - .5) * 0.4); g.add(p); } g.position.y = 0.5; place(g, x, z, 0.9); });
  if (kind === "void") { spots.forEach(([x, z]) => { const r = rock(0.6, { type: "rock", color: "#3a2a5a", color2: "#05020a", scale: 2, seed: 16 }); r.position.set(x, 1.5 + Math.random() * 2, z); r.userData.float = Math.random() * 6; props.add(r); });
    for (let i = 0; i < 60; i++) { const s = glowSprite(0xd8c8ff, 0.2 + Math.random() * 0.3, 0.8); s.position.set((Math.random() - .5) * 30, 2 + Math.random() * 10, -8 - Math.random() * 10); props.add(s); } }
}
function setBiome(i) {
  if (i === biomeIdx) return; biomeIdx = i; const a = ARENAS[i];
  scene.background = gradientSky(a.sky[0], a.sky[1]);
  scene.fog = new THREE.Fog(a.fog, 12, 30);
  const m = pbrMaterial({ ...a.ground, scale: 6, repeat: 5, normal: 3 }); ground.material = m;
  key.color.set(a.sun); key.intensity = a.sunI; hemi.intensity = a.hemiI; scene.environmentIntensity = a.env;
  buildProps(a.props);
  makeWeather({ meadow: "pollen", forest: "leaves", crypt: "wisps", ember: "embers", frost: "snow", sky: "clouds", void: "motes" }[a.props]); makeLandmark(a.props);
  dust.material.color.set(i === 3 ? 0xff8a3a : i === 6 ? 0xc8a8ff : i === 4 ? 0xffffff : 0xfff2c8); // embers / void motes / snow / pollen
}

// ---------- slimes ----------
// Each kind is a material recipe plus optional accessories; color comes from game data.
function slimeMaterial(kind, color) {
  const c = new THREE.Color(color);
  switch (kind) {
    case "ghost": return new THREE.MeshPhysicalMaterial({ color: 0xeef4ff, emissive: 0x9fd8ff, emissiveIntensity: 0.5, transparent: true, opacity: 0.55, roughness: 0.2, transmission: 0.4, thickness: 1 });
    case "lava": { const t = makePBR({ type: "rock", color: "#3a1a10", color2: "#ffffff", scale: 3, seed: 21 }); return new THREE.MeshStandardMaterial({ color: 0x2a0d06, emissive: 0xff5a10, emissiveMap: t.map, emissiveIntensity: 2.2, normalMap: t.normalMap, roughness: 0.6 }); }
    case "obsidian": return new THREE.MeshPhysicalMaterial({ color: 0x0c0a12, roughness: 0.05, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.6, metalness: 0.2 });
    case "ice": return mats.glass({ color: c, roughness: 0.04, thickness: 1.5, ior: 1.31, attenuationColor: c, attenuationDistance: 1.2 });
    case "snow": return mats.fabric(0xffffff, { roughness: 0.95, sheenColor: new THREE.Color(0xcfe8ff) });
    case "cloud": return new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.8, sheen: 1, sheenColor: new THREE.Color(0xffffff), transmission: 0.2, thickness: 1 });
    case "storm": return mats.jelly(c, { emissive: c, emissiveIntensity: 0.6 });
    case "void": return new THREE.MeshPhysicalMaterial({ color: 0x1a0830, emissive: c, emissiveIntensity: 0.35, roughness: 0.1, clearcoat: 1, iridescence: 1, transmission: 0.3, thickness: 1 });
    case "moss": { const t = makePBR({ type: "dirt", color: "#ffffff", color2: "#8a8a8a", scale: 4, seed: 22 }); return new THREE.MeshPhysicalMaterial({ color: c, map: t.map, normalMap: t.normalMap, roughness: 0.7, clearcoat: 0.3 }); }
    default: return mats.jelly(c);
  }
}
function makeSlime(def) {
  const g = new THREE.Group(), R = def.boss ? 1.25 : 0.8;
  const body = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 48), slimeMaterial(def.kind, def.color));
  // Flatten the underside so it sits like a blob of jelly.
  const p = body.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y < -R * 0.35) p.setY(i, -R * 0.35 + (y + R * 0.35) * 0.25); }
  body.geometry.computeVertexNormals(); body.position.y = R * 0.35; body.castShadow = true; g.add(body);
  const face = new THREE.Group(); face.position.set(0, R * 0.55, R * 0.82); g.add(face);
  const eyeMat = new THREE.MeshPhysicalMaterial({ color: 0x120a1a, roughness: 0.05, clearcoat: 1 });
  const shine = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const eyes = def.acc === "eye" ? [0] : [-1, 1];
  for (const s of eyes) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(R * (def.acc === "eye" ? 0.3 : 0.13), 24, 16), def.acc === "eye" ? new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.1, clearcoat: 1 }) : eyeMat);
    e.scale.set(1, 1.25, 0.6); e.position.set(s * R * 0.3, 0, 0); face.add(e);
    if (def.acc === "eye") { const iris = new THREE.Mesh(new THREE.SphereGeometry(R * 0.14, 20, 12), mats.emissive(0xff3b6b, 1.5)); iris.position.set(0, 0, R * 0.14); iris.scale.z = 0.4; face.add(iris); }
    const hl = new THREE.Mesh(new THREE.SphereGeometry(R * 0.035, 8, 6), shine); hl.position.set(s * R * 0.3 + R * 0.04, R * 0.06, R * 0.07); face.add(hl);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(R * 0.09, R * 0.02, 8, 16, Math.PI), eyeMat); mouth.rotation.z = Math.PI; mouth.position.set(0, -R * 0.2, 0); face.add(mouth);
  // Accessories.
  const acc = def.acc;
  if (def.boss || acc === "crown") { const cr = new THREE.Mesh(crownGeo, mats.gold()); cr.scale.setScalar(R * 0.9); cr.position.y = R * 1.28; g.add(cr);
    for (let i = 0; i < 5; i++) { const gem = new THREE.Mesh(new THREE.OctahedronGeometry(R * 0.05), mats.emissive([0xff3b6b, 0x4fd1ff, 0x7aff7a][i % 3], 1.5)); gem.position.set(Math.cos(i / 5 * Math.PI * 2) * R * 0.42, R * 1.36, Math.sin(i / 5 * Math.PI * 2) * R * 0.42); g.add(gem); } }
  if (acc === "mushroom") { const cap = new THREE.Mesh(new THREE.SphereGeometry(R * 0.55, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), mats.plastic(0xd9342b)); cap.scale.y = 0.6; cap.position.y = R * 1.2; g.add(cap); for (let i = 0; i < 6; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(R * 0.07, 8, 6), mats.plastic(0xffffff)); const a = i; d.position.set(Math.cos(a) * R * 0.35, R * 1.38, Math.sin(a) * R * 0.35); g.add(d); } }
  if (acc === "acorn") { const cap = new THREE.Mesh(new THREE.SphereGeometry(R * 0.5, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), pbrMaterial({ type: "bark", color: "#8a5a2a", color2: "#3a2210", scale: 4, seed: 30 })); cap.position.y = R * 1.1; g.add(cap); }
  if (acc === "skull") { const sk = new THREE.Mesh(new THREE.SphereGeometry(R * 0.35, 20, 16), new THREE.MeshStandardMaterial({ color: 0xf0ead8, roughness: 0.6 })); sk.position.y = R * 0.45; g.add(sk); }
  if (acc === "wings") for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.CircleGeometry(R * 0.6, 3), new THREE.MeshStandardMaterial({ color: 0x2a1a33, side: THREE.DoubleSide, roughness: 0.6 })); w.position.set(s * R * 1.05, R * 0.8, -R * 0.1); w.rotation.set(0, s * 0.5, s * 0.6); g.add(w); g.userData.wings = (g.userData.wings || []).concat(w); }
  if (acc === "horns") for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.ConeGeometry(R * 0.12, R * 0.5, 12), new THREE.MeshPhysicalMaterial({ color: 0x1a0d08, clearcoat: 1, roughness: 0.2 })); h.position.set(s * R * 0.45, R * 1.15, 0); h.rotation.z = -s * 0.4; g.add(h); }
  if (acc === "stars") for (let i = 0; i < 8; i++) { const st = glowSprite(0xfff4c8, R * 0.25, 1); st.position.set((Math.random() - .5) * R, R * (0.2 + Math.random() * 0.6), (Math.random() - .5) * R); g.add(st); }
  if (acc === "bolt") { const b = new THREE.Mesh(new THREE.ConeGeometry(R * 0.12, R * 0.6, 4), mats.emissive(0xffe14a, 3)); b.position.y = R * 1.3; g.add(b); }
  if (acc === "cape") { const c = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.9, R * 1.05, R * 0.9, 32, 1, true, Math.PI * 0.6, Math.PI * 0.8), mats.fabric(0x5a0a1a, { side: THREE.DoubleSide })); c.position.y = R * 0.5; c.rotation.y = Math.PI; g.add(c); }
  if (["lava", "storm", "void", "ghost"].includes(def.kind)) { const gl = glowSprite(def.kind === "lava" ? 0xff5a10 : def.kind === "ghost" ? 0x9fd8ff : new THREE.Color(def.color), R * 4, 0.35); gl.position.y = R * 0.5; g.add(gl); }
  const light = new THREE.PointLight(def.kind === "lava" ? 0xff6a1a : 0xffffff, def.kind === "lava" ? 6 : 0, 4); light.position.y = R; g.add(light);
  g.userData = { ...g.userData, body, R, def };
  return g;
}
// An open cylinder whose top edge rises into five points.
function makeCrown() {
  const geo = new THREE.CylinderGeometry(0.5, 0.45, 0.35, 40, 1, true); const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) { const a = Math.atan2(p.getZ(i), p.getX(i)); p.setY(i, 0.175 + Math.max(0, Math.cos(a * 5)) * 0.22); }
  geo.computeVertexNormals(); return geo;
}

// ---------- hero & party ----------
function figure({ body, head = mats.skin(), hat, prop, scale = 1 }) {
  const g = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.4, 8, 16), body); torso.position.y = 0.55; g.add(torso);
  const h = new THREE.Mesh(new THREE.SphereGeometry(0.19, 24, 16), head); h.position.y = 1.08; g.add(h);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshPhysicalMaterial({ color: 0x111111, clearcoat: 1 })); e.position.set(s * 0.07, 1.1, 0.17); g.add(e); }
  if (hat) g.add(hat);
  if (prop) g.add(prop);
  g.scale.setScalar(scale); g.traverse(c => { if (c.isMesh) c.castShadow = true; });
  return g;
}
function makeHero(path) {
  const steel = pbrMaterial({ type: "metal", color: "#e4e8ee", color2: "#8d949e", scale: 2, rough: [0.2, 0.45], seed: 40 }, { metalness: 1 });
  const goldArm = mats.gold({ roughness: 0.3 });
  const look = {
    paladin: { body: goldArm, hat: "helm", weapon: "sword", cape: 0xf2f2f2 },
    ranger: { body: mats.fabric(0x3f6b3a), hat: "hood", weapon: "bow", cape: 0x2d4a2a },
    sorcerer: { body: mats.fabric(0x4b2a7a), hat: "wizard", weapon: "staff", cape: 0x2a1450 },
  }[path] || { body: steel, hat: "helm", weapon: "sword", cape: 0xb2263a };
  const g = new THREE.Group();
  const f = figure({ body: look.body }); g.add(f);
  const cape = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.34, 0.75, 20, 1, true, Math.PI * 0.55, Math.PI * 0.9), mats.fabric(look.cape, { side: THREE.DoubleSide })); cape.position.set(0, 0.55, -0.02); cape.rotation.y = Math.PI; f.add(cape);
  if (look.hat === "helm") { const helm = new THREE.Mesh(new THREE.SphereGeometry(0.205, 24, 16, 0, Math.PI * 2, 0, Math.PI / 1.7), path === "paladin" ? goldArm : steel); helm.position.y = 1.1; f.add(helm); const plume = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 10), mats.fabric(0xb2263a)); plume.position.set(0, 1.35, -0.05); plume.rotation.x = -0.4; f.add(plume); }
  if (look.hat === "hood") { const hood = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.45, 20, 1, true), mats.fabric(0x2d4a2a, { side: THREE.DoubleSide })); hood.position.y = 1.2; f.add(hood); }
  if (look.hat === "wizard") { const hat = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.55, 20), mats.fabric(0x4b2a7a)); hat.position.y = 1.42; hat.rotation.z = 0.15; f.add(hat); const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.02, 24), mats.fabric(0x4b2a7a)); brim.position.y = 1.2; f.add(brim); }
  const arm = new THREE.Group(); arm.position.set(0.25, 0.75, 0.05); f.add(arm); heroParts.arm = arm;
  if (look.weapon === "sword") { const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.8, 0.015), mats.steel({ roughness: 0.15 })); blade.position.y = 0.5; arm.add(blade); const guard = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.05), goldArm); guard.position.y = 0.1; arm.add(guard); const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.16, 8), mats.fabric(0x3a2210)); arm.add(grip); }
  if (look.weapon === "bow") { const bow = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.02, 8, 24, Math.PI), pbrMaterial({ type: "wood", color: "#a0703e", color2: "#5a3818", scale: 2, seed: 41 })); bow.rotation.z = -Math.PI / 2; bow.position.y = 0.3; arm.add(bow); }
  if (look.weapon === "staff") { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.1, 8), pbrMaterial({ type: "wood", color: "#6a4a2a", color2: "#2e1e10", scale: 2, seed: 42 })); st.position.y = 0.35; arm.add(st); const orb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 14), mats.emissive(0x9b5cff, 3)); orb.position.y = 0.95; arm.add(orb); const gl = glowSprite(0x9b5cff, 0.8, 0.7); gl.position.y = 0.95; arm.add(gl); }
  if (path === "paladin") { const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.05, 32), goldArm); sh.rotation.x = Math.PI / 2; sh.rotation.z = Math.PI / 2; sh.position.set(-0.28, 0.6, 0.12); sh.rotation.y = 0.3; f.add(sh); }
  g.traverse(c => { if (c.isMesh) c.castShadow = true; });
  return g;
}
const PARTY_LOOK = {
  tom: [0x8a6a3a, "pitchfork"], lyra: [0x3f7a3a, "bow"], pim: [0x3a4a9a, "staff"], bo: [0xf2f2f2, "halo"], rhea: [0xb8bec8, "shield"],
  kai: [0x1a1a24, "mask"], ember: [0xd9453b, "dragon"], azra: [0x2aa0a0, "lamp"], nova: [0xfff2c8, "wings"], eon: [0x3a1a6a, "stars"],
};
function makeMember(id) {
  const [col, prop] = PARTY_LOOK[id] || [0x888888];
  if (prop === "dragon") { const d = new THREE.Group(); const b = new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 16), mats.plastic(col)); b.scale.set(1.2, 0.9, 1); b.position.y = 0.35; d.add(b); const h = new THREE.Mesh(new THREE.SphereGeometry(0.18, 20, 14), mats.plastic(col)); h.position.set(0.25, 0.6, 0); d.add(h); for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.CircleGeometry(0.28, 3), mats.plastic(0xff8a5a, { side: THREE.DoubleSide })); w.position.set(-0.05, 0.6, s * 0.2); w.rotation.set(s * 0.8, 0, 0.3); d.add(w); } d.traverse(c => c.isMesh && (c.castShadow = true)); return d; }
  const extra = new THREE.Group();
  if (prop === "halo") { const h = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.02, 8, 24), mats.emissive(0xffe08a, 3)); h.rotation.x = Math.PI / 2; h.position.y = 1.38; extra.add(h); }
  if (prop === "wings") for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 10), mats.fabric(0xffffff)); w.scale.set(0.3, 1, 0.8); w.position.set(s * 0.28, 0.75, -0.15); w.rotation.z = s * 0.4; extra.add(w); }
  if (prop === "shield") { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 24), mats.steel()); s.rotation.x = Math.PI / 2; s.position.set(0.25, 0.6, 0.15); extra.add(s); }
  if (prop === "staff" || prop === "pitchfork") { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 8), pbrMaterial({ type: "wood", color: "#8a5a2a", color2: "#3a2210", scale: 2, seed: 43 })); s.position.set(0.28, 0.6, 0); extra.add(s); if (prop === "staff") { const o = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), mats.emissive(0x5cc8ff, 3)); o.position.set(0.28, 1.12, 0); extra.add(o); } }
  if (prop === "lamp") { const l = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 10), mats.gold()); l.scale.set(1.5, 0.7, 1); l.position.set(0.3, 0.5, 0.1); extra.add(l); }
  if (prop === "stars") for (let i = 0; i < 5; i++) { const st = glowSprite(0xfff4c8, 0.15, 1); st.position.set(Math.cos(i) * 0.35, 0.8 + Math.sin(i * 2) * 0.3, Math.sin(i) * 0.35); extra.add(st); }
  if (prop === "mask") { const m = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.3), mats.fabric(0x111111)); m.position.set(0, 1.06, 0.03); extra.add(m); }
  if (prop === "bow") { const b = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.015, 8, 20, Math.PI), pbrMaterial({ type: "wood", color: "#a0703e", color2: "#5a3818", scale: 2, seed: 44 })); b.position.set(0.28, 0.6, 0); b.rotation.z = -Math.PI / 2; extra.add(b); }
  return figure({ body: mats.fabric(col), prop: extra, scale: 0.75 });
}

// ---------- effects ----------
function spray(n, color, from, speed = 4, kind = "drop") {
  for (let i = 0; i < n; i++) {
    const pool = kind === "coin" ? coins : drops;
    let d = pool.find(p => p.life <= 0);
    if (!d && pool.length >= (kind === "coin" ? 30 : 90)) d = pool.reduce((a, b) => (a.life < b.life ? a : b)); // pool full: recycle the oldest
    if (!d) {
      const m = kind === "coin" ? new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.02, 20), mats.gold()) : new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), mats.jelly(0xffffff));
      m.castShadow = true; scene.add(m); d = { m, v: new THREE.Vector3(), life: 0 }; pool.push(d);
    }
    if (kind !== "coin") d.m.material.color.set(color), d.m.material.attenuationColor && d.m.material.attenuationColor.set(color);
    d.m.visible = true; d.m.position.copy(from).add(tmp.set((Math.random() - .5) * 0.5, Math.random() * 0.5, (Math.random() - .5) * 0.5));
    d.v.set((Math.random() - .5) * speed, 2 + Math.random() * speed, (Math.random() - .5) * speed * 0.6);
    if (kind === "coin") d.v.x -= 3; // coins fly toward the hero
    d.life = kind === "coin" ? 1.1 : 0.9; d.m.scale.setScalar(kind === "coin" ? 1 : 0.6 + Math.random());
  }
}
function starBurst(from) {
  for (let i = 0; i < 10; i++) {
    let s = sparks.find(p => p.life <= 0); if (!s) { s = { m: glowSprite(0xffe08a, 0.35, 1), v: new THREE.Vector3(), life: 0 }; scene.add(s.m); sparks.push(s); }
    s.m.visible = true; s.m.position.copy(from); s.v.set((Math.random() - .5) * 8, (Math.random() - .5) * 8, (Math.random() - .5) * 4); s.life = 0.4;
  }
}


// ---------- weather, wildlife and landmarks per biome ----------
let weather = null, critters = [], landmark = null, chestM = null, weatherKind = "";
function sprite(color, size, blend = THREE.AdditiveBlending, op = 0.8) { const s = glowSprite(color, size, op); s.material.blending = blend; return s; }
function makeWeather(kind) {
  if (weather) scene.remove(weather); critters.forEach(c => scene.remove(c)); critters = [];
  weather = new THREE.Group(); scene.add(weather); weatherKind = kind;
  const N = { leaves: 40, snow: 160, embers: 90, wisps: 18, motes: 70, pollen: 50, clouds: 14 }[kind] || 0;
  for (let i = 0; i < N; i++) {
    let p;
    if (kind === "leaves") { p = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.08), new THREE.MeshStandardMaterial({ color: [0xd98a2a, 0xc8502a, 0xe8c24a, 0x6fae3a][i % 4], side: THREE.DoubleSide })); }
    else if (kind === "snow") p = sprite(0xffffff, 0.08, THREE.NormalBlending, 0.9);
    else if (kind === "embers") p = sprite(0xff7a2a, 0.12);
    else if (kind === "wisps") p = sprite(0x9fffd8, 0.5, THREE.AdditiveBlending, 0.5);
    else if (kind === "motes") p = sprite(0xc8a8ff, 0.1);
    else if (kind === "pollen") p = sprite(0xfff2a8, 0.06);
    else if (kind === "clouds") { p = sprite(0xffffff, 2.5 + Math.random() * 2, THREE.NormalBlending, 0.55); }
    p.position.set((Math.random() - .5) * 18, Math.random() * 7, -1 - Math.random() * 9);
    p.userData = { v: Math.random(), ph: Math.random() * 6 };
    weather.add(p);
  }
  // Critters: butterflies in the meadow, fireflies in the forest, bats in the crypt, birds in the sky.
  const crit = { meadow: "butterfly", forest: "firefly", crypt: "bat", sky: "bird", frost: "bird" }[ARENAS[biomeIdx].props];
  const n = crit === "firefly" ? 14 : 5;
  for (let i = 0; i < n && crit; i++) {
    let c;
    if (crit === "firefly") c = sprite(0xd8ff6a, 0.25);
    else { c = new THREE.Group(); const col = crit === "butterfly" ? [0xff6fa8, 0x6fb8ff, 0xffd23f][i % 3] : crit === "bat" ? 0x1a1418 : 0x2a2a2a; const wm = new THREE.MeshStandardMaterial({ color: col, side: THREE.DoubleSide, emissive: crit === "butterfly" ? col : 0, emissiveIntensity: 0.2 });
      for (const sd of [-1, 1]) { const w = new THREE.Mesh(crit === "butterfly" ? new THREE.CircleGeometry(0.08, 12) : new THREE.PlaneGeometry(0.2, 0.06), wm); w.position.x = sd * (crit === "butterfly" ? 0.07 : 0.1); w.rotation.x = -Math.PI / 2; c.add(w); } }
    c.userData = { ph: i * 1.3, kind: crit }; scene.add(c); critters.push(c);
  }
}
function makeLandmark(kind) {
  if (landmark) scene.remove(landmark);
  const g = new THREE.Group(); g.position.set(-6 + (kind === "void" ? 6 : 0), 0, -16);
  const stone = pbrMaterial({ type: "stone", color: "#9a9488", color2: "#4a453e", scale: 3, seed: 70 });
  if (kind === "meadow") { const hill = new THREE.Mesh(new THREE.SphereGeometry(4, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), pbrMaterial({ type: "dirt", color: "#7fc35e", color2: "#3f7a2c", scale: 4, seed: 71 })); hill.scale.y = 0.5; g.add(hill); for (const x of [-0.8, 0.8]) g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 2.2, 12), stone).translateX(x).translateY(2.9)); g.add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 0.8), stone).translateY(2.5)); for (const x of [-0.8, 0.8]) g.add(new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 12), mats.plastic(0x3a6ab8)).translateX(x).translateY(4.4)); }
  if (kind === "forest") { const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.6, 9, 14), pbrMaterial({ type: "bark", color: "#6a4a2a", color2: "#2e1e10", scale: 2, seed: 72 })); trunk.position.y = 4.5; g.add(trunk); for (let i = 0; i < 6; i++) g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(2.4 - i * 0.2, 1), pbrMaterial({ type: "dirt", color: "#4f9a3a", color2: "#1f4a1a", scale: 3, seed: 73 })).translateX(Math.cos(i) * 1.5).translateY(9 + i * 0.5).translateZ(Math.sin(i) * 1.2)); }
  if (kind === "crypt") { g.add(new THREE.Mesh(new THREE.BoxGeometry(3, 3.2, 2), stone).translateY(1.6)); const roof = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.8, 4), stone); roof.rotation.y = Math.PI / 4; roof.position.y = 4.1; g.add(roof); g.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.2, 0.2), stone).translateY(5.4)); g.add(new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), mats.emissive(0x7affc8, 2)).translateY(2.2).translateZ(1.01)); }
  if (kind === "ember") { const v = new THREE.Mesh(new THREE.ConeGeometry(6, 7, 24, 1, true), pbrMaterial({ type: "rock", color: "#3a2a24", color2: "#0a0402", scale: 3, seed: 74 })); v.position.y = 3.5; g.add(v); const glow = sprite(0xff5a10, 5, THREE.AdditiveBlending, 0.8); glow.position.y = 7.2; g.add(glow); g.userData.smoke = []; for (let i = 0; i < 6; i++) { const sm = sprite(0x3a302a, 3, THREE.NormalBlending, 0.4); sm.userData.k = i / 6; g.add(sm); g.userData.smoke.push(sm); } }
  if (kind === "frost") for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.ConeGeometry(3 + i, 6 + i * 2, 5), pbrMaterial({ type: "ice", color: "#ffffff", color2: "#9fc8e8", scale: 3, seed: 75 + i })); m.position.set(i * 4 - 2, 3 + i, -i * 2); g.add(m); }
  if (kind === "sky") for (let i = 0; i < 3; i++) { const isl = new THREE.Group(); const rock = new THREE.Mesh(new THREE.ConeGeometry(1.4 - i * 0.2, 2.2, 8), pbrMaterial({ type: "rock", color: "#9a8a7a", color2: "#4a3a2a", scale: 2, seed: 76 })); rock.rotation.x = Math.PI; isl.add(rock); isl.add(new THREE.Mesh(new THREE.CylinderGeometry(1.4 - i * 0.2, 1.4 - i * 0.2, 0.2, 8), pbrMaterial({ type: "dirt", color: "#7fc35e", color2: "#3f7a2c", scale: 3, seed: 77 })).translateY(1.1)); isl.position.set(i * 5 - 3, 5 + i * 1.5, -i * 3); isl.userData.ph = i; g.add(isl); }
  if (kind === "void") { const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.25, 16, 64), mats.emissive(0x9b5cff, 2.5)); ring.position.y = 5; g.add(ring); const inner = new THREE.Mesh(new THREE.CircleGeometry(3, 48), new THREE.MeshBasicMaterial({ color: 0x05000f })); inner.position.y = 5; g.add(inner); g.userData.ring = ring; }
  scene.add(g); landmark = g;
}
function tickLife(t, dt) {
  if (weather) weather.children.forEach(p => { const u = p.userData;
    if (weatherKind === "snow") { p.position.y -= dt * (0.5 + u.v * 0.6); p.position.x += Math.sin(t / 900 + u.ph) * dt * 0.2; }
    else if (weatherKind === "leaves") { p.position.y -= dt * (0.4 + u.v * 0.3); p.position.x += Math.sin(t / 700 + u.ph) * dt * 0.6; p.rotation.set(t / 400 + u.ph, t / 600, 0); }
    else if (weatherKind === "embers") { p.position.y += dt * (0.6 + u.v); p.position.x += Math.sin(t / 300 + u.ph) * dt * 0.3; p.material.opacity = 0.5 + Math.sin(t / 100 + u.ph) * 0.4; }
    else if (weatherKind === "clouds") { p.position.x += dt * 0.4; if (p.position.x > 10) p.position.x = -10; }
    else { p.position.y += Math.sin(t / 900 + u.ph) * dt * 0.2; p.position.x += Math.cos(t / 1100 + u.ph) * dt * 0.2; if (p.material) p.material.opacity = 0.35 + Math.sin(t / 500 + u.ph) * 0.3; }
    if (p.position.y < -0.2) p.position.y = 7; if (p.position.y > 7.5) p.position.y = 0; });
  critters.forEach((c, i) => { const u = c.userData, a = t / 1800 + u.ph;
    if (u.kind === "firefly") { c.position.set(Math.sin(a * 1.3) * 5, 0.6 + Math.sin(a * 2.1) * 0.5 + 0.5, -1.5 + Math.cos(a) * 2); c.material.opacity = 0.5 + Math.sin(t / 200 + i) * 0.5; return; }
    const r = u.kind === "butterfly" ? 3 : 6, y = u.kind === "butterfly" ? 0.8 + Math.sin(a * 3) * 0.4 : 3.5 + Math.sin(a) * 0.5;
    c.position.set(Math.cos(a) * r, y, -2 + Math.sin(a) * r * 0.5); c.rotation.y = -a;
    const flap = Math.sin(t / (u.kind === "butterfly" ? 60 : 90) + i) * 0.9; c.children[0].rotation.z = flap; c.children[1].rotation.z = -flap; });
  if (landmark) { if (landmark.userData.smoke) landmark.userData.smoke.forEach(sm => { sm.userData.k = (sm.userData.k + dt * 0.08) % 1; sm.position.set(Math.sin(sm.userData.k * 6) * 0.5, 7.5 + sm.userData.k * 6, 0); sm.scale.setScalar(2 + sm.userData.k * 4); sm.material.opacity = 0.45 * (1 - sm.userData.k); });
    if (landmark.userData.ring) landmark.userData.ring.rotation.z += dt * 0.3;
    landmark.children.forEach(c => { if (c.userData.ph !== undefined) c.position.y += Math.sin(t / 1200 + c.userData.ph) * 0.004; }); }
  if (chestM) { chestM.rotation.y = Math.sin(t / 400) * 0.25; chestM.position.y = Math.abs(Math.sin(t / 300)) * 0.12; chestM.children[chestM.children.length - 1].material.opacity = 0.5 + Math.sin(t / 150) * 0.3; }
}
function makeLootChest() {
  const g = new THREE.Group(), wood = pbrMaterial({ type: "wood", color: "#a57443", color2: "#5e3c1c", scale: 2, seed: 78 });
  g.add(new THREE.Mesh(RoundedBox(0.8, 0.5, 0.55), wood).translateY(0.25));
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.8, 20, 1, false, 0, Math.PI), wood); lid.rotation.z = Math.PI / 2; lid.position.y = 0.5; g.add(lid);
  for (const x of [-0.3, 0.3]) g.add(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.8, 0.58), mats.gold()).translateX(x).translateY(0.42));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.06), mats.gold()).translateY(0.42).translateZ(0.29));
  g.traverse(c => { if (c.isMesh) c.castShadow = true; });
  g.add(glowSprite(0xffd76a, 2, 0.6));
  return g;
}
const RoundedBox = (w, h, d) => new THREE.RoundedBoxGeometry(w, h, d, 3, 0.05);

const HERO_X = -2.1, SLIME_X = 1.7;
const Slime3D = {
  init(canvas) {
    stage = createStage(canvas, { bloom: 0.5, bloomThreshold: 0.88, exposure: 1.05, env: 0.9, fov: 38 });
    ({ scene, camera } = stage);
    hemi = new THREE.HemisphereLight(0xffffff, 0x445533, 1); scene.add(hemi);
    key = keyLight(scene, { size: 7, offset: [-4, 9, 6], mapSize: 2048 }); key.follow(0, 0, 0);
    ground = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.MeshStandardMaterial()); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    scene.add(props, party);
    crownGeo = makeCrown();
    dust = driftParticles(scene, { count: 120, size: 0.05, color: 0xfff2c8, box: [14, 5, 8], opacity: 0.6, speed: 0.25 });
    camera.position.set(0, 2.3, 7.4); camera.lookAt(0, 0.9, 0);
    hero = makeHero(null); hero.position.set(HERO_X, 0, 0.3); hero.rotation.y = 0.9; scene.add(hero);
  },
  setBiome(i) { if (stage) setBiome(i); },
  setMonster(def) {
    if (!stage) return;
    if (slime) scene.remove(slime);
    slime = makeSlime(def); if (def.golden) slime.userData.body.material = new THREE.MeshPhysicalMaterial({ color: 0xffc34d, metalness: 1, roughness: 0.18, clearcoat: 1, emissive: 0x6a4000, emissiveIntensity: 0.5 }); slime.position.set(SLIME_X, 0, 0); slime.rotation.y = -0.5; scene.add(slime);
    entering = 1; dying = 0; if (def.boss) shake = 0.5;
  },
  setHero(path, members) {
    if (!stage) return;
    if (path !== heroPath) { scene.remove(hero); hero = makeHero(path); hero.position.set(HERO_X, 0, 0.3); hero.rotation.y = 0.9; scene.add(hero); heroPath = path; }
    const k = members.join(","); if (k === partyKey) return; partyKey = k;
    party.clear();
    members.forEach((id, i) => { const m = makeMember(id); const row = Math.floor(i / 5), col = i % 5; m.position.set(-3.1 - row * 0.7 + (col % 2) * 0.25, 0, -1.4 + col * 0.65 - row * 0.3); m.rotation.y = 1.0; m.userData.phase = i; party.add(m); });
  },
  attack(crit) {
    if (!stage) return; lunge = 1; squash = 1; flash = 1;
    if (slime) spray(crit ? 10 : 4, slime.userData.def.color, tmp.set(SLIME_X - 0.4, 0.8, 0.3).clone(), crit ? 5 : 3);
    if (crit) { shake = Math.max(shake, 0.25); starBurst(new THREE.Vector3(SLIME_X - 0.3, 1, 0.5)); }
  },
  partyHit() { if (slime) squash = Math.max(squash, 0.35); },
  kill(boss) {
    if (!stage || !slime) return;
    spray(boss ? 40 : 18, slime.userData.def.color, new THREE.Vector3(SLIME_X, 0.7, 0), boss ? 7 : 5);
    spray(boss ? 14 : 6, 0, new THREE.Vector3(SLIME_X, 0.8, 0), 3, "coin");
    if (boss) { shake = 0.6; starBurst(new THREE.Vector3(SLIME_X, 1.2, 0)); }
    dying = 1;
  },
  setChest(on) { if (!stage) return; if (on && !chestM) { chestM = makeLootChest(); chestM.position.set(0.1, 0, 1.2); scene.add(chestM); } if (!on && chestM) { spray(12, 0, new THREE.Vector3(0.1, 0.6, 1.2), 4, "coin"); starBurst(new THREE.Vector3(0.1, 0.7, 1.2)); scene.remove(chestM); chestM = null; } },
  draw(t, dt, s) {
    if (!stage) return;
    bob += dt; tickLife(t, dt);
    // Hero: idle breathing, lunge + swing on tap.
    lunge = Math.max(0, lunge - dt * 6);
    const l = Math.sin(lunge * Math.PI);
    hero.position.x = HERO_X + l * 0.9; hero.position.y = Math.sin(bob * 2) * 0.02;
    if (heroParts.arm) heroParts.arm.rotation.z = -0.4 - l * 2.2;
    party.children.forEach(m => { m.position.y = Math.abs(Math.sin(bob * 3 + m.userData.phase)) * 0.08; });
    // Slime: idle wobble, squash on hit, drop in on spawn, pop on death.
    if (slime) {
      const u = slime.userData; squash = Math.max(0, squash - dt * 4); flash = Math.max(0, flash - dt * 8);
      entering = Math.max(0, entering - dt * 2.2);
      const w = Math.sin(t / 260) * 0.05, sq = Math.sin(squash * Math.PI) * 0.25;
      slime.scale.set(1 + w + sq, 1 - w - sq * 1.2, 1 + w + sq);
      slime.position.y = entering > 0 ? Math.pow(entering, 2) * 5 : 0;
      if (dying > 0) { dying = Math.max(0, dying - dt * 5); slime.scale.multiplyScalar(dying); }
      const mtl = u.body.material; if (mtl.emissive) { mtl.userData.baseE ??= mtl.emissiveIntensity; mtl.emissiveIntensity = mtl.userData.baseE + flash * 1.5; if (!mtl.userData.baseC) mtl.userData.baseC = mtl.emissive.clone(); mtl.emissive.copy(mtl.userData.baseC).lerp(new THREE.Color(0xffffff), flash * 0.6); }
      if (u.wings) u.wings.forEach((wg, i) => wg.rotation.x = Math.sin(t / 90 + i) * 0.6);
      slime.rotation.y = -0.5 + Math.sin(t / 900) * 0.15;
    }
    for (const d of [...drops, ...coins]) {
      if (d.life <= 0) continue; d.life -= dt; d.v.y -= 14 * dt; d.m.position.addScaledVector(d.v, dt);
      if (d.m.position.y < 0.07) { d.m.position.y = 0.07; d.v.y *= -0.35; d.v.x *= 0.7; d.v.z *= 0.7; }
      d.m.rotation.x += dt * 8;
      if (d.life <= 0) d.m.visible = false; else if (d.life < 0.25) d.m.scale.multiplyScalar(0.85);
    }
    for (const sp of sparks) { if (sp.life <= 0) continue; sp.life -= dt; sp.m.position.addScaledVector(sp.v, dt); sp.m.material.opacity = sp.life / 0.4; if (sp.life <= 0) sp.m.visible = false; }
    props.children.forEach(p => { if (p.userData.float !== undefined) p.position.y += Math.sin(t / 800 + p.userData.float) * 0.003; });
    dust.tick(dt, 0, 2, -1);
    // Camera: gentle drift, shake on crits and bosses, pushes in during boss fights.
    shake = Math.max(0, shake - dt);
    // Fit ~7.6 units of arena width on any screen shape, then push in a little for bosses.
    const fit = 3.8 / (Math.tan(camera.fov * Math.PI / 360) * camera.aspect), dist = Math.max(7.4, fit), bossZoom = s.boss ? 0.5 : 0;
    camera.position.set(Math.sin(t / 3000) * 0.25 + (Math.random() - .5) * shake * 0.5, 2.3 + dist * 0.05 + bossZoom * 0.3 + (Math.random() - .5) * shake * 0.5, dist - bossZoom);
    camera.lookAt(0, 0.9 + bossZoom * 0.3, 0);
    stage.render(t);
  },
};
window.Slime3D = Slime3D;
window.dispatchEvent(new Event("slime3d-ready"));
