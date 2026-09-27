// Hollow Pine — the game shell: saves, story flow, character creator + wardrobe, leveling, arts, gear,
// achievements you claim for silver and jade, daily rewards, the demo shop, HUD and touch/keyboard input.
import W, * as world from "./world.js";
import { makeHuman, animate } from "./actors.js";
import { createGame } from "./play.js";
import * as D from "./data.js";

const G = window.Grind;
const KEY = "hollowpine.v1";
const DEF = {
  name: "Kael", created: false, look: { ...D.DEFAULT_LOOK }, lvl: 1, xp: 0, sp: 0, gems: 0, silver: 0,
  arts: { vit: 0, edge: 0, swift: 0, silence: 0, focus: 0, precision: 0 }, abil: { step: 0, smoke: 0, dart: 0, vanish: 0, storm: 0 }, gear: { blade: 0, armor: 0, purse: 0 },
  wardrobe: {}, unlocked: {}, progress: {}, endings: {}, flags: {}, bestWave: 0, ach: {}, owned: {}, mute: false,
  stats: { kills: 0, takedowns: 0, poisonKills: 0, dodges: 0, silverTotal: 0, multi: false, runs: 0 },
};
const S = G.load(KEY, DEF);
G.muted = S.mute;
const save = () => G.save(KEY, S);
G.autosave(KEY, () => S, 8000);


// ---------- derived numbers ----------
const xpNeed = (l) => Math.round(60 * Math.pow(l, 1.35));
function derived() {
  const a = S.arts, g = S.gear, L = S.lvl;
  return {
    maxHp: (100 + 14 * (L - 1)) * (1 + 0.08 * a.vit) * (1 + 0.06 * g.armor),
    dmg: (14 + 2.2 * (L - 1)) * (1 + 0.07 * a.edge) * (1 + 0.06 * g.blade),
    speedMul: 1 + 0.03 * a.swift, silenceMul: 1 - 0.07 * a.silence, cdMul: 1 - 0.05 * a.focus, crit: 0.08 + 0.03 * a.precision,
    silverMul: (1 + 0.08 * g.purse) * (S.owned.starter ? 2 : 1), abilities: { ...S.abil },
  };
}
const done = (id) => !!(S.progress[id] && S.progress[id].done);
const nextIndex = () => { const i = D.LEVELS.findIndex((l) => !done(l.id)); return i < 0 ? D.LEVELS.length - 1 : i; };
const unlockedLevel = (i) => i === 0 || done(D.LEVELS[i - 1].id);
const stageNow = () => D.ACTS[D.LEVELS[nextIndex()].act].stage;
const totalStars = () => Object.values(S.progress).reduce((s, p) => s + (p.stars || []).filter(Boolean).length, 0);
const nameFill = (s) => s.replace(/\{name\}/g, S.name);
const find = (list, id) => list.find((o) => o.id === id);

// ---------- screens ----------
const $ = (id) => document.getElementById(id);
let current = "title";
function show(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("on", s.id === id));
  current = id;
  const enter = { title: enterTitle, chapters: renderChapters, arts: renderArts, ach: renderAch, shop: renderShop, creator: () => enterCreator(false) }[id];
  if (enter) enter();
  renderWallets();
}
document.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => { G.sfx("tap"); show(b.dataset.go); }));
function renderWallets() { document.querySelectorAll("[data-wallet]").forEach((w) => (w.innerHTML = `<span class="gold-t">🪙 ${G.fmt(S.silver)}</span><span class="jade-t">💎 ${G.fmt(S.gems)}</span>`)); }
function fade(cb) { const f = $("fade"); f.classList.add("on"); setTimeout(() => { cb(); setTimeout(() => f.classList.remove("on"), 60); }, 420); }

// ---------- 3D: showcase scenes for menus ----------
let mode = "menu", game = null, hero = null, heroKey = "", showKey = "", view = { r: 3.4, h: 1.2, look: 0.95, spin: 0.12 }, extra = [], sceneFn = null;
const SHOW_WILD = { floors: [[-7, -7, 7, 7]], start: [0, 0], props: [["hut", 0, -7], ["tree", -5, -4.5, 1.1], ["tree", 5.5, -3.5, 1], ["tree", -6.5, 2.5, 0.9], ["lantern", -2.3, -3.8], ["woodpile", 3.4, -4.6], ["rock", 4.8, 2.6, 0.9]] };
const SHOW_CITY = { floors: [[-7, -7, 7, 7]], start: [0, 0], props: [["city", -5, -7, 6, 5], ["city", 5, -7.5, 6, 5], ["lanternpost", -2.6, -3.4], ["lanternpost", 3, -3], ["crate", 3.5, 1.5], ["barrel", -3.6, 1.2], ["banner", -1.2, -5.2]] };
function showcase(stageIdx, theme) {
  theme = theme || ["dusk", "dawn", "city", "court"][stageIdx];
  const k = theme;
  if (showKey !== k) { world.build({ theme, ...(stageIdx >= 2 ? SHOW_CITY : SHOW_WILD) }); showKey = k; heroKey = ""; extra = []; }
  const hk = JSON.stringify(S.look) + stageIdx;
  if (heroKey !== hk) {
    if (hero && hero.root.parent) hero.root.parent.remove(hero.root);
    hero = makeHuman({ look: S.look, stage: stageIdx, unique: true }); world.add(hero.root); heroKey = hk;
  }
  mode = "menu";
}
function menuUpdate(dt, t) {
  if (!hero) return;
  const s = hero.scale;
  const flourish = (t % 7) / 7;
  const act = current === "title" && flourish > 0.86 ? (flourish < 0.93 ? "slash1" : "slash2") : null;
  animate(hero, { move: 0, speed: 0, act, p: act ? ((flourish - (act === "slash1" ? 0.86 : 0.93)) / 0.07) : 0, dt, t });
  extra.forEach((x) => x(dt, t));
  world.camOrbit(0, 0, 0, view.r * Math.max(0.75, s), view.h * s, Math.sin(t * view.spin) * 0.5 + (view.a || 0), view.look * s);
  world.update(dt, t);
}

// ---------- main loop ----------
let last = performance.now(), T = 0, cinA = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; T += dt;
  try {
    if (mode === "play" && game) game.update(dt, T);
    else if (mode === "cinema" && game) { cinA += dt * 0.16; game.cinema(dt, T, cinA); }
    else if (mode === "scene" && sceneFn) sceneFn(dt, T);
    else menuUpdate(dt, T);
    world.render(now);
  } catch (e) { console.error(e); }
  requestAnimationFrame(loop);
}

// ---------- story overlay ----------
let storyQ = null;
function story(lines, place, onDone) {
  storyQ = { lines: lines.map(nameFill), i: 0, onDone };
  $("storyPlace").textContent = place || "";
  $("choiceBtns").hidden = true; $("storyNext").hidden = false; $("storySkip").hidden = false;
  show("story"); storyLine();
}
function storyLine() {
  const q = storyQ, line = q.lines[q.i];
  const m = line.match(/^([A-Z][A-Z ']+):\s*(.*)$/);
  $("storyText").innerHTML = m ? `<span class="spk">${m[1][0] + m[1].slice(1).toLowerCase()}</span> — ${m[2]}` : line;
  $("storyText").animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 380, easing: "ease-out" });
  $("storyNext").textContent = q.i < q.lines.length - 1 ? "Next ▸" : "Continue ▸";
}
function storyAdvance(skip) {
  const q = storyQ; if (!q) return;
  G.sfx("tap");
  if (!skip && q.i < q.lines.length - 1) { q.i++; storyLine(); return; }
  storyQ = null; q.onDone && q.onDone();
}
$("storyNext").onclick = () => storyAdvance(false);
$("storySkip").onclick = () => storyAdvance(true);
$("story").addEventListener("pointerdown", (e) => { if (e.target.closest("button")) return; storyAdvance(false); });

// ---------- title ----------
let dailyShown = false;
function enterTitle() {
  showcase(stageNow()); view = { r: 5.4, h: 1.5, look: 1.15, spin: 0.15 };
  const i = nextIndex(), L = D.LEVELS[i];
  $("playBtn").textContent = !S.created ? "Begin" : Object.keys(S.progress).length ? `Continue · ${L.name}` : `Begin · ${L.name}`;
  $("who").innerHTML = S.created ? `${S.name} · Level ${S.lvl} · ${D.STAGES[stageNow()].name}` : "";
  $("spDot").hidden = !S.sp; $("spDot").textContent = S.sp;
  const ready = Object.values(S.ach).filter((v) => v === "ready").length; $("achDot").hidden = !ready; $("achDot").textContent = ready;
  $("muteBtn").textContent = G.muted ? "🔇" : "🔊";
  if (!dailyShown && S.created) {
    dailyShown = true; const day = G.dailyDay(S);
    if (day) {
      const jade = 10 * day + (S.owned.vip ? 50 : 0), silver = 100 * day;
      G.modal(`Day ${day} Reward`, `<p>Welcome back, ${S.name}.</p><p><b class="gold-t">🪙 ${silver}</b> &nbsp; <b class="jade-t">💎 ${jade}</b></p><p class="mut">Come back tomorrow for more. The streak resets if you miss a day.</p>`,
        [{ label: "Claim", onClick: () => { G.claimDaily(S); S.silver += silver; S.gems += jade; S.stats.silverTotal += silver; checkAch(); save(); renderWallets(); G.sfx("coin"); } }]);
    }
  }
}
$("playBtn").onclick = () => { G.sfx("tap"); if (!S.created) { enterCreator(true); return; } playLevel(nextIndex()); };
$("muteBtn").onclick = () => { G.muted = S.mute = !G.muted; $("muteBtn").textContent = G.muted ? "🔇" : "🔊"; save(); };

// ---------- chapters ----------
function renderChapters() {
  showcase(stageNow()); view = { r: 4.4, h: 1.3, look: 0.9, spin: 0.1 };
  let html = "", n = 0;
  D.ACTS.forEach((A, ai) => {
    html += `<div class="act"><small>${A.name} · ${A.place}</small><h3>${A.title}</h3></div>`;
    D.LEVELS.forEach((L, i) => {
      if (L.act !== ai) return; n++;
      const p = S.progress[L.id] || {}, st = p.stars || [], open = unlockedLevel(i), boss = L.goal.type === "boss", choice = L.goal.type === "choice";
      html += `<button class="lv ${boss ? "boss" : ""} ${open ? "" : "locked"}" data-lv="${i}" ${open ? "" : "disabled"}>
        <span class="n">${open ? (boss ? "☠" : choice ? "⚖" : n) : "🔒"}</span>
        <span><b>${L.name}</b><span class="meta">${L.place}${choice ? "" : ` · Rec. Lv ${L.rec}`}${p.best ? ` · Best ${G.time(p.best)}` : ""}</span></span>
        <span class="stars">${choice ? (S.ending ? "✓" : "") : [0, 1, 2].map((k) => `<span class="${st[k] ? "on" : ""}">★</span>`).join("")}</span></button>`;
    });
  });
  const ashes = done("redsnow");
  html += `<div class="act"><small>Endless · Grind for silver, XP and glory</small><h3>The Ashes</h3></div>
    <button class="lv boss ${ashes ? "" : "locked"}" id="ashesBtn" ${ashes ? "" : "disabled"}><span class="n">${ashes ? "∞" : "🔒"}</span><span><b>The Ruins of Hollow Pine</b><span class="meta">${ashes ? `Endless waves, a boss every 5th · Best wave ${S.bestWave}` : "Unlocks after the Night of Red Snow"}</span></span><span></span></button>`;
  $("chapList").innerHTML = html;
  $("chapList").querySelectorAll("[data-lv]").forEach((b) => (b.onclick = () => { G.sfx("tap"); playLevel(+b.dataset.lv); }));
  if (ashes) $("ashesBtn").onclick = () => { G.sfx("tap"); playEndless(); };
}

// ---------- character creator / wardrobe ----------
const CATS = [["name", "Name"], ["skin", "Skin"], ["hairStyle", "Hair"], ["hairColor", "Hair Color"], ["eyes", "Eyes"], ["outfit", "Outfit"], ["mask", "Mask"], ["scarf", "Scarf"], ["blade", "Blade"], ["scar", "Scar"], ["beard", "Beard"]];
let lookTab = "name", firstTime = false, previewStage = 0;
const owns = (cat, o) => (!o.price && !o.unlock) || S.wardrobe[cat + ":" + o.id] || (o.unlock && S.unlocked[cat + ":" + o.id]);
let creatorInit = false;
function enterCreator(first) {
  if (current === "creator" && !creatorInit && first === false) { // opened from the menu
    firstTime = false; previewStage = stageNow();
  } else if (first) { firstTime = true; previewStage = 0; creatorInit = true; show("creator"); return; }
  creatorInit = false;
  $("creatorTitle").textContent = firstTime ? "Create Your Assassin" : "Character";
  $("creatorDone").textContent = firstTime ? "Begin the Story ▸" : "Done";
  renderCreator();
}
function renderCreator() {
  showcase(previewStage); view = { r: 5.6, h: 1.2, look: 0.05, spin: 0.35 };
  const maxStage = firstTime ? 0 : Math.max(stageNow(), S.ending ? 3 : 0);
  $("stageSel").innerHTML = D.STAGES.map((s, i) => `<button class="chip ${i === previewStage ? "on" : ""} ${i > maxStage ? "lock" : ""}" data-st="${i}">${i > maxStage ? "🔒 " : ""}${s.name.replace("The ", "")}</button>`).join("");
  $("stageSel").querySelectorAll("[data-st]").forEach((b) => (b.onclick = () => { const i = +b.dataset.st; if (i > maxStage) { G.toast("You'll grow into this later in the story."); return; } previewStage = i; renderCreator(); }));
  $("lookTabs").innerHTML = CATS.map(([k, n]) => `<button class="${k === lookTab ? "on" : ""}" data-tab="${k}">${n}</button>`).join("");
  $("lookTabs").querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { lookTab = b.dataset.tab; renderCreator(); }));
  const body = $("lookBody");
  if (lookTab === "name") {
    body.innerHTML = `<input class="name" id="nameIn" maxlength="14" value="${S.name.replace(/"/g, "")}" aria-label="Name"><p class="mut" style="font-size:.8rem;margin:8px 0 0">Your look carries through every age, from boy to man. Masks, outfits and blades are earned with silver, jade and story milestones.</p>`;
    $("nameIn").oninput = (e) => { S.name = e.target.value.replace(/[<>&]/g, "").trim() || "Kael"; save(); };
    return;
  }
  const list = D.LOOKS[lookTab];
  body.innerHTML = `<div class="chips">${list.map((o) => {
    const own = owns(lookTab, o), on = S.look[lookTab] === o.id;
    const price = own ? "" : o.unlock ? `<span class="pr">🔒</span>` : o.price.s ? `<span class="pr">🪙${G.fmt(o.price.s)}</span>` : `<span class="pr j">💎${o.price.j}</span>`;
    const sw = o.c || o.tunic ? `<span class="sw" style="background:${o.c || `linear-gradient(135deg, ${o.tunic} 50%, ${o.trim} 50%)`}"></span>` : "";
    return `<button class="chip ${on ? "on" : ""} ${own ? "" : "lock"}" data-id="${o.id}">${sw}${o.name}${price}</button>`;
  }).join("")}</div>${lookTab === "beard" ? `<p class="mut" style="font-size:.78rem">Beards grow in from the Young Man stage.</p>` : ""}`;
  body.querySelectorAll("[data-id]").forEach((b) => (b.onclick = () => chooseLook(lookTab, find(list, b.dataset.id))));
}
function chooseLook(cat, o) {
  if (owns(cat, o)) { S.look[cat] = o.id; save(); G.sfx("tap"); renderCreator(); return; }
  if (o.unlock) { G.toast(`🔒 ${o.unlock}`); return; }
  const cur = o.price.s ? "s" : "j", cost = o.price[cur], have = cur === "s" ? S.silver : S.gems;
  G.modal(o.name, `<p>${cur === "s" ? "🪙" : "💎"} ${G.fmt(cost)}</p><p class="mut">You have ${G.fmt(have)}.</p>`, [{ label: "Cancel", cls: "ghost" }, { label: have >= cost ? "Buy & equip" : "Not enough", onClick: () => {
    if (have < cost) { G.toast(cur === "s" ? "Earn silver in the story or The Ashes." : "Earn jade from achievements, stars and daily visits, or visit the Shop."); return; }
    if (cur === "s") S.silver -= cost; else S.gems -= cost;
    S.wardrobe[cat + ":" + o.id] = true; S.look[cat] = o.id; S.flags.dress = true; checkAch(); save(); G.sfx("rare"); renderWallets(); renderCreator();
  } }]);
}
$("creatorDone").onclick = () => { G.sfx("tap"); if (firstTime) { S.created = true; save(); playLevel(0); } else show("title"); };
$("creatorBack").onclick = () => { G.sfx("tap"); if (firstTime) { S.created = true; save(); } show("title"); };

// ---------- playing a level ----------
let curLevel = null;
function ctxFor(stageIdx) {
  return {
    look: S.look, stageIdx, stats: derived(),
    hud: renderHud, sfx: G.sfx, toast: G.toast, hint: showHint,
    float: (x, y, z, text, cls = "") => { const p = world.project(x, y, z); if (p.behind) return; const f = document.createElement("div"); f.className = "float " + cls; f.textContent = text; f.style.left = p.x + "px"; f.style.top = p.y + "px"; document.body.appendChild(f); setTimeout(() => f.remove(), 900); },
    dialog: (lines, cb) => { story(lines, "", () => { show("hud"); cb(); }); },
    boss: (E) => { $("bossName").textContent = E.bdef.name; $("bossTitle").textContent = E.echo ? "Echo" : E.bdef.title; $("bossBar").style.display = "block"; },
    onKill: () => {},
    end: onEnd,
  };
}
function playLevel(i) {
  const L = D.LEVELS[i];
  if (!unlockedLevel(i)) return;
  if (L.goal.type === "choice") return playChoice(L);
  fade(() => {
    curLevel = { i, L };
    if (L.unlockAbility && !S.abil[L.unlockAbility]) { S.abil[L.unlockAbility] = 1; save(); }
    const stageIdx = D.ACTS[L.act].stage;
    game = createGame(ctxFor(stageIdx)); window.game = game;
    game.start(L); showKey = ""; heroKey = "";
    $("bossBar").style.display = "none";
    setupPad();
    cinA = Math.PI * 0.15; mode = "cinema";
    story(L.intro, `${D.ACTS[L.act].name} · ${L.place}`, () => { mode = "play"; show("hud"); });
  });
}
function playEndless() {
  fade(() => {
    curLevel = { endless: true };
    game = createGame(ctxFor(stageNow())); window.game = game;
    game.start(D.ENDLESS, { endless: true }); showKey = ""; heroKey = "";
    $("bossBar").style.display = "none"; setupPad();
    mode = "play"; show("hud");
  });
}
function onEnd(r) {
  S.stats.runs++;
  S.stats.kills += r.kills; S.stats.takedowns += r.takedowns; S.stats.poisonKills += r.poisonKills; S.stats.dodges += r.dodges; if (r.multi) S.stats.multi = true;
  const xpMul = S.owned.vip ? 2 : 1, sm = derived().silverMul;
  let xp = r.xp, silver = r.silver, jade = 0; const news = [];
  if (r.endless) {
    xp += r.wave * 40; silver += r.wave * 25 * sm;
    if (r.wave > S.bestWave) { S.bestWave = r.wave; news.push(`New best: wave ${r.wave}`); }
    finishRewards(xp * xpMul, silver, 0, news);
    return results({ title: "The Ashes", sub: `You held out until wave ${r.wave}.`, r, xp: xp * xpMul, silver, jade, news, endless: true });
  }
  const { i, L } = curLevel;
  if (!r.win) {
    xp *= 0.5; silver *= 0.5;
    finishRewards(xp * xpMul, silver, 0, news);
    return results({ title: r.reason === "escaped" ? "Escaped" : "You Fell", sub: r.reason === "escaped" ? "An informant reached the edge of the city." : "Hollow Pine's blade is not done yet. Train, then try again.", r, xp: xp * xpMul, silver, jade, news, lose: true });
  }
  const p = S.progress[L.id] || { stars: [false, false, false], done: false }, first = !p.done;
  const newStars = r.stars.filter((s, k) => s && !p.stars[k]).length;
  p.stars = p.stars.map((s, k) => s || r.stars[k]); p.done = true; p.best = p.best ? Math.min(p.best, r.time) : r.time;
  S.progress[L.id] = p;
  const starN = r.stars.filter(Boolean).length;
  xp += 100 * (1 + 0.6 * i) * (first ? 2 : 1) * (1 + 0.15 * starN);
  silver += 60 * (1 + 0.5 * i) * (first ? 2 : 1) * sm;
  jade = newStars * 5;
  if (L.id === "lanes" && !r.detected) S.flags.ghost_lanes = true;
  if (L.id === "redsnow" && !r.detected) S.flags.ghost_redsnow = true;
  if (r.noHitBoss) S.flags.untouched = true;
  if (L.unlockLook && !S.unlocked[L.unlockLook.join(":")]) { S.unlocked[L.unlockLook.join(":")] = true; const o = find(D.LOOKS[L.unlockLook[0]], L.unlockLook[1]); news.push(`Unlocked: ${o.name}`); }
  if (first && L.unlockAbility) news.push(`Art mastered: ${find(D.ABILITIES, L.unlockAbility).name}. Rank it up in Arts & Gear.`);
  if (first && L.id === "redsnow") news.push("Unlocked: The Ashes (endless mode)");
  finishRewards(xp * xpMul, silver, jade, news);
  const next = () => results({ title: "Victory", sub: L.name, r, xp: xp * xpMul, silver, jade, news, L });
  mode = "cinema"; cinA = 0;
  story(L.outro, L.place, () => {
    if (L.grow && first) grow(D.ACTS[L.act].stage, D.ACTS[D.LEVELS[i + 1].act].stage, L.grow, next);
    else next();
  });
}
function finishRewards(xp, silver, jade, news) {
  xp = Math.round(xp); silver = Math.round(silver);
  S.silver += silver; S.stats.silverTotal += silver; S.gems += jade; S.xp += xp;
  let ups = 0; while (S.xp >= xpNeed(S.lvl)) { S.xp -= xpNeed(S.lvl); S.lvl++; S.sp++; ups++; }
  if (ups) news.unshift(`Level up! You are level ${S.lvl}. +${ups} skill point${ups > 1 ? "s" : ""}`);
  checkAch(news); save();
}
function results({ title, sub, r, xp, silver, jade, news, L, lose, endless }) {
  if (game) { mode = "cinema"; }
  const st3 = L ? { time: `Finish under ${G.time(L.par)}`, ghost: "Never be spotted", untouched: "Lose less than a quarter of your health" }[L.star3] : "";
  const reqs = L ? [["Complete the chapter", r.stars[0]], ["Finish with over half your health", r.stars[1]], [st3, r.stars[2]]] : [];
  const i = curLevel && curLevel.i;
  const nextL = L && D.LEVELS[i + 1];
  $("resBody").innerHTML = `<h2 class="${lose ? "" : "gold-t"}">${title}</h2><p class="mut">${sub}</p>
    ${L ? `<div class="big">${r.stars.map((s) => `<span class="${s ? "on" : ""}">★</span>`).join("")}</div><div class="reqs">${reqs.map(([t, ok]) => `<div class="${ok ? "ok" : ""}">${ok ? "★" : "☆"} ${t}</div>`).join("")}</div>` : ""}
    <div class="gains"><div><small class="mut">XP</small><b>+${G.fmt(Math.round(xp))}</b></div><div><small class="mut">Silver</small><b class="gold-t">+${G.fmt(Math.round(silver))}</b></div><div><small class="mut">${endless ? "Kills" : "Jade"}</small><b class="jade-t">${endless ? r.kills : "+" + jade}</b></div></div>
    <div class="row between"><small>Level ${S.lvl}</small><small class="mut">${G.fmt(S.xp)} / ${G.fmt(xpNeed(S.lvl))} XP</small></div><div class="xpbar"><i id="xpFill" style="width:0"></i></div>
    <p class="mut" style="font-size:.8rem">⚔ ${r.kills} defeated · 🗡️ ${r.takedowns} takedowns · ⏱ ${G.time(r.time)}</p>
    <div class="news">${news.map((n) => `<div>${n}</div>`).join("")}</div>
    <div class="row" style="justify-content:center;margin-top:10px">
      ${nextL && !lose ? `<button class="btn gold" id="rNext">Next: ${nextL.name} ▸</button>` : ""}
      <button class="btn" id="rRetry">${endless ? "Again" : "Retry"}</button>
      ${S.sp ? `<button class="btn" id="rArts">Arts (${S.sp} SP)</button>` : lose ? `<button class="btn" id="rArts">Arts &amp; Gear</button>` : ""}
      <button class="btn" id="rChap">Chapters</button></div>`;
  show("results");
  requestAnimationFrame(() => setTimeout(() => { const f = $("xpFill"); if (f) f.style.width = (100 * S.xp / xpNeed(S.lvl)) + "%"; }, 60));
  if ($("rNext")) $("rNext").onclick = () => playLevel(i + 1);
  $("rRetry").onclick = () => (endless ? playEndless() : playLevel(i));
  if ($("rArts")) $("rArts").onclick = () => { leaveGame(); show("arts"); };
  $("rChap").onclick = () => { leaveGame(); show("chapters"); };
}
function leaveGame() { if (game) game.stop(); game = null; mode = "menu"; showKey = ""; }

// growth: the old you, a flash, the new you
function grow(from, to, line, then) {
  leaveGame();
  const theme = ["dusk", "dawn", "city", "court"][to];
  world.build({ theme, ...(to >= 2 ? SHOW_CITY : SHOW_WILD) }); showKey = "grow";
  let h = makeHuman({ look: S.look, stage: from, unique: true }); world.add(h.root);
  let swapped = false, t0 = T;
  mode = "scene";
  sceneFn = (dt, t) => {
    const e = t - t0;
    if (!swapped && e > 1.6) {
      swapped = true; W.fx.burst(0, 1, 0, "magic", 60, 0xffd08a); W.fx.burst(0, 0.2, 0, "snow", 30); world.shake(0.2); G.sfx("rare");
      h.root.parent.remove(h.root); h = makeHuman({ look: S.look, stage: to, unique: true }); world.add(h.root);
    }
    animate(h, { move: 0, speed: 0, act: null, dt, t });
    world.camOrbit(0, 0, 0, 3.4 * Math.max(0.75, h.scale), 1.1 * h.scale, e * 0.25, 0.8 * h.scale);
    world.update(dt, t);
  };
  const A = D.ACTS.find((a) => a.stage === to);
  story([line, `${A.name} — ${A.title}. You are ${D.STAGES[to].age}.`], "Time passes", () => { sceneFn = null; then(); });
}

// the epilogue: a choice, not a fight
function playChoice(L) {
  fade(() => {
    leaveGame(); curLevel = { i: D.LEVELS.indexOf(L), L };
    world.build({ theme: "dawn", floors: [[-8, -8, 8, 8]], start: [0, 0], props: [["hut", 0, -6.8], ["tree", -5, -4, 1.1], ["tree", 5.2, -3.5, 1], ["lantern", -2.5, -4], ["woodpile", 3.6, -4.8], ["rock", 5, 3, 0.9]] }); showKey = "choice";
    const me = makeHuman({ look: S.look, stage: 3, unique: true }); me.root.position.set(0, 0, 1.2); me.root.rotation.y = Math.PI; world.add(me.root);
    const ossa = makeHuman({ kit: "ossa" }); ossa.root.position.set(0, 0, -0.7); world.add(ossa.root);
    let ossaAct = "kneel", meAct = null, t0 = T;
    mode = "scene";
    sceneFn = (dt, t) => {
      animate(me, { move: 0, act: meAct, p: 1, dt, t }); animate(ossa, { move: 0, act: ossaAct, p: 1, dt, t });
      world.camOrbit(0, 0, 0.3, 5.2, 1.8, 0.9 + Math.sin((t - t0) * 0.12) * 0.35, 0.9);
      world.update(dt, t);
    };
    story(L.intro, "Epilogue · Ossa's Hut", () => {
      show("story"); $("storyText").innerHTML = "The blade is in your hand."; $("storyNext").hidden = true; $("storySkip").hidden = true; $("choiceBtns").hidden = false;
      $("chooseLight").onclick = () => ending("light", () => { ossaAct = null; });
      $("chooseShadow").onclick = () => ending("shadow", () => { meAct = "strike"; });
    });
    function ending(which, pose) {
      $("choiceBtns").hidden = true; G.sfx(which === "light" ? "up" : "bad");
      if (which === "shadow") fade(pose); else pose();
      S.ending = which; S.endings[which] = true; S.unlocked["outfit:" + which] = true;
      const p = S.progress.choice || { stars: [], done: false }; p.done = true; S.progress.choice = p;
      const news = [`Unlocked outfit: ${find(D.LOOKS.outfit, which).name}`]; checkAch(news); save();
      story(L[which], which === "light" ? "The Light" : "The Shadow", () => {
        G.modal("The End", `<p>Thank you for playing <b>Hollow Pine</b>.</p>${news.map((n) => `<p class="gold-t">${n}</p>`).join("")}<p class="mut">The Ashes are open for endless waves, and every chapter has stars left to earn. You can also go back and choose the other ending.</p>`,
          [{ label: "Chapters", cls: "ghost", onClick: () => { sceneFn = null; showKey = ""; show("chapters"); } }, { label: "The Ashes", onClick: () => { sceneFn = null; playEndless(); } }]);
      });
    }
  });
}

// ---------- HUD ----------
function setupPad() {
  const pad = $("pad"); pad.querySelectorAll(".ab").forEach((b) => b.remove());
  let k = 0;
  D.ABILITIES.forEach((a) => {
    if (!S.abil[a.id]) return;
    const b = document.createElement("button"); b.className = "ab"; b.dataset.ab = a.id; b.setAttribute("aria-label", a.name);
    b.innerHTML = `${a.icon}<kbd>${a.key}</kbd>`; b.style.right = (k * 54) + "px"; b.style.bottom = "152px"; k++;
    bindPress(b, () => game && game.press(a.id)); pad.appendChild(b);
  });
  pad.style.width = Math.max(250, k * 54) + "px";
  $("hudName").textContent = S.name; $("hudLv").textContent = "Lv " + S.lvl;
}
function renderHud(h) {
  $("hpBar").style.width = (100 * h.hp / h.maxHp) + "%";
  $("hudObj").innerHTML = `<small>${curLevel && curLevel.L ? curLevel.L.name : "The Ashes"}</small>${h.obj}`;
  for (const [id, f] of Object.entries(h.cds)) { const b = document.querySelector(`[data-ab="${id}"]`); if (b) b.style.setProperty("--cd", Math.max(0, f)); }
  $("bAtk").classList.toggle("td", h.td); $("bSneak").classList.toggle("on", h.sneak);
  const eye = $("eye");
  if (h.vanish) { eye.style.display = "block"; eye.style.color = "#c8b0ff"; eye.textContent = "VANISHED"; }
  else if (h.aware >= 1) { eye.style.display = "block"; eye.style.color = "#ff5a4a"; eye.textContent = "! SPOTTED"; }
  else if (h.aware > 0.08) { eye.style.display = "block"; eye.style.color = "#ffd24a"; eye.textContent = "? NOTICED"; }
  else eye.style.display = "none";
  if (h.boss) { $("bossBar").style.display = "block"; $("bossHp").style.width = (100 * h.boss.f) + "%"; } else $("bossBar").style.display = "none";
}
let hintTimer;
function showHint(text) { const e = $("hint"); e.textContent = text; e.classList.add("on"); clearTimeout(hintTimer); hintTimer = setTimeout(() => e.classList.remove("on"), 5200); }
function bindPress(el, fn) { el.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); fn(); }); }
bindPress($("bAtk"), () => game && game.press("attack"));
bindPress($("bDodge"), () => game && game.press("dodge"));
bindPress($("bSneak"), () => game && game.press("sneak"));
$("pauseBtn").addEventListener("pointerdown", (e) => { e.stopPropagation(); pause(); });
function pause() {
  if (!game || mode !== "play") return;
  game.paused = true;
  G.modal("Paused", `<p>${curLevel.L ? curLevel.L.name : "The Ashes"}</p><p class="mut">Move: drag left side / WASD · Strike: ⚔ / J · Dodge: ⤵ / Space · Sneak: 👣 / C · Arts: 1–5</p>`, [
    { label: "Resume", onClick: () => (game.paused = false) },
    { label: "Restart", cls: "ghost", onClick: () => (curLevel.endless ? playEndless() : playLevel(curLevel.i)) },
    { label: G.muted ? "Sound on" : "Sound off", cls: "ghost", onClick: () => { G.muted = S.mute = !G.muted; save(); game.paused = false; } },
    { label: "Quit", cls: "ghost", onClick: () => { leaveGame(); show("chapters"); } },
  ]);
}
// joystick on the left, tap-to-strike on the right
const joy = $("joy"); let joyId = null, jx = 0, jy = 0;
$("hud").addEventListener("pointerdown", (e) => {
  if (e.target.closest("button")) return;
  if (e.clientX < innerWidth * 0.55) { joyId = e.pointerId; jx = e.clientX; jy = e.clientY; joy.style.left = jx + "px"; joy.style.top = jy + "px"; joy.style.display = "block"; joy.firstElementChild.style.transform = ""; $("hud").setPointerCapture(e.pointerId); }
  else if (game) game.press("attack");
});
$("hud").addEventListener("pointermove", (e) => {
  if (e.pointerId !== joyId) return;
  let dx = e.clientX - jx, dy = e.clientY - jy; const d = Math.hypot(dx, dy), max = 50;
  if (d > max) { dx *= max / d; dy *= max / d; }
  joy.firstElementChild.style.transform = `translate(${dx}px, ${dy}px)`;
  if (game) game.setMove(dx / max, dy / max);
});
const joyEnd = (e) => { if (e.pointerId !== joyId) return; joyId = null; joy.style.display = "none"; if (game) game.setMove(0, 0); keyMove(); };
$("hud").addEventListener("pointerup", joyEnd); $("hud").addEventListener("pointercancel", joyEnd);
const keys = new Set();
function keyMove() { if (!game || joyId != null) return; const x = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0), z = (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0) - (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0); game.setMove(x, z); }
addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT") return;
  if (current === "story" && (e.code === "Space" || e.code === "Enter")) { e.preventDefault(); if (!$("storyNext").hidden) storyAdvance(false); return; }
  if (mode !== "play" || !game || document.querySelector(".gx-backdrop")) return;
  if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) { e.preventDefault(); keys.add(e.code); keyMove(); return; }
  if (e.repeat) return;
  if (e.code === "KeyJ" || e.code === "Enter") game.press("attack");
  else if (e.code === "Space" || e.code === "KeyK") { e.preventDefault(); game.press("dodge"); }
  else if (e.code === "KeyC" || e.code === "ShiftLeft" || e.code === "ShiftRight") game.press("sneak");
  else if (e.code === "Escape" || e.code === "KeyP") pause();
  else { const a = D.ABILITIES.find((x) => "Digit" + x.key === e.code); if (a) game.press(a.id); }
});
addEventListener("keyup", (e) => { keys.delete(e.code); keyMove(); });
addEventListener("blur", () => { keys.clear(); keyMove(); });
document.addEventListener("visibilitychange", () => { if (document.hidden && mode === "play") pause(); });

// ---------- arts & gear ----------
function renderArts() {
  showcase(stageNow()); view = { r: 4.4, h: 1.3, look: 0.9, spin: 0.1 };
  const pct = 100 * S.xp / xpNeed(S.lvl);
  let html = `<div class="panel"><div class="row between"><b class="serif">Level ${S.lvl}</b><span class="gold-t"><b>${S.sp}</b> skill point${S.sp === 1 ? "" : "s"}</span></div><div class="xpbar"><i style="width:${pct}%"></i></div><small class="mut">${G.fmt(S.xp)} / ${G.fmt(xpNeed(S.lvl))} XP · every level gives a skill point</small></div>`;
  html += `<div class="act"><small>Assassin arts · learned through the story</small><h3>Arts</h3></div>`;
  D.ABILITIES.forEach((a) => {
    const r = S.abil[a.id], lvl = D.LEVELS.find((l) => l.unlockAbility === a.id);
    html += `<div class="card"><div class="ic">${a.icon}</div><div><b>${a.name} ${r ? `<span class="mut">· rank ${r}/5</span>` : ""}</b><small>${r ? a.desc : `Learned in “${lvl.name}”`}</small>${r ? `<div class="pips">${[1, 2, 3, 4, 5].map((k) => `<i class="${k <= r ? "on" : ""}"></i>`).join("")}</div>` : ""}</div>
      ${r ? `<button class="btn small" data-ab="${a.id}" ${r >= 5 || !S.sp ? "disabled" : ""}>${r >= 5 ? "Max" : "+1 SP"}</button>` : `<span class="mut">🔒</span>`}</div>`;
  });
  html += `<div class="act"><small>Disciplines · skill points</small><h3>Training</h3></div>`;
  D.ARTS.forEach((a) => {
    const r = S.arts[a.id];
    html += `<div class="card"><div class="ic">${a.icon}</div><div><b>${a.name} <span class="mut">· ${r}/${a.max}</span></b><small>${a.desc} per rank</small><div class="pips">${Array.from({ length: a.max }, (_, k) => `<i class="${k < r ? "on" : ""}"></i>`).join("")}</div></div>
      <button class="btn small" data-art="${a.id}" ${r >= a.max || !S.sp ? "disabled" : ""}>${r >= a.max ? "Max" : "+1 SP"}</button></div>`;
  });
  html += `<div class="act"><small>Gear · silver</small><h3>Blacksmith</h3></div>`;
  D.GEAR.forEach((g) => {
    const r = S.gear[g.id], cost = G.cost(g.base, g.growth, r);
    html += `<div class="card"><div class="ic">${g.icon}</div><div><b>${g.name} <span class="mut">· ${r}/${g.max}</span></b><small>${g.desc}</small></div>
      <button class="btn small" data-gear="${g.id}" ${r >= g.max || S.silver < cost ? "disabled" : ""}>${r >= g.max ? "Max" : "🪙 " + G.fmt(cost)}</button></div>`;
  });
  const d = derived();
  html += `<p class="mut" style="font-size:.8rem;margin-top:12px">❤️ ${Math.round(d.maxHp)} health · 🗡️ ${Math.round(d.dmg)} damage · ✴️ ${Math.round(d.crit * 100)}% critical · 🍃 ${Math.round(d.speedMul * 100)}% speed</p>`;
  $("artsBody").innerHTML = html;
  $("artsBody").querySelectorAll("[data-ab]").forEach((b) => (b.onclick = () => { if (!S.sp) return; S.sp--; S.abil[b.dataset.ab]++; G.sfx("up"); save(); renderArts(); renderWallets(); }));
  $("artsBody").querySelectorAll("[data-art]").forEach((b) => (b.onclick = () => { if (!S.sp) return; S.sp--; S.arts[b.dataset.art]++; G.sfx("up"); save(); renderArts(); }));
  $("artsBody").querySelectorAll("[data-gear]").forEach((b) => (b.onclick = () => { const g = find(D.GEAR, b.dataset.gear), c = G.cost(g.base, g.growth, S.gear[g.id]); if (S.silver < c) return; S.silver -= c; S.gear[g.id]++; G.sfx("coin"); save(); renderArts(); renderWallets(); }));
}

// ---------- achievements ----------
const ACH_CHECK = {
  paper: () => done("paper"), ghost_lanes: () => S.flags.ghost_lanes, doran: () => done("doran"), redsnow: () => done("redsnow"), ghost_redsnow: () => S.flags.ghost_redsnow,
  grel: () => done("camp"), ossa: () => done("ossa"), targets: () => done("stables"), hask: () => done("hask"), varek: () => done("varek"), light: () => S.endings.light, shadow: () => S.endings.shadow,
  td10: () => S.stats.takedowns >= 10, td100: () => S.stats.takedowns >= 100, k100: () => S.stats.kills >= 100, k1000: () => S.stats.kills >= 1000,
  stars15: () => totalStars() >= 15, stars42: () => totalStars() >= 42, lv10: () => S.lvl >= 10, lv25: () => S.lvl >= 25, wave10: () => S.bestWave >= 10, wave25: () => S.bestWave >= 25,
  multi: () => S.stats.multi, untouched: () => S.flags.untouched, dodge50: () => S.stats.dodges >= 50, poison25: () => S.stats.poisonKills >= 25,
  arts: () => Object.values(S.abil).every((r) => r > 0), rich: () => S.stats.silverTotal >= 10000, dress: () => S.flags.dress, streak3: () => S.daily && S.daily.streak >= 3,
};
function checkAch(news) {
  for (const [id, title] of D.ACHIEVEMENTS) if (!S.ach[id] && ACH_CHECK[id] && ACH_CHECK[id]()) {
    S.ach[id] = "ready"; G.sfx("rare"); G.toast(`🏆 <b>${title}</b> · claim it in Achievements`, 3000);
    if (news) news.push(`🏆 Achievement: ${title}`);
  }
  if (Object.keys(S.ach).length >= 25 && !S.unlocked["blade:jade"]) { S.unlocked["blade:jade"] = true; if (news) news.push("Unlocked: Jade Fang blade"); }
}
function renderAch() {
  showcase(stageNow()); view = { r: 4.4, h: 1.3, look: 0.9, spin: 0.1 };
  checkAch();
  const got = D.ACHIEVEMENTS.filter(([id]) => S.ach[id] === "claimed"), pts = got.reduce((s, a) => s + a[5], 0), max = D.ACHIEVEMENTS.reduce((s, a) => s + a[5], 0);
  const order = (id) => (S.ach[id] === "ready" ? 0 : !S.ach[id] ? 1 : 2);
  const list = D.ACHIEVEMENTS.slice().sort((a, b) => order(a[0]) - order(b[0]));
  $("achBody").innerHTML = `<div class="panel"><div class="row between"><b class="serif">${pts} / ${max} points</b><span class="mut">${got.length} / ${D.ACHIEVEMENTS.length} claimed</span></div><div class="xpbar"><i style="width:${(100 * pts) / max}%"></i></div></div><div style="height:10px"></div>` +
    list.map(([id, title, how, s, j, p]) => { const st = S.ach[id]; return `<div class="card ${st === "ready" ? "ready" : st === "claimed" ? "done" : ""}"><div class="ic">${st ? "🏆" : "🔒"}</div><div><b>${title} <span class="mut">· ${p} pts</span></b><small>${how}</small><small><span class="gold-t">🪙 ${s}</span> · <span class="jade-t">💎 ${j}</span></small></div>
      ${st === "ready" ? `<button class="btn gold small" data-claim="${id}">Claim</button>` : st === "claimed" ? `<span class="mut">✓</span>` : ""}</div>`; }).join("");
  $("achBody").querySelectorAll("[data-claim]").forEach((b) => (b.onclick = () => {
    const a = D.ACHIEVEMENTS.find((x) => x[0] === b.dataset.claim); S.ach[a[0]] = "claimed"; S.silver += a[3]; S.stats.silverTotal += a[3]; S.gems += a[4];
    G.sfx("coin"); G.toast(`+🪙 ${a[3]} · +💎 ${a[4]}`); checkAch(); save(); renderAch(); renderWallets();
  }));
}

// ---------- shop (demo purchases) ----------
G.PRODUCTS = [
  { id: "starter", name: "Starter Pack", price: 2.99, once: true, gems: 500, desc: "500 💎 jade + permanent 2× silver", badge: "BEST VALUE" },
  { id: "vip", name: "Shadow Pass", price: 4.99, once: true, gems: 0, desc: "Permanent 2× XP and +50 💎 jade every day" },
  { id: "gems_s", name: "Pouch of Jade", price: 0.99, gems: 100, desc: "100 💎" },
  { id: "gems_m", name: "Chest of Jade", price: 4.99, gems: 600, desc: "600 💎 (+20% bonus)" },
  { id: "gems_l", name: "Vault of Jade", price: 9.99, gems: 1400, desc: "1,400 💎 (+40% bonus)" },
];
function renderShop() { showcase(stageNow()); view = { r: 4.4, h: 1.3, look: 0.9, spin: 0.1 }; G.renderStore($("shopBody"), S, () => { save(); renderWallets(); }, ""); }

// test + console hooks
window.HP = { S, save, W, world, get game() { return game; }, playLevel: (i) => playLevel(i), playEndless: () => playEndless(), show: (id) => show(id), finishRewards };

// ---------- boot ----------
try {
  world.init($("view"));
  show("title");
  $("loading").remove();
  requestAnimationFrame(loop);
} catch (e) {
  console.error(e);
  $("loading").innerHTML = `<div style="text-align:center;padding:20px;font:500 1rem system-ui;letter-spacing:0">Hollow Pine needs WebGL (3D graphics).<br><span style="color:#a39a8a">Try a recent Chrome, Safari or Firefox.</span></div>`;
}
