// Hollow Pine — procedural characters. A jointed human (with growth stages and full customization),
// enemy/boss kits built from the same body, a wolf, and a straw dummy, plus pose-blended animation.
import { THREE, makePBR, glowSprite, mats } from "../shared/realism.js";
import { LOOKS, STAGES } from "./data.js";

// ---------- materials ----------
const cache = new Map();
let fabricTex;
function fabricMaps() {
  if (!fabricTex) {
    const t = makePBR({ type: "fabric", scale: 4, size: 128, normal: 1.6, rough: [0.8, 1], seed: 21 });
    fabricTex = { normalMap: t.normalMap.clone(), roughnessMap: t.roughnessMap.clone() };
    for (const k in fabricTex) { fabricTex[k].repeat.set(3, 3); fabricTex[k].needsUpdate = true; }
  }
  return fabricTex;
}
function cached(key, make, unique) { if (unique) return make(); if (!cache.has(key)) cache.set(key, make()); return cache.get(key); }
const M = {
  cloth: (c, u) => cached("c" + c, () => { const f = fabricMaps(); const m = new THREE.MeshStandardMaterial({ color: c, roughness: 1, normalMap: f.normalMap, roughnessMap: f.roughnessMap }); m.normalScale.set(0.6, 0.6); return m; }, u),
  skin: (c, u) => cached("s" + c, () => mats.skin(c, { roughness: 0.58, sheen: 0.35 }), u),
  hair: (c, u) => cached("h" + c, () => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.5, sheen: 1, sheenRoughness: 0.35, sheenColor: new THREE.Color(c).lerp(new THREE.Color("#ffffff"), 0.35) }), u),
  eye: (c, u) => cached("e" + c, () => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.05, clearcoat: 1 }), u),
  steel: (u) => cached("steel", () => mats.steel({ roughness: 0.25 }), u),
  iron: (u) => cached("iron", () => new THREE.MeshStandardMaterial({ color: 0x3a3c40, metalness: 0.85, roughness: 0.45 }), u),
  gold: (u) => cached("gold", () => mats.gold(), u),
  lacquer: (c, u) => cached("l" + c, () => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.15 }), u),
  wood: (c = "#6b4a2e", u) => cached("w" + c, () => { const t = makePBR({ type: "wood", color: c, color2: new THREE.Color(c).multiplyScalar(0.55).getStyle(), scale: 3, size: 128, seed: 5 }); return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughness: 0.75 }); }, u),
  dark: (u) => cached("dark", () => new THREE.MeshStandardMaterial({ color: 0x0c0a09, roughness: 0.6 }), u),
  glow: (c, i = 2.5, u) => cached("g" + c + i, () => mats.emissive(c, i), u),
};

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
function mesh(geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; }
function grp(parent, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); if (parent) parent.add(g); return g; }
const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 5, 14);
const sph = (r, ws = 20, hs = 14, ...a) => new THREE.SphereGeometry(r, ws, hs, ...a);
const find = (list, id) => list.find((o) => o.id === id) || list[0];

// ---------- enemy & boss kits ----------
export const KITS = {
  elder: { tunic: "#6d6a63", pants: "#3d3b37", wrap: "#c9c2b4", trim: "#3a3a3a", skin: "#d4a27e", hair: "#dcd8d0", hairStyle: "topknot", beard: "full", weapon: "staff" },
  trainee: { tunic: "#8a8578", pants: "#4a4740", wrap: "#d8d2c4", trim: "#7a1f1f", skin: "#dcae88", hair: "#1a1410", hairStyle: "short", headband: "#8e1b1b", weapon: "bokken", scale: 0.8, head: 1.12 },
  soldier: { tunic: "#6b1a1a", pants: "#2a2222", wrap: "#3a3030", trim: "#c9a44a", skin: "#c99a74", hair: "#15100d", hairStyle: "short", helmet: "kabuto", armor: "#5a1216", weapon: "sword" },
  archer: { tunic: "#5a1818", pants: "#2a2222", wrap: "#4a3a30", trim: "#c9a44a", skin: "#b8845e", hair: "#15100d", hairStyle: "short", helmet: "jingasa", weapon: "bow", quiver: true },
  bandit: { tunic: "#5a4430", pants: "#3a2e22", wrap: "#7a6a50", trim: "#2a1f16", skin: "#b07a52", hair: "#2a1a10", hairStyle: "wild", beard: "short", fur: "#6a5236", headband: "#3a2a1a", weapon: "axe", bulk: 1.15 },
  spy: { tunic: "#2a2a38", pants: "#1a1a22", wrap: "#4a4a5a", trim: "#8e5ad0", skin: "#caa080", hair: "#2a1a10", hairStyle: "short", mask: "hood", weapon: "dagger" },
  elite: { tunic: "#141418", pants: "#0e0e12", wrap: "#2a2a30", trim: "#c9a44a", skin: "#b88a66", hair: "#0e0b09", hairStyle: "short", helmet: "kabuto", crest: true, armor: "#101014", menpo: true, weapon: "glaive", bulk: 1.08 },
  shadow: { tunic: "#0b0b10", pants: "#070709", wrap: "#121218", trim: "#1a1a22", skin: "#caa080", hair: "#0b0908", hairStyle: "short", mask: "hoodmask", weapon: "bokken", eyes: "#9fd8ff" },
  doran: { tunic: "#33363c", pants: "#1f2125", wrap: "#8a8578", trim: "#7a1f1f", skin: "#d0a07a", hair: "#15100d", hairStyle: "topknot", beard: "short", scarf: "#7a1f1f", weapon: "ninjato" },
  grel: { tunic: "#4a3524", pants: "#2e241a", wrap: "#6a5a44", trim: "#2a1f16", skin: "#b07a52", hair: "#3a2210", hairStyle: "wild", beard: "full", fur: "#5a4430", weapon: "greataxe", bulk: 1.5, scale: 1.28 },
  ossa: { tunic: "#d8d2c2", pants: "#8a8272", wrap: "#efe9dc", trim: "#5a5040", skin: "#c9a07a", hair: "#e8e4dc", hairStyle: "long", beard: "full", mask: "blindfold", weapon: "staff", stoop: 0.18 },
  hask: { tunic: "#5a1414", pants: "#221818", wrap: "#3a3030", trim: "#c9a44a", skin: "#c08e68", hair: "#15100d", hairStyle: "short", beard: "short", helmet: "kabuto", crest: true, armor: "#3a3c42", weapon: "sword", shield: true, bell: true, bulk: 1.25, scale: 1.12 },
  varek: { tunic: "#3a1a52", pants: "#1e1030", wrap: "#c9a44a", trim: "#e0c068", skin: "#d8b08c", hair: "#6a6a6a", hairStyle: "long", beard: "short", robe: true, chain: true, crown: true, weapon: "rapier" },
};

// ---------- weapons (built pointing down -y from the grip) ----------
function blade(len, bladeMat, opts = {}) {
  const g = new THREE.Group();
  const w = opts.width || 0.034;
  g.add(mesh(new THREE.BoxGeometry(0.012, len, w), bladeMat, 0, -len / 2 - 0.02, 0));
  const tip = mesh(new THREE.ConeGeometry(w * 0.72, 0.09, 4), bladeMat, 0, -len - 0.065, 0); tip.rotation.set(Math.PI, Math.PI / 4, 0); tip.scale.set(0.25, 1, 1); g.add(tip);
  g.add(mesh(new THREE.CylinderGeometry(opts.guard || 0.042, opts.guard || 0.042, 0.012, 16), opts.guardMat || M.iron(), 0, -0.02, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.017, 0.019, opts.grip || 0.17, 10), M.cloth(opts.wrap || "#1a1414"), 0, 0.07, 0));
  return g;
}
function makeWeapon(kind, look) {
  const g = new THREE.Group();
  if (kind === "player") {
    const b = find(LOOKS.blade, look.blade);
    const mat = b.glow ? new THREE.MeshStandardMaterial({ color: b.glow, emissive: b.glow, emissiveIntensity: 2.2, metalness: 0.6, roughness: 0.2 }) : M.steel();
    g.add(blade(b.len, mat, { guardMat: b.id === "doran" || b.id === "jade" ? M.gold() : M.iron(), wrap: b.id === "doran" ? "#5a1414" : "#1a1414" }));
    g.rotation.x = -0.9; g.userData.len = b.len;
  } else if (kind === "sword" || kind === "ninjato") { g.add(blade(kind === "sword" ? 0.72 : 0.78, M.steel())); g.rotation.x = -0.9; }
  else if (kind === "dagger") { g.add(blade(0.26, M.steel())); g.rotation.x = -0.9; }
  else if (kind === "rapier") { g.add(blade(0.95, M.steel(), { width: 0.018, guard: 0.055, guardMat: M.gold() })); g.rotation.x = -0.9; }
  else if (kind === "bokken") { const wd = M.wood("#8a6a44"); g.add(mesh(new THREE.BoxGeometry(0.03, 0.8, 0.04), wd, 0, -0.35, 0)); g.rotation.x = -0.9; }
  else if (kind === "staff") { g.add(mesh(new THREE.CylinderGeometry(0.022, 0.026, 1.7, 8), M.wood("#5a3e26"), 0, -0.1, 0)); g.rotation.x = -0.25; }
  else if (kind === "glaive") {
    g.add(mesh(new THREE.CylinderGeometry(0.02, 0.022, 1.8, 8), M.lacquer("#1a1010"), 0, -0.3, 0));
    const bl = mesh(new THREE.BoxGeometry(0.012, 0.42, 0.06), M.steel(), 0, -1.38, 0.02); bl.rotation.x = 0.15; g.add(bl);
    g.rotation.x = -1.1;
  } else if (kind === "axe" || kind === "greataxe") {
    const s = kind === "greataxe" ? 1.6 : 1;
    g.add(mesh(new THREE.CylinderGeometry(0.022 * s, 0.026 * s, 0.75 * s, 8), M.wood("#4a3220"), 0, -0.3 * s, 0));
    const head = mesh(new THREE.CylinderGeometry(0.2 * s, 0.2 * s, 0.025 * s, 20, 1, false, 0, Math.PI * 0.8), M.iron(), 0, -0.6 * s, 0.05 * s);
    head.rotation.set(Math.PI / 2, 0, Math.PI / 2 + 0.2); g.add(head);
    g.rotation.x = -0.7;
  }
  return g;
}

// ---------- the human ----------
/**
 * makeHuman({ look, kit, stage, unique }) — look (player customization) or kit (enemy/boss preset).
 * Returns { root, J (joints), kind:"human", setOpacity(a) }.
 */
export function makeHuman({ look = null, kit = null, stage = 3, unique = false } = {}) {
  const K = kit ? KITS[kit] : null;
  const st = STAGES[stage] || STAGES[3];
  let skin, hairC, hairStyle, eyesC, tunic, pants, wrap, trim, mask, scarfC, scarfLong, scar, beard;
  if (look) {
    skin = find(LOOKS.skin, look.skin).c; hairC = find(LOOKS.hairColor, look.hairColor).c; hairStyle = look.hairStyle; eyesC = find(LOOKS.eyes, look.eyes).c;
    const o = find(LOOKS.outfit, look.outfit); ({ tunic, pants, wrap, trim } = o);
    mask = look.mask; const sc = find(LOOKS.scarf, look.scarf); scarfC = sc.c; scarfLong = sc.long; scar = look.scar;
    beard = stage >= 2 ? look.beard : stage === 1 && look.beard === "stubble" ? "stubble" : "none";
  } else {
    ({ skin, tunic, pants, wrap, trim, hairStyle } = K); hairC = K.hair; eyesC = K.eyes || "#2a1a10"; mask = K.mask || "none"; scarfC = K.scarf; beard = K.beard || "none"; scar = "none";
  }
  const bulk = look ? st.bulk : K.bulk || 1;
  const headS = look ? st.head : K.head || 1;
  const u = unique;
  const mTunic = M.cloth(tunic, u), mPants = M.cloth(pants, u), mWrap = M.cloth(wrap, u), mTrim = M.cloth(trim, u), mSkin = M.skin(skin, u);
  const mHair = M.hair(hairC, u);

  const root = new THREE.Group();
  const body = grp(root, 0, 0.55, 0); // pivot for rolls and falls
  const inner = grp(body, 0, -0.55, 0);
  const hips = grp(inner, 0, 0.97, 0);
  const J = { root, body, hips };
  // pelvis + skirt of the tunic
  hips.add(mesh(sph(0.16), mPants)).scale.set(1, 1, 1);
  hips.children[0].scale.set(1.08 * bulk, 0.72, 0.82 * bulk);
  const skirtLen = K && K.robe ? 0.95 : 0.36;
  const skirt = mesh(new THREE.CylinderGeometry(0.19 * bulk, (K && K.robe ? 0.36 : 0.26) * bulk, skirtLen, 18, 1, true), mTunic, 0, -skirtLen / 2 + 0.06, 0);
  skirt.material = mTunic; skirt.material.side = THREE.DoubleSide; hips.add(skirt);
  if (K && K.robe) { const hem = mesh(new THREE.TorusGeometry(0.36 * bulk, 0.018, 6, 28), M.gold(u), 0, -skirtLen + 0.06, 0); hem.rotation.x = Math.PI / 2; hips.add(hem); }
  const sash = mesh(new THREE.TorusGeometry(0.175 * bulk, 0.035, 8, 24), mTrim, 0, 0.06, 0); sash.rotation.x = Math.PI / 2; sash.scale.set(1.05, 0.85, 1); hips.add(sash);
  const knot = mesh(sph(0.04, 10, 8), mTrim, -0.1 * bulk, 0.05, 0.13 * bulk); hips.add(knot);

  const spine = grp(hips, 0, 0.06, 0); J.spine = spine;
  const torso = mesh(cap(0.15, 0.24), mTunic, 0, 0.21, 0); torso.scale.set(1.28 * bulk, 1, 0.84 * bulk); spine.add(torso);
  // lapels: a trim V across the chest
  for (const s of [-1, 1]) { const l = mesh(new THREE.BoxGeometry(0.05, 0.3, 0.02), mTrim, s * 0.055 * bulk, 0.27, 0.125 * bulk); l.rotation.z = s * 0.45; l.rotation.x = -0.12; spine.add(l); }
  const chest = grp(spine, 0, 0.36, 0); J.chest = chest;
  if (K && K.armor) {
    const am = M.lacquer(K.armor, u);
    const plate = mesh(new THREE.RoundedBoxGeometry(0.4 * bulk, 0.34, 0.28 * bulk, 3, 0.06), am, 0, -0.15, 0.01); chest.add(plate);
    for (let i = 0; i < 3; i++) chest.add(mesh(new THREE.BoxGeometry(0.41 * bulk, 0.012, 0.29 * bulk), M.gold(u), 0, -0.26 + i * 0.1, 0.012));
    for (const s of [-1, 1]) { const p = mesh(new THREE.RoundedBoxGeometry(0.17, 0.05, 0.22, 2, 0.02), am, s * 0.25 * bulk, 0.0, 0); p.rotation.z = s * -0.45; chest.add(p); }
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; const k = mesh(new THREE.BoxGeometry(0.16, 0.2, 0.02), am, Math.sin(a) * 0.2 * bulk, -0.1, Math.cos(a) * 0.2 * bulk); k.rotation.y = a; k.rotation.x = 0.12; hips.add(k); }
  }
  if (K && K.fur) { const f = mesh(new THREE.TorusGeometry(0.2 * bulk, 0.08, 8, 20), M.cloth(K.fur, u), 0, 0.0, 0); f.rotation.x = Math.PI / 2; f.scale.set(1, 0.8, 1); chest.add(f); }
  if (K && K.chain) { const c = mesh(new THREE.TorusGeometry(0.13 * bulk, 0.012, 6, 24, Math.PI), M.gold(u), 0, -0.02, 0.07); c.rotation.set(Math.PI * 0.6, 0, Math.PI); chest.add(c); chest.add(mesh(sph(0.03, 12, 8), M.gold(u), 0, -0.14, 0.14)); }
  if (K && K.robe) { const col = mesh(new THREE.CylinderGeometry(0.15, 0.23 * bulk, 0.12, 18, 1, true), M.cloth(K.wrap, u), 0, 0.02, 0); col.material.side = THREE.DoubleSide; chest.add(col); }
  if (K && K.bell) hips.add(mesh(sph(0.055, 14, 10), M.gold(u), 0.16 * bulk, 0.02, 0.1));
  if (K && K.quiver) { const q = mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.5, 10), M.cloth("#4a3220", u), 0.08, -0.1, -0.16); q.rotation.z = 0.4; chest.add(q); for (let i = 0; i < 3; i++) { const a = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.2, 4), M.cloth("#dcd6c8", u), 0.16 + i * 0.015, 0.14, -0.16 + (i - 1) * 0.015); a.rotation.z = 0.4; chest.add(a); } }

  // neck + head
  const neck = grp(chest, 0, 0.1, 0); J.neck = neck;
  neck.add(mesh(cap(0.05, 0.05), mSkin, 0, 0.03, 0));
  const head = grp(neck, 0, 0.1, 0); J.head = head; head.scale.setScalar(headS);
  const shape = grp(head, 0, 0.1, 0); shape.scale.set(0.9, 1.08, 1);
  shape.add(mesh(sph(0.12, 28, 20), mSkin));
  // jaw for adults: a slightly squarer lower face
  if (!look || stage >= 2) { const jaw = mesh(sph(0.095, 16, 10), mSkin, 0, -0.045, 0.02); jaw.scale.set(1.05, 0.8, 1); shape.add(jaw); }
  const eyeM = M.eye(K && K.eyes ? K.eyes : eyesC, u);
  for (const s of [-1, 1]) {
    if (K && K.eyes) { const e = glowSprite(K.eyes, 0.09, 0.9); e.position.set(s * 0.04, 0.012, 0.115); shape.add(e); }
    const white = mesh(sph(0.021, 12, 8), M.skin("#f4efe8", u), s * 0.042, 0.01, 0.099); white.scale.set(1, 0.7, 0.5); shape.add(white);
    const e = mesh(sph(0.014, 12, 8), eyeM, s * 0.042, 0.01, 0.108); e.scale.set(1, 1, 0.5); shape.add(e);
    const brow = mesh(new THREE.BoxGeometry(0.046, 0.011, 0.02), mHair, s * 0.043, 0.042, 0.103); brow.rotation.z = s * -0.12; shape.add(brow);
    shape.add(mesh(sph(0.026, 10, 8), mSkin, s * 0.117, 0.0, -0.005));
  }
  const nose = mesh(sph(0.022, 10, 8), mSkin, 0, -0.018, 0.118); nose.scale.set(0.8, 1.2, 0.9); shape.add(nose);
  shape.add(mesh(new THREE.BoxGeometry(0.04, 0.007, 0.01), M.skin(new THREE.Color(skin).multiplyScalar(0.6).getStyle(), u), 0, -0.058, 0.108));
  if (scar === "eye") { const s = mesh(new THREE.BoxGeometry(0.008, 0.08, 0.01), M.skin("#b0605a", u), 0.045, 0.01, 0.113); s.rotation.z = 0.2; shape.add(s); }
  if (scar === "cheek") { const s = mesh(new THREE.BoxGeometry(0.06, 0.008, 0.01), M.skin("#b0605a", u), -0.06, -0.03, 0.098); s.rotation.set(0, -0.5, 0.35); shape.add(s); }
  buildHair(shape, hairStyle, mHair, M, skin, hairC, u);
  if (beard && beard !== "none") {
    const bm = beard === "stubble" ? M.hair(new THREE.Color(hairC).lerp(new THREE.Color(skin), 0.55).getStyle(), u) : mHair;
    const b = mesh(sph(0.124, 20, 12, Math.PI / 2 - 1.35, 2.7, Math.PI * 0.56, Math.PI * (beard === "full" ? 0.36 : 0.3)), bm); b.material.side = THREE.DoubleSide; shape.add(b);
    if (beard === "full") shape.add(mesh(sph(0.05, 12, 8), bm, 0, -0.13, 0.06));
    if (beard !== "stubble") { const mu = mesh(new THREE.BoxGeometry(0.07, 0.014, 0.02), bm, 0, -0.045, 0.112); shape.add(mu); }
  }
  if (K && K.headband) { const hb = mesh(new THREE.CylinderGeometry(0.127, 0.127, 0.03, 24, 1, true), M.cloth(K.headband, u), 0, 0.06, 0); hb.material.side = THREE.DoubleSide; shape.add(hb); }
  buildMask(shape, neck, mask, trim, tunic, M, u);
  if (K && K.helmet === "kabuto") {
    const hm = M.lacquer(K.armor || "#3a3c42", u);
    const h = mesh(sph(0.145, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), hm, 0, 0.02, 0); shape.add(h);
    const guard = mesh(new THREE.CylinderGeometry(0.15, 0.22, 0.1, 22, 1, true, Math.PI * 0.55, Math.PI * 0.9), hm, 0, -0.02, 0); guard.material.side = THREE.DoubleSide; shape.add(guard);
    shape.add(mesh(new THREE.TorusGeometry(0.146, 0.012, 6, 24), M.gold(u), 0, 0.02, 0)).rotation.x = Math.PI / 2;
    if (K.crest) { const c = mesh(new THREE.TorusGeometry(0.12, 0.012, 6, 20, Math.PI * 0.9), M.gold(u), 0, 0.2, 0.08); c.rotation.z = Math.PI * 0.05; shape.add(c); }
  }
  if (K && K.helmet === "jingasa") { const h = mesh(new THREE.ConeGeometry(0.3, 0.11, 22, 1, true), M.lacquer("#2a1a14", u), 0, 0.15, 0); h.material.side = THREE.DoubleSide; shape.add(h); }
  if (K && K.menpo) { const m = mesh(sph(0.125, 18, 10, Math.PI / 2 - 1.2, 2.4, Math.PI * 0.52, Math.PI * 0.3), M.lacquer("#0c0c0e", u)); m.material.side = THREE.DoubleSide; shape.add(m); }
  if (K && K.crown) { const c = mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.05, 12), M.gold(u), 0, 0.14, -0.02); shape.add(c); shape.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.24, 6), M.gold(u), 0, 0.15, -0.02)).rotation.z = Math.PI / 2; }

  // scarf: a ring and a trailing tail that sways
  J.scarf = [];
  if (scarfC) {
    const sm = M.cloth(scarfC, u);
    const ring = mesh(new THREE.TorusGeometry(0.09, 0.04, 8, 20), sm, 0, 0.06, 0); ring.rotation.x = Math.PI / 2 + 0.15; neck.add(ring);
    let parent = grp(chest, 0.05, 0.1, -0.1);
    const n = scarfLong ? 5 : 3;
    for (let i = 0; i < n; i++) {
      const seg = grp(parent, 0, i ? -0.13 : 0, 0);
      seg.add(mesh(new THREE.BoxGeometry(0.075, 0.14, 0.012), sm, 0, -0.065, 0));
      J.scarf.push(seg); parent = seg;
    }
  }

  // arms (x+ is the character's left: it faces +z)
  const mkArm = (s) => {
    const sh = grp(chest, s * 0.225 * bulk, 0.02, 0);
    sh.add(mesh(sph(0.07 * bulk, 14, 10), mTunic));
    const up = mesh(cap(0.056 * bulk, 0.19), mTunic, 0, -0.14, 0); sh.add(up);
    const el = grp(sh, 0, -0.29, 0);
    el.add(mesh(cap(0.048 * bulk, 0.17), mWrap, 0, -0.12, 0));
    const hand = grp(el, 0, -0.27, 0);
    const hm = mesh(sph(0.05, 12, 10), mSkin, 0, -0.025, 0.005); hm.scale.set(0.75, 1.1, 0.65); hand.add(hm);
    return { sh, el, hand };
  };
  const aL = mkArm(1), aR = mkArm(-1);
  Object.assign(J, { shL: aL.sh, elL: aL.el, handL: aL.hand, shR: aR.sh, elR: aR.el, handR: aR.hand });
  // legs
  const mkLeg = (s) => {
    const hp = grp(hips, s * 0.095 * bulk, -0.04, 0);
    hp.add(mesh(cap(0.074 * bulk, 0.28), mPants, 0, -0.2, 0));
    const kn = grp(hp, 0, -0.44, 0);
    kn.add(mesh(cap(0.058 * bulk, 0.28), mWrap, 0, -0.2, 0));
    const foot = mesh(new THREE.RoundedBoxGeometry(0.1, 0.07, 0.22, 2, 0.03), M.cloth("#1b1714", u), 0, -0.44, 0.045); kn.add(foot);
    return { hp, kn };
  };
  const lL = mkLeg(1), lR = mkLeg(-1);
  Object.assign(J, { hipL: lL.hp, knL: lL.kn, hipR: lR.hp, knR: lR.kn });

  // weapons
  const wk = look ? "player" : K.weapon;
  if (wk === "bow") {
    const bow = new THREE.Group();
    const arc = mesh(new THREE.TorusGeometry(0.55, 0.014, 6, 24, Math.PI * 0.85), M.lacquer("#2a1a12", u)); arc.rotation.z = Math.PI / 2 + Math.PI * 0.075 - Math.PI; bow.add(arc);
    const str = mesh(new THREE.CylinderGeometry(0.002, 0.002, 1.0, 3), M.cloth("#e8e2d0", u), 0.12, 0, 0); bow.add(str);
    bow.rotation.set(0, Math.PI / 2, 0); bow.position.set(0, -0.04, 0); aL.hand.add(bow);
  } else {
    const w = makeWeapon(wk, look); aR.hand.add(w); J.weapon = w;
  }
  if (K && K.shield) {
    const sh = new THREE.Group();
    sh.add(mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.05, 28), M.lacquer("#3a3c42", u)));
    const rim = mesh(new THREE.TorusGeometry(0.36, 0.02, 6, 28), M.gold(u)); rim.rotation.x = Math.PI / 2; sh.add(rim);
    sh.add(mesh(sph(0.08, 14, 10), M.gold(u), 0, 0.03, 0));
    sh.rotation.set(Math.PI / 2, 0, 0); sh.position.set(0.06, -0.12, 0.05); sh.rotation.z = Math.PI / 2;
    aL.el.add(sh); J.shield = sh;
  }

  const scale = look ? st.scale : K.scale || 1;
  root.scale.setScalar(scale);
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const h = { kind: "human", root, J, scale, stoop: K ? K.stoop || 0 : 0, ph: Math.random() * 6, cur: {}, kit, height: 1.75 * scale * (0.9 + 0.1 * headS) };
  h.setOpacity = (a) => root.traverse((o) => { if (o.material && !o.isSprite) { o.material.transparent = a < 1; o.material.opacity = a; o.material.depthWrite = a >= 1; } });
  return h;
}

function buildHair(shape, style, m, M, skin, hairC, u) {
  if (style === "shaved") {
    const c = mesh(sph(0.1215, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.46), M.hair(new THREE.Color(hairC).lerp(new THREE.Color(skin), 0.6).getStyle(), u)); c.rotation.x = -0.45; shape.add(c); return;
  }
  const capM = mesh(sph(0.128, 26, 14, 0, Math.PI * 2, 0, Math.PI * 0.52), m); capM.rotation.x = -0.46; capM.position.y = 0.006; shape.add(capM);
  // fringe so the hairline isn't a hard shell edge
  for (let i = -2; i <= 2; i++) { const f = mesh(sph(0.03, 8, 6), m, i * 0.026, 0.07 - Math.abs(i) * 0.006, 0.104 - Math.abs(i) * 0.008); f.scale.set(1.2, 0.6, 0.6); shape.add(f); }
  if (style === "topknot") { shape.add(mesh(sph(0.05, 14, 10), m, 0, 0.14, -0.06)); shape.add(mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.03, 10), M.cloth("#7a1f1f", u), 0, 0.11, -0.05)); }
  if (style === "long") { const t = mesh(cap(0.042, 0.26), m, 0, -0.07, -0.13); t.rotation.x = 0.28; shape.add(t); shape.add(mesh(sph(0.045, 10, 8), m, 0, 0.06, -0.12)); }
  if (style === "braid") for (let i = 0; i < 6; i++) shape.add(mesh(sph(0.036 - i * 0.003, 10, 8), m, 0, 0.04 - i * 0.055, -0.125 - i * 0.012));
  if (style === "wild") for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2, sp = mesh(new THREE.ConeGeometry(0.032, 0.11, 6), m, Math.sin(a) * 0.09, 0.09 + (i % 3) * 0.012, Math.cos(a) * 0.08 - 0.02);
    sp.rotation.set(Math.cos(a) * 0.9 - 0.3, 0, -Math.sin(a) * 0.9); shape.add(sp);
  }
}

function buildMask(shape, neck, mask, trim, tunic, M, u) {
  const cloth = M.cloth(new THREE.Color(tunic).multiplyScalar(0.8).getStyle(), u);
  if (mask === "half" || mask === "hoodmask") {
    const m = mesh(new THREE.CylinderGeometry(0.127, 0.115, 0.1, 22, 1, true, -1.75, 3.5), cloth, 0, -0.045, 0); m.material.side = THREE.DoubleSide; shape.add(m);
  }
  if (mask === "hood" || mask === "hoodmask") {
    const h = mesh(sph(0.152, 24, 14, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, 0, Math.PI * 0.74), cloth, 0, 0.012, -0.004); h.material.side = THREE.DoubleSide; shape.add(h);
    const drape = mesh(new THREE.CylinderGeometry(0.13, 0.25, 0.18, 18, 1, true), cloth, 0, -0.02, -0.01); drape.material.side = THREE.DoubleSide; neck.add(drape);
  }
  if (mask === "blindfold") {
    const b = mesh(new THREE.CylinderGeometry(0.128, 0.128, 0.034, 24, 1, true), M.cloth("#e9e4d6", u), 0, 0.012, 0); b.material.side = THREE.DoubleSide; shape.add(b);
    for (const s of [-1, 1]) { const t = mesh(new THREE.BoxGeometry(0.025, 0.14, 0.006), M.cloth("#e9e4d6", u), s * 0.02, -0.05, -0.13); t.rotation.set(0.25, 0, s * 0.15); shape.add(t); }
  }
  if (mask === "oni" || mask === "fox") {
    const oni = mask === "oni";
    const face = mesh(sph(0.132, 22, 14, Math.PI / 2 - 1.05, 2.1, Math.PI * 0.18, Math.PI * 0.62), M.lacquer(oni ? "#9e1414" : "#f2eee6", u)); face.material.side = THREE.DoubleSide; shape.add(face);
    for (const s of [-1, 1]) {
      const eye = mesh(sph(0.022, 10, 8), M.dark(u), s * 0.043, 0.012, 0.122); eye.scale.set(1.3, 0.6, 0.4); shape.add(eye);
      if (oni) { const horn = mesh(new THREE.ConeGeometry(0.02, 0.1, 10), M.lacquer("#efe6d0", u), s * 0.06, 0.13, 0.07); horn.rotation.z = s * -0.35; shape.add(horn); const br = mesh(new THREE.BoxGeometry(0.05, 0.014, 0.02), M.gold(u), s * 0.045, 0.045, 0.125); br.rotation.z = s * 0.35; shape.add(br); }
      else { const ear = mesh(new THREE.ConeGeometry(0.04, 0.11, 4), M.lacquer("#f2eee6", u), s * 0.07, 0.15, 0.02); ear.rotation.z = s * -0.3; shape.add(ear); const mk = mesh(new THREE.BoxGeometry(0.012, 0.05, 0.012), M.lacquer("#c21a1a", u), s * 0.055, 0.035, 0.12); mk.rotation.z = s * 0.3; shape.add(mk); }
    }
    if (oni) for (let i = -2; i <= 2; i++) shape.add(mesh(new THREE.BoxGeometry(0.012, 0.018, 0.01), M.lacquer("#f4efe0", u), i * 0.015, -0.06, 0.124));
    else { const sn = mesh(new THREE.ConeGeometry(0.035, 0.08, 10), M.lacquer("#f2eee6", u), 0, -0.035, 0.14); sn.rotation.x = Math.PI / 2; shape.add(sn); }
  }
}

// ---------- wolf ----------
export function makeWolf() {
  const fur = M.cloth("#6b6660"), furD = M.cloth("#3a3632"), furL = M.cloth("#b8b0a4");
  const root = new THREE.Group(), body = grp(root, 0, 0.55, 0), inner = grp(body, 0, 0, 0);
  const torso = mesh(cap(0.19, 0.55), fur); torso.rotation.x = Math.PI / 2; torso.scale.set(0.9, 1, 1.05); inner.add(torso);
  inner.add(mesh(sph(0.22, 16, 12), fur, 0, 0.03, 0.26)).scale.set(0.95, 1.05, 1);
  inner.add(mesh(sph(0.17, 14, 10), furL, 0, -0.07, 0.3)).scale.set(0.8, 0.8, 1);
  const neck = grp(inner, 0, 0.1, 0.42), head = grp(neck, 0, 0.08, 0.1);
  head.add(mesh(sph(0.13, 16, 12), fur)).scale.set(0.95, 0.9, 1.1);
  const snout = mesh(new THREE.ConeGeometry(0.075, 0.22, 12), furL, 0, -0.03, 0.17); snout.rotation.x = Math.PI / 2; head.add(snout);
  head.add(mesh(sph(0.025, 8, 6), M.dark(), 0, -0.01, 0.28));
  for (const s of [-1, 1]) {
    const ear = mesh(new THREE.ConeGeometry(0.045, 0.12, 6), furD, s * 0.07, 0.12, -0.02); ear.rotation.z = s * -0.25; head.add(ear);
    const e = glowSprite(0xffc04a, 0.08, 0.9); e.position.set(s * 0.055, 0.035, 0.1); head.add(e);
  }
  const tailG = grp(inner, 0, 0.08, -0.4); const tail = mesh(cap(0.05, 0.3), furD, 0, -0.16, -0.05); tail.rotation.x = 0.5; tailG.add(tail); tailG.rotation.x = -0.9;
  const legs = [];
  for (const [x, z] of [[0.11, 0.26], [-0.11, 0.26], [0.11, -0.28], [-0.11, -0.28]]) {
    const hp = grp(inner, x, -0.05, z); hp.add(mesh(cap(0.05, 0.2), fur, 0, -0.14, 0));
    const kn = grp(hp, 0, -0.27, 0); kn.add(mesh(cap(0.035, 0.18), furD, 0, -0.12, 0));
    legs.push({ hp, kn });
  }
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { kind: "wolf", root, J: { body, head, neck, tailG, legs }, scale: 1, ph: Math.random() * 6, cur: {}, height: 0.9 };
}

// ---------- straw dummy ----------
export function makeDummy() {
  const root = new THREE.Group(), body = grp(root, 0, 0, 0);
  const wood = M.wood("#6b4a2e"), straw = M.cloth("#c9a860"), rope = M.cloth("#6a4a2a");
  body.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.7, 8), wood, 0, 0.85, 0));
  const torso = mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.62, 14), straw, 0, 1.05, 0); body.add(torso);
  for (const y of [0.85, 1.05, 1.25]) { const r = mesh(new THREE.TorusGeometry(0.19, 0.018, 6, 18), rope, 0, y, 0); r.rotation.x = Math.PI / 2; body.add(r); }
  const arm = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.95, 8), wood, 0, 1.28, 0); arm.rotation.z = Math.PI / 2; body.add(arm);
  body.add(mesh(sph(0.14, 14, 10), straw, 0, 1.52, 0));
  const face = mesh(new THREE.BoxGeometry(0.12, 0.014, 0.02), M.dark(), 0, 1.54, 0.13); body.add(face);
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { kind: "dummy", root, J: { body }, scale: 1, cur: {}, height: 1.7, wob: 0 };
}

// ---------- animation ----------
// a = { move (0..1 of run speed), speed (units/s), sneak, act, p (0..1 progress), dt, t }
const ease = (x) => x * x * (3 - 2 * x);
function keys(p, list) { // piecewise-linear pose keyframes: [[t, {k:v}], ...]
  let a = list[0], b = list[list.length - 1];
  for (let i = 0; i < list.length - 1; i++) if (p >= list[i][0] && p <= list[i + 1][0]) { a = list[i]; b = list[i + 1]; break; }
  const f = b[0] > a[0] ? ease(Math.min(1, Math.max(0, (p - a[0]) / (b[0] - a[0])))) : 1, out = {};
  for (const k in a[1]) out[k] = a[1][k] + ((b[1][k] ?? a[1][k]) - a[1][k]) * f;
  for (const k in b[1]) if (!(k in out)) out[k] = b[1][k];
  return out;
}
const ACTS = {
  slash1: [[0, { shR_rx: -1.25, shR_rz: -1.1, elR_rx: -0.7, sp_ry: -0.55, ch_ry: -0.3, shL_rx: -0.4, shL_rz: 0.3 }], [0.3, { shR_rx: -1.5, shR_rz: -0.1, elR_rx: -0.15, sp_ry: 0.3, ch_ry: 0.35 }], [0.6, { shR_rx: -1.3, shR_rz: 0.75, elR_rx: -0.3, sp_ry: 0.6, ch_ry: 0.55 }], [1, { shR_rx: -0.7, shR_rz: 0.3, elR_rx: -0.5, sp_ry: 0.2, ch_ry: 0.1 }]],
  slash2: [[0, { shR_rx: -1.3, shR_rz: 0.8, elR_rx: -0.9, sp_ry: 0.55, ch_ry: 0.3, shL_rx: -0.3, shL_rz: 0.5 }], [0.3, { shR_rx: -1.55, shR_rz: 0, elR_rx: -0.1, sp_ry: -0.2, ch_ry: -0.3 }], [0.6, { shR_rx: -1.25, shR_rz: -1.1, elR_rx: -0.25, sp_ry: -0.6, ch_ry: -0.5 }], [1, { shR_rx: -0.7, shR_rz: -0.4, elR_rx: -0.5, sp_ry: -0.2, ch_ry: 0 }]],
  slash3: [[0, { shR_rx: -2.9, shR_rz: -0.25, elR_rx: -0.7, sp_rx: -0.2, shL_rx: -2.4, shL_rz: 0.3, elL_rx: -0.6, by: 0.04 }], [0.35, { shR_rx: -0.9, shR_rz: 0, elR_rx: 0, sp_rx: 0.45, shL_rx: -1.0, elL_rx: -0.2, by: -0.14, hipR_rx: -0.7, knR_rx: 0.7, hipL_rx: 0.35, knL_rx: 0.4 }], [1, { shR_rx: -0.8, elR_rx: -0.4, sp_rx: 0.2, by: -0.05 }]],
  takedown: [[0, { shL_rx: -1.35, shL_rz: 0.2, elL_rx: -0.5, shR_rx: -2.5, elR_rx: -1.3, sp_rx: 0.1 }], [0.45, { shR_rx: -1.35, elR_rx: -0.05, sp_rx: 0.45, by: -0.16, hipR_rx: -0.6, knR_rx: 0.8 }], [1, { shR_rx: -1.0, elR_rx: -0.4, sp_rx: 0.25, by: -0.1 }]],
  throw: [[0, { shR_rx: -2.7, shR_rz: -0.3, elR_rx: -1.3, sp_ry: -0.4 }], [0.35, { shR_rx: -1.2, shR_rz: 0, elR_rx: 0, sp_ry: 0.35 }], [1, { shR_rx: -0.6, elR_rx: -0.4, sp_ry: 0 }]],
  cast: [[0, { shL_rx: -2.8, shL_rz: 0.35, shR_rx: -2.8, shR_rz: -0.35, elL_rx: -0.3, elR_rx: -0.3, sp_rx: -0.15 }], [1, { shL_rx: -2.8, shL_rz: 0.35, shR_rx: -2.8, shR_rz: -0.35, sp_rx: -0.15 }]],
  spin: [[0, { shR_rx: -0.2, shR_rz: -1.5, shL_rx: -0.2, shL_rz: 1.5, elR_rx: 0, elL_rx: 0, by: -0.12, hipL_rx: -0.4, knL_rx: 0.6, hipR_rx: -0.4, knR_rx: 0.6 }], [1, { shR_rz: -1.5, shL_rz: 1.5, by: -0.12 }]],
  windup: [[0, { shR_rx: -0.7, elR_rx: -0.4 }], [1, { shR_rx: -2.55, shR_rz: -0.4, elR_rx: -0.9, sp_ry: -0.45, sp_rx: -0.1 }]],
  strike: [[0, { shR_rx: -2.55, shR_rz: -0.4, elR_rx: -0.9, sp_ry: -0.45 }], [0.3, { shR_rx: -0.8, shR_rz: 0.45, elR_rx: -0.1, sp_ry: 0.45, sp_rx: 0.3, by: -0.08 }], [1, { shR_rx: -0.7, shR_rz: 0.2, elR_rx: -0.4, sp_ry: 0.1 }]],
  slamup: [[0, { shR_rx: -0.6, shL_rx: -0.6 }], [1, { shR_rx: -2.95, shL_rx: -2.95, shR_rz: 0.3, shL_rz: -0.3, elR_rx: -0.5, elL_rx: -0.5, sp_rx: -0.25, by: 0.05 }]],
  slamdown: [[0, { shR_rx: -2.95, shL_rx: -2.95, shR_rz: 0.3, shL_rz: -0.3, sp_rx: -0.25 }], [0.3, { shR_rx: -0.9, shL_rx: -0.9, shR_rz: 0.3, shL_rz: -0.3, elR_rx: 0, elL_rx: 0, sp_rx: 0.6, by: -0.25, hipL_rx: -0.9, knL_rx: 1.2, hipR_rx: -0.9, knR_rx: 1.2 }], [1, { shR_rx: -0.9, shL_rx: -0.9, sp_rx: 0.4, by: -0.15 }]],
  block: [[0, { shL_rx: -1.35, shL_rz: 0.25, elL_rx: -1.2, sp_rx: 0.1 }], [1, { shL_rx: -1.35, shL_rz: 0.25, elL_rx: -1.2, sp_rx: 0.1 }]],
  bow: [[0, { shL_rx: -1.5, elL_rx: 0, shR_rx: -1.4, shR_rz: 0.2, elR_rx: -0.5, sp_ry: -0.6 }], [1, { shL_rx: -1.55, elL_rx: 0, shR_rx: -1.5, shR_rz: 0.35, elR_rx: -1.9, sp_ry: -0.9 }]],
  hit: [[0, { sp_rx: -0.4, nk_rx: -0.35, shL_rx: 0.35, shR_rx: 0.35, by: 0.02 }], [1, { sp_rx: 0, nk_rx: 0, shL_rx: 0, shR_rx: -0.2 }]],
  kneel: [[0, { by: -0.46, hipL_rx: -1.55, knL_rx: 1.55, hipR_rx: 0.15, knR_rx: 1.6, sp_rx: 0.35, nk_rx: 0.4, shL_rx: -0.4, elL_rx: -0.6, shR_rx: -0.3, elR_rx: -0.4 }], [1, { by: -0.46, hipL_rx: -1.55, knL_rx: 1.55, hipR_rx: 0.15, knR_rx: 1.6, sp_rx: 0.35, nk_rx: 0.4, shL_rx: -0.4, elL_rx: -0.6, shR_rx: -0.3, elR_rx: -0.4 }]],
  sit: [[0, { by: -0.72, hipL_rx: -1.45, hipL_rz: 0.55, knL_rx: 2.3, hipR_rx: -1.45, hipR_rz: -0.55, knR_rx: 2.3, shL_rx: -0.6, elL_rx: -1.0, shR_rx: -0.6, elR_rx: -1.0, sp_rx: 0.15 }], [1, { by: -0.72, hipL_rx: -1.45, hipL_rz: 0.55, knL_rx: 2.3, hipR_rx: -1.45, hipR_rz: -0.55, knR_rx: 2.3, shL_rx: -0.6, elL_rx: -1.0, shR_rx: -0.6, elR_rx: -1.0, sp_rx: 0.15 }]],
  stun: [[0, { nk_rx: 0.5, sp_rx: 0.35, shL_rx: 0.1, shR_rx: 0.1, elR_rx: -0.1, by: -0.06 }], [1, { nk_rx: 0.5, sp_rx: 0.35, by: -0.06 }]],
  parry: [[0, { shR_rx: -1.2, shR_rz: 0.2, elR_rx: -0.8, sp_ry: 0.2 }], [0.25, { shR_rx: -1.75, shR_rz: 0.95, elR_rx: -1.35, sp_ry: -0.35, by: -0.1, shL_rx: -0.6, elL_rx: -0.9 }], [1, { shR_rx: -1.6, shR_rz: 0.8, elR_rx: -1.2, sp_ry: -0.25, by: -0.08 }]],
  charge: [[0, { sp_rx: 0.45, shL_rx: -1.3, elL_rx: -1.0, shR_rx: 0.4, elR_rx: -0.3 }], [1, { sp_rx: 0.45, shL_rx: -1.3, elL_rx: -1.0, shR_rx: 0.4 }]],
};
const JKEYS = { sp: "spine", ch: "chest", nk: "neck", shL: "shL", elL: "elL", shR: "shR", elR: "elR", hipL: "hipL", knL: "knL", hipR: "hipR", knR: "knR" };

export function animate(h, a) {
  const dt = a.dt || 0.016;
  if (h.kind === "dummy") { h.wob *= Math.exp(-dt * 4); h.J.body.rotation.z = Math.sin(a.t * 18) * h.wob * 0.25; h.J.body.rotation.x = Math.cos(a.t * 14) * h.wob * 0.12; if (a.act === "dead") { h.J.body.rotation.x = -Math.min(1.4, (a.p || 0) * 2); } return; }
  if (h.kind === "wolf") return animWolf(h, a, dt);
  const J = h.J, T = {};
  const m = a.move || 0;
  // locomotion phase
  const stride = 1.45 * h.scale;
  h.ph += (a.speed || 0) * dt * (Math.PI * 2 / stride) * 0.5;
  const s = Math.sin(h.ph), c = Math.cos(h.ph);
  const sn = a.sneak ? 1 : 0;
  const breath = Math.sin(a.t * 2.2) * 0.02;
  // base: idle + run + sneak
  T.by = Math.abs(s) * 0.05 * m - sn * 0.2 + breath * 0.2;
  T.sp_rx = 0.14 * m + sn * 0.35 + h.stoop; T.sp_ry = 0; T.ch_ry = 0; T.nk_rx = -sn * 0.25 - h.stoop * 0.6 + breath * 0.3;
  const A = a.sneak ? 0.45 : 0.8;
  T.hipL_rx = -s * A * m - sn * 0.55; T.hipR_rx = s * A * m - sn * 0.55; T.hipL_rz = 0; T.hipR_rz = 0;
  T.knL_rx = 0.08 + Math.max(0, c) * 1.25 * m + sn * 0.95; T.knR_rx = 0.08 + Math.max(0, -c) * 1.25 * m + sn * 0.95;
  T.shL_rx = s * 0.6 * m - sn * 0.3; T.shR_rx = -s * 0.6 * m - sn * 0.5 - (1 - m) * 0.12; T.shL_rz = 0.1; T.shR_rz = -0.1;
  T.elL_rx = -0.3 - 0.6 * m - sn * 0.7; T.elR_rx = -0.35 - 0.6 * m - sn * 0.5;
  let rate = 12;
  if (a.act && ACTS[a.act]) { Object.assign(T, keys(a.p || 0, ACTS[a.act])); rate = 30; }
  if (a.act === "roll") {
    const p = a.p || 0;
    Object.assign(T, { hipL_rx: -1.5, hipR_rx: -1.5, knL_rx: 2.0, knR_rx: 2.0, sp_rx: 0.9, nk_rx: 0.5, shL_rx: -1.1, shR_rx: -1.1, elL_rx: -1.6, elR_rx: -1.6, by: -0.25 * Math.sin(p * Math.PI) });
    J.body.rotation.x = p * Math.PI * 2; rate = 40;
  } else if (a.act === "dead") {
    const p = ease(Math.min(1, a.p || 0));
    J.body.rotation.x = -1.45 * p; T.by = -0.44 * p; Object.assign(T, { shL_rz: 1.1, shR_rz: -1.1, hipL_rx: -0.2, knL_rx: 0.3, nk_rx: -0.3 });
  } else J.body.rotation.x *= Math.exp(-dt * 20);
  // apply with smoothing
  const k = 1 - Math.exp(-dt * rate);
  for (const key in T) {
    const cur = h.cur[key] ?? T[key];
    const v = cur + (T[key] - cur) * k; h.cur[key] = v;
    if (key === "by") { J.body.position.y = 0.55 + v; continue; }
    const [j, ax] = key.split("_"), node = J[JKEYS[j]];
    if (node) node.rotation[ax[1]] = v;
  }
  // scarf sway
  J.scarf.forEach((seg, i) => { seg.rotation.x = 0.35 + m * 0.9 + Math.sin(a.t * 6 + i) * (0.08 + m * 0.18); seg.rotation.z = Math.sin(a.t * 3.1 + i * 0.7) * 0.12; });
}

function animWolf(h, a, dt) {
  const J = h.J, m = a.move || 0;
  h.ph += (a.speed || 0) * dt * 3.2;
  const s = Math.sin(h.ph), c = Math.cos(h.ph);
  J.body.position.y = 0.55 + Math.abs(s) * 0.07 * m;
  J.body.rotation.x = s * 0.08 * m;
  J.legs.forEach((l, i) => { const off = i < 2 ? 0 : Math.PI; const ph = h.ph + off + (i % 2) * 0.4; l.hp.rotation.x = Math.sin(ph) * 0.8 * m; l.kn.rotation.x = (i < 2 ? -1 : 1) * Math.max(0, Math.cos(ph)) * 0.8 * m; });
  J.tailG.rotation.x = -0.9 + Math.sin(a.t * 5) * 0.1 + m * 0.4;
  J.neck.rotation.x = a.act === "windup" ? 0.35 : a.act === "strike" ? -0.2 : 0.05 * m;
  if (a.act === "dead") { const p = Math.min(1, a.p || 0); J.body.rotation.z = 1.4 * p; J.body.position.y = 0.55 - 0.33 * p; }
  else J.body.rotation.z = a.act === "hit" ? 0.2 : 0;
  if (a.act === "strike") J.body.position.y += 0.15 * Math.sin(Math.min(1, a.p || 0) * Math.PI);
}
