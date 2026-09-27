// Dig Out — realistic 3D renderer. The game logic lives in index.html; this module only draws it.
// It exposes window.Scene3D = { init(canvas, api), draw(t, dt), burst(color, n) } and fires "scene3d-ready".
import { THREE, createStage, keyLight, pbrMaterial, makePBR, mats, glowSprite, driftParticles } from "../shared/realism.js";

const ABOVE = 7, BELOW = 5, HALF_W = 4, BACK = 3; // visible window of earth around the digger
let stage, scene, camera, api, earth, ore, gems, current, cracks, crackTex = [], door, digger, pickPivot, lantern, lanternGlow, searchLight, beam, stars, prisonTop, guard, key, dust;
let builtFor = "", camY = 0, shake = 0;
const particles = [], sparks = [], dummy = new THREE.Object3D(), tmpColor = new THREE.Color();

// Neutral rock/dirt textures; each block's instance colour tints them into the current layer's hue.
const rockTex = { type: "rock", color: "#e8e2d8", color2: "#8f877c", scale: 3, normal: 3.2, rough: [0.75, 1], seed: 3 };
const dirtTex = { type: "dirt", color: "#efe6da", color2: "#9a8f80", scale: 4, normal: 2.6, rough: [0.8, 1], seed: 5 };

function mesh(geo, mat, shadow = true) { const m = new THREE.Mesh(geo, mat); m.castShadow = shadow; m.receiveShadow = true; return m; }

// Six crack overlays, from hairline to shattered.
function makeCracks() {
  for (let lvl = 0; lvl < 6; lvl++) {
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const g = c.getContext("2d"); g.lineCap = "round"; g.lineJoin = "round";
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < lvl * 3; k++) {
      let x = 128 + (rnd() - .5) * 60, y = 128 + (rnd() - .5) * 60; const pts = [[x, y]];
      for (let s = 0; s < 6; s++) { x += (rnd() - .5) * 70; y += (rnd() - .5) * 70; pts.push([x, y]); }
      for (const [w, col] of [[6, "rgba(255,230,200,.18)"], [3.2, "rgba(15,8,4,.9)"]]) { // lit edge + dark gap reads as depth
        g.lineWidth = w * (1 - k / 30); g.strokeStyle = col; g.beginPath(); pts.forEach(([px, py], i) => i ? g.lineTo(px, py) : g.moveTo(px, py)); g.stroke();
      }
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; crackTex.push(t);
  }
}

function makeDigger() {
  const g = new THREE.Group();
  const suit = mats.fabric(0xff8a1f, { sheen: 0.35, sheenColor: new THREE.Color(0xffc080) }); suit.map = makePBR({ type: "fabric", color: "#ffffff", color2: "#e6e6e6", scale: 2, seed: 9 }).map;
  const vinyl = mats.plastic(0xf7f5f0, { roughness: 0.35 });
  const knit = mats.fabric(0xb2263a); knit.map = makePBR({ type: "fabric", color: "#ffffff", color2: "#bdbdbd", scale: 1, seed: 4 }).map;
  const body = mesh(new THREE.CapsuleGeometry(0.24, 0.3, 8, 20), suit); body.position.y = 0.45; g.add(body);
  const collar = mesh(new THREE.TorusGeometry(0.16, 0.035, 8, 24), suit); collar.rotation.x = Math.PI / 2; collar.position.y = 0.74; g.add(collar);
  const head = mesh(new THREE.SphereGeometry(0.22, 32, 24), vinyl); head.position.y = 0.95; g.add(head);
  const hat = mesh(new THREE.SphereGeometry(0.228, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), knit); hat.position.y = 0.99; g.add(hat);
  const brim = mesh(new THREE.TorusGeometry(0.215, 0.04, 8, 32), knit); brim.rotation.x = Math.PI / 2; brim.position.y = 1.0; g.add(brim);
  const pom = mesh(new THREE.SphereGeometry(0.065, 16, 12), knit); pom.position.y = 1.24; g.add(pom);
  for (const s of [-1, 1]) { const eye = mesh(new THREE.SphereGeometry(0.032, 12, 12), new THREE.MeshPhysicalMaterial({ color: 0x1a0f08, roughness: 0.1, clearcoat: 1 }), false); eye.position.set(s * 0.08, 0.95, 0.2); g.add(eye); }
  for (const s of [-1, 1]) { const leg = mesh(new THREE.CapsuleGeometry(0.08, 0.12, 6, 12), suit); leg.position.set(s * 0.11, 0.12, 0); g.add(leg);
    const boot = mesh(new THREE.SphereGeometry(0.09, 16, 10), new THREE.MeshStandardMaterial({ color: 0x2a1c12, roughness: 0.6 })); boot.scale.set(1, 0.6, 1.4); boot.position.set(s * 0.11, 0.03, 0.03); g.add(boot); }
  // Pickaxe on a shoulder pivot so a swing is a single rotation: oiled wood handle, forged steel head.
  pickPivot = new THREE.Group(); pickPivot.position.set(0.28, 0.62, 0.05); g.add(pickPivot);
  const arm = mesh(new THREE.CapsuleGeometry(0.07, 0.18, 6, 12), suit); arm.position.set(0.02, -0.12, 0); pickPivot.add(arm);
  const wood = pbrMaterial({ type: "wood", color: "#a0703e", color2: "#5a3818", scale: 2, seed: 2 }, { roughness: 0.7 });
  const handle = mesh(new THREE.CylinderGeometry(0.028, 0.034, 0.78, 12), wood); handle.position.set(0.05, -0.05, 0.25); handle.rotation.x = Math.PI / 2.4; pickPivot.add(handle);
  const steel = pbrMaterial({ type: "metal", color: "#dfe3ea", color2: "#8d949e", scale: 2, rough: [0.25, 0.5], seed: 8 }, { metalness: 1 });
  const pickHead = mesh(new THREE.CylinderGeometry(0.012, 0.045, 0.56, 10), steel); pickHead.rotation.z = Math.PI / 2; pickHead.position.set(0.05, 0.1, 0.58); pickPivot.add(pickHead);
  const pickHead2 = pickHead.clone(); pickHead2.rotation.z = -Math.PI / 2; pickHead2.scale.set(1, 0.5, 1); pickHead2.position.x = -0.07; pickPivot.add(pickHead2);
  // A real lantern: brass cage, glowing bulb (bloom), warm point light.
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a14a, metalness: 1, roughness: 0.35 });
  const lamp = new THREE.Group(); lamp.position.set(-0.3, 0.55, 0.12); g.add(lamp);
  const cage = mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.14, 6, 1, true), brass); lamp.add(cage);
  const cap = mesh(new THREE.ConeGeometry(0.075, 0.06, 6), brass); cap.position.y = 0.1; lamp.add(cap);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 12), mats.emissive(0xffb347, 8)); lamp.add(bulb);
  lanternGlow = glowSprite(0xffb347, 0.9, 0.55); lamp.add(lanternGlow);
  lantern = new THREE.PointLight(0xffb45a, 7, 6, 1.7); lantern.castShadow = false; lamp.add(lantern);
  // Dizzy stars for when you're caught.
  stars = new THREE.Group(); stars.position.y = 1.4;
  for (let i = 0; i < 3; i++) { const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.06), mats.emissive(0xffd23f, 4)); st.position.set(Math.cos(i * 2.1) * .3, 0, Math.sin(i * 2.1) * .3); stars.add(st); }
  g.add(stars);
  g.userData.suit = suit;
  return g;
}

function makeDoor() {
  const g = new THREE.Group();
  const plate = pbrMaterial({ type: "metal", color: "#aab2bd", color2: "#5d656f", scale: 3, rough: [0.3, 0.6], seed: 12 }, { metalness: 1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a4048, metalness: 1, roughness: 0.4 });
  g.add(mesh(new THREE.RoundedBoxGeometry(1.02, 1.02, 2.02, 3, 0.05), plate));
  const rim = mesh(new THREE.TorusGeometry(0.36, 0.04, 12, 48), dark); rim.rotation.x = Math.PI / 2; rim.position.y = 0.52; g.add(rim);
  const wheel = new THREE.Group(); wheel.position.y = 0.56; g.add(wheel); g.userData.wheel = wheel;
  const ring = mesh(new THREE.TorusGeometry(0.26, 0.035, 12, 40), mats.steel()); ring.rotation.x = Math.PI / 2; wheel.add(ring);
  for (let i = 0; i < 3; i++) { // three spokes, each lying flat and turned 60° further round the hub
    const arm = new THREE.Group(); arm.rotation.y = i * Math.PI / 3; wheel.add(arm);
    const spoke = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.52, 8), mats.steel()); spoke.rotation.x = Math.PI / 2; arm.add(spoke);
  }
  const hub = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 16), mats.steel()); wheel.add(hub);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) {
    const bolt = mesh(new THREE.SphereGeometry(0.04, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), dark);
    bolt.position.set(-0.4 + c * 0.2, 0.51, -0.85 + r * 1.7); g.add(bolt);
  }
  const warn = mesh(new THREE.PlaneGeometry(0.9, 0.12), new THREE.MeshStandardMaterial({ map: stripeTexture(), roughness: 0.6 })); warn.rotation.x = -Math.PI / 2; warn.position.set(0, 0.515, 0.62); g.add(warn);
  return g;
}
function stripeTexture() {
  const c = document.createElement("canvas"); c.width = 256; c.height = 32; const g = c.getContext("2d");
  g.fillStyle = "#f2c200"; g.fillRect(0, 0, 256, 32); g.fillStyle = "#151515";
  for (let x = -32; x < 288; x += 32) { g.beginPath(); g.moveTo(x, 32); g.lineTo(x + 16, 32); g.lineTo(x + 32, 0); g.lineTo(x + 16, 0); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function makePrison() {
  const g = new THREE.Group();
  const concrete = pbrMaterial({ type: "plaster", color: "#b9b6ae", color2: "#7d7a73", scale: 5, repeat: 2, seed: 21 });
  const slab = mesh(new THREE.BoxGeometry(HALF_W * 2 + 1, 0.2, BACK + 1), concrete); slab.position.set(0, 0.6, -BACK / 2 + 0.5); g.add(slab);
  const hole = mesh(new THREE.BoxGeometry(1, 0.21, 2), new THREE.MeshStandardMaterial({ color: 0x0c0a08, roughness: 1 })); hole.position.set(0, 0.6, -0.5); g.add(hole);
  const barMat = new THREE.MeshStandardMaterial({ color: 0x5a5f68, metalness: 1, roughness: 0.45 });
  for (let x = -HALF_W; x <= HALF_W; x += 0.5) { const bar = mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.2, 12), barMat); bar.position.set(x, 1.8, -BACK + 0.2); g.add(bar); }
  const rail = mesh(new THREE.BoxGeometry(HALF_W * 2 + 0.4, 0.08, 0.08), barMat); rail.position.set(0, 2.85, -BACK + 0.2); g.add(rail);
  // The guard: pressed uniform, cap with a peak, and a torch.
  guard = new THREE.Group();
  const uni = mats.fabric(0x2b4c9b);
  const gb = mesh(new THREE.CapsuleGeometry(0.22, 0.35, 8, 16), uni); gb.position.y = 0.5; guard.add(gb);
  const gh = mesh(new THREE.SphereGeometry(0.2, 24, 16), mats.skin()); gh.position.y = 1.02; guard.add(gh);
  const cap = mesh(new THREE.CylinderGeometry(0.21, 0.2, 0.12, 24), mats.fabric(0x1c2f66)); cap.position.y = 1.17; guard.add(cap);
  const peak = mesh(new THREE.BoxGeometry(0.2, 0.02, 0.14), new THREE.MeshPhysicalMaterial({ color: 0x111111, clearcoat: 1, roughness: 0.2 })); peak.position.set(0, 1.12, 0.2); guard.add(peak);
  const badge = mesh(new THREE.CircleGeometry(0.04, 16), mats.gold()); badge.position.set(-0.1, 0.72, 0.23); guard.add(badge);
  guard.position.set(-6, 0.7, -1.5); g.add(guard);
  return g;
}

function buildEarth() {
  const count = (ABOVE + BELOW + 1) * (HALF_W * 2 + 1) * (BACK + 1);
  const geo = new THREE.RoundedBoxGeometry(0.985, 0.985, 0.985, 2, 0.07);
  earth = new THREE.InstancedMesh(geo, pbrMaterial(rockTex), count);
  // Ore: gold-flecked metallic blocks; gems: glowing crystal blocks that bloom.
  ore = new THREE.InstancedMesh(geo, pbrMaterial({ ...rockTex, color: "#ffe08a", color2: "#6b4b10", seed: 31 }, { metalness: 0.85, roughness: 0.35 }), 40);
  gems = new THREE.InstancedMesh(geo, new THREE.MeshPhysicalMaterial({ color: 0x4fd1ff, emissive: 0x1aa0ff, emissiveIntensity: 1.6, roughness: 0.15, clearcoat: 1, normalMap: makePBR(rockTex).normalMap }), 20);
  for (const m of [earth, ore, gems]) { m.castShadow = m.receiveShadow = true; m.frustumCulled = false; scene.add(m); } // instances follow the camera
}

function layoutEarth(s) {
  let n = 0, no = 0, ng = 0;
  for (let dy = -ABOVE; dy <= BELOW; dy++) {
    const d = s.depth + dy;
    for (let x = -HALF_W; x <= HALF_W; x++) for (let z = -BACK; z <= 0; z++) {
      // Ant-farm cutaway: above the digger the front layer is open; the dug trench (x = 0, z = -1) is carved into the back wall.
      if (d < 0 || (d <= s.depth && (z === 0 || (x === 0 && z === -1)))) continue;
      const hash = Math.abs(Math.sin(d * 12.9898 + x * 78.233 + z * 37.719)) * 43758.5453 % 1;
      dummy.position.set(x, -d, z);
      dummy.rotation.set(0, (Math.floor(hash * 4)) * Math.PI / 2, 0); // rotate texture per block so tiling doesn't repeat visibly
      dummy.updateMatrix();
      if (hash > 0.992 && ng < 20) { gems.setMatrixAt(ng++, dummy.matrix); continue; }
      if (hash > 0.965 && no < 40) { ore.setMatrixAt(no++, dummy.matrix); continue; }
      earth.setMatrixAt(n, dummy.matrix);
      tmpColor.set(s.layerColor(d)).offsetHSL(0, -0.05, (hash - 0.5) * 0.07 - (z < -1 ? 0.05 : 0) + 0.04);
      earth.setColorAt(n, tmpColor); n++;
    }
  }
  earth.count = n; ore.count = no; gems.count = ng;
  for (const m of [earth, ore, gems]) m.instanceMatrix.needsUpdate = true;
  if (earth.instanceColor) earth.instanceColor.needsUpdate = true;
}


// ---------- underground life: wall decorations, creatures, special blocks ----------
let decor, bats = [], worms = [], chestFace, goldSparks = [], drips = [];
const D = {};
function initDecor() {
  decor = new THREE.Group(); scene.add(decor);
  D.bone = new THREE.MeshStandardMaterial({ color: 0xece4d0, roughness: 0.55 });
  D.crystal = new THREE.MeshPhysicalMaterial({ color: 0x8fe0ff, emissive: 0x2a8fff, emissiveIntensity: 0.8, roughness: 0.05, transmission: 0.6, thickness: 0.3 });
  D.crystalPink = new THREE.MeshPhysicalMaterial({ color: 0xff9ad5, emissive: 0xff3fa4, emissiveIntensity: 0.7, roughness: 0.05, transmission: 0.6, thickness: 0.3 });
  D.cap = new THREE.MeshStandardMaterial({ color: 0x7affc8, emissive: 0x3affb0, emissiveIntensity: 1.6, roughness: 0.4 });
  D.stem = new THREE.MeshStandardMaterial({ color: 0xe8e0c8, roughness: 0.7 });
  D.root = pbrMaterial({ type: "bark", color: "#8a6242", color2: "#3a2412", scale: 2, seed: 50 });
  D.pipe = pbrMaterial({ type: "metal", color: "#8a5a3a", color2: "#3a2010", scale: 2, rough: [0.5, 0.9], seed: 51 }, { metalness: 0.8 });
  D.lava = new THREE.MeshStandardMaterial({ color: 0x2a0800, emissive: 0xff4a10, emissiveIntensity: 2.4 });
  D.worm = new THREE.MeshPhysicalMaterial({ color: 0xd98a8a, roughness: 0.35, clearcoat: 0.8 });
  D.water = new THREE.MeshPhysicalMaterial({ color: 0x9fe0ff, roughness: 0.05, transmission: 0.8, thickness: 0.1 });
  // Bats that flit through the open shaft.
  const wing = new THREE.MeshStandardMaterial({ color: 0x1a1418, side: THREE.DoubleSide, roughness: 0.6 });
  for (let i = 0; i < 3; i++) { const b = new THREE.Group(); b.add(mesh(new THREE.SphereGeometry(0.06, 10, 8), wing)); for (const sd of [-1, 1]) { const w = mesh(new THREE.CircleGeometry(0.12, 3), wing, sd * 0.1, 0, 0); w.rotation.x = -Math.PI / 2; b.add(w); } b.userData.phase = i * 2.1; scene.add(b); bats.push(b); }
  // Chest face that appears embedded in special chest blocks.
  chestFace = new THREE.Group();
  const wood = pbrMaterial({ type: "wood", color: "#a57443", color2: "#5e3c1c", scale: 2, seed: 52 });
  chestFace.add(mesh(new THREE.BoxGeometry(0.6, 0.4, 0.12), wood, 0, 0, 0));
  const lid = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.6, 16, 1, false, 0, Math.PI), wood, 0, 0.2, 0); lid.rotation.z = Math.PI / 2; lid.scale.z = 0.6; chestFace.add(lid);
  for (const x of [-0.22, 0.22]) chestFace.add(mesh(new THREE.BoxGeometry(0.05, 0.62, 0.14), mats.gold(), x, 0.05, 0));
  chestFace.add(mesh(new THREE.BoxGeometry(0.08, 0.1, 0.05), mats.gold(), 0, 0.02, 0.07));
  const cg = glowSprite(0xffd76a, 1.2, 0.6); cg.position.z = 0.2; chestFace.add(cg);
  const cl = new THREE.PointLight(0xffc34d, 5, 2.5); cl.position.z = 0.4; chestFace.add(cl);
  chestFace.scale.setScalar(1.3); chestFace.visible = false; scene.add(chestFace);
  for (let i = 0; i < 16; i++) { const g = glowSprite(0xffe08a, 0.12, 0); scene.add(g); goldSparks.push(g); }
  for (let i = 0; i < 6; i++) { const d = mesh(new THREE.SphereGeometry(0.025, 8, 6), D.water, 0, -999, 0); d.userData.v = 0; scene.add(d); drips.push(d); }
}
function fossil() { const g = new THREE.Group(); g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), D.bone).rotateZ(Math.PI / 2)); for (let i = 0; i < 5; i++) { const r = mesh(new THREE.TorusGeometry(0.1 - i * 0.012, 0.012, 6, 12, Math.PI), D.bone, -0.18 + i * 0.09, 0, 0); r.rotation.z = Math.PI; g.add(r); } g.add(mesh(new THREE.SphereGeometry(0.07, 12, 8), D.bone, 0.28, 0.02, 0)); return g; }
function crystals(mat) { const g = new THREE.Group(); for (let i = 0; i < 4; i++) { const c = mesh(new THREE.OctahedronGeometry(0.07, 0), mat, (i - 1.5) * 0.06, 0, 0); c.scale.y = 2 + Math.random(); c.rotation.z = (i - 1.5) * 0.35; g.add(c); } const l = new THREE.PointLight(mat.emissive.getHex(), 1.2, 1.4); l.position.z = 0.2; g.add(l); return g; }
function mushrooms() { const g = new THREE.Group(); for (let i = 0; i < 3; i++) { const m = new THREE.Group(); m.add(mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.1, 6), D.stem, 0, 0.05, 0)); m.add(mesh(new THREE.SphereGeometry(0.05, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), D.cap, 0, 0.1, 0)); m.position.x = (i - 1) * 0.08; m.scale.setScalar(0.7 + i * 0.25); g.add(m); } const gl = glowSprite(0x3affb0, 0.5, 0.5); gl.position.y = 0.1; g.add(gl); return g; }
function roots() { const g = new THREE.Group(); for (let i = 0; i < 3; i++) { const pts = [new THREE.Vector3((i - 1) * 0.12, 0.45, 0), new THREE.Vector3((i - 1) * 0.1 + 0.05, 0.1, 0.03), new THREE.Vector3((i - 1) * 0.15, -0.3, 0)]; g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.02 - i * 0.003, 6), D.root)); } return g; }
function pipe() { const g = new THREE.Group(); g.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 1, 16), D.pipe).rotateZ(Math.PI / 2)); for (const x of [-0.35, 0.35]) g.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 16), D.pipe, x, 0, 0).rotateZ(Math.PI / 2)); return g; }
function lavaCrack() { const g = new THREE.Group(); const pts = [new THREE.Vector3(-0.4, 0.1, 0), new THREE.Vector3(-0.1, -0.05, 0), new THREE.Vector3(0.1, 0.12, 0), new THREE.Vector3(0.4, -0.1, 0)]; g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.025, 6), D.lava)); const gl = glowSprite(0xff5a10, 0.9, 0.55); g.add(gl); return g; }
function worm() { const g = new THREE.Group(); const segs = []; for (let i = 0; i < 6; i++) { const sg = mesh(new THREE.SphereGeometry(0.025 - i * 0.002, 8, 6), D.worm, i * 0.035, 0, 0); g.add(sg); segs.push(sg); } g.userData.segs = segs; g.userData.phase = Math.random() * 6; worms.push(g); return g; }
function layoutDecor(s) {
  decor.clear(); worms = [];
  for (let dy = -ABOVE; dy <= BELOW; dy++) {
    const d = s.depth + dy; if (d < 1) continue;
    const layer = Math.min(3, Math.floor(d / Math.max(1, s.goal) * 4));
    for (const x of [-3, -2, -1, 1, 2, 3]) {
      const h = Math.abs(Math.sin(d * 91.7 + x * 13.3)) * 43758.5453 % 1;
      if (h > 0.2) continue; // ~20% of wall spots get something
      const faceZ = d <= s.depth ? -0.47 : 0.53, pick = h * 5;
      const opts = [[roots, worm, fossil], [fossil, mushrooms, worm], [pipe, mushrooms, () => crystals(D.crystal)], [lavaCrack, () => crystals(D.crystalPink), fossil]][layer];
      const o = opts[Math.floor(pick * opts.length) % opts.length]();
      o.position.set(x, -d + (h - 0.1) * 2, faceZ); o.rotation.z = (h - 0.1) * 3; decor.add(o);
    }
  }
}
function tickDecor(t, dt, s) {
  const y = -s.depth;
  bats.forEach((b, i) => { const a = t / 1600 + b.userData.phase; b.position.set(Math.sin(a) * 3, y + 3 + Math.sin(a * 2.3) * 1.2, 0.2 + Math.cos(a) * 0.5); b.rotation.y = Math.cos(a) > 0 ? 0 : Math.PI; b.children[1].rotation.x = -Math.PI / 2 + Math.sin(t / 60 + i) * 0.8; b.children[2].rotation.x = -Math.PI / 2 - Math.sin(t / 60 + i) * 0.8; });
  worms.forEach(w => w.userData.segs.forEach((sg, i) => { sg.position.y = Math.sin(t / 200 + w.userData.phase + i) * 0.02; }));
  // Water drips from the tunnel ceiling above the digger.
  drips.forEach(d => { if (d.position.y < y - 0.2 || d.position.y < -900) { if (Math.random() < dt * 0.4) { d.position.set((Math.random() - .5) * 0.6, y + 4, -0.8); d.userData.v = 0; } else return; } d.userData.v -= 9 * dt; d.position.y += d.userData.v * dt; });
  // Special current block.
  chestFace.visible = s.special === "chest" && !s.door; if (chestFace.visible) { chestFace.position.set(0, y + 0.02, 0.56); chestFace.children[chestFace.children.length - 2].material.opacity = 0.45 + Math.sin(t / 200) * 0.2; }
  const gold = s.special === "gold" || s.rush;
  goldSparks.forEach((g, i) => { g.material.opacity = gold ? 0.6 + Math.sin(t / 120 + i) * 0.4 : 0; if (gold) g.position.set(Math.sin(i * 7.1 + t / 900) * 0.55, y + 0.5 + ((t / 1500 + i / 16) % 1) * 1.4, -0.3 + Math.cos(i * 3.3) * 0.7); });
}

const Scene3D = {
  init(canvas, gameApi) {
    api = gameApi;
    stage = createStage(canvas, { bloom: 0.55, bloomThreshold: 0.9, exposure: 1.1, env: 0.35, fov: 42 });
    ({ scene, camera } = stage);
    scene.background = new THREE.Color(0x1a0f08); scene.fog = new THREE.FogExp2(0x1a0f08, 0.075);
    scene.add(new THREE.HemisphereLight(0xfff1dc, 0x3b2416, 0.55));
    key = keyLight(scene, { intensity: 1.8, color: 0xffe2b8, size: 7, offset: [4, 8, 6] });
    searchLight = new THREE.SpotLight(0xfff2c8, 0, 24, 0.33, 0.55, 1.2); scene.add(searchLight, searchLight.target);
    beam = new THREE.Mesh(new THREE.ConeGeometry(0.95, 10, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    scene.add(beam);
    makeCracks(); buildEarth();
    current = mesh(new THREE.RoundedBoxGeometry(1, 1, 2, 3, 0.06), pbrMaterial(dirtTex).clone()); scene.add(current);
    cracks = new THREE.Mesh(new THREE.BoxGeometry(1.012, 1.012, 2.012), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false })); scene.add(cracks);
    door = makeDoor(); scene.add(door);
    digger = makeDigger(); scene.add(digger);
    prisonTop = makePrison(); scene.add(prisonTop);
    initDecor();
    dust = driftParticles(scene, { count: 140, size: 0.022, color: 0xffd9a0, box: [5, 4, 4], opacity: 0.4, speed: 0.1 });
    const chunkGeo = new THREE.DodecahedronGeometry(0.075, 0);
    for (let i = 0; i < 70; i++) { const p = mesh(chunkGeo, pbrMaterial(dirtTex).clone(), false); p.visible = false; scene.add(p); particles.push({ m: p, v: new THREE.Vector3(), w: new THREE.Vector3(), life: 0 }); }
    for (let i = 0; i < 24; i++) { const sp = glowSprite(0xffd76a, 0.18, 1); sp.visible = false; scene.add(sp); sparks.push({ m: sp, v: new THREE.Vector3(), life: 0 }); }
  },

  burst(color, n = 14) {
    const s = api.state(); let made = 0;
    for (const p of particles) {
      if (p.life > 0) continue;
      p.m.visible = true; p.m.material.color.set(color).offsetHSL(0, 0, (Math.random() - 0.5) * 0.1);
      p.m.position.set((Math.random() - .5) * 0.8, -s.depth + 0.52, -0.5 + (Math.random() - .5) * 1.5);
      p.v.set((Math.random() - .5) * 4.5, 2 + Math.random() * 3.5, 0.5 + Math.random() * 2.5);
      p.w.set(Math.random() * 12, Math.random() * 12, Math.random() * 12);
      p.m.scale.setScalar(0.6 + Math.random() * 1.2);
      p.life = 1 + Math.random() * 0.5; if (++made >= n) break;
    }
    let sp = 0;
    for (const k of sparks) { if (k.life > 0) continue; k.m.visible = true; k.m.position.set((Math.random() - .5) * 0.5, -s.depth + 0.55, -0.3); k.v.set((Math.random() - .5) * 6, 1 + Math.random() * 4, Math.random() * 3); k.life = 0.45; if (++sp >= Math.min(8, n / 2)) break; }
    shake = Math.max(shake, n > 20 ? 0.35 : 0.06);
  },

  draw(t, dt) {
    if (!stage) return;
    const s = api.state(), keyStr = `${s.depth}|${s.prison}`;
    if (keyStr !== builtFor) { layoutEarth(s); layoutDecor(s); builtFor = keyStr; }
    const y = -s.depth;
    // Live block (or the Warden's vault door) with cracks growing as HP drops.
    current.visible = !s.door; door.visible = !!s.door;
    const wob = s.hitT > 0 ? Math.sin(t / 18) * 0.03 * s.hitT * 10 : 0;
    current.position.set(wob, y, -0.5); cracks.position.copy(current.position); door.position.set(wob, y, -0.5);
    current.material.color.set(s.special === "gold" ? 0xffc34d : s.layerColor(s.depth)).offsetHSL(0, -0.05, 0.08);
    current.material.metalness = s.special === "gold" ? 0.7 : 0; current.material.emissive.set(s.special === "gold" ? 0x6a4000 : 0x000000);
    tickDecor(t, dt, s);
    const lvl = Math.min(5, Math.floor((1 - s.frac) * 6));
    cracks.visible = lvl > 0 && !s.door; cracks.material.map = crackTex[lvl]; cracks.material.needsUpdate = true;
    if (s.door) door.userData.wheel.rotation.y = (1 - s.frac) * 8;
    // Digger stands on top of the block and swings the pickaxe down onto it; a little squash on impact.
    digger.position.set(0, y + 0.5, -0.5);
    digger.rotation.y = Math.sin(t / 1400) * 0.25 + 0.35;
    const sw = Math.sin(s.swing * Math.PI);
    pickPivot.rotation.x = -1.9 + sw * 2.3;
    digger.scale.set(1 + sw * 0.03, 1 - sw * 0.04, 1 + sw * 0.03);
    digger.userData.suit.color.set(s.skinColor);
    digger.userData.suit.emissive.set(s.frenzy ? 0xff5a00 : 0x000000); digger.userData.suit.emissiveIntensity = s.frenzy ? 0.5 + Math.sin(t / 60) * 0.3 : 0;
    stars.visible = s.stun > 0; stars.rotation.y = t / 200;
    const flicker = 1 + Math.sin(t / 90) * 0.06 + Math.sin(t / 37) * 0.04;
    lantern.intensity = 7 * flicker; lanternGlow.material.opacity = 0.5 * flicker;
    // Surface prison and guard; the searchlight floods the shaft while he patrols.
    prisonTop.visible = s.depth < ABOVE + 2;
    const gx = s.guard === "idle" ? -6 : s.guard === "warn" ? -6 + (1 - s.guardT / 2) * 5 : Math.sin(t / 500) * 1.2;
    guard.position.x = gx; guard.rotation.y = s.guard === "patrol" ? Math.sin(t / 500) : Math.PI / 2;
    const patrol = s.guard === "patrol";
    searchLight.intensity = THREE.MathUtils.lerp(searchLight.intensity, patrol ? 60 : 0, 0.15);
    searchLight.position.set(0, y + 8, -0.5); searchLight.target.position.set(0, y, -0.5);
    beam.position.set(0, y + 5, -0.5); beam.material.opacity = THREE.MathUtils.lerp(beam.material.opacity, patrol ? 0.07 : s.guard === "warn" ? 0.02 : 0, 0.15);
    // Debris and sparks.
    for (const p of particles) {
      if (p.life <= 0) continue;
      p.life -= dt; p.v.y -= 14 * dt; p.m.position.addScaledVector(p.v, dt);
      p.m.rotation.x += p.w.x * dt; p.m.rotation.y += p.w.y * dt;
      if (p.m.position.y < y + 0.55 && p.v.y < 0 && Math.abs(p.m.position.x) < 0.5) { p.m.position.y = y + 0.55; p.v.y *= -0.3; p.v.x *= 0.6; p.v.z *= 0.6; }
      if (p.life <= 0) p.m.visible = false;
    }
    for (const k of sparks) { if (k.life <= 0) continue; k.life -= dt; k.v.y -= 9 * dt; k.m.position.addScaledVector(k.v, dt); k.m.material.opacity = k.life / 0.45; if (k.life <= 0) k.m.visible = false; }
    dust.tick(dt, 0, camY + 0.8, -0.5); dust.material.color.set(s.rush ? 0xffd23f : 0xffd9a0); dust.material.opacity = s.rush ? 0.9 : 0.4;
    // Camera eases down the shaft with a slow handheld drift; shakes on big hits; widens in Frenzy.
    camY = THREE.MathUtils.lerp(camY, y, 1 - Math.pow(0.001, dt));
    shake = Math.max(0, shake - dt); const sh = (s.shake > 0 ? s.shake : 0) + shake;
    camera.position.set(1.8 + Math.sin(t / 2100) * 0.08 + (Math.random() - .5) * sh, camY + 2.6 + Math.sin(t / 1700) * 0.05 + (Math.random() - .5) * sh, 6.2);
    camera.lookAt(0, camY + 0.7, -1);
    const fov = s.frenzy ? 48 : 42; if (Math.abs(camera.fov - fov) > 0.1) { camera.fov += (fov - camera.fov) * 0.1; camera.updateProjectionMatrix(); }
    key.follow(0, camY, -1);
    scene.fog.color.set(s.layerColor(s.depth)).multiplyScalar(0.18); scene.background.copy(scene.fog.color);
    stage.render(t);
  },
};

window.Scene3D = Scene3D;
window.dispatchEvent(new Event("scene3d-ready"));
