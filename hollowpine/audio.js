// Hollow Pine — procedural audio. No sound files: every note and hit is synthesized with Web Audio.
// Music: a Japanese in-scale (miyako-bushi) score with koto plucks, a shakuhachi-style flute, a low drone
// and taiko drums, layered by intensity (menu → explore → combat → boss), plus a heartbeat at low health.
// SFX: blade swings, flesh hits, steel clangs, parries, takedowns, dodges, alerts and stings. Haptics too.

let ac = null, master, musicBus, sfxBus, verb, noiseBuf;
let muted = false, musicOn = true, mode = "silent", target = { drone: 0, koto: 0, flute: 0, taiko: 0 }, level = { drone: 0, koto: 0, flute: 0, taiko: 0 };
let droneNodes = null, nextStep = 0, step = 0, bar = 0, timer = null, heart = 0, heartT = 0;
const A = {};
export default A;

// D miyako-bushi: D Eb G A Bb (semitones 0 1 5 7 8), spread over octaves.
const SCALE = [0, 1, 5, 7, 8];
const D3 = 146.83;
const note = (deg, oct = 0) => D3 * Math.pow(2, (SCALE[((deg % 5) + 5) % 5] + 12 * (Math.floor(deg / 5) + oct)) / 12);
const MODES = {
  silent: { drone: 0, koto: 0, flute: 0, taiko: 0, bpm: 70 },
  menu: { drone: 0.5, koto: 0.7, flute: 0.8, taiko: 0, bpm: 64 },
  explore: { drone: 0.6, koto: 0.6, flute: 0.5, taiko: 0.12, bpm: 76 },
  combat: { drone: 0.7, koto: 0.8, flute: 0.25, taiko: 0.9, bpm: 108 },
  boss: { drone: 0.9, koto: 0.9, flute: 0.4, taiko: 1, bpm: 118 },
  victory: { drone: 0.3, koto: 1, flute: 1, taiko: 0.2, bpm: 72 },
};

function ensure() {
  if (ac) { if (ac.state === "suspended") ac.resume(); return true; }
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.85; master.connect(comp).connect(ac.destination);
    verb = ac.createConvolver(); verb.buffer = impulse(2.6, 2.4);
    const vg = ac.createGain(); vg.gain.value = 0.32; verb.connect(vg).connect(master);
    musicBus = ac.createGain(); musicBus.gain.value = musicOn ? 0.5 : 0; musicBus.connect(master); musicBus.connect(verb);
    sfxBus = ac.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
    const send = ac.createGain(); send.gain.value = 0.18; sfxBus.connect(send).connect(verb);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    startDrone();
    nextStep = ac.currentTime + 0.1;
    timer = setInterval(schedule, 25);
    return true;
  } catch (e) { ac = null; return false; }
}
function impulse(sec, decay) {
  const n = Math.floor(ac.sampleRate * sec), b = ac.createBuffer(2, n, ac.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
  return b;
}
// Browsers only allow audio after a gesture: unlock on the first tap or key.
const unlock = () => ensure();
addEventListener("pointerdown", unlock, { passive: true });
addEventListener("keydown", unlock);

// ---------- building blocks ----------
function env(g, t, a, peak, d, end = 0.0001) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(end, t + a + d); }
function osc(type, f, t, dur, out, vol, a = 0.005, d = dur) { const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); env(g, t, a, vol, d); o.connect(g).connect(out); o.start(t); o.stop(t + a + d + 0.05); return o; }
function noise(t, dur, out, vol, type = "bandpass", f = 1000, q = 1, a = 0.002, fEnd) {
  const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = noiseBuf; s.loop = true; fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q; if (fEnd) fl.frequency.exponentialRampToValueAtTime(fEnd, t + dur);
  env(g, t, a, vol, dur); s.connect(fl).connect(g).connect(out); s.start(t, Math.random() * 0.5); s.stop(t + a + dur + 0.05); return fl;
}

// instruments
function koto(f, t, vol = 0.18, bright = 1) {
  const g = ac.createGain(), lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(2600 * bright, t); lp.frequency.exponentialRampToValueAtTime(500, t + 1.2); lp.Q.value = 2;
  env(g, t, 0.003, vol, 1.6); lp.connect(g).connect(musicBus);
  for (const [type, m, v] of [["triangle", 1, 1], ["sawtooth", 1.002, 0.25], ["sine", 2, 0.35]]) { const o = ac.createOscillator(), og = ac.createGain(); o.type = type; o.frequency.value = f * m; og.gain.value = v; o.connect(og).connect(lp); o.start(t); o.stop(t + 1.8); }
}
function flute(f, t, dur, vol = 0.09) {
  const o = ac.createOscillator(), g = ac.createGain(), vib = ac.createOscillator(), vg = ac.createGain();
  o.type = "sine"; o.frequency.setValueAtTime(f * 0.97, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.12);
  vib.frequency.value = 5.2; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.012, t + dur * 0.6); vib.connect(vg).connect(o.frequency);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.15); g.gain.setValueAtTime(vol, t + dur - 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.3);
  o.connect(g).connect(musicBus); o.start(t); vib.start(t); o.stop(t + dur + 0.4); vib.stop(t + dur + 0.4);
  noise(t, dur * 0.8, musicBus, vol * 0.25, "bandpass", f * 2, 6, 0.1); // breath
}
function taiko(t, vol = 0.7, p = 1, out = musicBus) {
  const o = ac.createOscillator(), g = ac.createGain(); o.type = "sine"; o.frequency.setValueAtTime(120 * p, t); o.frequency.exponentialRampToValueAtTime(48 * p, t + 0.28);
  env(g, t, 0.002, vol, 0.7); o.connect(g).connect(out); o.start(t); o.stop(t + 0.8);
  noise(t, 0.09, out, vol * 0.5, "lowpass", 400, 0.7);
}
function ka(t, vol = 0.18) { noise(t, 0.035, musicBus, vol, "highpass", 3500, 0.8); osc("square", 900, t, 0.03, musicBus, vol * 0.25); }
function startDrone() {
  const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 280; lp.Q.value = 1.5;
  const g = ac.createGain(); g.gain.value = 0; lp.connect(g).connect(musicBus);
  const os = [note(0, -1), note(0, -1) * 1.004, note(3, -1)].map((f) => { const o = ac.createOscillator(); o.type = "sawtooth"; o.frequency.value = f; const og = ac.createGain(); og.gain.value = 0.06; o.connect(og).connect(lp); o.start(); return o; });
  const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 120; lfo.connect(lg).connect(lp.frequency); lfo.start();
  droneNodes = { g, lp };
}

// ---------- the score: a 16-step sequencer with seeded-random phrases ----------
let phrase = [], phraseAt = 0, seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
function schedule() {
  if (!ac) return;
  const M = MODES[mode] || MODES.silent;
  for (const k in level) level[k] += (target[k] - level[k]) * 0.04;
  if (droneNodes) { droneNodes.g.gain.setTargetAtTime(level.drone * 0.9, ac.currentTime, 0.4); droneNodes.lp.frequency.setTargetAtTime(220 + level.taiko * 260, ac.currentTime, 0.5); }
  const sp = 60 / M.bpm / 4;
  while (nextStep < ac.currentTime + 0.15) {
    const t = nextStep, s = step % 16;
    if (musicOn && !muted) playStep(t, s, sp);
    // heartbeat at low health
    if (heart > 0 && (step % Math.max(4, Math.round(0.85 / sp))) === 0) { taiko(t, 0.35 * heart, 0.55, sfxBus); taiko(t + 0.14, 0.25 * heart, 0.5, sfxBus); }
    nextStep += sp; step++; if (s === 15) bar++;
  }
}
function playStep(t, s, sp) {
  const L = level;
  // koto: sparse in exploration, a driving ostinato in combat
  if (L.koto > 0.05) {
    const combat = L.taiko > 0.5;
    const pattern = combat ? [0, 2, 3, 6, 8, 10, 11, 14] : [0, 6, 10];
    if (pattern.includes(s) && (combat || rnd() < 0.8)) {
      const deg = combat ? [0, 2, 3, 2, 0, 4, 3, 1][pattern.indexOf(s)] + (bar % 4 === 3 ? 1 : 0) : Math.floor(rnd() * 8);
      koto(note(deg, combat ? 0 : 0), t, 0.13 * L.koto * (s === 0 ? 1.2 : 1), combat ? 1.3 : 0.8);
      if (!combat && rnd() < 0.3) koto(note(deg + 2), t + sp * 1.5, 0.08 * L.koto, 0.7);
    }
  }
  // flute: a new phrase every 4 bars
  if (L.flute > 0.05 && s === 0 && bar % 4 === 0 && t > phraseAt) {
    const n = 3 + Math.floor(rnd() * 3); let deg = 5 + Math.floor(rnd() * 4), tt = t + sp * 2;
    for (let i = 0; i < n; i++) { const dur = sp * (i === n - 1 ? 10 : 3 + Math.floor(rnd() * 4)); flute(note(deg, 0), tt, dur, 0.07 * L.flute); tt += dur; deg += rnd() < 0.5 ? -1 : 1; }
    phraseAt = tt;
  }
  // taiko: heartbeat-slow in exploration, full ensemble in combat and boss fights
  if (L.taiko > 0.05) {
    const big = L.taiko > 0.5;
    const hits = big ? { 0: 1, 3: 0.55, 6: 0.7, 8: 0.9, 11: 0.5, 13: 0.45, 14: 0.75 } : { 0: 0.6, 8: 0.35 };
    if (hits[s]) taiko(t, 0.55 * L.taiko * hits[s], s === 0 ? 0.85 : 1);
    if (big && (s === 4 || s === 12)) ka(t, 0.16 * L.taiko);
    if (mode === "boss" && s === 0 && bar % 2 === 0) taiko(t, 0.9, 0.6);
  }
}

// ---------- public API ----------
A.setMode = (m) => { if (!MODES[m]) return; mode = m; const M = MODES[m]; target = { drone: M.drone, koto: M.koto, flute: M.flute, taiko: M.taiko }; };
A.mode = () => mode;
A.setHeart = (v) => { heart = Math.max(0, Math.min(1, v)); };
A.setMuted = (m) => { muted = m; if (ac) master.gain.setTargetAtTime(m ? 0 : 0.85, ac.currentTime, 0.05); };
A.setMusic = (on) => { musicOn = on; if (ac) musicBus.gain.setTargetAtTime(on ? 0.5 : 0, ac.currentTime, 0.2); };
A.music = () => musicOn;

const SFX = {
  swing: (t, v = 1) => { noise(t, 0.16, sfxBus, 0.3 * v, "bandpass", 700, 1.4, 0.02, 3500); },
  heavy: (t) => { noise(t, 0.28, sfxBus, 0.35, "bandpass", 400, 1.2, 0.04, 2000); },
  hit: (t, v = 1) => { osc("sine", 160, t, 0.14, sfxBus, 0.5 * v); noise(t, 0.08, sfxBus, 0.45 * v, "lowpass", 1400, 0.8); noise(t + 0.01, 0.12, sfxBus, 0.18 * v, "bandpass", 2500, 3); },
  crit: (t) => { SFX.hit(t, 1.3); osc("sine", 70, t, 0.4, sfxBus, 0.6); noise(t, 0.3, sfxBus, 0.2, "highpass", 5000, 0.7); },
  clang: (t, v = 1) => { for (const [f, d] of [[1230, 0.5], [1847, 0.35], [2651, 0.28], [3620, 0.2]]) osc("sine", f * (0.97 + Math.random() * 0.06), t, d, sfxBus, 0.12 * v); noise(t, 0.05, sfxBus, 0.35 * v, "highpass", 4000, 0.7); },
  parry: (t) => { SFX.clang(t, 1.6); osc("triangle", 2480, t, 1.1, sfxBus, 0.09); osc("sine", 3720, t, 0.9, sfxBus, 0.06); osc("sine", 90, t, 0.3, sfxBus, 0.5); },
  takedown: (t) => { noise(t, 0.35, sfxBus, 0.25, "bandpass", 300, 1, 0.25, 4000); SFX.crit(t + 0.3); osc("sine", 55, t + 0.3, 1.2, sfxBus, 0.5); },
  dodge: (t) => { noise(t, 0.22, sfxBus, 0.22, "bandpass", 1800, 1.5, 0.01, 500); },
  hurt: (t) => { osc("sine", 110, t, 0.25, sfxBus, 0.6); noise(t, 0.12, sfxBus, 0.4, "lowpass", 900, 1); osc("sawtooth", 80, t, 0.18, sfxBus, 0.12); },
  alert: (t) => { osc("sawtooth", note(4, 1), t, 0.25, sfxBus, 0.12); osc("sawtooth", note(5, 1), t + 0.09, 0.4, sfxBus, 0.14); taiko(t, 0.6, 1.2, sfxBus); },
  suspicious: (t) => { osc("triangle", note(3, 1), t, 0.3, sfxBus, 0.06); },
  coin: (t) => { osc("triangle", 1760, t, 0.12, sfxBus, 0.08); osc("triangle", 2640, t + 0.05, 0.18, sfxBus, 0.07); },
  heal: (t) => { [0, 2, 4].forEach((d, i) => osc("sine", note(d, 1), t + i * 0.06, 0.4, sfxBus, 0.08)); },
  art: (t) => { noise(t, 0.4, sfxBus, 0.25, "bandpass", 500, 2, 0.05, 3000); osc("sine", note(4, 2), t + 0.1, 0.8, sfxBus, 0.07); },
  smoke: (t) => { noise(t, 0.9, sfxBus, 0.35, "lowpass", 900, 0.7, 0.01, 200); taiko(t, 0.4, 1.4, sfxBus); },
  break: (t) => { SFX.clang(t, 1.3); osc("square", 180, t, 0.5, sfxBus, 0.12); osc("sine", 45, t, 0.9, sfxBus, 0.6); noise(t, 0.4, sfxBus, 0.3, "bandpass", 700, 0.8); },
  boss: (t) => { taiko(t, 1, 0.6, sfxBus); osc("sine", note(0, -2), t, 3, sfxBus, 0.25); for (const [f, d] of [[180, 3], [263, 2.6], [391, 2.2]]) osc("sine", f, t + 0.02, d, sfxBus, 0.07); },
  victory: (t) => { [0, 2, 4, 5, 7].forEach((d, i) => koto(note(d, 1), t + i * 0.11, 0.2, 1.4)); taiko(t, 0.8, 0.8, sfxBus); },
  defeat: (t) => { osc("sine", note(0, -2), t, 3.5, sfxBus, 0.35); for (const [f, d] of [[143, 3.5], [211, 3], [297, 2.5]]) osc("sine", f, t, d, sfxBus, 0.08); },
  ui: (t) => { osc("sine", 820, t, 0.05, sfxBus, 0.12); noise(t, 0.02, sfxBus, 0.12, "bandpass", 2500, 2); },
  step: (t) => { noise(t, 0.05, sfxBus, 0.06, "lowpass", 600, 0.7); },
  land: (t) => { noise(t, 0.08, sfxBus, 0.15, "lowpass", 400, 0.7); },
  bow: (t) => { noise(t, 0.12, sfxBus, 0.15, "bandpass", 3000, 4, 0.005, 1200); osc("triangle", 180, t, 0.12, sfxBus, 0.08); },
};
A.sfx = (name, v) => { if (muted || !ensure() || !SFX[name]) return; try { SFX[name](ac.currentTime + 0.005, v); } catch (e) { /* audio node limits: skip */ } };
A.vibrate = (ms) => { try { if (navigator.vibrate && !muted) navigator.vibrate(ms); } catch (e) {} };
A.unlock = unlock;
