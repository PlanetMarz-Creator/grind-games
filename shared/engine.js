// Grind Engine — shared game logic for the Grind Games collection. No styling: every game owns its look.
// Provides saves, big-number formatting, offline earnings, daily rewards, a demo store, achievements and juice.
(function () {
  const G = {};

  // ---------- numbers ----------
  const UNITS = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];
  G.fmt = function (n) {
    if (!isFinite(n)) return "∞";
    if (Math.abs(n) < 1000) return (Math.abs(n) < 10 && n % 1 ? n.toFixed(1) : Math.floor(n)).toString();
    const i = Math.min(UNITS.length - 1, Math.floor(Math.log10(Math.abs(n)) / 3));
    const v = n / Math.pow(1000, i);
    return (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)) + UNITS[i];
  };
  G.time = function (s) {
    s = Math.max(0, Math.floor(s));
    if (s < 60) return s + "s";
    if (s < 3600) return Math.floor(s / 60) + "m " + (s % 60) + "s";
    return Math.floor(s / 3600) + "h " + Math.floor((s % 3600) / 60) + "m";
  };
  // Classic idle cost curve: base * growth^owned.
  G.cost = (base, growth, owned) => Math.ceil(base * Math.pow(growth, owned));

  // ---------- saves ----------
  function merge(def, got) {
    if (Array.isArray(def) || typeof def !== "object" || def === null) return got === undefined ? def : got;
    const out = {};
    for (const k of new Set([...Object.keys(def), ...Object.keys(got || {})])) out[k] = merge(def[k], got ? got[k] : undefined);
    return out;
  }
  G.load = function (key, defaults) {
    try { return merge(structuredClone(defaults), JSON.parse(localStorage.getItem(key) || "null")); }
    catch (e) { return structuredClone(defaults); }
  };
  G.save = function (key, state) {
    state.lastSeen = Date.now();
    try { localStorage.setItem(key, JSON.stringify(state)); } catch (e) { /* storage blocked: play continues in memory */ }
  };
  G.autosave = function (key, getState, ms = 5000) {
    setInterval(() => G.save(key, getState()), ms);
    addEventListener("visibilitychange", () => document.hidden && G.save(key, getState()));
    addEventListener("pagehide", () => G.save(key, getState()));
  };
  G.reset = function (key) { try { localStorage.removeItem(key); } catch (e) {} location.reload(); };

  // Seconds away since last save, capped (default 8h; VIP doubles it).
  G.awaySeconds = function (state, capHours = 8) {
    if (!state.lastSeen) return 0;
    return Math.min((Date.now() - state.lastSeen) / 1000, capHours * 3600);
  };

  // ---------- daily login streak ----------
  // Returns the streak day (1..7) if a reward is claimable today, else 0. Missing a day resets the streak.
  G.dailyDay = function (state) {
    const d = state.daily || (state.daily = { last: "", streak: 0 });
    const today = new Date().toDateString();
    if (d.last === today) return 0;
    const yest = new Date(Date.now() - 864e5).toDateString();
    return d.last === yest ? (d.streak % 7) + 1 : 1;
  };
  G.claimDaily = function (state) {
    const day = G.dailyDay(state);
    if (!day) return 0;
    state.daily.last = new Date().toDateString(); state.daily.streak = day;
    return day;
  };

  // ---------- UI helpers (games style .gx-* classes) ----------
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  G.el = el;

  let toastBox;
  G.toast = function (html, ms = 2200) {
    if (!toastBox) { toastBox = el("div", "gx-toasts"); toastBox.setAttribute("aria-live", "polite"); document.body.appendChild(toastBox); }
    const t = el("div", "gx-toast", html); toastBox.appendChild(t);
    while (toastBox.children.length > 2) toastBox.firstChild.remove(); // keep the play area visible
    setTimeout(() => t.classList.add("out"), ms); setTimeout(() => t.remove(), ms + 400);
  };

  // Modal with buttons: [{label, cls, onClick, keepOpen}]. Modals queue: only one shows at a time.
  const queue = [];
  let showing = false;
  G.modal = function (title, bodyHtml, buttons = [{ label: "OK" }]) {
    if (showing) { queue.push([title, bodyHtml, buttons]); return; }
    showing = true;
    const back = el("div", "gx-backdrop");
    const box = el("div", "gx-modal"); box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true");
    box.innerHTML = `<h2 class="gx-title">${title}</h2><div class="gx-body">${bodyHtml}</div>`;
    const row = el("div", "gx-actions");
    const close = () => {
      if (!back.isConnected) return;
      back.remove(); showing = false;
      if (queue.length) setTimeout(() => G.modal(...queue.shift()), 120);
    };
    buttons.forEach((b) => {
      const btn = el("button", "gx-btn " + (b.cls || ""), b.label);
      btn.onclick = () => { if (b.onClick) b.onClick(close, box); if (!b.keepOpen) close(); };
      row.appendChild(btn);
    });
    box.appendChild(row); back.appendChild(box); document.body.appendChild(back);
    back.addEventListener("click", (e) => { if (e.target === back && buttons.length <= 1) close(); });
    const first = row.querySelector("button"); if (first) first.focus();
  };

  // Floating "+123" text at a screen point.
  G.float = function (x, y, text, cls = "") {
    const f = el("div", "gx-float " + cls, text);
    f.style.left = x + "px"; f.style.top = y + "px";
    document.body.appendChild(f); setTimeout(() => f.remove(), 900);
  };
  G.shake = function (node, px = 6) {
    node.animate([{ transform: `translate(${px}px,0)` }, { transform: `translate(-${px}px,${px / 2}px)` }, { transform: "none" }], { duration: 180 });
  };

  // ---------- sound (tiny synth, no assets) ----------
  let ac; G.muted = false;
  G.sfx = function (type) {
    if (G.muted) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
      const presets = { tap: [220, 160, "square", 0.05, 0.06], coin: [880, 1320, "triangle", 0.12, 0.08], up: [440, 990, "sawtooth", 0.2, 0.06],
        hit: [140, 60, "square", 0.12, 0.1], rare: [660, 1760, "triangle", 0.45, 0.1], bad: [200, 90, "sawtooth", 0.3, 0.08] };
      const [f1, f2, wave, dur, vol] = presets[type] || presets.tap;
      o.type = wave; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* audio unavailable */ }
  };

  // ---------- achievements ----------
  G.achieve = function (state, id, title, reward, grant) {
    state.ach = state.ach || {};
    if (state.ach[id]) return false;
    state.ach[id] = Date.now();
    if (grant) grant(reward);
    G.sfx("rare"); G.toast(`🏆 <b>${title}</b>${reward ? ` · +${reward} 💎` : ""}`, 3000);
    return true;
  };

  // ---------- demo store ----------
  // Every game sells the same product shapes; `grant(product)` applies the goods.
  // DEMO: no payment is taken. Swap `checkout` for StoreKit / Google Play Billing (e.g. via RevenueCat) when shipping natively.
  G.PRODUCTS = [
    { id: "starter", name: "Starter Pack", price: 2.99, once: true, gems: 500, desc: "500 💎 + permanent 2× earnings", badge: "BEST VALUE" },
    { id: "vip", name: "VIP Pass", price: 4.99, once: true, gems: 0, desc: "Offline earnings cap 8h → 24h, 2× offline, daily +50 💎" },
    { id: "gems_s", name: "Pouch of Gems", price: 0.99, gems: 100, desc: "100 💎" },
    { id: "gems_m", name: "Chest of Gems", price: 4.99, gems: 600, desc: "600 💎 (+20% bonus)" },
    { id: "gems_l", name: "Vault of Gems", price: 9.99, gems: 1400, desc: "1,400 💎 (+40% bonus)" },
  ];
  G.checkout = function (product, onSuccess) {
    G.modal("Confirm purchase", `<p><b>${product.name}</b> — $${product.price.toFixed(2)}</p><p>${product.desc}</p>
      <p class="gx-demo">Demo build: no money is charged.</p>`,
      [{ label: "Cancel", cls: "ghost" }, { label: `Buy $${product.price.toFixed(2)}`, cls: "buy", onClick: () => { onSuccess(); G.sfx("rare"); } }]);
  };
  // Renders the store into `container`. state.owned tracks one-time products.
  G.renderStore = function (container, state, grant, extraHtml = "") {
    state.owned = state.owned || {};
    container.innerHTML = extraHtml;
    G.PRODUCTS.forEach((p) => {
      const owned = p.once && state.owned[p.id];
      const card = el("div", "gx-product" + (owned ? " owned" : ""),
        `${p.badge ? `<span class="gx-badge">${p.badge}</span>` : ""}<b>${p.name}</b><small>${p.desc}</small>`);
      const b = el("button", "gx-btn buy", owned ? "Owned ✓" : `$${p.price.toFixed(2)}`);
      b.disabled = !!owned;
      b.onclick = () => G.checkout(p, () => {
        if (p.once) state.owned[p.id] = true;
        state.gems = (state.gems || 0) + p.gems;
        G.renderStore(container, state, grant, extraHtml); grant(p); // grant last so the game can re-render its own extras
        G.toast(`Thanks! <b>${p.name}</b> added.`);
      });
      card.appendChild(b); container.appendChild(card);
    });
  };

  window.Grind = G;
})();
