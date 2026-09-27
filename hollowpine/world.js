// Hollow Pine — the world renderer: themed environments (sky, fog, light, ground, weather),
// procedural props, particles (fire, smoke, sparks, petals), attack telegraphs, markers and the camera.
import { THREE, createStage, keyLight, pbrMaterial, makePBR, glowSprite, glowTexture } from "../shared/realism.js";
const BGU = THREE.BufferGeometryUtils;

// ---------- themes ----------
// sky: Sky-shader sun (elevation°, azimuth°) or night gradient. fog: [color, density]. key: [color, intensity, offset].
const THEMES = {
  day: { sky: { elev: 16, azim: 160, turb: 5, ray: 1.4 }, fog: [0xc6d0d8, 0.02], exp: 0.62, key: [0xfff0dc, 2.8], hemi: [0xdfe9f5, 0x5a4a3a, 0.5], env: 0.55, ground: "village", weather: "mist", grass: 1, patches: "snow", mountains: 1 },
  dusk: { sky: { elev: 2.5, azim: 205, turb: 9, ray: 3 }, fog: [0x8a7078, 0.026], exp: 0.72, key: [0xffa268, 2.4], hemi: [0x9a9cc8, 0x4a3a30, 0.75], env: 0.45, ground: "village", weather: "mist", grass: 1, patches: "snow", mountains: 1, windows: 1 },
  sunset: { sky: { elev: 1.2, azim: 235, turb: 10, ray: 3.6 }, fog: [0xb8826a, 0.022], exp: 0.75, key: [0xffa060, 2.8], hemi: [0xc0a8c8, 0x5a4030, 0.8], env: 0.5, ground: "village", weather: "embers", grass: 1, patches: "snow", mountains: 1, windows: 1 },
  redsnow: { night: [0x16070a, 0x6a2012], fog: [0x2a0e0a, 0.03], exp: 0.95, key: [0x9aa8d8, 0.9], hemi: [0x5a3a44, 0x1a0c08, 0.55], env: 0.2, ground: "snow", weather: "redsnow", patches: "dirt", mountains: 1, burning: 1, stars: 0 },
  mountain: { sky: { elev: 11, azim: 120, turb: 3, ray: 1 }, fog: [0xd6dee8, 0.016], exp: 0.58, key: [0xfff4e8, 2.8], hemi: [0xe6eef8, 0x8090a0, 0.6], env: 0.6, ground: "snow", weather: "snow", patches: "rock", mountains: 1 },
  dark: { night: [0x020308, 0x0b1320], fog: [0x04060a, 0.07], exp: 1.05, key: [0x8aa0c8, 0.4], hemi: [0x223044, 0x080a0c, 0.3], env: 0.12, ground: "snow", weather: "snow", patches: "rock", stars: 1, playerLight: 1 },
  camp: { sky: { elev: 3, azim: 215, turb: 8, ray: 2.8 }, fog: [0x7a6258, 0.024], exp: 0.72, key: [0xffa060, 2.4], hemi: [0x9a9ab8, 0x4a3a30, 0.75], env: 0.45, ground: "dirt", weather: "snow", grass: 1, patches: "snow", mountains: 1 },
  dawn: { sky: { elev: 5, azim: 95, turb: 4, ray: 2.2 }, fog: [0xe0cfc8, 0.02], exp: 0.6, key: [0xffc49a, 2.4], hemi: [0xd8d6f0, 0x6a5a5a, 0.55], env: 0.55, ground: "snow", weather: "snow", patches: "rock", mountains: 1 },
  city: { sky: { elev: 0.8, azim: 200, turb: 10, ray: 3.2 }, fog: [0x5a4a58, 0.026], exp: 0.8, key: [0xff9a60, 2.2], hemi: [0x8a8ab8, 0x3a3234, 0.75], env: 0.4, ground: "cobble", weather: "mist", windows: 1 },
  roofs: { night: [0x04061a, 0x1d2644], fog: [0x121830, 0.022], exp: 0.95, key: [0x9ab4ff, 1.0], hemi: [0x3a4a7a, 0x100c10, 0.45], env: 0.25, ground: "street", weather: "none", stars: 1, moon: 1, windows: 1 },
  court: { night: [0x05071a, 0x221e3a], fog: [0x141428, 0.024], exp: 0.95, key: [0xa8bcff, 0.9], hemi: [0x4a4a7a, 0x1a1210, 0.45], env: 0.3, ground: "marble", weather: "embers", stars: 1, moon: 1, windows: 1 },
  hall: { night: [0x050305, 0x160c0a], fog: [0x0c0706, 0.03], exp: 1.0, key: [0xffb070, 0.9], hemi: [0x4a3030, 0x100808, 0.5], env: 0.25, ground: "marbleDark", weather: "embers", indoor: 1 },
  top: { night: [0x03040f, 0x1a1a3a], fog: [0x0e0e22, 0.018], exp: 0.95, key: [0xb0c4ff, 1.1], hemi: [0x40407a, 0x160e0e, 0.5], env: 0.3, ground: "marble", weather: "none", stars: 1, moon: 1 },
  ruins: { sky: { elev: 8, azim: 170, turb: 18, ray: 0.6 }, fog: [0x8a8580, 0.03], exp: 0.55, key: [0xe8e0d8, 1.8], hemi: [0xb0aaa8, 0x3a3432, 0.6], env: 0.5, ground: "ash", weather: "ash", patches: "snow", mountains: 1 },
};
export const themeOf = (id) => THEMES[id] || THEMES.day;

let stage, scene, camera, renderer, key, hemi, pmrem, levelGroup, focusLight, fill;
const W = { colliders: [], floors: [], fires: [], waters: [], mist: [], updaters: [] };
export default W;

export function init(canvas) {
  stage = createStage(canvas, { exposure: 0.6, bloom: 0.55, bloomThreshold: 0.92, bloomRadius: 0.55, fov: 50, maxDpr: 1.75 });
  ({ scene, camera, renderer } = stage);
  camera.near = 0.3; camera.far = 900; camera.updateProjectionMatrix();
  pmrem = new THREE.PMREMGenerator(renderer);
  key = keyLight(scene, { mapSize: 2048, size: 16, intensity: 2.6 });
  key.shadow.camera.far = 80;
  hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5); scene.add(hemi);
  focusLight = new THREE.PointLight(0xbcd4ff, 0, 9, 1.6); scene.add(focusLight);
  fill = new THREE.DirectionalLight(0xffe6cc, 0); scene.add(fill, fill.target); // soft light from the camera side
  W.fx = new FX(); W.stage = stage; W.scene = scene; W.camera = camera;
  return W;
}

// ---------- materials ----------
const matCache = new Map();
function pm(key, tex, opts) { if (!matCache.has(key)) matCache.set(key, pbrMaterial({ size: 256, ...tex }, opts)); return matCache.get(key); }
const MAT = {
  plaster: () => pm("plaster", { type: "plaster", color: "#dcd3c2", color2: "#a89c86", scale: 3, seed: 3, repeat: 1 }),
  char: () => pm("char", { type: "plaster", color: "#3a322c", color2: "#120e0c", scale: 3, seed: 4 }),
  darkwood: () => pm("dw", { type: "wood", color: "#4a3322", color2: "#22160e", scale: 2, seed: 7 }),
  wood: () => pm("wd", { type: "wood", color: "#8a6a48", color2: "#4a3422", scale: 2, seed: 8 }),
  planks: () => pm("pl", { type: "planks", color: "#8a6e50", color2: "#3a2a1c", scale: 2, seed: 9, rough: [0.6, 0.95] }),
  tiles: () => pm("tl", { type: "tiles", color: "#4a4e56", color2: "#1c1e22", scale: 4, seed: 10, rough: [0.45, 0.85], normal: 3 }),
  redtiles: () => pm("rtl", { type: "tiles", color: "#7a2a22", color2: "#2a0e0a", scale: 4, seed: 11, rough: [0.45, 0.85], normal: 3 }),
  thatch: () => pm("th", { type: "bark", color: "#a08a5a", color2: "#4a3a1e", scale: 4, seed: 12 }),
  stone: () => pm("st", { type: "stone", color: "#8e8a84", color2: "#403c38", scale: 3, seed: 13 }),
  rock: () => pm("rk", { type: "rock", color: "#85807a", color2: "#34302c", scale: 3, seed: 14 }),
  marble: () => pm("mb", { type: "stone", color: "#e2dcd0", color2: "#9a948a", scale: 2, seed: 15, rough: [0.15, 0.4] }, { metalness: 0.05 }),
  cloth: (c) => { const k = "cl" + c; if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, side: THREE.DoubleSide })); return matCache.get(k); },
  iron: () => { if (!matCache.has("iron")) matCache.set("iron", new THREE.MeshStandardMaterial({ color: 0x2e3034, metalness: 0.85, roughness: 0.45 })); return matCache.get("iron"); },
  gold: () => { if (!matCache.has("gold")) matCache.set("gold", new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 1, roughness: 0.25 })); return matCache.get("gold"); },
  glow: (c, i = 2.5) => { const k = "gl" + c + i; if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i })); return matCache.get(k); },
  window: (lit) => lit ? MAT.glow(0xffb45a, 2.2) : pm("win", { type: "wood", color: "#1a120c", color2: "#0a0604", scale: 1 }),
};
// Box whose UVs scale with its size, so textures keep one density on every face.
function box(w, h, d, mat, x = 0, y = 0, z = 0, density = 0.6) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let i = 0; i < uv.count; i++) { const f = Math.floor(i / 4), [a, b] = dims[f]; uv.setXY(i, uv.getX(i) * a * density, uv.getY(i) * b * density); }
  const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
}
function mesh(geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; }

// ---------- procedural geometry: pines, rocks, mountains ----------
function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function pineGeo(variant, snowy) {
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.1, 0.2, 2.4, 8); trunk.translate(0, 1.2, 0); paint(trunk, () => [0.24, 0.16, 0.1]); parts.push(trunk);
  const layers = 5 + variant;
  for (let i = 0; i < layers; i++) {
    const f = i / (layers - 1), r = 1.9 - f * 1.55, hgt = 1.5 - f * 0.5, y = 1.3 + f * 3.9;
    const c = new THREE.ConeGeometry(r, hgt, 14, 2, true);
    const p = c.attributes.position;
    for (let k = 0; k < p.count; k++) { // jagged, drooping branch tips
      const x = p.getX(k), z = p.getZ(k), yy = p.getY(k), rad = Math.hypot(x, z);
      if (rad > r * 0.55) { const a = Math.atan2(z, x), j = 1 + (hash(a * 3 + i, variant) - 0.5) * 0.45 + Math.sin(a * 7 + i) * 0.08; p.setXYZ(k, x * j, yy - (j - 0.8) * 0.35, z * j); }
    }
    c.computeVertexNormals(); c.translate(0, y, 0);
    paint(c, (x, yy, z) => {
      const n = hash(x * 3.1 + i, z * 2.7 + yy), g = 0.1 + n * 0.06;
      let col = [0.05 + n * 0.03, g + 0.06, 0.06 + n * 0.02];
      if (snowy && (n > 0.55 || yy > y + hgt * 0.1)) { const s = snowy * (n > 0.72 ? 1 : 0.55); col = col.map((v, q) => v + ([0.86, 0.9, 0.95][q] - v) * s); }
      return col;
    });
    parts.push(c);
  }
  return BGU.mergeGeometries(parts.map((g) => g.index ? g.toNonIndexed() : g));
}
function paint(geo, fn) {
  const p = geo.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const c = fn(p.getX(i), p.getY(i), p.getZ(i)); col.set(c, i * 3); }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
}
function rockGeo(seed, snowy) {
  const g = new THREE.IcosahedronGeometry(1, 3), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i), n = 0.75 + hash(v.x * 2 + seed, v.y * 2 + v.z) * 0.35 + Math.sin(v.x * 3 + seed) * 0.08;
    v.multiplyScalar(n); v.y *= 0.7; p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const nr = g.attributes.normal;
  paint(g, (x, y, z) => { const k = hash(x * 5, z * 5) * 0.1; const base = [0.36 + k, 0.34 + k, 0.32 + k]; const up = snowy ? Math.max(0, nr.getY(0) * 0) : 0; return base; });
  if (snowy) { const c = g.attributes.color; for (let i = 0; i < c.count; i++) { const ny = nr.getY(i); if (ny > 0.55) { const s = Math.min(1, (ny - 0.55) * 3) * snowy; c.setXYZ(i, c.getX(i) + (0.9 - c.getX(i)) * s, c.getY(i) + (0.93 - c.getY(i)) * s, c.getZ(i) + (0.97 - c.getZ(i)) * s); } } }
  return g;
}
function mountainGeo(seed) {
  const g = new THREE.ConeGeometry(1, 1, 48, 24), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), h = y + 0.5;
    const n = (hash(Math.floor(a * 8) + seed, Math.floor(h * 10)) - 0.5) * 0.18 + Math.sin(a * 5 + seed) * 0.08 + Math.sin(a * 13 + h * 9) * 0.04;
    const k = 1 + n * (1 - h * 0.6); p.setXYZ(i, x * k, y + Math.sin(a * 3 + seed) * 0.03, z * k);
  }
  g.computeVertexNormals();
  const nr = g.attributes.normal;
  paint(g, (x, y) => [0.3, 0.3, 0.32]);
  const c = g.attributes.color;
  for (let i = 0; i < c.count; i++) { const h = p.getY(i) + 0.5, ny = nr.getY(i); const snow = h > 0.42 - ny * 0.25 + hash(i, seed) * 0.1 ? 1 : 0; if (snow) c.setXYZ(i, 0.88, 0.91, 0.96); else { const k = hash(i * 0.1, seed) * 0.08; c.setXYZ(i, 0.26 + k, 0.26 + k, 0.28 + k); } }
  return g;
}
const vcMat = (rough = 0.9) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough });

// ---------- soft canvas textures ----------
function blobTexture(seed, soft = 0.5) {
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d"); const img = g.createImageData(128, 128);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const dx = x / 64 - 1, dy = y / 64 - 1, a = Math.atan2(dy, dx), r = Math.hypot(dx, dy);
    const edge = 0.7 + Math.sin(a * 3 + seed) * 0.12 + Math.sin(a * 7 + seed * 2) * 0.07 + (hash(x * 0.3, y * 0.3 + seed) - 0.5) * 0.12;
    const v = Math.max(0, Math.min(1, (edge - r) / (soft * 0.5)));
    const i = (y * 128 + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = v * 255;
  }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function textTexture(txt, color, font = "900 96px Georgia") {
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
  g.font = font; g.textAlign = "center"; g.textBaseline = "middle"; g.lineWidth = 12; g.strokeStyle = "rgba(0,0,0,.85)"; g.strokeText(txt, 64, 70); g.fillStyle = color; g.fillText(txt, 64, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function streakTexture() {
  const c = document.createElement("canvas"); c.width = 64; c.height = 256; const g = c.getContext("2d");
  for (let x = 0; x < 64; x++) { const b = 150 + hash(x, 1) * 105; g.fillStyle = `rgba(${b},${b + 10},${b + 20},${0.35 + hash(x, 2) * 0.5})`; g.fillRect(x, 0, 1, 256); }
  for (let i = 0; i < 90; i++) { g.fillStyle = "rgba(255,255,255,.6)"; g.fillRect(hash(i, 3) * 64, hash(i, 4) * 256, 1, 20 + hash(i, 5) * 60); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------- particles (per-particle size + colour + alpha) ----------
class Particles {
  constructor(max, additive) {
    this.max = max; this.n = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 4); this.size = new Float32Array(max);
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("pcolor", new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("size", new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.max0 = new Float32Array(max); this.grav = new Float32Array(max); this.drag = new Float32Array(max);
    this.s = new Float32Array(max * 2); this.c = new Float32Array(max * 8);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: glowTexture() }, uScale: { value: 400 } }, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: "uniform float uScale; attribute float size; attribute vec4 pcolor; varying vec4 vC; void main(){ vC = pcolor; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = max(1.0, size * uScale / -mv.z); gl_Position = projectionMatrix * mv; }",
      fragmentShader: "uniform sampler2D map; varying vec4 vC; void main(){ float a = texture2D(map, gl_PointCoord).a; gl_FragColor = vec4(vC.rgb, vC.a * a); }",
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.geo = g; this.points.renderOrder = additive ? 5 : 4;
  }
  spawn(x, y, z, vx, vy, vz, life, s0, s1, c0, c1, grav = 0, drag = 0) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.pos.set([x, y, z], i * 3); this.vel.set([vx, vy, vz], i * 3); this.life[i] = this.max0[i] = life; this.grav[i] = grav; this.drag[i] = drag;
    this.s[i * 2] = s0; this.s[i * 2 + 1] = s1; this.c.set(c0, i * 8); this.c.set(c1, i * 8 + 4);
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.copy(this.n - 1, i); this.n--; i--; continue; }
      const t = 1 - this.life[i] / this.max0[i], d = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      for (let k = 0; k < 3; k++) { this.vel[i * 3 + k] *= d; this.pos[i * 3 + k] += this.vel[i * 3 + k] * dt; }
      this.size[i] = this.s[i * 2] + (this.s[i * 2 + 1] - this.s[i * 2]) * t;
      for (let k = 0; k < 4; k++) this.col[i * 4 + k] = this.c[i * 8 + k] + (this.c[i * 8 + 4 + k] - this.c[i * 8 + k]) * t;
    }
    this.geo.setDrawRange(0, this.n);
    for (const a of ["position", "pcolor", "size"]) this.geo.attributes[a].needsUpdate = true;
  }
  copy(from, to) {
    if (from === to) return;
    for (let k = 0; k < 3; k++) { this.pos[to * 3 + k] = this.pos[from * 3 + k]; this.vel[to * 3 + k] = this.vel[from * 3 + k]; }
    for (let k = 0; k < 4; k++) this.col[to * 4 + k] = this.col[from * 4 + k];
    for (let k = 0; k < 8; k++) this.c[to * 8 + k] = this.c[from * 8 + k];
    this.s[to * 2] = this.s[from * 2]; this.s[to * 2 + 1] = this.s[from * 2 + 1];
    this.life[to] = this.life[from]; this.max0[to] = this.max0[from]; this.grav[to] = this.grav[from]; this.drag[to] = this.drag[from]; this.size[to] = this.size[from];
  }
  clear() { this.n = 0; this.geo.setDrawRange(0, 0); }
}

// ---------- effects: bursts, slashes, rings, telegraph decals ----------
const R = (a = 1) => (Math.random() - 0.5) * 2 * a;
class FX {
  constructor() {
    this.add = new Particles(2600, true); this.alpha = new Particles(1600, false);
    scene.add(this.add.points, this.alpha.points);
    this.items = [];
    // slash arc geometry: a ring sector whose brightness fades toward its tail
    const g = new THREE.RingGeometry(0.45, 1.75, 40, 1, -Math.PI / 2 - 1.2, 2.4), p = g.attributes.position, col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getY(i), p.getX(i)) + Math.PI / 2, f = Math.max(0, Math.min(1, (a + 1.2) / 2.4)), r = Math.hypot(p.getX(i), p.getY(i)); const v = Math.pow(f, 2.2) * (0.35 + 0.65 * (r - 0.45) / 1.3); col.set([v, v, v], i * 3); }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3)); g.rotateX(-Math.PI / 2);
    this.slashGeo = g;
    this.ringGeo = new THREE.RingGeometry(0.85, 1, 48).rotateX(-Math.PI / 2);
    this.discGeo = new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2);
    this.planeGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5);
  }
  burst(x, y, z, kind = "spark", n = 14, color) {
    for (let i = 0; i < n; i++) {
      if (kind === "spark") this.add.spawn(x, y, z, R(4), Math.random() * 4 + 1, R(4), 0.35 + Math.random() * 0.25, 0.12, 0.02, [3, 2.2, 1.2, 1], [2, 0.6, 0.1, 0], 9, 1.5);
      else if (kind === "blood") this.alpha.spawn(x, y, z, R(2.6), Math.random() * 3 + 0.5, R(2.6), 0.5 + Math.random() * 0.4, 0.13, 0.05, [0.55, 0.03, 0.04, 0.95], [0.3, 0.02, 0.02, 0], 8, 1);
      else if (kind === "straw") this.alpha.spawn(x, y, z, R(2.5), Math.random() * 3 + 1, R(2.5), 0.7 + Math.random() * 0.5, 0.1, 0.07, [0.85, 0.7, 0.35, 1], [0.7, 0.55, 0.25, 0], 5, 1.2);
      else if (kind === "smoke") this.alpha.spawn(x + R(0.6), y + Math.random() * 0.8, z + R(0.6), R(1.2), Math.random() * 0.8, R(1.2), 1.2 + Math.random() * 1.2, 0.8, 2.6, [0.16, 0.16, 0.18, 0.6], [0.2, 0.2, 0.22, 0], -0.2, 1.2);
      else if (kind === "shadow") this.alpha.spawn(x + R(0.3), y + Math.random() * 1.4, z + R(0.3), R(1.5), Math.random() * 1.5, R(1.5), 0.5 + Math.random() * 0.3, 0.5, 0.1, [0.05, 0.03, 0.08, 0.85], [0.02, 0.02, 0.04, 0], -1, 2);
      else if (kind === "magic") { const c = new THREE.Color(color || 0x9a6aff); this.add.spawn(x, y, z, R(3), Math.random() * 3, R(3), 0.5 + Math.random() * 0.3, 0.18, 0.02, [c.r * 3, c.g * 3, c.b * 3, 1], [c.r, c.g, c.b, 0], 2, 2); }
      else if (kind === "poison") this.add.spawn(x + R(0.3), y + Math.random() * 0.8, z + R(0.3), R(0.6), 0.8 + Math.random(), R(0.6), 0.6 + Math.random() * 0.4, 0.14, 0.03, [0.4, 2.2, 0.5, 0.9], [0.1, 0.6, 0.1, 0], -0.5, 1);
      else if (kind === "gold") this.add.spawn(x, y, z, R(2), Math.random() * 3 + 1, R(2), 0.6, 0.12, 0.02, [3, 2.2, 0.6, 1], [2, 1, 0.2, 0], 6, 1);
      else if (kind === "snow") this.alpha.spawn(x + R(0.4), y, z + R(0.4), R(2.5), Math.random() * 2, R(2.5), 0.6 + Math.random() * 0.4, 0.14, 0.26, [0.95, 0.96, 1, 0.8], [0.95, 0.96, 1, 0], 3, 2);
      else if (kind === "heal") this.add.spawn(x + R(0.4), y + Math.random(), z + R(0.4), 0, 1.5 + Math.random(), 0, 0.8, 0.16, 0.02, [0.6, 3, 1.2, 1], [0.2, 1, 0.4, 0], 0, 0);
    }
  }
  slash(x, y, z, face, color = 0xdff4ff, mirror = false, tilt = 0, scale = 1) {
    const m = new THREE.Mesh(this.slashGeo, new THREE.MeshBasicMaterial({ color, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.set(0, face, 0, "YXZ"); m.rotation.z = tilt; m.scale.set(mirror ? -scale : scale, scale, scale); m.renderOrder = 6;
    scene.add(m); this.items.push({ m, t: 0, dur: 0.22, kind: "slash" });
  }
  ring(x, z, r, color = 0xffd2a0, dur = 0.4, y = 0.06) {
    const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.set(x, y, z); scene.add(m); this.items.push({ m, t: 0, dur, r, kind: "ring" });
  }
  // Telegraph on the ground. shape: circle{r} | line{len,w,face} | cone{r,arc,face}. Fill grows with set(p).
  decal(shape, x, z, o = {}) {
    const g = new THREE.Group(); g.position.set(x, 0.045, z); g.rotation.y = o.face || 0;
    const color = o.color ?? 0xff2a14;
    const mOut = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending });
    const mIn = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending });
    let outer, inner;
    if (shape === "circle") { outer = new THREE.Mesh(this.discGeo, mOut); outer.scale.setScalar(o.r); inner = new THREE.Mesh(this.discGeo, mIn); const edge = new THREE.Mesh(this.ringGeo, mIn); edge.scale.setScalar(o.r); g.add(edge); }
    else if (shape === "line") { outer = new THREE.Mesh(this.planeGeo, mOut); outer.scale.set(o.w, 1, o.len); inner = new THREE.Mesh(this.planeGeo, mIn); }
    else { const geo = new THREE.CircleGeometry(o.r, 24, -Math.PI / 2 - o.arc / 2, o.arc).rotateX(-Math.PI / 2); outer = new THREE.Mesh(geo, mOut); inner = new THREE.Mesh(geo, mIn); }
    g.add(outer, inner); scene.add(g);
    const d = { g, set: (p) => { p = Math.max(0.001, Math.min(1, p)); if (shape === "circle") inner.scale.setScalar(o.r * p); else if (shape === "line") inner.scale.set(o.w, 1, o.len * p); else inner.scale.setScalar(p); },
      move: (nx, nz, face) => { g.position.x = nx; g.position.z = nz; if (face != null) g.rotation.y = face; },
      remove: () => { scene.remove(g); mOut.dispose(); mIn.dispose(); if (shape === "cone") outer.geometry.dispose(); } };
    d.set(0); return d;
  }
  update(dt) {
    this.add.update(dt); this.alpha.update(dt);
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]; it.t += dt; const p = it.t / it.dur;
      if (p >= 1) { scene.remove(it.m); it.m.material.dispose(); this.items.splice(i, 1); continue; }
      if (it.kind === "slash") { it.m.material.opacity = 1 - p; it.m.rotation.y += dt * 2 * (it.m.scale.x < 0 ? -1 : 1); }
      if (it.kind === "ring") { it.m.scale.setScalar(0.2 + p * it.r); it.m.material.opacity = 1 - p; }
    }
  }
  clear() { this.add.clear(); this.alpha.clear(); this.items.forEach((it) => scene.remove(it.m)); this.items = []; }
}

// ---------- markers & HUD-in-world ----------
const texCache = {};
export function marker() {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: null, depthTest: false, transparent: true }));
  s.scale.setScalar(0.55); s.renderOrder = 20; s.visible = false;
  s.show = (ch, color) => { const k = ch + color; texCache[k] = texCache[k] || textTexture(ch, color); if (s.material.map !== texCache[k]) { s.material.map = texCache[k]; s.material.needsUpdate = true; } s.visible = true; };
  return s;
}
export function hpBar() {
  const g = new THREE.Group();
  const mk = (c, o) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ color: c, depthTest: false, transparent: true, opacity: o })); s.center.set(0, 0.5); s.renderOrder = 19; return s; };
  const bg = mk(0x000000, 0.6), fg = mk(0xe03a2a, 1); bg.scale.set(0.8, 0.08, 1); fg.scale.set(0.76, 0.05, 1); bg.position.x = -0.4; fg.position.set(-0.38, 0, 0.001);
  g.add(bg, fg); g.visible = false;
  g.set = (f, color) => { fg.scale.x = 0.76 * Math.max(0, f); if (color) fg.material.color.set(color); };
  return g;
}
// Vision cone on the ground: a fan with alpha fading outward.
export function visionCone(range, fovDeg) {
  const seg = 24, arc = (fovDeg * Math.PI) / 180, pos = [0, 0, 0], col = [1, 1, 1, 0.09], idx = [];
  for (let i = 0; i <= seg; i++) { const a = -arc / 2 + (arc * i) / seg; pos.push(Math.sin(a) * range, 0, Math.cos(a) * range); col.push(1, 1, 1, 0.0); }
  for (let i = 1; i <= seg; i++) idx.push(0, i, i + 1);
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 4)); g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  m.position.y = 0.04; m.renderOrder = 3; return m;
}
export function targetRing() {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.position.y = 0.05; m.renderOrder = 3; return m;
}
const projGeo = {};
export function projectile(kind) {
  const g = new THREE.Group();
  if (kind === "arrow") { g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.75, 5).rotateX(Math.PI / 2), MAT.wood())); g.add(mesh(new THREE.ConeGeometry(0.03, 0.09, 6).rotateX(Math.PI / 2), MAT.iron(), 0, 0, 0.42)); g.add(mesh(new THREE.BoxGeometry(0.002, 0.05, 0.12), MAT.cloth("#e8e2d0"), 0, 0, -0.33)); }
  else if (kind === "dart") { g.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 5).rotateX(Math.PI / 2), MAT.iron())); g.add(mesh(new THREE.ConeGeometry(0.03, 0.08, 6).rotateX(-Math.PI / 2), MAT.cloth("#9b1420"), 0, 0, -0.16)); const gl = glowSprite(0x7aff6a, 0.35, 0.8); g.add(gl); }
  else if (kind === "knife") { g.add(mesh(new THREE.BoxGeometry(0.01, 0.03, 0.3), new THREE.MeshStandardMaterial({ color: 0xc8d0da, metalness: 1, roughness: 0.2 }))); g.add(glowSprite(0xffe0c0, 0.3, 0.5)); }
  else if (kind === "vial") { g.add(mesh(new THREE.SphereGeometry(0.09, 14, 10), new THREE.MeshStandardMaterial({ color: 0x5aff6a, emissive: 0x2aa83a, emissiveIntensity: 1.6, roughness: 0.1 }))); g.add(glowSprite(0x6aff7a, 0.8, 0.8)); }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
export function coin() {
  projGeo.coin = projGeo.coin || new THREE.CylinderGeometry(0.13, 0.13, 0.03, 20).rotateX(Math.PI / 2);
  const m = new THREE.Mesh(projGeo.coin, MAT.gold()); m.castShadow = true; return m;
}
export function orb() { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), MAT.glow(0x5aff8a, 2))); g.add(glowSprite(0x5aff8a, 1, 0.7)); return g; }

// ---------- level construction ----------
let skyObj = null, weather = null, envTex = null, sunDir = new THREE.Vector3(0.4, 1, 0.3);
export function clear() {
  if (levelGroup) { scene.remove(levelGroup); levelGroup.traverse((o) => { if (o.geometry && !o.userData.keepGeo) o.geometry.dispose(); }); }
  levelGroup = new THREE.Group(); scene.add(levelGroup);
  W.colliders = []; W.floors = []; W.fires = []; W.waters = []; W.mist = []; W.updaters = []; weather = null;
  if (W.fx) W.fx.clear();
  W.group = levelGroup;
}
export function add(o) { levelGroup.add(o); return o; }

function setupSky(T) {
  const envScene = new THREE.Scene();
  if (T.sky) {
    const sky = new THREE.Sky(); sky.scale.setScalar(450);
    const u = sky.material.uniforms; u.turbidity.value = T.sky.turb; u.rayleigh.value = T.sky.ray; u.mieCoefficient.value = 0.005; u.mieDirectionalG.value = 0.8;
    const phi = THREE.MathUtils.degToRad(90 - T.sky.elev), th = THREE.MathUtils.degToRad(T.sky.azim);
    sunDir.setFromSphericalCoords(1, phi, th); u.sunPosition.value.copy(sunDir);
    levelGroup.add(sky); const s2 = sky.clone(); envScene.add(s2); skyObj = sky;
  } else {
    const [top, bot] = T.night;
    const mat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { top: { value: new THREE.Color(top) }, bot: { value: new THREE.Color(bot) } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "uniform vec3 top, bot; varying vec3 vP; void main(){ float h = clamp(vP.y * 1.6 + 0.12, 0.0, 1.0); gl_FragColor = vec4(mix(bot, top, pow(h, 0.7)), 1.0); }" });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), mat); levelGroup.add(dome); envScene.add(dome.clone());
    sunDir.set(-0.35, 0.8, -0.5).normalize();
    if (T.stars) {
      const n = 900, p = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, e = Math.random() * 1.2 + 0.08; p.set([Math.cos(a) * Math.cos(e) * 380, Math.sin(e) * 380, Math.sin(a) * Math.cos(e) * 380], i * 3); }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(p, 3));
      levelGroup.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xdfe8ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 })));
    }
    if (T.moon) {
      const mp = new THREE.Vector3(-0.35, 0.42, -1).normalize().multiplyScalar(360);
      const moon = new THREE.Mesh(new THREE.SphereGeometry(14, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff6e0, fog: false })); moon.position.copy(mp); levelGroup.add(moon);
      const halo = glowSprite(0xaec4ff, 120, 0.35); halo.material.fog = false; halo.position.copy(mp); levelGroup.add(halo);
      sunDir.copy(mp).normalize();
    }
  }
  if (envTex) envTex.dispose();
  envTex = pmrem.fromScene(envScene, 0, 0.1, 1000).texture;
  scene.environment = envTex; scene.environmentIntensity = T.env;
}

function ground(T, floors) {
  const kinds = {
    village: { type: "dirt", color: "#8f806c", color2: "#4a4034", scale: 6 }, dirt: { type: "dirt", color: "#7a6450", color2: "#3a2e22", scale: 6 },
    snow: { type: "plaster", color: "#f2f5fa", color2: "#b4bfcc", scale: 5, rough: [0.5, 0.85], normal: 1.4 }, cobble: { type: "stone", color: "#8e8780", color2: "#34302c", scale: 6, normal: 3 },
    marble: { type: "stone", color: "#ddd6ca", color2: "#8e887e", scale: 3, rough: [0.12, 0.35], normal: 1.2 }, marbleDark: { type: "stone", color: "#5a524c", color2: "#1a1614", scale: 3, rough: [0.1, 0.35], normal: 1.2 },
    ash: { type: "dirt", color: "#6a6460", color2: "#262220", scale: 6 }, street: { type: "stone", color: "#6a6660", color2: "#24201e", scale: 6 },
  };
  const k = kinds[T.ground] || kinds.village;
  const mat = pbrMaterial({ ...k, size: 512, seed: 2, repeat: 1 }); for (const m of ["map", "normalMap", "roughnessMap"]) { mat[m] = mat[m].clone(); mat[m].repeat.set(26, 26); mat[m].needsUpdate = true; }
  const g = mesh(new THREE.PlaneGeometry(240, 240).rotateX(-Math.PI / 2), mat); g.castShadow = false; g.userData.ground = true;
  return g;
}

function scatterPatches(T, rect) {
  if (!T.patches) return;
  const colors = { snow: 0xd8dde4, dirt: 0x5a4a3a, rock: 0x6a6660 };
  const tex = [glowTexture()];
  const [x1, z1, x2, z2] = rect;
  for (let i = 0; i < 26; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: colors[T.patches], map: tex[0], transparent: true, opacity: 0.7, depthWrite: false, roughness: T.patches === "snow" ? 0.7 : 0.95, polygonOffset: true, polygonOffsetFactor: -1 }));
    const s = 3 + Math.random() * 6; m.scale.set(s, 1, s * (0.5 + Math.random() * 0.7)); m.rotation.y = Math.random() * 3;
    m.position.set(x1 - 12 + Math.random() * (x2 - x1 + 24), 0.012 + i * 0.0004, z1 - 12 + Math.random() * (z2 - z1 + 24)); m.receiveShadow = true;
    levelGroup.add(m);
  }
}

// Instanced forests / rocks / grass placed from a list of [x, z, scale, rotY].
function instanced(geo, mat, list, shadow = true) {
  if (!list.length) return;
  const im = new THREE.InstancedMesh(geo, mat, list.length), o = new THREE.Object3D();
  list.forEach(([x, z, s, r, y = 0], i) => { o.position.set(x, y, z); o.rotation.set(0, r ?? Math.random() * 6.28, 0); o.scale.setScalar(s); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
  im.castShadow = shadow; im.receiveShadow = true; im.frustumCulled = false; levelGroup.add(im); return im;
}
const inRect = (x, z, [x1, z1, x2, z2], m = 0) => x > x1 - m && x < x2 + m && z > z1 - m && z < z2 + m;

// ---------- props ----------
function house(x, z, w, d, burning, T, opts = {}) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const wallH = opts.tall ? 4.2 : 2.3, plaster = burning ? MAT.char() : MAT.plaster(), beam = MAT.darkwood();
  g.add(box(w + 0.3, 0.36, d + 0.3, MAT.stone(), 0, 0.18, 0));
  g.add(box(w, wallH, d, plaster, 0, 0.36 + wallH / 2, 0, 0.5));
  const top = 0.36 + wallH;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.22, wallH + 0.05, 0.22, beam, sx * w / 2, 0.36 + wallH / 2, sz * d / 2));
  for (const sz of [-1, 1]) g.add(box(w + 0.1, 0.2, 0.24, beam, 0, top - 0.05, sz * d / 2));
  for (const sx of [-1, 1]) g.add(box(0.24, 0.2, d + 0.1, beam, sx * w / 2, top - 0.05, 0));
  if (opts.tall) { for (const sz of [-1, 1]) g.add(box(w + 0.1, 0.16, 0.26, beam, 0, 0.36 + wallH * 0.5, sz * d / 2)); }
  // roof: gable along the longer side
  const along = w >= d, L = (along ? w : d) + 1, S = (along ? d : w) + 1.1, pitch = 0.5, rise = (S / 2) * Math.tan(pitch), pw = S / 2 / Math.cos(pitch);
  const roof = new THREE.Group(); roof.position.y = top; if (!along) roof.rotation.y = Math.PI / 2;
  const rm = opts.thatch ? MAT.thatch() : opts.red ? MAT.redtiles() : MAT.tiles();
  for (const s of [-1, 1]) { const p = box(L, 0.14, pw, burning ? MAT.char() : rm, 0, rise / 2, s * S / 4, 0.8); p.rotation.x = s * pitch; roof.add(p); }
  roof.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, L + 0.1, 8).rotateZ(Math.PI / 2), beam, 0, rise + 0.05, 0));
  const tri = new THREE.Shape(); const hw = (along ? d : w) / 2; tri.moveTo(-hw, 0); tri.lineTo(hw, 0); tri.lineTo(0, rise * ((along ? d : w) / S)); tri.closePath();
  for (const s of [-1, 1]) { const gm = mesh(new THREE.ShapeGeometry(tri), plaster, s * (along ? w : d) / 2, 0, 0); gm.rotation.y = s * Math.PI / 2; roof.add(gm); }
  g.add(roof);
  // door + windows on the +z face (toward the camera) and sides
  g.add(box(0.95, 1.75, 0.08, beam, 0, 0.36 + 0.875, d / 2 + 0.03));
  const lit = T.windows && !burning && Math.random() < 0.8;
  const floors = opts.tall ? [0.36 + 1.3, 0.36 + 3.2] : [0.36 + 1.3];
  for (const wy of floors) for (const wx of [-w / 2 + 0.9, w / 2 - 0.9]) if (w > 3) {
    g.add(box(0.7, 0.62, 0.06, MAT.window(lit), wx, wy, d / 2 + 0.03));
    for (const k of [-1, 0, 1]) g.add(box(0.03, 0.62, 0.08, beam, wx + k * 0.2, wy, d / 2 + 0.05));
    if (lit && wy === floors[0]) { const gl = glowSprite(0xffa040, 1.6, 0.35); gl.position.set(wx, wy, d / 2 + 0.3); g.add(gl); }
  }
  if (opts.tall && T.windows) for (const wx of [-w / 2 + 0.4, w / 2 - 0.4]) { const ln = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), MAT.glow(0xff4a2a, 2)); ln.scale.y = 1.3; ln.position.set(wx, 0.36 + wallH - 0.5, d / 2 + 0.35); g.add(ln); const gl = glowSprite(0xff5a2a, 1.4, 0.5); gl.position.copy(ln.position); g.add(gl); }
  add(g);
  W.colliders.push({ type: "box", x1: x - w / 2 - 0.1, z1: z - d / 2 - 0.1, x2: x + w / 2 + 0.1, z2: z + d / 2 + 0.1, block: true });
  if (burning) {
    const n = Math.max(2, Math.round((along ? w : d) / 2));
    for (let i = 0; i < n; i++) { const f = (i + 0.5) / n - 0.5; addFire(x + (along ? f * w : 0), top + rise * 0.7, z + (along ? 0 : f * d), 1.1, W.fires.length < 4); }
    addFire(x + (Math.random() - 0.5) * w * 0.6, 1.1, z + d / 2 + 0.1, 0.6, false);
  }
  return g;
}
export function addFire(x, y, z, s = 1, light = true) {
  const f = { x, y, z, s, acc: 0 };
  if (light) { f.light = new THREE.PointLight(0xff7a30, 6 * s, 9 * s, 1.8); f.light.position.set(x, y + 0.6, z); add(f.light); }
  const glow = glowSprite(0xff7a30, 2.4 * s, 0.5); glow.position.set(x, y + 0.4, z); add(glow); f.glow = glow;
  W.fires.push(f); return f;
}
function lantern(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  g.add(box(0.5, 0.18, 0.5, MAT.stone(), 0, 0.09, 0), mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.7, 8), MAT.stone(), 0, 0.5, 0), box(0.44, 0.1, 0.44, MAT.stone(), 0, 0.88, 0));
  g.add(box(0.3, 0.3, 0.3, MAT.glow(0xffc070, 1.8), 0, 1.08, 0));
  const r = mesh(new THREE.ConeGeometry(0.42, 0.28, 4), MAT.stone(), 0, 1.38, 0); r.rotation.y = Math.PI / 4; g.add(r);
  const gl = glowSprite(0xffb050, 1.8, 0.6); gl.position.y = 1.08; g.add(gl);
  add(g); W.colliders.push({ type: "circle", x, z, r: 0.35 });
}
function lanternPost(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  g.add(mesh(new THREE.CylinderGeometry(0.07, 0.09, 3, 8), MAT.darkwood(), 0, 1.5, 0), box(0.8, 0.08, 0.08, MAT.darkwood(), 0.35, 2.9, 0));
  const l = mesh(new THREE.SphereGeometry(0.2, 14, 10), MAT.glow(0xff5a2a, 2.2), 0.65, 2.5, 0); l.scale.y = 1.35; g.add(l);
  const gl = glowSprite(0xff6a3a, 2, 0.6); gl.position.set(0.65, 2.5, 0); g.add(gl);
  add(g); W.colliders.push({ type: "circle", x, z, r: 0.2 });
}
function well(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const ring = mesh(new THREE.CylinderGeometry(0.85, 0.9, 0.8, 20, 1, true), MAT.stone(), 0, 0.4, 0); ring.material = MAT.stone(); g.add(ring);
  g.add(mesh(new THREE.TorusGeometry(0.85, 0.1, 8, 24).rotateX(Math.PI / 2), MAT.stone(), 0, 0.8, 0));
  g.add(mesh(new THREE.CircleGeometry(0.8, 20).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x050505 }), 0, 0.3, 0));
  for (const s of [-1, 1]) g.add(box(0.12, 1.9, 0.12, MAT.darkwood(), s * 0.8, 0.95, 0));
  const r = new THREE.Group(); r.position.y = 1.9;
  for (const s of [-1, 1]) { const p = box(1.3, 0.08, 0.8, MAT.tiles(), 0, 0.2, s * 0.32); p.rotation.x = s * 0.5; r.add(p); }
  g.add(r); g.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.6, 8).rotateZ(Math.PI / 2), MAT.wood(), 0, 1.55, 0));
  add(g); W.colliders.push({ type: "circle", x, z, r: 1.0 });
}
function bellTower(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  g.add(box(2.4, 0.3, 2.4, MAT.stone(), 0, 0.15, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.22, 4.2, 0.22, MAT.darkwood(), sx * 0.95, 2.25, sz * 0.95));
  g.add(box(2.2, 0.2, 2.2, MAT.darkwood(), 0, 4.3, 0));
  const r = mesh(new THREE.ConeGeometry(2.0, 1.2, 4), MAT.tiles(), 0, 5.0, 0); r.rotation.y = Math.PI / 4; g.add(r);
  const bell = mesh(new THREE.CylinderGeometry(0.28, 0.5, 0.8, 20), new THREE.MeshStandardMaterial({ color: 0x8a6a2a, metalness: 1, roughness: 0.35 }), 0, 3.6, 0); g.add(bell);
  add(g); W.colliders.push({ type: "box", x1: x - 1.2, z1: z - 1.2, x2: x + 1.2, z2: z + 1.2 });
}
function tent(x, z, s) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const c = mesh(new THREE.ConeGeometry(1.6 * s, 2.2 * s, 7, 1, true), MAT.cloth("#8a7a5a"), 0, 1.1 * s, 0); g.add(c);
  g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6 * s, 6), MAT.darkwood(), 0, 1.3 * s, 0));
  add(g); W.colliders.push({ type: "circle", x, z, r: 1.35 * s });
}
function campfire(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.add(mesh(new THREE.DodecahedronGeometry(0.16), MAT.rock(), Math.cos(a) * 0.55, 0.08, Math.sin(a) * 0.55)); }
  for (let i = 0; i < 4; i++) { const l = mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.8, 6), MAT.darkwood(), 0, 0.15, 0); l.rotation.set(1.2, (i / 4) * Math.PI * 2, 0); g.add(l); }
  add(g); addFire(x, 0.2, z, 0.8, true); W.colliders.push({ type: "circle", x, z, r: 0.7 });
}
function crate(x, z, s = 0.9) { const b = box(s, s, s, MAT.planks(), x, s / 2, z, 1); b.rotation.y = Math.random() * 0.4; add(b); W.colliders.push({ type: "box", x1: x - s / 2, z1: z - s / 2, x2: x + s / 2, z2: z + s / 2 }); }
function barrel(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  g.add(mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.95, 16), MAT.wood(), 0, 0.475, 0));
  for (const y of [0.2, 0.75]) g.add(mesh(new THREE.TorusGeometry(0.37, 0.025, 6, 20).rotateX(Math.PI / 2), MAT.iron(), 0, y, 0));
  add(g); W.colliders.push({ type: "circle", x, z, r: 0.4 });
}
function cart(x, z, rot = 0) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot;
  g.add(box(1.4, 0.5, 2.2, MAT.planks(), 0, 0.85, 0));
  for (const s of [-1, 1]) g.add(mesh(new THREE.TorusGeometry(0.42, 0.06, 8, 20).rotateY(Math.PI / 2), MAT.darkwood(), s * 0.78, 0.45, 0.2));
  g.add(box(0.1, 0.1, 1.6, MAT.darkwood(), 0.3, 0.7, 1.8), box(0.1, 0.1, 1.6, MAT.darkwood(), -0.3, 0.7, 1.8));
  add(g); W.colliders.push({ type: "circle", x, z, r: 1.15 });
}
function pillar(x, z, T) {
  const mat = T.ground === "marble" || T.ground === "marbleDark" ? MAT.marble() : MAT.stone();
  const g = new THREE.Group(); g.position.set(x, 0, z);
  g.add(box(1.2, 0.3, 1.2, mat, 0, 0.15, 0), mesh(new THREE.CylinderGeometry(0.42, 0.48, 5.2, 20), mat, 0, 2.9, 0), box(1.2, 0.35, 1.2, mat, 0, 5.6, 0));
  if (T.indoor || T.moon) for (const y of [0.45, 5.35]) g.add(mesh(new THREE.TorusGeometry(0.5, 0.05, 6, 24).rotateX(Math.PI / 2), MAT.gold(), 0, y, 0));
  add(g); W.colliders.push({ type: "circle", x, z, r: 0.62, pillar: true });
}
function brazier(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  for (let i = 0; i < 3; i++) { const l = mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.1, 6), MAT.iron(), 0, 0.55, 0); l.rotation.set(0.25, (i / 3) * Math.PI * 2, 0, "YXZ"); l.position.set(Math.sin((i / 3) * Math.PI * 2) * 0.15, 0.55, Math.cos((i / 3) * Math.PI * 2) * 0.15); g.add(l); }
  g.add(mesh(new THREE.CylinderGeometry(0.45, 0.28, 0.35, 16, 1, true), MAT.iron(), 0, 1.15, 0));
  add(g); addFire(x, 1.25, z, 0.7, W.fires.length < 5); W.colliders.push({ type: "circle", x, z, r: 0.5 });
}
function banner(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  g.add(mesh(new THREE.CylinderGeometry(0.06, 0.07, 6, 8), MAT.darkwood(), 0, 3, 0));
  const c = document.createElement("canvas"); c.width = 64; c.height = 160; const cx = c.getContext("2d");
  cx.fillStyle = "#6a1016"; cx.fillRect(0, 0, 64, 160); cx.strokeStyle = "#d9a441"; cx.lineWidth = 4; cx.strokeRect(4, 4, 56, 152);
  cx.beginPath(); cx.arc(32, 60, 16, 0, 7); cx.stroke(); cx.fillStyle = "#d9a441"; cx.fillRect(30, 44, 4, 32);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const cl = mesh(new THREE.PlaneGeometry(1.2, 3, 1, 8), new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, roughness: 0.9 }), 0, 4.2, 0.08); g.add(cl);
  const p = cl.geometry.attributes.position; W.updaters.push((t2) => { for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, Math.sin(t2 * 2 + y * 2) * 0.06 * (1.5 - y)); } p.needsUpdate = true; });
  add(g);
}
function tree(x, z, s, list) { list.push([x, z, s * (0.9 + Math.random() * 0.25)]); W.colliders.push({ type: "circle", x, z, r: 0.45 * s }); }
function rock(x, z, s, list) { list.push([x, z, s, Math.random() * 6, -0.1 * s]); W.colliders.push({ type: "circle", x, z, r: 0.85 * s }); }
function hut(x, z) { house(x, z, 4.4, 3.4, false, { windows: true }, { thatch: true }); const w = W.colliders.pop(); if (Math.abs(z) < 12) W.colliders.push(w); }
function rack(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  for (const s of [-1, 1]) g.add(box(0.12, 1.4, 0.12, MAT.darkwood(), s * 0.9, 0.7, 0));
  g.add(box(2, 0.1, 0.14, MAT.darkwood(), 0, 1.2, 0), box(2, 0.1, 0.14, MAT.darkwood(), 0, 0.5, 0));
  for (let i = 0; i < 5; i++) { const st = mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.5, 6), MAT.wood(), -0.7 + i * 0.35, 0.8, 0.1); st.rotation.x = -0.2; g.add(st); }
  add(g); W.colliders.push({ type: "box", x1: x - 1, z1: z - 0.25, x2: x + 1, z2: z + 0.25 });
}
function fence(x1, z1, x2, z2) {
  const parts = [], mat = MAT.darkwood();
  const side = (ax, az, bx, bz) => {
    const len = Math.hypot(bx - ax, bz - az), n = Math.ceil(len / 2);
    for (let i = 0; i <= n; i++) { const f = i / n, p = new THREE.BoxGeometry(0.14, 1.1, 0.14); p.translate(ax + (bx - ax) * f, 0.55, az + (bz - az) * f); parts.push(p); }
    for (const y of [0.45, 0.9]) { const r = new THREE.BoxGeometry(bx !== ax ? len : 0.08, 0.08, bz !== az ? len : 0.08); r.translate((ax + bx) / 2, y, (az + bz) / 2); parts.push(r); }
  };
  const m = 0.3; side(x1 - m, z1 - m, x2 + m, z1 - m); side(x1 - m, z2 + m, x2 + m, z2 + m); side(x1 - m, z1 - m, x1 - m, z2 + m); side(x2 + m, z1 - m, x2 + m, z2 + m);
  const g = mesh(BGU.mergeGeometries(parts), mat); add(g);
}
function palisade(x1, z1, x2, z2) {
  const parts = [], len = Math.hypot(x2 - x1, z2 - z1), n = Math.ceil(len / 0.42);
  for (let i = 0; i <= n; i++) {
    const f = i / n, h = 2.6 + hash(i, x1) * 0.6, c = new THREE.CylinderGeometry(0.2, 0.22, h, 7); c.translate(x1 + (x2 - x1) * f, h / 2, z1 + (z2 - z1) * f); parts.push(c);
    const tip = new THREE.ConeGeometry(0.2, 0.45, 7); tip.translate(x1 + (x2 - x1) * f, h + 0.22, z1 + (z2 - z1) * f); parts.push(tip);
  }
  add(mesh(BGU.mergeGeometries(parts), MAT.darkwood()));
  W.colliders.push({ type: "box", x1: Math.min(x1, x2) - 0.25, z1: Math.min(z1, z2) - 0.25, x2: Math.max(x1, x2) + 0.25, z2: Math.max(z1, z2) + 0.25, block: true });
}
function throne(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  g.add(box(2.6, 0.3, 2, MAT.marble(), 0, 0.15, 0), box(1.4, 0.5, 1, MAT.lacq || new THREE.MeshPhysicalMaterial({ color: 0x3a1a52, roughness: 0.3, clearcoat: 1 }), 0, 0.55, 0.1));
  g.add(box(1.5, 2.2, 0.25, new THREE.MeshPhysicalMaterial({ color: 0x1a0a14, roughness: 0.3, clearcoat: 1 }), 0, 1.4, -0.45));
  g.add(box(1.6, 0.1, 0.3, MAT.gold(), 0, 2.55, -0.45));
  for (const s of [-1, 1]) g.add(box(0.2, 0.5, 1, MAT.gold(), s * 0.75, 0.95, 0.1));
  add(g); W.colliders.push({ type: "box", x1: x - 1.3, z1: z - 1, x2: x + 1.3, z2: z + 1 });
}
function carpet(x, z, w, d) {
  const c = document.createElement("canvas"); c.width = 64; c.height = 256; const g = c.getContext("2d");
  g.fillStyle = "#6a0e14"; g.fillRect(0, 0, 64, 256); g.fillStyle = "#c9a041"; g.fillRect(4, 0, 4, 256); g.fillRect(56, 0, 4, 256);
  for (let y = 0; y < 256; y += 32) { g.beginPath(); g.moveTo(32, y + 6); g.lineTo(44, y + 16); g.lineTo(32, y + 26); g.lineTo(20, y + 16); g.closePath(); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, d / 4);
  const m = mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }), x, 0.02, z); m.castShadow = false; add(m);
}
function hay(x, z) { const h = mesh(new THREE.SphereGeometry(0.8, 14, 10), MAT.thatch(), x, 0.35, z); h.scale.set(1.2, 0.6, 1); add(h); W.colliders.push({ type: "circle", x, z, r: 0.85 }); }
function woodpile(x, z) { const g = new THREE.Group(); g.position.set(x, 0, z); for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - r; i++) g.add(mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.6, 8).rotateZ(Math.PI / 2), MAT.wood(), 0, 0.17 + r * 0.29, (i - (3 - r) / 2) * 0.33)); g.rotation.y = 0.3; add(g); W.colliders.push({ type: "circle", x, z, r: 0.9 }); }
function torch(x, z) { add(mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.2, 6), MAT.darkwood(), x, 1.1, z)); addFire(x, 2.25, z, 0.45, false); W.colliders.push({ type: "circle", x, z, r: 0.2 }); }
function chimney(x, z) { add(box(1, 1.8, 1, MAT.stone(), x, 0.9, z)); W.colliders.push({ type: "box", x1: x - 0.55, z1: z - 0.55, x2: x + 0.55, z2: z + 0.55 }); }
function wallRow(x, z, w, h, mat, crenel) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  g.add(box(w, h, 1.2, mat, 0, h / 2, 0, 0.4));
  if (crenel) for (let i = -w / 2 + 0.5; i < w / 2; i += 1.4) g.add(box(0.8, 0.8, 1.2, mat, i, h + 0.4, 0, 0.4));
  else { const r = box(w + 0.6, 0.16, 1.9, MAT.tiles(), 0, h + 0.3, 0.1, 0.8); r.rotation.x = 0.25; g.add(r); }
  add(g);
}
function ruin(x, z, w, d) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  g.add(box(w + 0.3, 0.3, d + 0.3, MAT.stone(), 0, 0.15, 0));
  const pieces = [[-w / 2, 0, 0.25, d, 1.6], [0, -d / 2, w, 0.25, 0.9], [w / 2, d / 4, 0.25, d / 2, 2.1]];
  pieces.forEach(([px, pz, pw, pd, ph]) => g.add(box(pw, ph, pd, MAT.char(), px, 0.3 + ph / 2, pz)));
  const bm = box(0.25, 0.25, d + 1, MAT.char(), 0.2, 0.9, 0.2); bm.rotation.set(0.1, 0.4, 0.5); g.add(bm);
  add(g); W.colliders.push({ type: "box", x1: x - w / 2, z1: z - d / 2, x2: x + w / 2, z2: z + d / 2 });
}

// water: a reflective surface whose normal map scrolls
function water(x, z, w, d, y = -0.05) {
  const t = makePBR({ type: "water", scale: 4, size: 256, normal: 3, seed: 30 });
  const n = t.normalMap.clone(); n.repeat.set(w / 5, d / 5); n.needsUpdate = true;
  const m = mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0x0e2a30, roughness: 0.06, metalness: 0.1, normalMap: n, clearcoat: 1, clearcoatRoughness: 0.05 }), x, y, z);
  m.castShadow = false; add(m); W.waters.push(n); return m;
}
function cliffWall(x1, z, x2, T) {
  const w = x2 - x1, g = new THREE.Group();
  const rockM = MAT.rock();
  for (let i = 0; i < 9; i++) { const r = mesh(new THREE.IcosahedronGeometry(1, 2), rockM, x1 + (i + 0.5) * w / 9 + (Math.random() - 0.5), 4 + Math.random() * 4, z - 1.5 - Math.random() * 1.5); r.scale.set(2.8, 6, 2.2); g.add(r); }
  // waterfall
  const tex = streakTexture(); tex.repeat.set(3, 1);
  const fall = mesh(new THREE.PlaneGeometry(4, 11), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.85, depthWrite: false, color: 0xcfe6ee }), 0, 5.2, z + 0.4); fall.castShadow = false; g.add(fall);
  W.updaters.push((t) => { tex.offset.y = t * 1.6; });
  W.mistSource = { x: 0, z: z + 1.5 };
  add(g);
}

// ---------- build a level ----------
export function build(level, opts = {}) {
  clear();
  const T = themeOf(level.theme);
  W.theme = T;
  stage.renderer.toneMappingExposure = T.exp;
  scene.fog = new THREE.FogExp2(T.fog[0], T.fog[1]);
  setupSky(T);
  key.color.set(T.key[0]); key.intensity = T.key[1];
  { const h = Math.hypot(sunDir.x, sunDir.z) || 1; key.userData.offset.set((sunDir.x / h) * 12, Math.max(12, sunDir.y * 22), (sunDir.z / h) * 12); } // keep the key light high enough to light the play area
  hemi.color.set(T.hemi[0]); hemi.groundColor.set(T.hemi[1]); hemi.intensity = T.hemi[2];
  focusLight.intensity = T.playerLight ? 14 : 0;
  W.floors = (level.floors || [[-10, -10, 10, 10]]).map((r) => r.slice());
  const bb = W.floors.reduce((a, [x1, z1, x2, z2]) => [Math.min(a[0], x1), Math.min(a[1], z1), Math.max(a[2], x2), Math.max(a[3], z2)], [1e9, 1e9, -1e9, -1e9]);
  W.bounds = bb;
  const trees = [], rocks = [], grass = [];
  const snowy = /snow|mountain|dark|dawn|redsnow|camp|ruins|day|dusk|sunset/.test(level.theme) ? (/(mountain|dark|dawn|redsnow)/.test(level.theme) ? 1 : 0.55) : 0;

  // ground
  if (level.chasm) {
    const rockM = MAT.rock();
    const snowTop = ground(T, W.floors);
    for (const [z1, z2] of [[W.floors[0][1], 80], [-90, W.floors[2][3]]]) {
      const top = snowTop.clone(); top.geometry = new THREE.PlaneGeometry(120, z2 - z1).rotateX(-Math.PI / 2); top.position.set(0, 0, (z1 + z2) / 2); add(top);
      add(box(120, 40, z2 - z1, rockM, 0, -20.05, (z1 + z2) / 2, 0.25)).castShadow = false;
    }
    const riv = water(0, 0, 120, 40, -34); riv.material.color.set(0x16323a);
    const br = level.bridge; const [bx, bz1, bz2, bw] = br;
    for (let z = bz1; z < bz2; z += 0.42) { const p = box(bw, 0.08, 0.36, MAT.planks(), bx + (Math.random() - 0.5) * 0.06, -0.04 - Math.sin(((z - bz1) / (bz2 - bz1)) * Math.PI) * 0.0, z + 0.2, 1); p.rotation.z = (Math.random() - 0.5) * 0.04; add(p); }
    for (const s of [-1, 1]) {
      const pts = []; for (let i = 0; i <= 20; i++) { const f = i / 20; pts.push(new THREE.Vector3(bx + s * bw / 2, 1.0 - Math.sin(f * Math.PI) * 0.25, bz1 + (bz2 - bz1) * f)); }
      add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.035, 5), MAT.cloth("#8a7050")));
      for (const z of [bz1, bz2]) add(mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.6, 8), MAT.darkwood(), bx + s * bw / 2, 0.6, z));
      for (let z = bz1 + 1.5; z < bz2; z += 1.5) add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 4), MAT.cloth("#8a7050"), bx + s * bw / 2, 0.5, z));
    }
    // cliff-side forest
    for (let i = 0; i < 90; i++) { const x = (Math.random() - 0.5) * 80, z = Math.random() < 0.5 ? 26 + Math.random() * 40 : -28 - Math.random() * 50; if (!W.floors.some((f) => inRect(x, z, f, 2))) trees.push([x, z, 0.8 + Math.random() * 0.7]); }
  } else if (level.rooftops) {
    const street = ground(T, W.floors); street.position.y = -11; add(street);
    const wallM = MAT.plaster();
    W.floors.forEach(([x1, z1, x2, z2]) => {
      const w = x2 - x1, d = z2 - z1;
      if (w < 2.5 || d < 2.5) { // plank walkway
        const along = d > w; const n = Math.ceil((along ? d : w) / 0.4);
        for (let i = 0; i < n; i++) { const f = (i + 0.5) / n; add(box(along ? w : 0.36, 0.08, along ? 0.36 : d, MAT.planks(), along ? (x1 + x2) / 2 : x1 + w * f, -0.04, along ? z1 + d * f : (z1 + z2) / 2, 1)); }
        return;
      }
      add(box(w, 11, d, wallM, (x1 + x2) / 2, -5.6, (z1 + z2) / 2, 0.35)).castShadow = false;
      const top = box(w + 0.02, 0.1, d + 0.02, MAT.tiles(), (x1 + x2) / 2, -0.05, (z1 + z2) / 2, 0.8); top.castShadow = false; add(top);
      for (const [px, pz, pw, pd] of [[(x1 + x2) / 2, z1 - 0.1, w + 0.4, 0.2], [(x1 + x2) / 2, z2 + 0.1, w + 0.4, 0.2], [x1 - 0.1, (z1 + z2) / 2, 0.2, d], [x2 + 0.1, (z1 + z2) / 2, 0.2, d]]) add(box(pw, 0.35, pd, MAT.darkwood(), px, 0.05, pz));
      for (let y = -9.5; y < -1; y += 2.6) for (let x = x1 + 1; x < x2 - 0.5; x += 1.8) if (Math.random() < 0.55) { const wm = box(0.6, 0.7, 0.06, MAT.window(true), x, y, z2 + 0.03); wm.castShadow = false; add(wm); }
    });
    // the rest of the city below and around
    for (let i = 0; i < 60; i++) {
      const x = (Math.random() - 0.5) * 90, z = (Math.random() - 0.5) * 110 - 5, w = 4 + Math.random() * 5, d = 4 + Math.random() * 5;
      if (W.floors.some((f) => inRect(x, z, f, 3 + Math.max(w, d) / 2))) continue;
      const h = 5 + Math.random() * 6, g = new THREE.Group(); g.position.set(x, -11, z);
      g.add(box(w, h, d, wallM, 0, h / 2, 0, 0.35));
      const r = mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.75, 2, 4), MAT.tiles(), 0, h + 1, 0); r.rotation.y = Math.PI / 4; r.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d)); g.add(r);
      for (let wy = 1.5; wy < h - 0.5; wy += 2.2) if (Math.random() < 0.6) g.add(box(0.6, 0.7, 0.06, MAT.window(true), (Math.random() - 0.5) * (w - 1), wy, d / 2 + 0.03));
      g.traverse((o) => { o.castShadow = false; }); add(g);
    }
  } else {
    add(ground(T, W.floors));
    scatterPatches(T, bb);
  }

  // outdoor surroundings: forest ring, rocks, grass, mountains
  const outdoor = !T.indoor && !level.rooftops && !level.chasm && !/city|court|top/.test(level.theme);
  if (outdoor) {
    for (let i = 0; i < 260; i++) {
      const a = Math.random() * Math.PI * 2, rr = 1.5 + Math.pow(Math.random(), 1.4) * 34;
      const x = Math.min(Math.max(Math.cos(a) * 60, bb[0] - rr), bb[2] + rr) , z = Math.min(Math.max(Math.sin(a) * 60, bb[1] - rr), bb[3] + rr);
      const jx = x + (Math.random() - 0.5) * 3, jz = z + (Math.random() - 0.5) * 3;
      if (W.floors.some((f) => inRect(jx, jz, f, 1.2))) continue;
      if (jz > bb[3] + 6 && Math.abs(jx) < 14) continue; // keep the camera's view of the arena clear
      trees.push([jx, jz, 0.7 + Math.random() * 0.8]);
    }
    for (let i = 0; i < 40; i++) { const x = bb[0] - 4 + Math.random() * (bb[2] - bb[0] + 8), z = bb[1] - 4 + Math.random() * (bb[3] - bb[1] + 8); if (!W.floors.some((f) => inRect(x, z, f, 0.3))) rocks.push([x, z, 0.3 + Math.random() * 0.6, Math.random() * 6, -0.1]); }
  }
  if (T.grass) for (let i = 0; i < 380; i++) grass.push([bb[0] - 8 + Math.random() * (bb[2] - bb[0] + 16), bb[1] - 8 + Math.random() * (bb[3] - bb[1] + 16), 0.5 + Math.random() * 0.6]);
  if (T.mountains) {
    const mg = [mountainGeo(1), mountainGeo(2), mountainGeo(3)], mm = vcMat(0.95);
    for (let i = 0; i < 11; i++) {
      const a = -Math.PI / 2 + (i / 10 - 0.5) * 2.8, d = 120 + Math.random() * 70, m = new THREE.Mesh(mg[i % 3], mm);
      m.position.set(Math.cos(a) * d, -2, Math.sin(a) * d); const s = 50 + Math.random() * 50; m.scale.set(s * 1.3, s * (0.9 + Math.random() * 0.6), s * 1.3); add(m);
    }
  }
  if (level.indoor || T.indoor) {
    const wm = MAT.stone();
    const [x1, z1, x2, z2] = bb;
    add(box(x2 - x1 + 2, 9, 1, wm, (x1 + x2) / 2, 4.5, z1 - 0.6, 0.4));
    for (const s of [x1 - 0.6, x2 + 0.6]) add(box(1, 9, z2 - z1 + 2, wm, s, 4.5, (z1 + z2) / 2, 0.4));
    for (let z = z1 + 3; z < z2; z += 7) for (const s of [x1 - 0.05, x2 + 0.05]) { const bn = mesh(new THREE.PlaneGeometry(1.4, 4.5), new THREE.MeshStandardMaterial({ color: 0x5a0c12, roughness: 0.9, side: THREE.DoubleSide }), s, 4.5, z); bn.rotation.y = Math.PI / 2; add(bn); }
  }
  if (/court|top/.test(level.theme)) {
    const [x1, z1, x2, z2] = bb, wm = MAT.marble();
    const bal = [];
    const rail = (ax, az, bx, bz) => { const len = Math.hypot(bx - ax, bz - az), n = Math.ceil(len / 0.6); for (let i = 0; i <= n; i++) { const f = i / n, c = new THREE.CylinderGeometry(0.09, 0.12, 1, 8); c.translate(ax + (bx - ax) * f, 0.5, az + (bz - az) * f); bal.push(c); } const top = new THREE.BoxGeometry(bx !== ax ? len : 0.3, 0.14, bz !== az ? len : 0.3); top.translate((ax + bx) / 2, 1.05, (az + bz) / 2); bal.push(top); };
    const m = 0.6; rail(x1 - m, z1 - m, x2 + m, z1 - m); rail(x1 - m, z1 - m, x1 - m, z2 + m); rail(x2 + m, z1 - m, x2 + m, z2 + m);
    add(mesh(BGU.mergeGeometries(bal), wm));
    if (level.theme === "top") { const fl = add(box(x2 - x1 + 6, 30, z2 - z1 + 6, MAT.stone(), (x1 + x2) / 2, -15.02, (z1 + z2) / 2, 0.2)); fl.castShadow = false; W.group.children.forEach((c) => { if (c.userData.ground) c.visible = false; }); }
    else { for (const [x, z, w] of [[-18, -10, 12], [18, -8, 12], [0, -26, 20]]) house(x, z, w, 6, false, T, { tall: true, red: true }), W.colliders.pop(); }
  }
  if (level.theme === "city") {
    // distant city skyline beyond the level
    for (let i = 0; i < 24; i++) { const x = (Math.random() - 0.5) * 80, z = bb[1] - 8 - Math.random() * 30; house(x, z, 4 + Math.random() * 4, 4 + Math.random() * 3, false, T, { tall: true, red: Math.random() < 0.3 }); W.colliders.pop(); }
    for (let i = 0; i < 16; i++) { const s = Math.random() < 0.5 ? -1 : 1, x = s * (bb[2] + 5 + Math.random() * 14), z = bb[1] + Math.random() * (bb[3] - bb[1]); house(x, z, 4 + Math.random() * 3, 4 + Math.random() * 3, false, T, { tall: true }); W.colliders.pop(); }
  }
  if (level.fence) fence(...level.fence);
  if (level.cliff) cliffWall(level.cliff[0], level.cliff[1], level.cliff[2], T);
  if (level.pool) water(level.pool[0], level.pool[1], level.pool[2], level.pool[3], 0.02);
  if (level.ring) for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; trees.push([Math.cos(a) * (level.ring + 1.5 + Math.random() * 3), Math.sin(a) * (level.ring + 1.5 + Math.random() * 3), 0.8 + Math.random() * 0.5]); }

  // props from level data
  for (const [type, ...a] of level.props || []) {
    if (type === "house") house(a[0], a[1], a[2], a[3], a[4] || T.burning, T);
    else if (type === "city") house(a[0], a[1], a[2], a[3], false, T, { tall: true, red: a[0] > 0 });
    else if (type === "stable") { house(a[0], a[1], a[2], a[3], false, T, { thatch: true }); for (let i = 0; i < 3; i++) hay(a[0] + a[2] / 2 + 0.9, a[1] - a[3] / 3 + i * a[3] / 3); }
    else if (type === "tree") tree(a[0], a[1], a[2] || 1, trees);
    else if (type === "rock") rock(a[0], a[1], a[2] || 1, rocks);
    else if (type === "lantern") lantern(a[0], a[1]);
    else if (type === "lanternpost") lanternPost(a[0], a[1]);
    else if (type === "well") well(a[0], a[1]);
    else if (type === "belltower") bellTower(a[0], a[1]);
    else if (type === "fire") { addFire(a[0], 0.2, a[1], a[2] || 1, W.fires.length < 5); W.colliders.push({ type: "circle", x: a[0], z: a[1], r: 0.6 * (a[2] || 1) }); for (let i = 0; i < 3; i++) { const l = box(0.2, 0.2, 1.4, MAT.char(), a[0] + (Math.random() - 0.5) * 0.6, 0.1, a[1] + (Math.random() - 0.5) * 0.6); l.rotation.y = Math.random() * 3; add(l); } }
    else if (type === "tent") tent(a[0], a[1], a[2] || 1.5);
    else if (type === "campfire") campfire(a[0], a[1]);
    else if (type === "crate") crate(a[0], a[1]);
    else if (type === "barrel") barrel(a[0], a[1]);
    else if (type === "cart") cart(a[0], a[1], a[2] || 0);
    else if (type === "pillar") pillar(a[0], a[1], T);
    else if (type === "brazier") brazier(a[0], a[1]);
    else if (type === "banner") banner(a[0], a[1]);
    else if (type === "throne") throne(a[0], a[1]);
    else if (type === "carpet") carpet(a[0], a[1], a[2], a[3]);
    else if (type === "hay") hay(a[0], a[1]);
    else if (type === "woodpile") woodpile(a[0], a[1]);
    else if (type === "torch") torch(a[0], a[1]);
    else if (type === "rack") rack(a[0], a[1]);
    else if (type === "hut") hut(a[0], a[1]);
    else if (type === "palisade") palisade(a[0], a[1], a[2], a[3]);
    else if (type === "gate") { for (const s of [-1, 1]) add(box(0.5, 4, 0.5, MAT.darkwood(), a[0] + s * 4, 2, a[1])); add(box(8.8, 0.5, 0.5, MAT.darkwood(), a[0], 3.8, a[1])); }
    else if (type === "chimney") chimney(a[0], a[1]);
    else if (type === "ruin") ruin(a[0], a[1], a[2], a[3]);
    else if (type === "courtwall") wallRow(a[0], a[1] - 0.6, 40, 5, MAT.plaster(), false);
    else if (type === "palacewall") { wallRow(a[0], a[1] - 0.6, 30, 7, MAT.stone(), true); add(box(3.2, 4.5, 0.4, MAT.darkwood(), a[0], 2.25, a[1] + 0.1)); }
    else if (type === "stairs") for (let i = 0; i < 8; i++) add(box(4, 0.3, 0.6, MAT.marble(), a[0], 0.15 + i * 0.3, a[1] - i * 0.6));
    else if (type === "window") { const f = new THREE.Group(); f.position.set(a[0], 0, a[1]); f.add(box(8, 0.5, 0.5, MAT.stone(), 0, 7, 0)); for (const s of [-1, 1]) f.add(box(0.6, 7, 0.6, MAT.stone(), s * 4, 3.5, 0)); add(f); }
  }
  // instanced vegetation
  if (trees.length) { const variants = [0, 1, 2].map((v) => pineGeo(v, snowy)); const mm = vcMat(0.85); variants.forEach((g, v) => instanced(g, mm, trees.filter((_, i) => i % 3 === v))); }
  if (rocks.length) { const rg = [rockGeo(1, snowy), rockGeo(7, snowy)]; const rm = vcMat(0.9); rm.normalMap = MAT.rock().normalMap; rg.forEach((g, v) => instanced(g, rm, rocks.filter((_, i) => i % 2 === v))); }
  if (grass.length) {
    const blades = []; for (let i = 0; i < 7; i++) { const c = new THREE.ConeGeometry(0.03, 0.45 + hash(i, 2) * 0.3, 3); c.translate(0, 0.25, 0); c.rotateZ((hash(i, 5) - 0.5) * 0.7); c.rotateX((hash(i, 6) - 0.5) * 0.7); c.translate((hash(i, 7) - 0.5) * 0.25, 0, (hash(i, 8) - 0.5) * 0.25); blades.push(c.toNonIndexed()); }
    const gg = BGU.mergeGeometries(blades); paint(gg, (x, y) => [0.35 + y * 0.4, 0.3 + y * 0.3, 0.14]);
    instanced(gg, vcMat(0.9), grass.filter(([x, z]) => !W.colliders.some((c) => c.type === "box" && inRect(x, z, [c.x1, c.z1, c.x2, c.z2], 0.2))), false);
  }
  // weather + mist
  setupWeather(T);
  return W;
}

function setupWeather(T) {
  const kind = T.weather;
  if (kind === "snow" || kind === "redsnow" || kind === "ash") {
    const n = kind === "ash" ? 500 : 900, p = new Float32Array(n * 3), sp = new Float32Array(n);
    for (let i = 0; i < n; i++) { p.set([(Math.random() - 0.5) * 40, Math.random() * 18, (Math.random() - 0.5) * 40], i * 3); sp[i] = 0.6 + Math.random() * 0.8; }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    const color = kind === "redsnow" ? 0xff8a80 : kind === "ash" ? 0x8a8480 : 0xffffff;
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ map: glowTexture(), color, size: kind === "ash" ? 0.12 : 0.13, transparent: true, opacity: 0.9, depthWrite: false }));
    pts.frustumCulled = false; add(pts);
    weather = { pts, p, sp, n, fall: kind === "ash" ? 0.5 : 1.3, cx: 0, cz: 0 };
  }
  // low mist banks drift across the ground
  if (T.weather === "mist" || T.fog[1] > 0.025) {
    const tex = glowTexture();
    for (let i = 0; i < 12; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: T.fog[0], transparent: true, opacity: 0.1, depthWrite: false })); s.scale.set(14, 5, 1); s.position.set((Math.random() - 0.5) * 40, 1.2 + Math.random(), (Math.random() - 0.5) * 40); add(s); W.mist.push(s); }
  }
  W.embers = kind === "embers" || kind === "redsnow";
}

// ---------- per-frame ----------
let camX = 0, camZ = 0, shakeT = 0, shakeA = 0;
const camOff = new THREE.Vector3(0, 1.08, 0.88).normalize();
export function camFollow(x, z, dt, zoom = 1, snap = false) {
  const k = snap ? 1 : 1 - Math.exp(-dt * 6);
  camX += (x - camX) * k; camZ += (z - camZ) * k;
  const portrait = camera.aspect < 1;
  const fov = portrait ? 52 : 44; if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  const d = (portrait ? 10 : 9.5) * zoom;
  shakeT = Math.max(0, shakeT - dt); const s = shakeT > 0 ? shakeA * (shakeT / 0.35) : 0;
  camera.position.set(camX + camOff.x * d + (Math.random() - 0.5) * s, camOff.y * d + (Math.random() - 0.5) * s, camZ + camOff.z * d);
  camera.lookAt(camX, 0.6, camZ - (portrait ? 0.6 : 0));
  key.follow(camX, 0, camZ - 2);
  setFill(0.45, camX, camZ);
}
function setFill(i, x, z) { fill.intensity = i * (W.theme && W.theme.night ? 0.6 : 1); fill.position.copy(camera.position).add(new THREE.Vector3(1.5, 2, 0)); fill.target.position.set(x, 0.8, z); fill.target.updateMatrixWorld(); }
export function camOrbit(x, y, z, r, h, a, lookY = 1, fillI = 1.3) {
  const portrait = camera.aspect < 1, fov = portrait ? 50 : 40; if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  camera.position.set(x + Math.sin(a) * r, y + h, z + Math.cos(a) * r); camera.lookAt(x, y + lookY, z); key.follow(x, 0, z); camX = x; camZ = z; setFill(fillI, x, z);
}
export function shake(a = 0.3) { shakeA = Math.max(shakeA * (shakeT > 0 ? 1 : 0), a); shakeT = 0.35; }
const pv = new THREE.Vector3();
export function project(x, y, z) { pv.set(x, y, z).project(camera); const r = stage.renderer.domElement.getBoundingClientRect(); return { x: r.left + (pv.x * 0.5 + 0.5) * r.width, y: r.top + (-pv.y * 0.5 + 0.5) * r.height, behind: pv.z > 1 }; }
export function setFocusLight(x, z) { focusLight.position.set(x, 2.2, z); }

export function update(dt, t) {
  W.fx.update(dt);
  const size = stage.renderer.getDrawingBufferSize(new THREE.Vector2());
  const sc = size.y * camera.projectionMatrix.elements[5] * 0.5;
  W.fx.add.mat.uniforms.uScale.value = sc; W.fx.alpha.mat.uniforms.uScale.value = sc;
  for (const f of W.fires) {
    f.acc += dt * 38 * f.s;
    while (f.acc > 1) {
      f.acc--;
      W.fx.add.spawn(f.x + R(0.25 * f.s), f.y, f.z + R(0.25 * f.s), R(0.3), 1.4 + Math.random() * 1.4 * f.s, R(0.3), 0.45 + Math.random() * 0.45, 0.55 * f.s, 0.08, [3.2, 1.7, 0.5, 0.9], [1.4, 0.25, 0.05, 0], -0.8, 0.8);
      if (Math.random() < 0.18) W.fx.alpha.spawn(f.x + R(0.2), f.y + 0.8 * f.s, f.z + R(0.2), R(0.3) + 0.3, 1 + Math.random() * 0.6, R(0.3), 2.2 + Math.random(), 0.5 * f.s, 2.2 * f.s, [0.12, 0.1, 0.1, 0.45], [0.2, 0.19, 0.19, 0], -0.1, 0.4);
      if (Math.random() < 0.06) W.fx.add.spawn(f.x, f.y + 0.5, f.z, R(1.2), 2 + Math.random() * 2, R(1.2), 1.5 + Math.random(), 0.06, 0.02, [3, 1.4, 0.3, 1], [2, 0.4, 0.1, 0], -0.4, 0.5);
    }
    const fl = 0.75 + Math.sin(t * 17 + f.x) * 0.12 + Math.sin(t * 29 + f.z) * 0.1;
    if (f.light) f.light.intensity = 6 * f.s * fl;
    f.glow.material.opacity = 0.35 + fl * 0.2;
  }
  if (W.embers && Math.random() < dt * 25) W.fx.add.spawn(camX + R(10), 0.2, camZ + R(8), R(0.6), 0.8 + Math.random(), R(0.6), 3 + Math.random() * 2, 0.07, 0.03, [3, 1.2, 0.3, 1], [1.5, 0.3, 0.05, 0], -0.1, 0.2);
  if (W.mistSource && Math.random() < dt * 20) W.fx.alpha.spawn(W.mistSource.x + R(2), 0.3, W.mistSource.z + R(0.5), R(0.5), 0.4 + Math.random() * 0.5, 0.5 + Math.random() * 0.6, 2.5, 1, 3.2, [0.9, 0.94, 0.97, 0.3], [0.9, 0.94, 0.97, 0], -0.05, 0.3);
  if (weather) {
    const { p, sp, n } = weather;
    for (let i = 0; i < n; i++) {
      p[i * 3 + 1] -= weather.fall * sp[i] * dt; p[i * 3] += (Math.sin(t * 0.8 + i) * 0.3 + 0.4) * dt; p[i * 3 + 2] += Math.cos(t * 0.6 + i * 0.7) * 0.2 * dt;
      if (p[i * 3 + 1] < 0) { p[i * 3 + 1] += 18; p[i * 3] = camX + (Math.random() - 0.5) * 40; p[i * 3 + 2] = camZ + (Math.random() - 0.5) * 40; }
      if (p[i * 3] - camX > 20) p[i * 3] -= 40; else if (p[i * 3] - camX < -20) p[i * 3] += 40;
      if (p[i * 3 + 2] - camZ > 20) p[i * 3 + 2] -= 40; else if (p[i * 3 + 2] - camZ < -20) p[i * 3 + 2] += 40;
    }
    weather.pts.geometry.attributes.position.needsUpdate = true;
  }
  for (const s of W.mist) { s.position.x += dt * 0.4; if (s.position.x - camX > 22) s.position.x -= 44; if (s.position.z - camZ > 22) s.position.z -= 44; else if (s.position.z - camZ < -22) s.position.z += 44; }
  for (const n of W.waters) { n.offset.x = t * 0.02; n.offset.y = t * 0.035; }
  for (const u of W.updaters) u(t);
}
export function render(t) { stage.render(t); }
export { R };
