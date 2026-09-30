// Hollow Pine — gameplay: movement + collision, stealth (vision cones, awareness), takedowns, combos,
// dodge rolls, five assassin arts, enemy AI, five bosses with telegraphed moves, objectives and endless waves.
import W, * as world from "./world.js";
import { makeHuman, makeWolf, makeDummy, animate } from "./actors.js";
import { FOES, BOSSES, STAGES, LOOKS } from "./data.js";
import { THREE } from "../shared/realism.js";

const TAU = Math.PI * 2;
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const turn = (a, b, max) => a + Math.max(-max, Math.min(max, angDiff(a, b)));
const faceTo = (ax, az, bx, bz) => Math.atan2(bx - ax, bz - az);
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (list) => { const tot = list.reduce((s, [, w]) => s + w, 0); let r = Math.random() * tot; for (const [n, w] of list) { if ((r -= w) <= 0) return n; } return list[0][0]; };

export function createGame(ctx) {
  const G = { enemies: [], proj: [], pickups: [], pools: [], smokes: [], decals: [], paused: false, over: false };
  let P, L, t = 0, slow = 0, hitStop = 0, hintI = 0, hudT = 0, stats, bossE = null, goalBeacon = null, wave = 0, waveT = 0, endT = 0, endResult = null, kills = [];
  const stage = () => STAGES[ctx.stageIdx];

  // ---------- collision ----------
  const inFloor = (x, z, m) => W.floors.some(([x1, z1, x2, z2]) => x >= x1 + m && x <= x2 - m && z >= z1 + m && z <= z2 - m);
  function pushOut(e) {
    let hit = null;
    for (const c of W.colliders) {
      if (c.type === "circle") {
        const dx = e.x - c.x, dz = e.z - c.z, d = Math.hypot(dx, dz), min = c.r + e.r;
        if (d < min && d > 1e-4) { e.x = c.x + (dx / d) * min; e.z = c.z + (dz / d) * min; hit = c; }
      } else {
        const cx = Math.max(c.x1, Math.min(e.x, c.x2)), cz = Math.max(c.z1, Math.min(e.z, c.z2)), dx = e.x - cx, dz = e.z - cz, d = Math.hypot(dx, dz);
        if (d < e.r) {
          hit = c;
          if (d > 1e-4) { e.x = cx + (dx / d) * e.r; e.z = cz + (dz / d) * e.r; }
          else { const o = [[e.x - c.x1, -1, 0], [c.x2 - e.x, 1, 0], [e.z - c.z1, 0, -1], [c.z2 - e.z, 0, 1]].sort((a, b) => a[0] - b[0])[0]; if (o[1]) e.x = o[1] < 0 ? c.x1 - e.r : c.x2 + e.r; else e.z = o[2] < 0 ? c.z1 - e.r : c.z2 + e.r; }
        }
      }
    }
    return hit;
  }
  function move(e, dx, dz) {
    const ox = e.x, oz = e.z, m = Math.min(e.r * 0.5, 0.15);
    e.x += dx; e.z += dz;
    const hit = pushOut(e);
    if (!inFloor(e.x, e.z, m)) {
      const nx = e.x, nz = e.z; e.x = ox; e.z = oz;
      if (inFloor(nx, oz, m)) e.x = nx; else if (inFloor(ox, nz, m)) e.z = nz;
      return hit || "edge";
    }
    return hit;
  }
  function segBlocked(ax, az, bx, bz) { // line of sight vs walls and pillars
    const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 0.45);
    for (let i = 1; i < n; i++) {
      const x = ax + ((bx - ax) * i) / n, z = az + ((bz - az) * i) / n;
      for (const c of W.colliders) {
        if (c.type === "box" && c.block && x > c.x1 && x < c.x2 && z > c.z1 && z < c.z2) return true;
        if (c.pillar && Math.hypot(x - c.x, z - c.z) < c.r) return true;
      }
    }
    return false;
  }

  // ---------- setup ----------
  G.start = function (level, opts = {}) {
    L = level; t = 0; slow = 0; hintI = 0; wave = 0; waveT = 0; G.over = false; endResult = null; kills = [];
    G.enemies = []; G.proj = []; G.pickups = []; G.pools = []; G.smokes = []; G.decals = []; bossE = null;
    world.build(level);
    const st = stage();
    const h = makeHuman({ look: ctx.look, stage: ctx.stageIdx, unique: true });
    world.add(h.root);
    const S = ctx.stats;
    P = { x: level.start[0], z: level.start[1], face: Math.PI, r: 0.3 * Math.max(0.8, h.scale), h, hp: S.maxHp, maxHp: S.maxHp, act: null, actT: 0, actDur: 0, combo: 0, comboT: 0, queued: false,
      sneak: false, inv: 0, dodgeCd: 0, parryT: 0, parryCd: 0, cd: {}, vanish: 0, nextTD: false, dead: false, moveAmt: 0, speed: 4.4 * st.speed * S.speedMul, bladeLen: (LOOKS.blade.find((b) => b.id === ctx.look.blade) || LOOKS.blade[0]).len };
    G.P = P;
    stats = { kills: 0, takedowns: 0, poisonKills: 0, dodges: 0, parries: 0, breaks: 0, dmgTaken: 0, detected: false, silver: 0, xp: 0, multi: false, orbs: 0 };
    G.stats = stats;
    P.trail = world.trail(bladeColor()); world.add(P.trail);
    for (const [type, x, z, path, o] of level.enemies || []) spawn(type, x, z, path, o || {});
    if (level.boss) { const [id, x, z] = level.boss; bossE = spawnBoss(id, x, z); }
    if (level.goal && level.goal.type === "reach") {
      const [gx, gz] = level.goal.at; const g = new THREE.Group(); g.position.set(gx, 0, gz);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(level.goal.r * 0.7, level.goal.r * 0.9, 9, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd08a, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      beam.position.y = 4.5; g.add(beam);
      const ring = new THREE.Mesh(new THREE.RingGeometry(level.goal.r - 0.15, level.goal.r, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd08a, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
      ring.position.y = 0.05; g.add(ring); world.add(g); goalBeacon = g;
    } else goalBeacon = null;
    if (opts.endless) { G.endless = true; nextWave(); } else G.endless = false;
    placeActors(0.016);
    world.camFollow(P.x, P.z, 1, 1, true);
    ctx.hud(hudState());
  };

  function spawn(type, x, z, path, o = {}) {
    const def = FOES[type], tier = G.endless ? 0.6 + wave * 0.28 : L.tier;
    const h = def.kit === "wolf" ? makeWolf() : def.kit === "dummy" ? makeDummy() : makeHuman({ kit: def.kit, unique: def.hidden });
    world.add(h.root);
    const E = { type, def, h, x, z, r: def.r || 0.34, face: o.face ?? Math.PI * 0 + (path ? faceTo(x, z, path[1 % path.length][0], path[1 % path.length][1]) : 0), baseFace: o.face ?? 0, look: o.look || 0,
      hp: def.hp * (1 + 0.4 * tier), maxHp: def.hp * (1 + 0.4 * tier), dmg: def.dmg * (1 + 0.3 * tier), state: "patrol", aware: 0, path, pi: 1 % (path ? path.length : 1), dir: 1, wait: 0,
      act: null, actT: 0, actDur: 0, cd: rnd(0.5, 1.2), stun: 0, invis: 0, posture: 0, postT: 0, poison: null, target: !!o.target, lost: 0, dead: false, deadT: 0, xp: def.xp * (1 + 0.35 * tier), silver: def.silver * (1 + 0.3 * tier), id: Math.random() * 100 };
    if (o.face == null && !path) E.face = Math.PI * (Math.random() < 0.5 ? 0 : 1) + rnd(-0.6, 0.6);
    E.mk = world.marker(); E.bar = world.hpBar(); world.add(E.mk); world.add(E.bar);
    if (def.vision && !def.hidden) { E.cone = world.visionCone(def.vision, def.fov); world.add(E.cone); }
    if (E.target) { E.tmk = world.marker(); E.tmk.show("✦", "#ffd24a"); E.tmk.scale.setScalar(0.5); world.add(E.tmk); }
    if (def.hidden) { E.eyes = new THREE.Group(); for (const s of [-1, 1]) { const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: null, color: 0x9fd8ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); g.material.map = eyeTex(); g.scale.setScalar(0.18); g.position.x = s * 0.07; E.eyes.add(g); } world.add(E.eyes); }
    if (G.endless || o.alert) alert(E, false);
    G.enemies.push(E); return E;
  }
  let _eyeTex; const eyeTex = () => _eyeTex || (_eyeTex = (() => { const s = world.coin; return new THREE.CanvasTexture((() => { const c = document.createElement("canvas"); c.width = c.height = 32; const g = c.getContext("2d"); const r = g.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, "#fff"); r.addColorStop(0.3, "rgba(160,220,255,.8)"); r.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = r; g.fillRect(0, 0, 32, 32); return c; })()); })());

  function spawnBoss(id, x, z, echo = 0) {
    const B = BOSSES[id], tier = G.endless ? 0.6 + wave * 0.28 : L.tier;
    const h = makeHuman({ kit: B.kit });
    world.add(h.root);
    const hpMul = echo ? 0.45 + wave * 0.03 : 1 + 0.35 * tier;
    const E = { type: id, boss: true, bdef: B, def: { name: B.name, vision: 9, fov: 120, reach: 2.4, speed: B.speed, kit: B.kit }, h, x, z, r: 0.42 * (B.scale || 1), face: 0,
      hp: B.hp * hpMul, maxHp: B.hp * hpMul, dmg: B.dmg * (1 + 0.22 * tier), state: id === "grel" && !echo ? "patrol" : "intro", aware: 0, act: null, actT: 0, actDur: 0, stun: 0, poison: null,
      posture: 0, postT: 0, m: null, mcd: 1.2, phase: 1, summonCd: 0, invis: 0, dead: false, deadT: 0, xp: B.xp * (echo ? 0.5 : 1), silver: B.silver * (echo ? 0.5 : 1), echo, id: Math.random() * 100, lost: 0, yielded: false };
    E.mk = world.marker(); E.bar = world.hpBar(); world.add(E.mk); world.add(E.bar);
    E.face = faceTo(x, z, P.x, P.z);
    G.enemies.push(E); return E;
  }

  // ---------- input ----------
  const inp = { mx: 0, mz: 0 };
  G.setMove = (x, z) => { inp.mx = x; inp.mz = z; };
  G.press = (what) => {
    if (G.over || G.paused || !P || P.dead) return;
    if (what === "attack") attack();
    else if (what === "dodge") dodge();
    else if (what === "sneak") { P.sneak = !P.sneak; ctx.sfx("ui"); }
    else if (what === "parry") parry();
    else useAbility(what);
  };

  // ---------- player actions ----------
  function nearestFoe(range, filter = () => true) {
    let best = null, bd = range;
    for (const E of G.enemies) { if (E.dead || E.invis > 0 || !filter(E)) continue; const d = Math.hypot(E.x - P.x, E.z - P.z); if (d < bd) { bd = d; best = E; } }
    return best;
  }
  const canTakedown = (E) => !E.dead && (E.boss ? E.stun > 0 : E.state !== "alert" || E.stun > 0 || P.nextTD);
  G.takedownTarget = () => P && !P.act ? nearestFoe(2.3, (E) => canTakedown(E) && !E.boss) : null;

  function attack() {
    if (P.act === "roll" || P.act === "takedown" || P.act === "spin") return;
    if (P.act && P.act.startsWith("slash")) { if (P.actT > P.actDur * 0.45) P.queued = true; return; }
    const td = nearestFoe(2.3, canTakedown);
    if (td) { startTakedown(td); return; }
    const tgt = nearestFoe(3.6);
    if (tgt) P.face = faceTo(P.x, P.z, tgt.x, tgt.z);
    P.combo = P.comboT > 0 ? (P.combo + 1) % 3 : 0;
    P.act = "slash" + (P.combo + 1); P.actT = 0; P.actDur = P.combo === 2 ? 0.5 : 0.34; P.hitDone = false; P.queued = false;
    ctx.sfx(P.combo === 2 ? "heavy" : "swing");
  }
  function startTakedown(E) {
    P.act = "takedown"; P.actT = 0; P.actDur = 0.55; P.td = E; P.hitDone = false; P.face = faceTo(P.x, P.z, E.x, E.z);
    E.held = true; E.act = "hit"; E.actT = 0; E.actDur = 0.6;
    slow = 0.55; world.shake(0.12); ctx.sfx("takedown"); ctx.vibrate(60);
    world.cinematic((P.x + E.x) / 2, (P.z + E.z) / 2, P.face + Math.PI / 2 + (Math.random() < 0.5 ? 0.35 : -0.35), 0.8, 3.2 * Math.max(0.8, P.h.scale), 1.25 * Math.max(0.8, P.h.scale));
  }
  function dodge() {
    if (P.dodgeCd > 0 || P.act === "roll" || P.act === "takedown") return;
    const mx = inp.mx, mz = inp.mz;
    if (Math.hypot(mx, mz) > 0.2) P.face = Math.atan2(mx, mz);
    P.act = "roll"; P.actT = 0; P.actDur = 0.42; P.inv = 0.38; P.dodgeCd = 0.62;
    W.fx.burst(P.x, 0.1, P.z, "snow", 6); ctx.sfx("dodge");
  }
  // Parry: a short window that deflects melee blows and arrows. Success costs the attacker posture.
  function parry() {
    if (P.parryCd > 0 || P.act === "roll" || P.act === "takedown" || P.act === "spin") return;
    const tgt = nearestFoe(4); if (tgt) P.face = faceTo(P.x, P.z, tgt.x, tgt.z);
    P.act = "parry"; P.actT = 0; P.actDur = 0.36; P.parryT = 0.24; P.parryCd = 0.5;
    ctx.sfx("swing", 0.5);
  }
  function parried(E, x, z) {
    stats.parries++; P.parryT = 0; P.parryCd = 0; P.act = "parry"; P.actT = 0.1; P.actDur = 0.36;
    const hx = (P.x + x) / 2, hz = (P.z + z) / 2;
    W.fx.burst(hx, 1.2 * P.h.scale, hz, "parry", 30); W.fx.ring(hx, hz, 1.6, 0xfff0c0, 0.3, 1.0);
    ctx.float(P.x, 2.2 * P.h.scale, P.z, "PARRY", "parry"); ctx.sfx("parry"); ctx.vibrate(40);
    hitStop = 0.13; slow = Math.max(slow, 0.25); world.flash(0xfff4e0, 0.3); world.aberrate(0.8); world.punch(Math.sin(P.face), Math.cos(P.face), 0.2);
    if (E && !E.dead) {
      addPosture(E, E.boss ? 34 : 100);
      if (!E.boss && E.stun <= 0) { E.act = "hit"; E.actT = 0; E.actDur = 0.5; clearDecal(E); }
      if (E.boss && E.m && E.stun <= 0) { endMove(E); E.act = "hit"; E.mcd = 0.9; }
    }
  }
  function addPosture(E, amt) {
    if (E.dead || E.stun > 0) return;
    E.posture = (E.posture || 0) + amt; E.postT = 1.6;
    if (E.posture >= 100) {
      E.posture = 0; E.stun = E.boss ? 2.8 : 2.2; stats.breaks++; clearDecal(E); if (E.boss && E.m) endMove(E);
      ctx.float(E.x, 2.5 * (E.h.scale || 1), E.z, E.boss ? "POSTURE BROKEN" : "BROKEN", "crit"); ctx.sfx("break"); ctx.vibrate(70);
      W.fx.ring(E.x, E.z, 2.2, 0xff3a2a, 0.45); W.fx.burst(E.x, 1.3, E.z, "ink", 24); world.flash(0x9b1420, 0.3); slow = Math.max(slow, 0.35);
      if (!E.boss) { E.state = "suspicious"; E.aware = 0.5; }
    }
  }
  function cdOf(id) { return ({ step: 7, smoke: 14, dart: 4, vanish: 20, storm: 12 })[id] * ctx.stats.cdMul; }
  function useAbility(id) {
    const rank = ctx.stats.abilities[id] || 0;
    if (!rank || (P.cd[id] || 0) > 0 || P.act === "takedown") return;
    if (id === "step") {
      const E = nearestFoe(10);
      if (!E) { ctx.float(P.x, 1.6, P.z, "No target", "info"); return; }
      W.fx.burst(P.x, 0.2, P.z, "shadow", 22);
      const back = [E.x - Math.sin(E.face) * (E.r + 0.7), E.z - Math.cos(E.face) * (E.r + 0.7)];
      const side = [E.x + (P.x - E.x) / Math.hypot(P.x - E.x, P.z - E.z) * (E.r + 0.7), E.z + (P.z - E.z) / Math.hypot(P.x - E.x, P.z - E.z) * (E.r + 0.7)];
      const spot = inFloor(back[0], back[1], 0.1) ? back : side;
      P.x = spot[0]; P.z = spot[1]; pushOut(P); P.face = faceTo(P.x, P.z, E.x, E.z);
      W.fx.burst(P.x, 0.2, P.z, "shadow", 22); ctx.sfx("art");
      if (canTakedown(E) && !E.boss) startTakedown(E);
      else { P.act = "slash3"; P.actT = 0.1; P.actDur = 0.5; P.hitDone = true; hurt(E, ctx.stats.dmg * (2.2 + 0.3 * rank), { crit: true, from: P, kind: "step" }); W.fx.slash(E.x, 1.1, E.z, P.face, 0xb08aff, false, 0.8, 1.2); }
    } else if (id === "smoke") {
      const r = 3.2 + 0.3 * rank;
      G.smokes.push({ x: P.x, z: P.z, r, t: 4 + 0.3 * rank });
      for (let i = 0; i < 50; i++) W.fx.alpha.spawn(P.x + rnd(-r, r) * 0.7, rnd(0.2, 1.6), P.z + rnd(-r, r) * 0.7, rnd(-0.6, 0.6), rnd(0, 0.5), rnd(-0.6, 0.6), rnd(3, 4.5), 1.4, 3.4, [0.7, 0.7, 0.72, 0.7], [0.6, 0.6, 0.62, 0], -0.05, 0.8);
      for (const E of G.enemies) if (!E.dead && Math.hypot(E.x - P.x, E.z - P.z) < r + 0.5) {
        E.stun = E.boss ? 1.2 + 0.2 * rank : 2.5 + 0.4 * rank; E.act = null; clearDecal(E);
        if (!E.boss) { E.state = "suspicious"; E.aware = 0.4; E.lost = 0; } else if (E.m) endMove(E);
      }
      ctx.sfx("smoke"); world.shake(0.1);
    } else if (id === "dart") {
      const E = nearestFoe(14);
      if (!E) { ctx.float(P.x, 1.6, P.z, "No target", "info"); return; }
      P.face = faceTo(P.x, P.z, E.x, E.z); P.act = "throw"; P.actT = 0; P.actDur = 0.35;
      shoot("dart", P.x, 1.1 * P.h.scale, P.z, E, 24, { dmg: ctx.stats.dmg * 0.6, poison: ctx.stats.dmg * (0.35 + 0.08 * rank), friendly: true });
      ctx.sfx("swing", 0.6);
    } else if (id === "vanish") {
      P.vanish = 4 + 0.5 * rank; P.nextTD = true; P.h.setOpacity(0.22);
      W.fx.burst(P.x, 0.3, P.z, "shadow", 30); ctx.sfx("art");
      for (const E of G.enemies) if (E.state === "alert" && !E.boss) { E.lost = 1.5; }
    } else if (id === "storm") {
      P.act = "spin"; P.actT = 0; P.actDur = 1.1; P.stormTick = 0; P.stormRank = rank; ctx.sfx("art");
    }
    P.cd[id] = cdOf(id);
  }

  // ---------- damage ----------
  function hurt(E, dmg, o = {}) {
    if (E.dead) return;
    const from = o.from || P;
    const fromAngle = Math.abs(angDiff(E.face, faceTo(E.x, E.z, from.x, from.z)));
    const front = fromAngle < 1.2;
    let blocked = false;
    if (o.kind !== "poison" && o.kind !== "takedown" && E.stun <= 0 && front) {
      if (E.boss && E.bdef.shield && !(E.m && E.m.name === "charge" && E.m.stage === 2)) blocked = true;
      if (E.def.guard && E.state === "alert" && E.act !== "windup" && E.act !== "strike" && o.kind !== "storm") blocked = true;
    }
    if (blocked) { dmg *= 0.12; W.fx.burst(E.x + Math.sin(E.face) * 0.5, 1.1, E.z + Math.cos(E.face) * 0.5, "spark", 16); ctx.float(E.x, 2, E.z, "BLOCKED", "block"); ctx.sfx("clang"); hitStop = Math.max(hitStop, 0.04); addPosture(E, 6); }
    let crit = o.crit || (!blocked && Math.random() < ctx.stats.crit);
    if (crit && !o.crit) dmg *= 2;
    E.hp -= dmg;
    if (o.kind !== "poison") {
      if (E.def.kit === "dummy") { W.fx.burst(E.x, 1.1, E.z, "straw", 12); E.h.wob = 1; }
      else if (!blocked) W.fx.burst(E.x, 1.1 * (E.h.scale || 1), E.z, "blood", crit ? 16 : 9);
      if (!blocked) {
        world.shake(crit ? 0.18 : 0.07);
        const dx = E.x - from.x, dz = E.z - from.z, dl = Math.hypot(dx, dz) || 1;
        world.punch(dx / dl, dz / dl, crit ? 0.22 : 0.09);
        hitStop = Math.max(hitStop, crit ? 0.09 : o.kind === "storm" ? 0.02 : 0.05);
        ctx.sfx(crit ? "crit" : "hit"); ctx.vibrate(crit ? 30 : 12);
        if (crit) { world.aberrate(0.6); W.fx.burst(E.x, 1.1 * (E.h.scale || 1), E.z, "ink", 10); }
        if (o.kind === "melee" || o.kind === "step") addPosture(E, (crit ? 12 : 7) * (o.kind === "step" ? 3 : 1));
        else if (o.kind === "storm") addPosture(E, 3);
      }
    }
    ctx.float(E.x, 2.1 * (E.h.scale || 1), E.z, Math.round(dmg) + (crit ? "!" : ""), crit ? "crit" : o.kind === "poison" ? "poison" : "");
    E.hurtT = 3;
    if (E.hp <= 0) { die(E, o.kind); return; }
    if (!E.boss && !blocked && o.kind !== "poison" && E.act !== "windup") { E.act = "hit"; E.actT = 0; E.actDur = 0.22; }
    if (E.state !== "alert" && !E.boss) { if (o.kind === "dart" || o.kind === "poison") { E.aware = Math.max(E.aware, 0.7); E.state = "suspicious"; E.lastX = P.x; E.lastZ = P.z; } else alert(E, true); }
    if (E.boss && E.state !== "fight") E.state = "fight";
    // noise: fighting draws nearby attention
    if (o.kind === "melee") for (const O of G.enemies) if (O !== E && !O.dead && O.state === "patrol" && Math.hypot(O.x - P.x, O.z - P.z) < 5) { O.aware = Math.max(O.aware, 0.5); O.state = "suspicious"; O.lastX = P.x; O.lastZ = P.z; }
    if (E.boss) bossHpCheck(E);
  }
  function die(E, kind) {
    E.dead = true; E.deadT = 0; E.act = "dead"; E.hp = 0; clearDecal(E);
    if (E.cone) E.cone.visible = false; E.mk.visible = false; E.bar.visible = false; if (E.tmk) E.tmk.visible = false; if (E.eyes) E.eyes.visible = false;
    if (E.def.hidden) E.h.root.visible = true;
    const k = G.endless ? 1 : L.tier;
    stats.kills++; stats.xp += E.xp * (kind === "takedown" ? 1.5 : 1);
    if (kind === "takedown") stats.takedowns++;
    if (kind === "poison") stats.poisonKills++;
    kills.push(t); kills = kills.filter((x) => t - x < 2); if (kills.length >= 3) stats.multi = true;
    // drops
    const n = E.boss ? 8 : 1 + Math.floor(Math.random() * 2), each = (E.silver * ctx.stats.silverMul) / n;
    for (let i = 0; i < n; i++) drop("coin", E.x + rnd(-0.5, 0.5), E.z + rnd(-0.5, 0.5), each);
    if (!E.boss && E.def.kit !== "dummy" && Math.random() < 0.13) drop("orb", E.x, E.z, 0.2);
    ctx.onKill && ctx.onKill(E, kind);
    if (E.boss) { slow = 1.4; world.shake(0.5); ctx.sfx("break"); world.flash(0xffffff, 0.5); W.fx.burst(E.x, 1.4, E.z, "ink", 40); world.cinematic(E.x, E.z, faceTo(E.x, E.z, P.x, P.z) + 1.2, 1.5, 4.2, 1.6); }
  }
  function damagePlayer(amount, src) {
    if (P.dead || G.over) return;
    if (P.parryT > 0 && src && src.by) { parried(src.by, src.x, src.z); return; }
    if (P.inv > 0) { if (!src.dodged) { src.dodged = true; stats.dodges++; ctx.float(P.x, 1.8, P.z, "DODGE", "dodge"); slow = Math.max(slow, 0.2); } return; }
    P.hp -= amount; stats.dmgTaken += amount;
    world.flash(0x9b1420, 0.22); world.aberrate(0.7); ctx.vibrate(50); hitStop = Math.max(hitStop, 0.06);
    if (bossE && !bossE.dead) bossE.tookHit = true;
    ctx.float(P.x, 1.9 * P.h.scale, P.z, "-" + Math.round(amount), "hurt"); ctx.sfx("hurt"); world.shake(0.22);
    W.fx.burst(P.x, 1, P.z, "blood", 8);
    if (P.act !== "roll" && P.act !== "takedown" && P.act !== "spin") P.hitT = 0.2;
    if (src && src.x != null) { const d = Math.hypot(P.x - src.x, P.z - src.z) || 1; move(P, ((P.x - src.x) / d) * 0.35, ((P.z - src.z) / d) * 0.35); }
    if (P.vanish > 0) { P.vanish = 0; P.h.setOpacity(1); }
    if (P.hp <= 0) { P.hp = 0; P.dead = true; P.act = "dead"; P.actT = 0; P.actDur = 1; ctx.sfx("defeat"); slow = 0.8; finish(false); }
  }
  function alert(E, shout) {
    if (E.state === "alert" || E.dead) return;
    E.state = "alert"; E.aware = 1; E.lost = 0;
    if (!G.endless) stats.detected = true;
    E.mk.show("!", "#ff3b2f"); E.mkT = 1.4;
    if (E.def.flee) { const c = W.floors[0]; const corners = [[c[0] + 0.5, c[1] + 0.5], [c[2] - 0.5, c[1] + 0.5], [c[0] + 0.5, c[3] - 0.5], [c[2] - 0.5, c[3] - 0.5]]; E.flee = corners.sort((a, b) => Math.hypot(b[0] - P.x, b[1] - P.z) - Math.hypot(a[0] - P.x, a[1] - P.z))[0]; }
    if (shout) { ctx.sfx("alert"); for (const O of G.enemies) if (O !== E && !O.dead && !O.boss && O.state !== "alert" && Math.hypot(O.x - E.x, O.z - E.z) < 8) { O.aware = 1; setTimeout(() => alert(O, false), 250); } }
    if (G.enemies.some((B) => B.boss && B.state === "patrol")) for (const B of G.enemies) if (B.boss && B.state === "patrol" && Math.hypot(B.x - E.x, B.z - E.z) < 12) B.state = "intro";
  }

  // ---------- projectiles, drops, pools ----------
  function shoot(kind, x, y, z, target, speed, o) {
    const m = world.projectile(kind); m.position.set(x, y, z); world.add(m);
    const tx = target.x ?? target[0], tz = target.z ?? target[1];
    const a = o.angle ?? faceTo(x, z, tx, tz);
    G.proj.push({ m, kind, x, z, y, vx: Math.sin(a) * speed, vz: Math.cos(a) * speed, life: o.life || 1.4, ...o, target: o.homing ? target : null });
  }
  function drop(kind, x, z, value) {
    const m = kind === "coin" ? world.coin() : world.orb(); m.position.set(x, 0.3, z); world.add(m);
    G.pickups.push({ m, kind, x, z, value, t: 0, vy: rnd(3, 5), y: 0.4 });
  }

  // ---------- boss logic ----------
  function bossHpCheck(E) {
    const f = E.hp / E.maxHp, B = E.bdef;
    if (B.yieldAt && !E.echo && f <= B.yieldAt && !E.yielded) { E.yielded = true; E.dead = true; E.act = "kneel"; clearDecal(E); endMove(E); E.bar.visible = false; stats.xp += E.xp; for (let i = 0; i < 6; i++) drop("coin", E.x + rnd(-1, 1), E.z + rnd(-1, 1), (E.silver * ctx.stats.silverMul) / 6); ctx.float(E.x, 2.4, E.z, "YIELDS", "crit"); slow = 1; ctx.sfx("rare"); ctx.onKill && ctx.onKill(E, "yield"); return; }
    if (B.p2 && E.phase === 1 && f <= B.p2.at) {
      E.phase = 2; world.shake(0.4);
      if (B.p2.talk && !E.echo && L.mid) { G.paused = true; ctx.dialog(L.mid, () => { G.paused = false; }); }
      ctx.float(E.x, 2.6, E.z, "ENRAGED", "crit");
      W.fx.ring(E.x, E.z, 6, 0xff3a2a, 0.6);
    }
  }
  function clearDecal(E) { if (E.decal) { E.decal.remove(); E.decal = null; } }
  function endMove(E) { if (E.m) { (E.m.decals || []).forEach((d) => d.remove()); } clearDecal(E); E.m = null; E.act = null; E.mcd = rnd(0.5, 1.1) * (E.phase === 2 ? 0.7 : 1); if (E.invis > 0) { E.invis = 0; E.h.root.visible = true; } }
  function bossMoves(E) { const B = E.bdef; let list = B.moves.slice(); if (E.phase === 2 && B.p2) list = list.concat(B.p2.add); if (E.summonCd > 0 || G.enemies.filter((m) => m.minion && !m.dead).length >= 3) list = list.filter(([n]) => n !== "summon"); return list; }
  function updateBoss(E, dt) {
    const d = Math.hypot(P.x - E.x, P.z - E.z), toP = faceTo(E.x, E.z, P.x, P.z), B = E.bdef;
    E.summonCd -= dt;
    if (E.state === "patrol") { // asleep until he hears you or sees you up close
      E.face = turn(E.face, toP, dt * 0.5); E.act = "sit";
      if (d < 7 && !P.vanish) E.state = "intro";
      return;
    }
    if (E.state === "intro") { E.act = null; E.face = turn(E.face, toP, dt * 4); E.introT = (E.introT || 0) + dt; if (E.introT > 1 || d < 5) { E.state = "fight"; ctx.boss(E); } return; }
    if (E.stun > 0) { E.act = "stun"; return; }
    if (E.m) return runMove(E, dt, d, toP);
    // no move: approach and choose
    E.face = turn(E.face, toP, dt * 5);
    if (d > 2.4) { const sp = B.speed * dt; move(E, Math.sin(toP) * sp, Math.cos(toP) * sp); E.moving = 1; } else E.moving = 0;
    E.mcd -= dt;
    if (E.mcd <= 0 && !P.dead) {
      const name = pick(bossMoves(E));
      E.m = { name, t: 0, stage: 0, n: 0, decals: [] };
      if (name === "summon") E.summonCd = 14;
    }
  }
  function runMove(E, dt, d, toP) {
    const m = E.m, B = E.bdef, fast = E.phase === 2 ? 0.85 : 1, quick = B.kit === "doran" || B.kit === "ossa" ? 0.82 : 1;
    m.t += dt; E.moving = 0;
    const swing = (count, windup, dmgMul, arc = 1.9, r = 2.6) => {
      if (m.stage === 0) { // approach
        E.face = turn(E.face, toP, dt * 6);
        if (d > 2.1 && m.t < 2.5) { const sp = B.speed * 1.15 * dt; move(E, Math.sin(toP) * sp, Math.cos(toP) * sp); E.moving = 1; return; }
        m.stage = 1; m.t = 0; E.face = toP; E.decal = W.fx.decal("cone", E.x, E.z, { r, arc, face: E.face });
      }
      if (m.stage === 1) {
        E.act = "windup"; E.actT = m.t; E.actDur = windup * fast * quick; E.decal.move(E.x, E.z, E.face); E.decal.set(m.t / E.actDur);
        if (m.t >= E.actDur) {
          clearDecal(E); E.act = "strike"; E.actT = 0; E.actDur = 0.3;
          const a = Math.abs(angDiff(E.face, faceTo(E.x, E.z, P.x, P.z)));
          W.fx.slash(E.x, 1.2 * (E.h.scale || 1), E.z, E.face, 0xffc8a0, m.n % 2 === 1, 0.3, 1.2 * (B.scale || 1));
          if (Math.hypot(P.x - E.x, P.z - E.z) < r + P.r && a < arc / 2 + 0.2) damagePlayer(E.dmg * dmgMul, { x: E.x, z: E.z, id: m, by: E });
          m.n++; m.stage = 2; m.t = 0; m.dodgedReset = true;
        }
      } else if (m.stage === 2) { E.actT = m.t; if (m.t > 0.2) { if (m.n >= count) endMove(E); else { m.stage = 0; m.t = 0; } } }
    };
    switch (m.name) {
      case "combo": swing(B.kit === "grel" ? 2 : 3, B.kit === "grel" ? 0.7 : 0.5, 1, B.kit === "grel" ? 2.3 : 1.9, B.kit === "grel" ? 3.1 : 2.6); break;
      case "lunge": case "charge": {
        const len = m.name === "charge" ? 13 : 7.5, w = m.name === "charge" ? 1.9 : 1.4;
        if (m.stage === 0) { E.face = toP; m.dir = toP; E.decal = W.fx.decal("line", E.x, E.z, { len, w, face: m.dir }); m.stage = 1; m.t = 0; m.ox = E.x; m.oz = E.z; }
        if (m.stage === 1) { E.act = m.name === "charge" ? "charge" : "windup"; E.actT = m.t; E.actDur = (m.name === "charge" ? 0.85 : 0.6) * fast * quick; E.decal.set(m.t / E.actDur); if (m.t >= E.actDur) { clearDecal(E); m.stage = 2; m.t = 0; m.hit = false; } }
        else if (m.stage === 2) {
          E.act = m.name === "charge" ? "charge" : "strike"; E.actT = Math.min(0.29, m.t); E.actDur = 0.3; E.moving = 1;
          const sp = (m.name === "charge" ? 17 : 19) * dt, res = move(E, Math.sin(m.dir) * sp, Math.cos(m.dir) * sp);
          if (!m.hit && Math.hypot(P.x - E.x, P.z - E.z) < 1.0 + P.r) { m.hit = true; damagePlayer(E.dmg * (m.name === "charge" ? 1.5 : 1.3), { x: E.x, z: E.z, id: m, by: E }); }
          if (Math.random() < 0.6) W.fx.burst(E.x, 0.1, E.z, "snow", 2);
          const traveled = Math.hypot(E.x - m.ox, E.z - m.oz);
          if (res || traveled >= len - 0.2) {
            if (m.name === "charge" && res) { E.stun = 2.8; world.shake(0.45); W.fx.burst(E.x + Math.sin(m.dir) * 0.6, 1.2, E.z + Math.cos(m.dir) * 0.6, "spark", 30); ctx.float(E.x, 2.6, E.z, "STUNNED", "crit"); ctx.sfx("break"); }
            endMove(E);
          }
        }
        break;
      }
      case "knives": {
        const n = B.kit === "ossa" ? 5 : 3;
        if (m.stage === 0) { E.face = toP; E.act = "throw"; E.actT = 0; E.actDur = 0.45 * fast; m.stage = 1; m.t = 0; E.decal = W.fx.decal("cone", E.x, E.z, { r: 9, arc: 0.24 * n, face: toP, color: 0xff8a2a }); }
        E.face = turn(E.face, toP, dt * 3); if (E.decal) { E.decal.move(E.x, E.z, E.face); E.decal.set(m.t / 0.45); }
        E.actT = m.t;
        if (m.stage === 1 && m.t >= 0.45 * fast) {
          clearDecal(E);
          for (let i = 0; i < n; i++) shoot(B.kit === "varek" ? "vial" : "knife", E.x, 1.2, E.z, P, B.kit === "varek" ? 12 : 15, { angle: E.face + (i - (n - 1) / 2) * 0.24, dmg: E.dmg * 0.6, hostile: true, life: 1.2, poison: B.kit === "varek" ? E.dmg * 0.15 : 0, owner: E });
          ctx.sfx("swing"); m.stage = 2; m.t = 0;
        }
        if (m.stage === 2 && m.t > 0.3) endMove(E);
        break;
      }
      case "slam": case "bash": {
        const r = m.name === "slam" ? 3.7 : 2.7;
        if (m.stage === 0) { if (m.name === "bash" && d > 2.4 && m.t < 2) { E.face = turn(E.face, toP, dt * 6); const sp = B.speed * 1.2 * dt; move(E, Math.sin(toP) * sp, Math.cos(toP) * sp); E.moving = 1; return; } E.decal = W.fx.decal("circle", E.x, E.z, { r }); m.stage = 1; m.t = 0; }
        if (m.stage === 1) { E.act = "slamup"; E.actT = m.t; E.actDur = (m.name === "slam" ? 1.0 : 0.7) * fast; E.decal.set(m.t / E.actDur); if (m.t >= E.actDur) { clearDecal(E); E.act = "slamdown"; E.actT = 0; E.actDur = 0.5; m.stage = 2; m.t = 0; world.shake(0.4); W.fx.ring(E.x, E.z, r, 0xffe0c0, 0.45); W.fx.burst(E.x, 0.2, E.z, "snow", 26); ctx.sfx("hit"); if (Math.hypot(P.x - E.x, P.z - E.z) < r + P.r * 0.5) damagePlayer(E.dmg * (m.name === "slam" ? 1.6 : 1.2), { x: E.x, z: E.z, id: m }); } }
        else if (m.stage === 2) { E.actT = m.t; if (m.t > 0.5) endMove(E); }
        break;
      }
      case "whirl": {
        if (m.stage === 0) { E.decal = W.fx.decal("circle", E.x, E.z, { r: 2.4 }); m.stage = 1; m.t = 0; }
        if (m.stage === 1) { E.act = "slamup"; E.actT = m.t; E.actDur = 0.6; E.decal.set(m.t / 0.6); if (m.t > 0.6) { m.stage = 2; m.t = 0; m.tick = 0; } }
        else if (m.stage === 2) {
          E.act = "spin"; E.actT = 0; E.actDur = 1; E.face += dt * 14; E.decal.move(E.x, E.z); E.decal.set(1);
          const sp = 2.3 * dt; move(E, Math.sin(toP) * sp, Math.cos(toP) * sp); E.moving = 1;
          m.tick -= dt; if (m.tick <= 0) { m.tick = 0.42; W.fx.slash(E.x, 1.2, E.z, E.face, 0xffd0a0, false, 0, 1.5); if (Math.hypot(P.x - E.x, P.z - E.z) < 2.4 + P.r * 0.5) damagePlayer(E.dmg * 0.7, { x: E.x, z: E.z, id: { t: m.t } }); }
          if (m.t > 2.2) endMove(E);
        }
        break;
      }
      case "blink": case "vanish": {
        if (m.stage === 0) { W.fx.burst(E.x, 0.2, E.z, "shadow", 26); E.invis = m.name === "vanish" ? 1.8 : 0.4; E.h.root.visible = false; E.mk.visible = false; m.stage = 1; m.t = 0; ctx.sfx("up"); }
        if (m.stage === 1) {
          if (m.t >= E.invis) {
            const bx = P.x - Math.sin(P.face) * 1.7, bz = P.z - Math.cos(P.face) * 1.7;
            if (inFloor(bx, bz, 0.3)) { E.x = bx; E.z = bz; } else { E.x = P.x + rnd(-1.5, 1.5); E.z = P.z + 1.7; }
            pushOut(E); E.h.root.visible = true; E.invis = 0; W.fx.burst(E.x, 0.2, E.z, "shadow", 26); E.face = faceTo(E.x, E.z, P.x, P.z);
            m.stage = 2; m.t = 0; E.decal = W.fx.decal("cone", E.x, E.z, { r: 2.5, arc: 1.9, face: E.face });
          }
        } else if (m.stage === 2) {
          E.act = "windup"; E.actT = m.t; E.actDur = 0.42 * fast; E.decal.set(m.t / E.actDur);
          if (m.t >= E.actDur) { clearDecal(E); E.act = "strike"; E.actT = 0; E.actDur = 0.3; W.fx.slash(E.x, 1.2, E.z, E.face, 0xc0a0ff); if (Math.hypot(P.x - E.x, P.z - E.z) < 2.5 + P.r && Math.abs(angDiff(E.face, faceTo(E.x, E.z, P.x, P.z))) < 1.15) damagePlayer(E.dmg * 1.1, { x: E.x, z: E.z, id: m, by: E }); m.stage = 3; m.t = 0; }
        } else if (m.stage === 3 && m.t > 0.35) endMove(E);
        break;
      }
      case "summon": {
        E.act = "cast"; E.actT = m.t; E.actDur = 1;
        if (m.t > 0.9 && m.stage === 0) {
          m.stage = 1; const k = 2; const [x1, z1, x2, z2] = W.floors[0];
          for (let i = 0; i < k; i++) { const sx = i % 2 ? x1 + 1.2 : x2 - 1.2, sz = rnd(z1 + 2, z2 - 2); const mn = spawn(B.p2.minion, sx, sz, null, { alert: true }); mn.minion = true; W.fx.burst(sx, 0.4, sz, "smoke", 20); }
          ctx.sfx("alert"); W.fx.burst(E.x, 2, E.z, "magic", 20, 0xff4a3a);
        }
        if (m.t > 1.3) endMove(E);
        break;
      }
      case "poison": {
        E.act = "throw"; E.actT = Math.min(m.t, 0.45); E.actDur = 0.45; E.face = turn(E.face, toP, dt * 6);
        if (m.stage === 0 && m.t > 0.4) {
          m.stage = 1;
          for (let i = 0; i < 3; i++) { const tx = P.x + (i ? rnd(-2.2, 2.2) : 0), tz = P.z + (i ? rnd(-2.2, 2.2) : 0); const dcl = W.fx.decal("circle", tx, tz, { r: 1.7, color: 0x6aff4a }); m.decals.push(dcl); m[i] = { tx, tz, dcl }; }
        }
        if (m.stage === 1) {
          for (let i = 0; i < 3; i++) m[i].dcl.set(Math.min(1, (m.t - 0.4) / 0.85));
          if (m.t > 1.25) { for (let i = 0; i < 3; i++) { const { tx, tz, dcl } = m[i]; dcl.remove(); G.pools.push({ x: tx, z: tz, r: 1.7, t: 5, dps: E.dmg * 0.35, d: W.fx.decal("circle", tx, tz, { r: 1.7, color: 0x3aff3a }) }); W.fx.burst(tx, 0.3, tz, "poison", 20); } m.decals = []; ctx.sfx("hit"); endMove(E); }
        }
        break;
      }
      case "rain": {
        E.act = "cast"; E.actT = m.t; E.actDur = 1;
        if (m.stage === 0) { m.stage = 1; m.list = []; m.spawnT = 0; m.count = 0; }
        m.spawnT -= dt;
        if (m.count < 7 && m.spawnT <= 0) { m.spawnT = 0.24; m.count++; const tx = P.x + rnd(-3, 3), tz = P.z + rnd(-3, 3), dcl = W.fx.decal("circle", tx, tz, { r: 1.35 }); m.decals.push(dcl); m.list.push({ tx, tz, dcl, t: 0 }); }
        for (const s of m.list) if (!s.done) { s.t += dt; s.dcl.set(s.t / 1.0); if (s.t >= 1) { s.done = true; s.dcl.remove(); m.decals = m.decals.filter((x) => x !== s.dcl); W.fx.burst(s.tx, 0.3, s.tz, "blood", 14); W.fx.burst(s.tx, 0.3, s.tz, "spark", 10); W.fx.ring(s.tx, s.tz, 1.35, 0xff4a3a, 0.35); if (Math.hypot(P.x - s.tx, P.z - s.tz) < 1.35 + P.r * 0.5) damagePlayer(E.dmg * 1.1, { x: s.tx, z: s.tz, id: s }); } }
        if (m.count >= 7 && m.list.every((s) => s.done)) endMove(E);
        break;
      }
      default: endMove(E);
    }
  }

  // ---------- enemy AI ----------
  function canSee(E) {
    if (P.vanish > 0 || P.dead) return false;
    const dx = P.x - E.x, dz = P.z - E.z, d = Math.hypot(dx, dz);
    if (d > E.def.vision) return false;
    if (G.smokes.some((s) => Math.hypot(P.x - s.x, P.z - s.z) < s.r || Math.hypot(E.x - s.x, E.z - s.z) < s.r)) return false;
    if (Math.abs(angDiff(E.face, Math.atan2(dx, dz))) > ((E.def.fov / 2) * Math.PI) / 180) return d < (P.sneak ? 0 : 1.3);
    return !segBlocked(E.x, E.z, P.x, P.z);
  }
  function updateEnemy(E, dt) {
    const def = E.def, d = Math.hypot(P.x - E.x, P.z - E.z), toP = faceTo(E.x, E.z, P.x, P.z);
    if (E.poison) { E.poison.t -= dt; E.poison.acc = (E.poison.acc || 0) + dt; if (E.poison.acc >= 0.5) { E.poison.acc = 0; hurt(E, E.poison.dps * 0.5, { kind: "poison" }); W.fx.burst(E.x, 1, E.z, "poison", 3); } if (E.poison && E.poison.t <= 0) E.poison = null; if (E.dead) return; }
    if (E.boss) return updateBoss(E, dt);
    if (E.held) return;
    if (def.still) { E.moving = 0; return; }
    E.moving = 0;
    if (E.stun > 0) { E.act = "stun"; clearDecal(E); return; }
    if (E.act === "stun") E.act = null;
    if (E.act === "hit") { E.actT += dt; if (E.actT > E.actDur) E.act = null; return; }
    // perception
    if (E.state !== "alert") {
      if (canSee(E)) {
        const rate = 1.9 * (1 - (d / def.vision) * 0.55) * (P.sneak ? 0.42 : 1) * ctx.stats.silenceMul * (P.act && P.act !== "roll" ? 1.6 : 1);
        E.aware += rate * dt; E.lastX = P.x; E.lastZ = P.z;
        if (E.aware >= 1) alert(E, true);
        else if (E.aware > 0.3 && E.state === "patrol") { E.state = "suspicious"; ctx.sfx("suspicious"); }
      } else { E.aware = Math.max(0, E.aware - 0.22 * dt); if (E.state === "suspicious" && E.aware < 0.12) { E.state = "patrol"; } }
    }
    if (E.state === "alert") {
      // losing you: vanish or smoke
      if (!canSee(E) && (P.vanish > 0 || G.smokes.length)) { E.lost += dt; if (E.lost > 2) { E.state = "suspicious"; E.aware = 0.6; E.lastX = P.x; E.lastZ = P.z; E.mk.show("?", "#ffd24a"); return; } }
      else E.lost = 0;
      if (def.flee) {
        const [fx, fz] = E.flee, fa = faceTo(E.x, E.z, fx, fz);
        E.face = turn(E.face, fa, dt * 8); const sp = def.speed * dt; move(E, Math.sin(fa) * sp, Math.cos(fa) * sp); E.moving = 1;
        if (Math.hypot(E.x - fx, E.z - fz) < 1.2 && !G.over) { ctx.toast("An informant escaped!"); finish(false, "escaped"); }
        return;
      }
      if (E.act === "windup" || E.act === "bow") {
        E.actT += dt;
        if (E.decal) { E.decal.move(E.x, E.z, E.face); E.decal.set(E.actT / E.actDur); }
        if (def.ranged) E.face = turn(E.face, toP, dt * 4);
        if (E.actT >= E.actDur) {
          clearDecal(E);
          if (def.ranged) { shoot("arrow", E.x, 1.3, E.z, P, 17, { dmg: E.dmg, hostile: true, life: 1.1, owner: E }); E.act = null; ctx.sfx("bow"); }
          else {
            E.act = "strike"; E.actT = 0; E.actDur = 0.35;
            if (def.kit !== "wolf") W.fx.slash(E.x, 1.1 * (E.h.scale || 1), E.z, E.face, 0xffd0b0, Math.random() < 0.5, 0.3, 0.9);
            if (d < def.reach + P.r + 0.2 && Math.abs(angDiff(E.face, toP)) < 1.1) damagePlayer(E.dmg, { x: E.x, z: E.z, id: E.actT0 = {}, by: E });
          }
          E.cd = def.cd * rnd(0.8, 1.25);
        }
        return;
      }
      if (E.act === "strike") { E.actT += dt; if (E.actT > E.actDur) E.act = null; return; }
      E.cd -= dt;
      E.face = turn(E.face, toP, dt * 7);
      if (def.ranged) {
        let mv = 0; if (d > def.ranged * 0.85) mv = 1; else if (d < 4) mv = -1;
        if (mv) { const a = mv > 0 ? toP : toP + Math.PI, sp = def.speed * 0.8 * dt; move(E, Math.sin(a) * sp, Math.cos(a) * sp); E.moving = 0.8; }
        if (E.cd <= 0 && d < def.ranged && !segBlocked(E.x, E.z, P.x, P.z) && !P.dead) { E.act = "bow"; E.actT = 0; E.actDur = def.wind; E.decal = W.fx.decal("line", E.x, E.z, { len: Math.min(d + 1, def.ranged), w: 0.35, face: toP, color: 0xff8a2a }); }
        return;
      }
      if (d > def.reach * 0.85) {
        const sp = def.speed * dt; let res = move(E, Math.sin(toP) * sp, Math.cos(toP) * sp); E.moving = 1;
        if (res && res !== "edge") { const side = toP + (E.id % 2 > 1 ? 1.4 : -1.4); move(E, Math.sin(side) * sp, Math.cos(side) * sp); }
      } else if (E.cd <= 0 && !P.dead) {
        E.act = "windup"; E.actT = 0; E.actDur = def.wind;
        E.decal = W.fx.decal("cone", E.x, E.z, { r: def.reach + 0.3, arc: 1.9, face: E.face });
      }
      return;
    }
    if (E.state === "suspicious") {
      E.mk.show("?", "#ffd24a");
      const ta = faceTo(E.x, E.z, E.lastX, E.lastZ), dl = Math.hypot(E.lastX - E.x, E.lastZ - E.z);
      E.face = turn(E.face, ta, dt * 3);
      if (dl > 1 && E.aware > 0.45) { const sp = def.walk * 1.1 * dt; move(E, Math.sin(ta) * sp, Math.cos(ta) * sp); E.moving = 0.4; }
      return;
    }
    // patrol
    E.mk.visible = false;
    if (E.path) {
      if (E.wait > 0) { E.wait -= dt; return; }
      const [tx, tz] = E.path[E.pi], dd = Math.hypot(tx - E.x, tz - E.z);
      if (dd < 0.25) { E.wait = rnd(0.8, 1.6); E.pi += E.dir; if (E.pi >= E.path.length || E.pi < 0) { E.dir *= -1; E.pi += 2 * E.dir; } return; }
      const a = faceTo(E.x, E.z, tx, tz); E.face = turn(E.face, a, dt * 4);
      const sp = def.walk * dt; move(E, Math.sin(E.face) * sp, Math.cos(E.face) * sp); E.moving = 0.35;
    } else if (E.look) E.face = E.baseFace + Math.sin(t * 0.55 + E.id) * E.look;
    else if (def.kit === "wolf" || def.hidden) { E.roam = (E.roam || 0) - dt; if (E.roam <= 0) { E.roam = rnd(2, 4); E.roamA = rnd(0, TAU); } E.face = turn(E.face, E.roamA, dt * 2); const sp = def.walk * 0.6 * dt; move(E, Math.sin(E.face) * sp, Math.cos(E.face) * sp); E.moving = 0.3; }
  }

  // ---------- waves (The Ashes) ----------
  function nextWave() {
    wave++; waveT = 0; G.wave = wave;
    const pool = ["trainee", "soldier", "wolf", "bandit", "archer", "shadow", "elite"].slice(0, Math.min(7, 2 + Math.floor(wave / 2)));
    const n = 3 + Math.floor(wave * 1.2), [x1, z1, x2, z2] = W.floors[0];
    if (wave % 5 === 0) { const ids = ["doran", "grel", "ossa", "hask", "varek"], id = ids[(wave / 5 - 1) % 5]; const B = spawnBoss(id, 0, z1 + 2, 1); B.state = "fight"; ctx.boss(B); }
    for (let i = 0; i < (wave % 5 === 0 ? Math.floor(n / 2) : n); i++) {
      const side = i % 4, x = side === 0 ? x1 + 1 : side === 1 ? x2 - 1 : rnd(x1 + 1, x2 - 1), z = side === 2 ? z1 + 1 : side === 3 ? z2 - 1 : rnd(z1 + 1, z2 - 1);
      spawn(pool[Math.floor(Math.random() * pool.length)], x, z, null, { alert: true });
      W.fx.burst(x, 0.5, z, "smoke", 10);
    }
    ctx.toast(`Wave ${wave}`); ctx.sfx("alert");
  }

  // ---------- end ----------
  function finish(win, reason) {
    if (G.over) return;
    G.over = true; endT = win ? 1.4 : 1.8;
    const st3 = L.star3, ratio = P.hp / P.maxHp;
    const stars = win ? [true, ratio >= 0.5, st3 === "time" ? t <= L.par : st3 === "ghost" ? !stats.detected : st3 === "untouched" ? stats.dmgTaken < P.maxHp * 0.25 : false] : [false, false, false];
    endResult = { win, reason, stars, time: t, ...stats, wave, endless: G.endless, noHitBoss: win && !!L.boss && stats.dmgTaken === 0 };
    if (win) { ctx.sfx("victory"); slow = 1.2; }
  }

  // ---------- per-frame ----------
  function placeActors(dt) {
    P.h.root.position.set(P.x, 0, P.z); P.h.root.rotation.y = P.face;
    for (const E of G.enemies) {
      E.h.root.position.x = E.x; E.h.root.position.z = E.z; E.h.root.rotation.y = E.face;
      const top = (E.h.height || 1.7) + 0.35;
      E.mk.position.set(E.x, top + 0.15, E.z); E.bar.position.set(E.x, top - 0.12, E.z);
      if (E.tmk) E.tmk.position.set(E.x, top + (E.mk.visible ? 0.55 : 0.15), E.z);
      if (E.eyes) { E.eyes.position.set(E.x + Math.sin(E.face) * 0.15, 1.5, E.z + Math.cos(E.face) * 0.15); }
      if (E.cone) {
        E.cone.position.set(E.x, 0.04, E.z); E.cone.rotation.y = E.face;
        E.cone.visible = !E.dead && E.state !== "alert" && E.stun <= 0 && !E.held;
        const a = Math.min(1, E.aware);
        E.cone.material.color.setRGB(1, 1 - a * 0.25, 1 - a * 0.95).lerp(new THREE.Color(1, 0.15, 0.1), a > 0.6 ? (a - 0.6) * 2.5 : 0);
        E.cone.material.opacity = 0.75 + a * 0.25;
      }
    }
  }
  G.update = function (rdt, rt) {
    if (!P) return;
    if (G.paused) { world.update(0, rt); return; }
    let scale = slow > 0 ? 0.3 : 1; slow = Math.max(0, slow - rdt);
    if (hitStop > 0) { hitStop -= rdt; scale = 0.03; }
    if (world.inCinematic()) scale = Math.min(scale, 0.3);
    const dt = Math.min(0.05, rdt) * scale; t += dt;
    const S = ctx.stats;
    // --- player ---
    P.inv = Math.max(0, P.inv - dt); P.dodgeCd -= dt; P.parryT = Math.max(0, P.parryT - dt); P.parryCd -= dt; P.comboT -= dt; P.hitT = Math.max(0, (P.hitT || 0) - dt);
    for (const k in P.cd) P.cd[k] = Math.max(0, P.cd[k] - dt);
    if (P.vanish > 0) { P.vanish -= dt; if (P.vanish <= 0) { P.h.setOpacity(1); } }
    let mx = inp.mx, mz = inp.mz; const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
    P.moveAmt = 0;
    if (!P.dead && !G.over) {
      if (P.act) {
        P.actT += dt; const p = P.actT / P.actDur;
        if (P.act.startsWith("slash")) {
          if (P.actT < P.actDur * 0.4) move(P, Math.sin(P.face) * dt * 1.6, Math.cos(P.face) * dt * 1.6);
          if (!P.hitDone && p >= 0.32) {
            P.hitDone = true;
            const reach = (1.35 + P.bladeLen * 0.9) * Math.max(0.8, P.h.scale), mult = [1, 1.1, 1.75][P.combo];
            W.fx.slash(P.x, 1.0 * P.h.scale + 0.1, P.z, P.face, bladeColor(), P.combo === 1, P.combo === 2 ? 1.3 : 0.25, reach * 0.62);
            for (const E of G.enemies) {
              if (E.dead || E.invis > 0) continue;
              const d = Math.hypot(E.x - P.x, E.z - P.z);
              if (d < reach + E.r && Math.abs(angDiff(P.face, faceTo(P.x, P.z, E.x, E.z))) < 1.35) hurt(E, S.dmg * mult * rnd(0.92, 1.08), { from: P, kind: "melee" });
            }
          }
          if (P.actT >= P.actDur) { P.act = null; P.comboT = 0.55; if (P.queued) { P.queued = false; attack(); } }
        } else if (P.act === "takedown") {
          const E = P.td;
          if (p < 0.4) { const tx = E.x - Math.sin(P.face) * (E.r + 0.55), tz = E.z - Math.cos(P.face) * (E.r + 0.55); P.x += (tx - P.x) * Math.min(1, dt * 12); P.z += (tz - P.z) * Math.min(1, dt * 12); }
          if (!P.hitDone && p >= 0.45) {
            P.hitDone = true; E.held = false;
            if (E.boss) hurt(E, S.dmg * 3.5, { crit: true, kind: "takedown", from: P }); else { hurt(E, E.hp + 1, { crit: true, kind: "takedown", from: { x: E.x - Math.sin(E.face), z: E.z - Math.cos(E.face) } }); }
            W.fx.slash(E.x, 1.1, E.z, P.face, 0xb08aff, false, 1.4, 1.1); ctx.float(E.x, 2.4, E.z, "TAKEDOWN", "td");
            if (P.nextTD) { P.nextTD = false; if (P.vanish > 0) { P.vanish = 0; P.h.setOpacity(1); } }
            for (const O of G.enemies) if (O !== E && !O.dead && O.state !== "alert" && Math.hypot(O.x - P.x, O.z - P.z) < 3.5 && canSee(O)) { O.aware = Math.max(O.aware, 0.75); O.state = "suspicious"; O.lastX = P.x; O.lastZ = P.z; }
          }
          if (P.actT >= P.actDur) P.act = null;
        } else if (P.act === "roll") {
          const sp = 9.5 * dt * (1 - p * 0.5); move(P, Math.sin(P.face) * sp, Math.cos(P.face) * sp); P.moveAmt = 1;
          for (const j of ["head", "chest", "hips", "handL", "handR", "knL", "knR"]) { P.h.J[j].getWorldPosition(tmpV); W.fx.burst(tmpV.x, tmpV.y, tmpV.z, "ghost", 1); }
          if (P.actT >= P.actDur) P.act = null;
        } else if (P.act === "spin") {
          P.face += dt * 16; P.stormTick -= dt; const sp = 2.2 * dt; if (ml > 0.2) move(P, (mx / Math.max(ml, 1)) * sp, (mz / Math.max(ml, 1)) * sp);
          if (P.stormTick <= 0) { P.stormTick = 0.18; const r = 3 + 0.2 * P.stormRank; W.fx.slash(P.x, 0.9, P.z, P.face, bladeColor(), false, 0, r * 0.62); for (const E of G.enemies) if (!E.dead && E.invis <= 0 && Math.hypot(E.x - P.x, E.z - P.z) < r + E.r) hurt(E, S.dmg * (0.55 + 0.1 * P.stormRank), { from: P, kind: "storm" }); }
          if (P.actT >= P.actDur) P.act = null;
        } else if (P.actT >= P.actDur) P.act = null;
      } else if (ml > 0.08) {
        const sp = P.speed * (P.sneak ? 0.5 : 1) * (P.vanish > 0 ? 1.3 : 1) * dt * Math.min(1, ml * 1.2);
        P.face = turn(P.face, Math.atan2(mx, mz), dt * 14);
        move(P, mx * sp / dt * dt, mz * sp / dt * dt);
        P.moveAmt = Math.min(1, ml * 1.2);
      }
    }
    // --- enemies ---
    for (const E of G.enemies) {
      if (E.dead) {
        E.deadT += dt;
        if (E.yielded) { E.act = "kneel"; E.face = turn(E.face, faceTo(E.x, E.z, P.x, P.z), dt * 3); }
        else if (E.deadT > 3.5) { E.h.root.position.y = -(E.deadT - 3.5) * 0.4; if (E.deadT > 5.5 && E.h.root.parent) { E.h.root.parent.remove(E.h.root); } }
        continue;
      }
      if (E.stun > 0) E.stun -= dt;
      if (E.posture > 0) { E.postT -= dt; if (E.postT <= 0) E.posture = Math.max(0, E.posture - (E.boss ? 9 : 14) * dt); }
      if (E.mkT > 0) { E.mkT -= dt; if (E.mkT <= 0 && E.state === "alert") E.mk.visible = false; }
      updateEnemy(E, dt);
      if (E.def.hidden) { const d = Math.hypot(E.x - P.x, E.z - P.z), vis = d < 4.6 || (E.state === "alert" && d < 6.5) || E.stun > 0; E.h.root.visible = vis; E.eyes.visible = !vis && d < 12; E.eyes.children.forEach((s) => (s.material.opacity = 0.5 + Math.sin(t * 3 + E.id) * 0.3)); }
      if (E.hurtT > 0) { E.hurtT -= dt; E.bar.visible = !E.boss; E.bar.set(E.hp / E.maxHp); } else E.bar.visible = false;
    }
    // separation
    const actors = G.enemies.filter((E) => !E.dead && E.invis <= 0);
    for (let i = 0; i < actors.length; i++) for (let j = i + 1; j < actors.length; j++) {
      const a = actors[i], b = actors[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = a.r + b.r;
      if (d < min && d > 1e-4) { const push = (min - d) / 2; a.x -= (dx / d) * push; a.z -= (dz / d) * push; b.x += (dx / d) * push; b.z += (dz / d) * push; }
    }
    for (const E of actors) { const dx = P.x - E.x, dz = P.z - E.z, d = Math.hypot(dx, dz), min = P.r + E.r; if (d < min && d > 1e-4 && P.act !== "takedown") { P.x = E.x + (dx / d) * min; P.z = E.z + (dz / d) * min; } }
    // --- projectiles ---
    for (let i = G.proj.length - 1; i >= 0; i--) {
      const pr = G.proj[i]; pr.life -= dt;
      if (pr.target && !pr.target.dead) { const a = faceTo(pr.x, pr.z, pr.target.x, pr.target.z), sp = Math.hypot(pr.vx, pr.vz); pr.vx = Math.sin(a) * sp; pr.vz = Math.cos(a) * sp; }
      pr.x += pr.vx * dt; pr.z += pr.vz * dt; pr.m.position.set(pr.x, pr.y, pr.z); pr.m.rotation.y = Math.atan2(pr.vx, pr.vz);
      if (pr.kind === "vial") pr.m.rotation.x += dt * 10;
      let done = pr.life <= 0;
      if (!done && W.colliders.some((c) => c.block && c.type === "box" && pr.x > c.x1 && pr.x < c.x2 && pr.z > c.z1 && pr.z < c.z2)) done = true;
      if (!done && pr.hostile && Math.hypot(pr.x - P.x, pr.z - P.z) < 0.9 + P.r * 0.5 && P.parryT > 0) {
        // deflect: send it back at whoever threw it
        const back = pr.owner && !pr.owner.dead ? pr.owner : nearestFoe(20); parried(null, pr.x, pr.z);
        pr.hostile = false; pr.friendly = true; pr.dmg *= 1.5; pr.poison = 0; pr.life = 1.2;
        const a = back ? faceTo(pr.x, pr.z, back.x, back.z) : Math.atan2(-pr.vx, -pr.vz), sp = Math.hypot(pr.vx, pr.vz) * 1.3;
        pr.vx = Math.sin(a) * sp; pr.vz = Math.cos(a) * sp;
      }
      if (!done && pr.hostile && Math.hypot(pr.x - P.x, pr.z - P.z) < 0.5 + P.r * 0.5) {
        if (P.inv > 0) damagePlayer(0, pr); else { damagePlayer(pr.dmg, { x: pr.x - pr.vx * 0.05, z: pr.z - pr.vz * 0.05 }); if (pr.poison) G.pools.push({ x: P.x, z: P.z, r: 1.4, t: 3, dps: pr.poison * 2, d: W.fx.decal("circle", P.x, P.z, { r: 1.4, color: 0x3aff3a }) }); done = true; }
      }
      if (!done && pr.friendly) for (const E of G.enemies) if (!E.dead && E.invis <= 0 && Math.hypot(pr.x - E.x, pr.z - E.z) < E.r + 0.35) {
        hurt(E, pr.dmg, { kind: "dart", from: { x: pr.x - pr.vx, z: pr.z - pr.vz } });
        if (!E.dead && pr.poison) E.poison = { t: 5, dps: pr.poison };
        W.fx.burst(E.x, 1, E.z, "poison", 12); done = true; break;
      }
      if (done) { pr.m.parent && pr.m.parent.remove(pr.m); G.proj.splice(i, 1); }
    }
    // --- poison pools, smoke ---
    for (let i = G.pools.length - 1; i >= 0; i--) {
      const pl = G.pools[i]; pl.t -= dt; pl.d.set(Math.min(1, pl.t / 5 + 0.4));
      if (Math.random() < dt * 8) W.fx.burst(pl.x + rnd(-pl.r, pl.r) * 0.6, 0.1, pl.z + rnd(-pl.r, pl.r) * 0.6, "poison", 1);
      if (Math.hypot(P.x - pl.x, P.z - pl.z) < pl.r) { pl.acc = (pl.acc || 0) + dt; if (pl.acc > 0.5) { pl.acc = 0; P.inv > 0 ? 0 : damagePlayer(pl.dps * 0.5, { x: pl.x, z: pl.z }); } }
      if (pl.t <= 0) { pl.d.remove(); G.pools.splice(i, 1); }
    }
    G.smokes = G.smokes.filter((s) => (s.t -= dt) > 0);
    // --- pickups ---
    for (let i = G.pickups.length - 1; i >= 0; i--) {
      const pk = G.pickups[i]; pk.t += dt;
      if (pk.t < 0.6) { pk.vy -= 14 * dt; pk.y = Math.max(0.2, pk.y + pk.vy * dt); }
      const d = Math.hypot(P.x - pk.x, P.z - pk.z);
      if (pk.t > 0.5 && d < 3.2 && !P.dead) { const a = faceTo(pk.x, pk.z, P.x, P.z), sp = (4 + (3.2 - d) * 6) * dt; pk.x += Math.sin(a) * sp; pk.z += Math.cos(a) * sp; pk.y += (1 - pk.y) * dt * 5; }
      pk.m.position.set(pk.x, pk.y + Math.sin(t * 4 + i) * 0.05, pk.z); pk.m.rotation.y += dt * 4;
      if (pk.t > 0.5 && d < 0.55) {
        if (pk.kind === "coin") { stats.silver += pk.value; ctx.sfx("coin"); ctx.vibrate(5); }
        else { P.hp = Math.min(P.maxHp, P.hp + P.maxHp * pk.value); stats.orbs++; W.fx.burst(P.x, 0.4, P.z, "heal", 16); ctx.float(P.x, 2, P.z, "+" + Math.round(P.maxHp * pk.value), "heal"); ctx.sfx("heal"); }
        pk.m.parent && pk.m.parent.remove(pk.m); G.pickups.splice(i, 1);
      }
    }
    // --- objectives ---
    if (!G.over && !P.dead) {
      const g = L.goal ? L.goal.type : "kill";
      if (G.endless) { if (G.enemies.every((E) => E.dead)) { waveT += dt; if (waveT > 2.5) { P.hp = Math.min(P.maxHp, P.hp + P.maxHp * 0.15); G.enemies.forEach((E) => { if (E.h.root.parent) E.h.root.parent.remove(E.h.root); [E.mk, E.bar, E.cone, E.tmk, E.eyes].forEach((o) => o && o.parent && o.parent.remove(o)); }); G.enemies = []; nextWave(); } } }
      else if (g === "kill" && G.enemies.every((E) => E.dead || E.minion)) finish(true);
      else if (g === "reach" && Math.hypot(P.x - L.goal.at[0], P.z - L.goal.at[1]) < L.goal.r) finish(true);
      else if (g === "targets" && G.enemies.filter((E) => E.target).every((E) => E.dead)) finish(true);
      else if (g === "boss" && bossE && bossE.dead) { G.enemies.forEach((E) => { if (E.minion && !E.dead) die(E, "cleanup"); }); finish(true); }
    }
    if (G.over) { endT -= rdt; if (endT <= 0 && endResult) { const r = endResult; endResult = null; ctx.end(r); } }
    // --- hints ---
    if (L.hints && hintI < L.hints.length && t > 0.6 + hintI * 6.5) ctx.hint(L.hints[hintI++]);
    // --- animate ---
    const pAct = P.dead ? "dead" : P.act || (P.hitT > 0 ? "hit" : null);
    animate(P.h, { move: P.moveAmt, speed: P.moveAmt * P.speed * (P.sneak ? 0.5 : 1), sneak: P.sneak && !P.act, act: pAct === "slash1" || pAct === "slash2" || pAct === "slash3" || pAct === "takedown" || pAct === "roll" || pAct === "throw" || pAct === "dead" || pAct === "spin" || pAct === "parry" ? pAct : pAct === "hit" ? "hit" : null, p: P.act ? P.actT / P.actDur : pAct === "hit" ? 1 - P.hitT / 0.2 : P.dead ? P.actT : 0, dt, t });
    if (P.dead) P.actT += dt;
    for (const E of G.enemies) {
      if (!E.h.root.parent) continue;
      const act = E.dead && !E.yielded ? "dead" : E.act, p = E.dead && !E.yielded ? E.deadT / 0.8 : E.actDur ? E.actT / E.actDur : 0;
      animate(E.h, { move: E.moving || 0, speed: (E.moving || 0) * (E.state === "alert" || E.boss ? E.def.speed : E.def.walk || 1.2), act: act === "windup" && E.def.kit === "archer" ? "bow" : act, p, dt, t });
      if (E.act === "strike" && !E.boss && !E.dead) E.actT += 0;
    }
    placeActors(dt);
    const wpn = P.h.J.weapon;
    if (wpn) { const len = wpn.userData.len || 0.5; wpn.localToWorld(tmpB.set(0, -0.12, 0)); wpn.localToWorld(tmpT.set(0, -(len + 0.12), 0)); P.trail.push(tmpB, tmpT, !!P.act && /slash|spin|takedown/.test(P.act), dt); }
    if (goalBeacon) { goalBeacon.children[0].material.opacity = 0.08 + Math.sin(t * 3) * 0.04; goalBeacon.rotation.y += dt; }
    const boss = G.enemies.find((E) => E.boss && E.state === "fight" && !E.dead);
    world.camFollow(P.x, P.z, rdt, boss ? 1.12 : 1);
    world.setFocusLight(P.x, P.z);
    world.update(dt, rt);
    // HUD at ~12 fps
    hudT -= rdt; if (hudT <= 0) {
      hudT = 0.08; ctx.hud(hudState());
      const bossOn = G.enemies.some((E) => E.boss && E.state === "fight" && !E.dead), fight = G.enemies.some((E) => !E.dead && E.state === "alert" && Math.hypot(E.x - P.x, E.z - P.z) < 16);
      const low = P.dead ? 0 : Math.max(0, (0.3 - P.hp / P.maxHp) / 0.3);
      ctx.music(G.over ? "silent" : bossOn ? "boss" : fight ? "combat" : "explore", low); world.lowHealth(low * 0.7);
    }
  };
  const tmpV = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpT = new THREE.Vector3();
  function bladeColor() { const b = LOOKS.blade.find((x) => x.id === ctx.look.blade); return b && b.glow ? b.glow : 0xdff4ff; }
  function hudState() {
    const S = ctx.stats, g = L.goal ? L.goal.type : "kill";
    let obj = L.goal ? L.goal.text : "";
    if (G.endless) obj = `Wave ${wave} · ${G.enemies.filter((E) => !E.dead).length} left`;
    else if (g === "kill") { const all = G.enemies.filter((E) => !E.minion); obj += ` ${all.filter((E) => E.dead).length}/${all.length}`; }
    else if (g === "targets") { const all = G.enemies.filter((E) => E.target); obj += ` ${all.filter((E) => E.dead).length}/${all.length}`; }
    const boss = G.enemies.find((E) => E.boss && (E.state === "fight" || E.echo));
    const cds = {}; for (const id of ["step", "smoke", "dart", "vanish", "storm"]) cds[id] = S.abilities[id] ? (P.cd[id] || 0) / cdOf(id) : -1;
    const maxAware = Math.max(0, ...G.enemies.filter((E) => !E.dead && !E.boss).map((E) => (E.state === "alert" ? 1 : E.aware)));
    return { hp: P.hp, maxHp: P.maxHp, obj, cds, td: !!G.takedownTarget(), sneak: P.sneak, vanish: P.vanish > 0, aware: maxAware, time: t, silver: stats.silver,
      boss: boss && !boss.dead ? { name: boss.bdef.name, title: boss.bdef.title, f: boss.hp / boss.maxHp, phase: boss.phase, posture: boss.stun > 0 ? 1 : boss.posture / 100, broken: boss.stun > 0 } : null,
      finisher: !!(G.takedownTarget() || (boss && boss.stun > 0 && Math.hypot(boss.x - P.x, boss.z - P.z) < 2.6)), parryCd: Math.max(0, P.parryCd) };
  }
  // Story scenes play over the live level: everyone idles and the camera circles the hero.
  G.cinema = function (rdt, rt, angle) {
    if (!P) return;
    animate(P.h, { move: 0, speed: 0, act: P.dead ? "dead" : null, p: 1, dt: rdt, t: rt });
    for (const E of G.enemies) if (E.h.root.parent) animate(E.h, { move: 0, act: E.yielded ? "kneel" : E.dead ? "dead" : E.state === "patrol" && E.boss ? "sit" : null, p: 1, dt: rdt, t: rt });
    placeActors(rdt);
    for (const E of G.enemies) if (E.cone) E.cone.visible = false;
    world.camOrbit(P.x, 0, P.z, 6.5 * Math.max(0.8, P.h.scale), 2.6, angle, 1.1 * P.h.scale);
    world.setFocusLight(P.x, P.z);
    world.update(rdt, rt);
  };
  G.stop = () => { P = null; };
  // test hooks
  G.debug = { win: () => finish(true), lose: () => finish(false), get P() { return P; }, get t() { return t; } };
  return G;
}
