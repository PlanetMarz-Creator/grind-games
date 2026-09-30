// Grind Games — shared realistic-rendering kit.
// Physically based lighting (image-based environment + ACES tone mapping), soft shadows, bloom, a subtle
// lens finish (vignette + grain), adaptive resolution for slower phones, and procedural PBR textures
// (albedo + normal + roughness) so materials read as real rock, metal, wood and water without image files.
import * as THREE from "./vendor/three-kit.min.js";
export { THREE };

// ---------- stage: renderer + scene + camera + post-processing ----------
const LensShader = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, vignette: { value: 0.35 }, grain: { value: 0.035 } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time, vignette, grain; varying vec2 vUv;
    float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + time) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float d = distance(vUv, vec2(0.5));
      c.rgb *= 1.0 - vignette * smoothstep(0.35, 0.85, d);
      c.rgb += (rnd(vUv * 900.0) - 0.5) * grain;
      gl_FragColor = c;
    }`,
};

export function createStage(canvas, opts = {}) {
  const o = { exposure: 1, env: 1, bloom: 0.45, bloomThreshold: 0.85, bloomRadius: 0.5, shadows: true, fov: 45, lens: true, maxDpr: 2, transparent: false, depth: false, ...opts };
  // transparent: the canvas composites over the page (alpha), so bloom and the lens pass are skipped (they drop alpha).
  if (o.transparent) { o.bloom = 0; o.lens = false; }
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: o.transparent, powerPreference: "high-performance" });
  if (o.transparent) renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = o.exposure;
  renderer.shadowMap.enabled = o.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoft was removed upstream; PCF + shadow.radius gives soft edges
  const scene = new THREE.Scene();
  // Image-based lighting: a studio "room" gives every PBR surface believable reflections and soft fill.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = o.env;
  const camera = new THREE.PerspectiveCamera(o.fov, 1, 0.1, 400);

  // Multisampled render target = antialiasing that survives post-processing.
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  if (o.depth) target.depthTexture = new THREE.DepthTexture(1, 1); // lets post passes read scene depth (outlines, fog, DOF)
  const composer = new THREE.EffectComposer(renderer, target);
  composer.addPass(new THREE.RenderPass(scene, camera));
  const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(1, 1), o.bloom, o.bloomRadius, o.bloomThreshold);
  if (o.bloom > 0) composer.addPass(bloom);
  composer.addPass(new THREE.OutputPass());
  const lens = new THREE.ShaderPass(LensShader);
  if (o.lens) composer.addPass(lens);

  // Adaptive quality: if frames run slow for a couple of seconds, step the resolution down.
  let dpr = Math.min(devicePixelRatio || 1, o.maxDpr), slow = 0, fast = 0, lastT = performance.now();
  const steps = [2, 1.5, 1.25, 1, 0.8];
  function applySize() {
    const w = canvas.clientWidth || 300, h = canvas.clientHeight || 300;
    renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
    composer.setPixelRatio(dpr); composer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  new ResizeObserver(applySize).observe(canvas); applySize();

  const stage = {
    renderer, scene, camera, composer, bloom, lens,
    render(t) {
      const now = performance.now(), ft = now - lastT; lastT = now;
      if (ft > 24) { slow += ft; fast = 0; } else { fast += ft; slow = Math.max(0, slow - ft * 0.5); }
      if (slow > 2000) { const i = steps.findIndex(s => s < dpr); if (i >= 0) { dpr = steps[i]; applySize(); } if (dpr <= 1) bloom.enabled = false; slow = 0; }
      if (fast > 8000 && dpr < Math.min(devicePixelRatio || 1, o.maxDpr)) { const up = [...steps].reverse().find(s => s > dpr); if (up) { dpr = Math.min(up, o.maxDpr); applySize(); bloom.enabled = o.bloom > 0; } fast = 0; }
      lens.uniforms.time.value = (t || now) * 0.001 % 100;
      if (o.transparent) renderer.render(scene, camera); // direct render keeps a clean alpha channel
      else composer.render();
    },
  };
  return stage;
}

// A key light with soft shadows that follows a focus point (keeps the shadow map tight = crisp shadows).
export function keyLight(scene, { color = 0xfff1dc, intensity = 2.2, size = 8, mapSize = 1024, offset = [5, 9, 6] } = {}) {
  const l = new THREE.DirectionalLight(color, intensity);
  l.castShadow = true; l.shadow.mapSize.set(mapSize, mapSize); l.shadow.bias = -0.0004; l.shadow.normalBias = 0.02; l.shadow.radius = 4;
  Object.assign(l.shadow.camera, { left: -size, right: size, top: size, bottom: -size, near: 0.5, far: 60 });
  l.userData.offset = new THREE.Vector3(...offset);
  l.follow = (x, y, z) => { l.position.set(x, y, z).add(l.userData.offset); l.target.position.set(x, y, z); l.target.updateMatrixWorld(); };
  scene.add(l, l.target);
  return l;
}

// ---------- procedural PBR textures ----------
// Tileable value noise: the lattice wraps with period p, so textures repeat seamlessly.
function makeNoise(seed) {
  const perm = new Uint8Array(512); let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const vals = new Float32Array(256).map(() => rnd());
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
  const lat = (x, y) => vals[perm[(perm[x & 255] + y) & 511]];
  const smooth = (t) => t * t * (3 - 2 * t);
  const noise = (x, y, p) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const x0 = ((xi % p) + p) % p, y0 = ((yi % p) + p) % p, x1 = (x0 + 1) % p, y1 = (y0 + 1) % p;
    const u = smooth(xf), v = smooth(yf);
    const a = lat(x0, y0), b = lat(x1, y0), c = lat(x0, y1), d = lat(x1, y1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const fbm = (x, y, p, oct = 5, ridge = false) => {
    let sum = 0, amp = 0.5, f = 1, norm = 0;
    for (let o = 0; o < oct; o++) { let n = noise(x * f, y * f, p * f); if (ridge) n = 1 - Math.abs(n * 2 - 1); sum += n * amp; norm += amp; amp *= 0.5; f *= 2; }
    return sum / norm;
  };
  return { noise, fbm, rnd };
}

// Height functions per material type; u, v in [0,1). Return height in [0,1].
const PATTERNS = {
  rock: (N, u, v, p) => Math.pow(N.fbm(u * p, v * p, p, 6, true), 1.6) * 0.8 + N.fbm(u * p * 4, v * p * 4, p * 4, 3) * 0.2,
  dirt: (N, u, v, p) => { const b = N.fbm(u * p, v * p, p, 5); const peb = N.noise(u * p * 6, v * p * 6, p * 6); return b * 0.7 + (peb > 0.72 ? (peb - 0.72) * 2.5 : 0) * 0.5 + N.noise(u * p * 20, v * p * 20, p * 20) * 0.1; },
  metal: (N, u, v, p) => 0.5 + (N.noise(u * p * 0.5, v * p * 40, p * 40) - 0.5) * 0.25 + (N.noise(u * p * 8, v * p * 8, p * 8) > 0.8 ? -0.2 : 0),
  wood: (N, u, v, p) => { const w = N.fbm(u * p, v * p * 0.25, p, 3) * 6; const ring = Math.sin((u * p * 2 + w) * Math.PI * 2) * 0.5 + 0.5; return ring * 0.6 + N.noise(u * p * 30, v * p * 2, p * 30) * 0.4; },
  stone: (N, u, v, p) => { // cobbles via cellular distance on a jittered grid
    const cu = u * p, cv = v * p, iu = Math.floor(cu), iv = Math.floor(cv); let d1 = 9, d2 = 9;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const gx = iu + a, gy = iv + b, wx = ((gx % p) + p) % p, wy = ((gy % p) + p) % p;
      const px = gx + N.noise(wx * 7.1, wy * 3.3, 999), py = gy + N.noise(wx * 1.7, wy * 9.9, 999);
      const d = Math.hypot(cu - px, cv - py); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
    }
    return Math.min(1, (d2 - d1) * 2.2) * 0.8 + N.fbm(u * p * 3, v * p * 3, p * 3, 3) * 0.2;
  },
  sand: (N, u, v, p) => Math.sin((v * p + N.fbm(u * p, v * p, p, 3) * 2) * Math.PI * 2) * 0.15 + 0.5 + (N.noise(u * p * 40, v * p * 40, p * 40) - 0.5) * 0.3,
  fabric: (N, u, v, p) => { const k = p * 16; const w = Math.sin(u * k * Math.PI * 2) * Math.sin(v * k * Math.PI * 2); return 0.5 + w * 0.3 + (N.noise(u * p * 4, v * p * 4, p * 4) - 0.5) * 0.3; },
  ice: (N, u, v, p) => N.fbm(u * p, v * p, p, 4) * 0.5 + (N.fbm(u * p * 2, v * p * 2, p * 2, 3, true) > 0.93 ? 0.5 : 0),
  bark: (N, u, v, p) => N.fbm(u * p * 3, v * p * 0.4, p * 3, 5, true),
  plaster: (N, u, v, p) => N.fbm(u * p, v * p, p, 5) * 0.6 + N.noise(u * p * 25, v * p * 25, p * 25) * 0.4,
  water: (N, u, v, p) => N.fbm(u * p, v * p, p, 5),
  tiles: (N, u, v, p) => { // overlapping roof tiles: staggered rows of rounded tile bellies
    const row = v * p * 2, rf = row - Math.floor(row), col = u * p * 3 + (Math.floor(row) % 2) * 0.5, cf = col - Math.floor(col);
    return (1 - rf) * 0.55 + Math.sin(cf * Math.PI) * 0.35 + N.noise(u * p * 12, v * p * 12, p * 12) * 0.1; },
  planks: (N, u, v, p) => { // boards along u with dark seams and grain
    const b = v * p * 2, bf = b - Math.floor(b), seam = Math.min(bf, 1 - bf) < 0.04 ? 0 : 1;
    return seam * (0.55 + (N.noise(u * p * 1.5, Math.floor(b) * 7.3, p * 1.5) - 0.5) * 0.3 + (N.noise(u * p * 24, v * p * 3, p * 24) - 0.5) * 0.25); },
};

const cache = new Map();
/**
 * makePBR({ type, color, color2, size, scale, rough:[min,max], normal, seed, repeat })
 * Returns { map, normalMap, roughnessMap } as tiled CanvasTextures. Albedo blends color -> color2 by height.
 */
export function makePBR(opts) {
  const o = { type: "rock", color: "#7a6a58", color2: "#4a3e33", size: 256, scale: 4, rough: [0.7, 1], normal: 2.5, seed: 1, repeat: 1, ...opts };
  const key = JSON.stringify(o); if (cache.has(key)) return cache.get(key);
  const N = makeNoise(o.seed), S = o.size, fn = PATTERNS[o.type];
  const h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) h[y * S + x] = fn(N, x / S, y / S, o.scale);
  const c1 = new THREE.Color(o.color), c2 = new THREE.Color(o.color2);
  const mk = () => { const c = document.createElement("canvas"); c.width = c.height = S; return c; };
  const albedo = mk(), nrm = mk(), rgh = mk();
  const A = albedo.getContext("2d").createImageData(S, S), NI = nrm.getContext("2d").createImageData(S, S), R = rgh.getContext("2d").createImageData(S, S);
  const at = (x, y) => h[((y + S) % S) * S + ((x + S) % S)];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4, v = h[y * S + x];
    // albedo: colour ramp + fine speckle
    const t = Math.min(1, Math.max(0, v * 1.15 - 0.05));
    const sp = (N.noise(x * 0.9, y * 0.9, S) - 0.5) * 0.08;
    A.data[i] = Math.min(255, (c2.r + (c1.r - c2.r) * t + sp) * 255);
    A.data[i + 1] = Math.min(255, (c2.g + (c1.g - c2.g) * t + sp) * 255);
    A.data[i + 2] = Math.min(255, (c2.b + (c1.b - c2.b) * t + sp) * 255); A.data[i + 3] = 255;
    // normal from height gradient (Sobel-lite)
    const dx = (at(x + 1, y) - at(x - 1, y)) * o.normal, dy = (at(x, y + 1) - at(x, y - 1)) * o.normal;
    const len = Math.hypot(dx, dy, 1);
    NI.data[i] = (-dx / len * 0.5 + 0.5) * 255; NI.data[i + 1] = (dy / len * 0.5 + 0.5) * 255; NI.data[i + 2] = (1 / len * 0.5 + 0.5) * 255; NI.data[i + 3] = 255;
    // roughness: crevices rougher, peaks smoother
    const r = o.rough[1] - (o.rough[1] - o.rough[0]) * v;
    R.data[i] = R.data[i + 1] = R.data[i + 2] = r * 255; R.data[i + 3] = 255;
  }
  albedo.getContext("2d").putImageData(A, 0, 0); nrm.getContext("2d").putImageData(NI, 0, 0); rgh.getContext("2d").putImageData(R, 0, 0);
  const tex = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(o.repeat, o.repeat); t.anisotropy = 4; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  const out = { map: tex(albedo, true), normalMap: tex(nrm), roughnessMap: tex(rgh) };
  cache.set(key, out);
  return out;
}

// A PBR material from a procedural texture set.
export function pbrMaterial(texOpts, matOpts = {}) {
  const t = makePBR(texOpts);
  const m = new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, roughness: 1, metalness: 0, ...matOpts });
  m.normalScale = new THREE.Vector2(1, 1);
  return m;
}

// Soft round glow sprite (particles, lights, bubbles, sparks).
let glowTex;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d"), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.35, "rgba(255,255,255,.45)"); grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c); glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}
export function glowSprite(color, size = 1, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(size); return s;
}

// Floating dust / plankton / embers: a Points cloud that drifts inside a box around a focus point.
export function driftParticles(scene, { count = 200, size = 0.05, color = 0xffffff, box = [10, 10, 10], opacity = 0.6, speed = 0.1 } = {}) {
  const pos = new Float32Array(count * 3), vel = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) for (let k = 0; k < 3; k++) { pos[i * 3 + k] = (Math.random() - 0.5) * box[k]; vel[i * 3 + k] = (Math.random() - 0.5) * speed; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: glowTexture(), color, size, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
  pts.frustumCulled = false; scene.add(pts);
  pts.tick = (dt, cx = 0, cy = 0, cz = 0) => {
    for (let i = 0; i < count; i++) for (let k = 0; k < 3; k++) {
      const j = i * 3 + k, c = [cx, cy, cz][k]; pos[j] += vel[j] * dt;
      if (pos[j] - c > box[k] / 2) pos[j] -= box[k]; else if (pos[j] - c < -box[k] / 2) pos[j] += box[k];
    }
    geo.attributes.position.needsUpdate = true;
  };
  return pts;
}

// Shorthand for common physical materials.
export const mats = {
  jelly: (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.12, transmission: 0.85, thickness: 1.2, ior: 1.35, attenuationColor: new THREE.Color(color), attenuationDistance: 0.8, clearcoat: 1, clearcoatRoughness: 0.08, ...o }),
  glass: (o = {}) => new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, transmission: 1, thickness: 0.2, ior: 1.5, ...o }),
  gold: (o = {}) => new THREE.MeshStandardMaterial({ color: 0xffc34d, metalness: 1, roughness: 0.22, ...o }),
  steel: (o = {}) => new THREE.MeshStandardMaterial({ color: 0xb8bec8, metalness: 0.9, roughness: 0.32, ...o }),
  fabric: (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.85, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xffffff), ...o }),
  skin: (color = 0xf1c7a0, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color(0xffd0b0), clearcoat: 0.1, ...o }),
  plastic: (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2, ...o }),
  emissive: (color, intensity = 3, o = {}) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, ...o }),
};
