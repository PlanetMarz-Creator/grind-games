// Hollow Pine — content: story, levels, foes, bosses, arts, cosmetics, achievements.
// Coordinates: x = right, z = toward the camera (down the screen). Levels run from +z (start) to -z (goal).

export const STAGES = [
  { id: "boy", name: "The Boy", age: 10, scale: 0.64, head: 1.24, bulk: 0.86, speed: 0.93 },
  { id: "teen", name: "The Teen", age: 15, scale: 0.86, head: 1.08, bulk: 0.93, speed: 1 },
  { id: "young", name: "The Young Man", age: 18, scale: 0.97, head: 1.0, bulk: 1, speed: 1.05 },
  { id: "man", name: "The Man", age: 19, scale: 1.0, head: 0.98, bulk: 1.1, speed: 1.06 },
];

export const ACTS = [
  { name: "Act I", title: "The Boy", place: "Hollow Pine", stage: 0 },
  { name: "Act II", title: "The Teen", place: "The Northern Mountains", stage: 1 },
  { name: "Act III", title: "The Young Man", place: "The Regent's City", stage: 2 },
  { name: "Act IV", title: "The Man", place: "The Regent's Tower", stage: 3 },
];

// ---------- foes ----------
// hp/dmg are tier-0 values; each level's tier scales them. vision in units, fov in degrees.
export const FOES = {
  dummy: { name: "Straw Dummy", hp: 26, dmg: 0, speed: 0, walk: 0, reach: 0, wind: 1, cd: 9, vision: 0, fov: 0, xp: 6, silver: 3, kit: "dummy", still: true },
  elder: { name: "Village Elder", hp: 50, dmg: 5, speed: 2.5, walk: 1.1, reach: 1.5, wind: 0.6, cd: 1.6, vision: 7.5, fov: 80, xp: 12, silver: 5, kit: "elder" },
  trainee: { name: "Pine Student", hp: 44, dmg: 6, speed: 3.0, walk: 1.2, reach: 1.5, wind: 0.5, cd: 1.4, vision: 8, fov: 90, xp: 12, silver: 5, kit: "trainee" },
  soldier: { name: "Regent's Soldier", hp: 62, dmg: 10, speed: 3.1, walk: 1.3, reach: 1.7, wind: 0.55, cd: 1.5, vision: 9, fov: 80, xp: 18, silver: 8, kit: "soldier" },
  archer: { name: "Regent's Archer", hp: 42, dmg: 9, speed: 2.8, walk: 1.2, reach: 1.4, ranged: 12, wind: 0.9, cd: 2.3, vision: 12, fov: 70, xp: 18, silver: 8, kit: "archer" },
  wolf: { name: "Mountain Wolf", hp: 34, dmg: 7, speed: 5.0, walk: 1.8, reach: 1.3, wind: 0.35, cd: 1.1, vision: 10, fov: 150, xp: 12, silver: 4, kit: "wolf", beast: true, r: 0.45 },
  shadow: { name: "Shadow", hp: 50, dmg: 8, speed: 3.6, walk: 1.4, reach: 1.6, wind: 0.45, cd: 1.3, vision: 7, fov: 120, xp: 16, silver: 6, kit: "shadow", hidden: true },
  bandit: { name: "Pass Bandit", hp: 80, dmg: 12, speed: 2.9, walk: 1.2, reach: 1.8, wind: 0.65, cd: 1.6, vision: 8.5, fov: 90, xp: 20, silver: 10, kit: "bandit" },
  spy: { name: "Regent's Informant", hp: 40, dmg: 6, speed: 3.3, walk: 1.1, reach: 1.4, wind: 0.5, cd: 1.4, vision: 8, fov: 100, xp: 30, silver: 20, kit: "spy", flee: true },
  elite: { name: "Tower Elite", hp: 120, dmg: 15, speed: 3.0, walk: 1.2, reach: 2.2, wind: 0.6, cd: 1.5, vision: 10, fov: 80, xp: 32, silver: 14, kit: "elite", guard: true },
};

// Boss moves: [name, weight]. p2 = phase two, added below a health fraction.
export const BOSSES = {
  doran: { name: "Doran", title: "Your Father · The Finest Blade", hp: 420, dmg: 11, speed: 3.6, kit: "doran", yieldAt: 0.25,
    moves: [["combo", 3], ["lunge", 2], ["knives", 2]], xp: 150, silver: 80 },
  grel: { name: "Grel", title: "The Bandit King", hp: 1000, dmg: 19, speed: 2.6, kit: "grel", scale: 1.3,
    moves: [["combo", 2], ["slam", 3], ["whirl", 2]], p2: { at: 0.5, add: [["summon", 2]], minion: "bandit" }, xp: 400, silver: 200 },
  ossa: { name: "Ossa", title: "The Blind Master", hp: 850, dmg: 15, speed: 3.9, kit: "ossa", yieldAt: 0.25,
    moves: [["blink", 3], ["knives", 2], ["combo", 2], ["vanish", 1]], xp: 450, silver: 220 },
  hask: { name: "Captain Hask", title: "The Iron Hound", hp: 1300, dmg: 23, speed: 3.0, kit: "hask", shield: true,
    moves: [["combo", 2], ["charge", 4], ["bash", 2]], p2: { at: 0.5, add: [["summon", 2]], minion: "soldier" }, xp: 700, silver: 350 },
  varek: { name: "Regent Varek", title: "The Man Who Bought a Village", hp: 1700, dmg: 25, speed: 3.4, kit: "varek",
    moves: [["combo", 3], ["knives", 2], ["poison", 2], ["blink", 2]], p2: { at: 0.6, add: [["rain", 3], ["summon", 1]], minion: "elite", talk: true }, xp: 1000, silver: 500 },
};

// ---------- abilities (assassin arts with a button) ----------
export const ABILITIES = [
  { id: "step", name: "Shadow Step", icon: "👤", key: "1", cd: 7, desc: "Blink behind the nearest enemy and strike a critical hit. Unaware foes die instantly." },
  { id: "smoke", name: "Smoke Bomb", icon: "💨", key: "2", cd: 14, desc: "Everyone in the cloud loses sight of you and is stunned. Stunned foes can be taken down." },
  { id: "dart", name: "Poison Dart", icon: "🎯", key: "3", cd: 4, desc: "Your mother's recipe. A silent dart that poisons for 5 seconds." },
  { id: "vanish", name: "Vanish", icon: "🌫️", key: "4", cd: 20, desc: "Turn invisible and 30% faster. Your next strike is a takedown." },
  { id: "storm", name: "Blade Storm", icon: "🌀", key: "5", cd: 12, desc: "Spin through everything around you." },
];

// Passive arts bought with skill points (1 per player level).
export const ARTS = [
  { id: "vit", name: "Vitality", icon: "❤️", desc: "+8% health", max: 10 },
  { id: "edge", name: "Edge", icon: "🗡️", desc: "+7% damage", max: 10 },
  { id: "swift", name: "Swiftness", icon: "🍃", desc: "+3% speed", max: 10 },
  { id: "silence", name: "Silence", icon: "🤫", desc: "Seen 7% slower", max: 10 },
  { id: "focus", name: "Focus", icon: "🧘", desc: "−5% cooldowns", max: 8 },
  { id: "precision", name: "Precision", icon: "✴️", desc: "+3% critical", max: 10 },
];

// Gear bought with silver.
export const GEAR = [
  { id: "blade", name: "Whetstone", icon: "🔪", desc: "+6% damage per level", max: 25, base: 120, growth: 1.42 },
  { id: "armor", name: "Padded Gi", icon: "🥋", desc: "+6% health per level", max: 25, base: 120, growth: 1.42 },
  { id: "purse", name: "Deep Pockets", icon: "👛", desc: "+8% silver per level", max: 15, base: 200, growth: 1.55 },
];

// ---------- cosmetics ----------
// price: { s: silver } or { j: jade }, or unlock: "reason" (earned). Nothing = free.
export const LOOKS = {
  skin: [
    { id: "s1", name: "Porcelain", c: "#f2d3ba" }, { id: "s2", name: "Warm", c: "#e3b28c" }, { id: "s3", name: "Honey", c: "#c68d61" },
    { id: "s4", name: "Bronze", c: "#a36a44" }, { id: "s5", name: "Umber", c: "#7a4a2d" }, { id: "s6", name: "Ebony", c: "#4d2f1e" },
  ],
  hairStyle: [
    { id: "short", name: "Short" }, { id: "topknot", name: "Topknot" }, { id: "long", name: "Tail" },
    { id: "braid", name: "Braid" }, { id: "wild", name: "Wild" }, { id: "shaved", name: "Shaved" },
  ],
  hairColor: [
    { id: "black", name: "Ink", c: "#15100d" }, { id: "brown", name: "Chestnut", c: "#3d2416" }, { id: "auburn", name: "Auburn", c: "#6d2f18" },
    { id: "ash", name: "Ash", c: "#77736e" }, { id: "white", name: "Snow", c: "#e4e0d8" },
  ],
  eyes: [
    { id: "brown", name: "Brown", c: "#3a2212" }, { id: "grey", name: "Storm", c: "#5d6470" }, { id: "green", name: "Pine", c: "#3f6e3a" },
    { id: "blue", name: "Glacier", c: "#3b6a9a" }, { id: "amber", name: "Amber", c: "#9a6a1a" },
  ],
  outfit: [
    { id: "pine", name: "Hollow Pine Grey", tunic: "#4a4d52", pants: "#2c2e33", wrap: "#b9b2a4", trim: "#7a1f1f" },
    { id: "night", name: "Night", tunic: "#1b1c22", pants: "#121317", wrap: "#34363d", trim: "#3e4250" },
    { id: "moss", name: "Moss", tunic: "#3c4a33", pants: "#262e20", wrap: "#a39d86", trim: "#8a6a2a" },
    { id: "ash", name: "Ash Walker", tunic: "#8b8680", pants: "#4c4945", wrap: "#d8d2c6", trim: "#2c2c2c", price: { s: 300 } },
    { id: "blood", name: "Blood Moon", tunic: "#5e1016", pants: "#1d0b0d", wrap: "#2a1416", trim: "#d4a64a", price: { s: 900 } },
    { id: "wraith", name: "Snow Wraith", tunic: "#e8e8ea", pants: "#b8bcc4", wrap: "#ffffff", trim: "#6fa8d8", price: { s: 1500 } },
    { id: "silk", name: "Regent's Silk", tunic: "#3a1a52", pants: "#1e1030", wrap: "#c9a44a", trim: "#e0c068", price: { j: 150 } },
    { id: "ember", name: "Ember", tunic: "#2a1a14", pants: "#140c09", wrap: "#ff7a2a", trim: "#ffb347", price: { j: 220 } },
    { id: "light", name: "Teacher of the Light", tunic: "#f1ead8", pants: "#9c8f74", wrap: "#fff6e0", trim: "#d9a441", unlock: "Choose the Light ending" },
    { id: "shadow", name: "Last Shadow", tunic: "#0b0b0f", pants: "#050507", wrap: "#5a0d12", trim: "#9b1420", unlock: "Choose the Shadow ending" },
  ],
  mask: [
    { id: "none", name: "Bare" }, { id: "half", name: "Half Mask" }, { id: "hood", name: "Hood" }, { id: "hoodmask", name: "Hood + Mask" },
    { id: "oni", name: "Oni Mask", price: { s: 1500 } }, { id: "fox", name: "Fox Mask", price: { j: 120 } },
    { id: "blindfold", name: "Ossa's Blindfold", unlock: "Beat Ossa's Trial" },
  ],
  scarf: [
    { id: "none", name: "None" }, { id: "crimson", name: "Crimson", c: "#8e1b1b" }, { id: "black", name: "Black", c: "#141418" }, { id: "white", name: "White", c: "#e9e6df" },
    { id: "long", name: "Long Crimson", c: "#a01818", long: true, price: { s: 500 } }, { id: "jade", name: "Jade Silk", c: "#2f8f6a", long: true, price: { j: 100 } },
  ],
  blade: [
    { id: "tanto", name: "Tanto", len: 0.42 }, { id: "ninjato", name: "Ninjato", len: 0.72, price: { s: 400 } },
    { id: "doran", name: "Doran's Blade", len: 0.8, unlock: "Beat Doran's Lesson" },
    { id: "ember", name: "Ember Edge", len: 0.75, glow: "#ff6a1a", price: { s: 2500 } },
    { id: "moon", name: "Moon Blade", len: 0.8, glow: "#7fc4ff", price: { j: 250 } },
    { id: "jade", name: "Jade Fang", len: 0.68, glow: "#3dffa8", unlock: "Earn 25 achievements" },
  ],
  scar: [{ id: "none", name: "None" }, { id: "eye", name: "Eye" }, { id: "cheek", name: "Cheek" }],
  beard: [{ id: "none", name: "None" }, { id: "stubble", name: "Stubble" }, { id: "short", name: "Short" }, { id: "full", name: "Full" }],
};
export const DEFAULT_LOOK = { skin: "s2", hairStyle: "topknot", hairColor: "black", eyes: "brown", outfit: "pine", mask: "none", scarf: "crimson", blade: "tanto", scar: "none", beard: "none" };

// ---------- levels ----------
// props: [type, ...args]. house/stable/city: [x,z,w,d]; tree/rock: [x,z,scale]; wall/fence: [x1,z1,x2,z2];
// enemies: [foe, x, z, path?, opts?]. goal: kill | reach | targets | boss | choice.
const C8 = (r) => Array.from({ length: 8 }, (_, i) => { const a = (i + 0.5) * Math.PI / 4; return ["pillar", +(Math.cos(a) * r).toFixed(2), +(Math.sin(a) * r).toFixed(2)]; });

export const LEVELS = [
  // ===== ACT I — THE BOY =====
  { id: "paper", act: 0, name: "The Straw Men", place: "Hollow Pine · Training Yard", theme: "day", tier: 0, rec: 1, par: 50, star3: "time",
    goal: { type: "kill", text: "Cut down the straw dummies" },
    floors: [[-10, -12, 10, 12]], start: [0, 9], fence: [-10, -12, 10, 12],
    props: [["house", -6, -9, 6, 4.5], ["house", 6.5, -9, 5, 4.5], ["rack", 0, -10.6], ["lantern", -8, 5], ["lantern", 8, 5], ["lantern", -3.5, -5.5], ["lantern", 3.5, -5.5], ["rock", 8, -2, 1], ["rock", -8.5, -1, 0.8], ["tree", -8.6, 10, 0.8], ["tree", 8.6, 9.8, 0.9]],
    enemies: [["dummy", -4, 3], ["dummy", 0, 1], ["dummy", 4, 3], ["dummy", -5, -3], ["dummy", 5, -3], ["dummy", 0, -5]],
    hints: ["Drag anywhere on the left to move. Keyboard: WASD.", "Tap ⚔ to strike (J or click). Three quick strikes make a combo.", "Tap ⤵ to dodge-roll (Space). You can't be hurt mid-roll."],
    intro: [
      "No map shows Hollow Pine. It sits in a fold of the northern mountains, where the fog is so thick that birds walk instead of fly.",
      "For three hundred years its people have made one thing, and made it better than anyone alive: quiet deaths.",
      "You are {name}. Your mother Ysra is the village poisoner. Your father Doran is its finest blade. You are ten years old.",
      "DORAN: \"Feet light. Blade lighter. Cut down the straw men, then we eat.\"",
    ],
    outro: ["DORAN: \"Good. Sloppy, but good. Your mother made mint tea. Don't tell her I let you use a real blade.\""] },

  { id: "lanes", act: 0, name: "Walking on Paper", place: "Hollow Pine · The Lanes", theme: "dusk", tier: 0, rec: 2, par: 90, star3: "ghost",
    goal: { type: "reach", text: "Reach the bell unseen", at: [0, -18.2], r: 2.2 },
    floors: [[-11, -22, 11, 22]], start: [0, 19], fence: [-11, -22, 11, 22],
    props: [["house", -7.5, 15, 5, 5], ["house", 7.5, 15, 5, 5], ["house", -7.5, 5, 5, 6], ["house", 7.5, 6, 5, 4], ["house", 0, -1, 6, 4], ["house", -7.5, -6, 5, 5], ["house", 7.5, -8, 5, 5], ["house", -6, -15, 4, 4], ["house", 6, -15, 4, 4],
      ["belltower", 0, -20.6], ["lantern", -3.6, 12], ["lantern", 3.6, 12], ["lantern", -4.2, -9.5], ["lantern", 4.2, -11.5], ["crate", 3.6, 2.6], ["crate", 4.3, 3.3], ["barrel", -3.9, -5.2], ["tree", -9.5, -19.5, 0.8], ["tree", 9.6, -19.8, 0.9]],
    enemies: [["elder", -3.5, 9, [[-3.5, 9], [3.5, 9]]], ["elder", -4.1, 5, [[-4.1, 5], [-4.1, -4]]], ["elder", 4.1, 1, [[4.1, 1], [4.1, -4.5]]], ["elder", -3, -10.5, [[-3, -10.5], [3, -10.5]]], ["elder", 0, -15.5, null, { face: 0, look: 1.1 }]],
    hints: ["Tap 👣 to sneak (C or Shift). Sneaking is quiet and slow.", "Cones show where elders look. They turn yellow, then red, as you're noticed.", "Behind an unaware enemy, ⚔ becomes a silent TAKEDOWN."],
    intro: [
      "The second rule of Hollow Pine: if they see you, you have already lost.",
      "YSRA: \"The elders are watching the lanes tonight. Reach the bell without a single one seeing you.\"",
      "YSRA: \"And if one does? Make sure they're sleeping before they can tell anyone.\"",
    ],
    outro: ["The bell rang once. Your mother laughed from a rooftop you never saw her climb.", "YSRA: \"Rice-paper feet. Just like your father's.\""] },

  { id: "falls", act: 0, name: "Below the Falls", place: "Hollow Pine · The Falls", theme: "day", tier: 0.3, rec: 3, par: 75, star3: "time",
    goal: { type: "kill", text: "Beat the older students" },
    floors: [[-11, -8, 11, 15]], start: [0, 12], cliff: [-16, -13, 16], pool: [0, -10.5, 18, 5],
    props: [["rock", -9, -5.5, 1.3], ["rock", 9, -6, 1.5], ["rock", -5, 3, 0.9], ["rock", 6.5, 5, 0.8], ["rock", -8, 9, 1.1], ["rock", 3, -6.5, 0.7], ["tree", 10, 12, 1], ["tree", -10.2, 13, 0.9], ["tree", 10.3, 1, 0.8], ["lantern", -2.5, 9.5], ["lantern", 2.5, 9.5]],
    enemies: [["trainee", -5, 5.5, null, { face: 1.6 }], ["trainee", -3, 5.5, null, { face: -1.6 }], ["trainee", 4, 3, [[4, 3], [6, -3]]], ["trainee", -6, -2, [[-6, -2], [-2, -3]]], ["trainee", 0, -4, null, { face: 0 }], ["trainee", 7, 8, null, { face: 2.6 }], ["trainee", -8, -5, null, { face: 0.6 }], ["trainee", 5, -5, null, { face: -0.8 }]],
    hints: ["Takedowns count double here. Nobody fights fair below the falls."],
    intro: [
      "Every child of Hollow Pine trains below the falls, where the water is cold enough to stop your breath.",
      "The older students don't go easy on Doran's son.",
    ],
    outro: ["DORAN: \"You fought eight and stayed standing. Tomorrow, you fight me.\""] },

  { id: "doran", act: 0, name: "Doran's Lesson", place: "Hollow Pine · Training Yard, Sunset", theme: "sunset", tier: 0.5, rec: 4, par: 90, star3: "untouched",
    goal: { type: "boss", text: "Spar with your father", boss: "doran" },
    floors: [[-10, -10, 10, 10]], start: [0, 7], fence: [-10, -10, 10, 10],
    props: [["lantern", -8.5, -8.5], ["lantern", 8.5, -8.5], ["lantern", -8.5, 8.5], ["lantern", 8.5, 8.5], ["rack", -4, -9.2], ["rack", 4, -9.2], ["tree", -9.5, 0, 0.9], ["tree", 9.6, -2, 0.8]],
    enemies: [], boss: ["doran", 0, -4],
    hints: ["Red on the ground means MOVE. Dodge through it or step out.", "Doran yields when he's had enough. Show him everything."],
    intro: ["DORAN: \"Red on the ground means move. Everything else means strike.\"", "DORAN: \"Come. Show me what your mother's been teaching you behind my back.\""],
    outro: [
      "Doran lowers his blade and smiles. \"You have my eyes. Take this. It was mine at your age.\"",
      "You earned DORAN'S BLADE.",
      "Three nights later, the lanterns of the winter festival are lit.",
    ], unlockLook: ["blade", "doran"] },

  { id: "redsnow", act: 0, name: "The Night of Red Snow", place: "Hollow Pine · Festival Night", theme: "redsnow", tier: 1, rec: 5, par: 120, star3: "ghost",
    goal: { type: "reach", text: "Get to the old well", at: [0, -21.5], r: 1.9 },
    floors: [[-12, -25, 12, 25]], start: [0, 22],
    props: [["house", -8, 16, 5, 5, 1], ["house", 8, 15, 5, 6, 1], ["house", -8, 6, 5, 5, 1], ["house", 8, 5, 5, 4, 1], ["house", 0, 0, 5, 4, 1], ["house", -8, -6, 5, 6, 1], ["house", 8, -8, 5, 5, 1], ["house", 0, -13, 5, 4, 1], ["house", 8, -18, 5, 4, 1], ["house", -8, -18, 4, 4, 1],
      ["well", 0, -21.5], ["fire", 4, 10, 1], ["fire", -3.5, -3.5, 0.8], ["fire", 3.6, -13, 0.9], ["cart", -3.8, 18], ["barrel", 4.2, 20], ["lanternpost", -3.2, 7], ["lanternpost", 3.2, -6]],
    enemies: [["soldier", -4, 11, [[-4, 11], [4, 11]]], ["soldier", -4.3, 4, [[-4.3, 4], [-4.3, -3]]], ["soldier", 4.3, 2, [[4.3, 2], [4.3, -4.5]]], ["soldier", -10, 0.5, [[-10, 0.5], [-6, 0.5]]],
      ["soldier", -4.2, -9, [[-4.2, -9], [-4.2, -16]]], ["soldier", 4.2, -9.5, [[4.2, -9.5], [4.2, -16]]], ["soldier", -3.5, -19.5, null, { face: 0.5, look: 1 }], ["soldier", 3.5, -19.5, null, { face: -0.5, look: 1 }]],
    hints: ["Stay in the dark between the fires. Soldiers are much stronger than you."],
    intro: [
      "Lord Varek was the village's richest patron. Now he is regent, and a regent can't afford three hundred witnesses.",
      "His soldiers come on the first night of the festival. They know the hidden passes. Someone gave them a map.",
      "DORAN: \"Get to the old well. Count to ten thousand. Don't come up before. Whatever you hear.\"",
    ],
    outro: [
      "You count to ten thousand. Then you count again, because you are afraid.",
      "Snow falls through the opening of the well. It is pink.",
      "When you climb out, Hollow Pine is ash. Three hundred people. No graves. No names.",
      "Only the carved lintel from your door remains: WE ARE THE SHADOW THE POWERFUL CAST.",
    ], grow: "Seven winters pass on the mountain." },

  // ===== ACT II — THE TEEN =====
  { id: "bridge", act: 1, name: "The Rope Bridge", place: "The Northern Mountains", theme: "mountain", tier: 1.5, rec: 6, par: 70, star3: "time",
    goal: { type: "kill", text: "Drive off the wolf pack" },
    floors: [[-7, 13, 7, 24], [-1.6, -13.5, 1.6, 13.5], [-9, -26, 9, -13]], start: [0, 21], bridge: [0, -13, 13, 3.2], chasm: true,
    props: [["rock", -5, 19.5, 1.2], ["rock", 5.2, 17.5, 1], ["tree", -6, 23, 0.9], ["tree", 6.3, 22.6, 1], ["tree", -7.5, -24, 1], ["tree", 7.6, -21, 1.1], ["rock", -6, -16, 1.1], ["rock", 6.5, -24, 1], ["hut", 0, -29.5]],
    enemies: [["wolf", 0, 5, null, { face: 0 }], ["wolf", 0.4, -3, null, { face: 0 }], ["wolf", -5, -18], ["wolf", 5, -17], ["wolf", 0, -21], ["wolf", -3, -23.5], ["wolf", 4, -23]],
    hints: ["Wolves are fast but fragile. Let them come to you on the bridge."],
    intro: [
      "An old man finds you in the snow by the sound of your starving breath. He is blind.",
      "OSSA: \"Your father was my student. Now you are. First lesson: the mountain doesn't care who you've lost.\"",
      "Five winters later, a wolf pack follows the smell of Ossa's smoked fish to the bridge.",
    ],
    outro: ["OSSA: \"You slept on that bridge for a month. Now you fight on it. Good.\""] },

  { id: "blind", act: 1, name: "Blindfold", place: "The Northern Mountains · Moonless Night", theme: "dark", tier: 2, rec: 7, par: 80, star3: "time",
    goal: { type: "kill", text: "Find and defeat the shadows" },
    floors: [[-12, -12, 12, 12]], start: [0, 8], ring: 11,
    props: [["tree", -6, 3, 1], ["tree", 6.5, -2, 1.1], ["rock", -2, -6, 1.2], ["rock", 5, 6, 0.9], ["tree", 0, -9.8, 0.9], ["rock", -8, -4, 1]],
    enemies: [["shadow", -5, 6], ["shadow", 5, 3], ["shadow", -7, -1], ["shadow", 2, -2], ["shadow", -3, -8], ["shadow", 7, -7], ["shadow", 8, 8], ["shadow", -8, -9]],
    unlockAbility: "step",
    hints: ["New art: SHADOW STEP. Tap 👤 (key 1) to blink behind the nearest enemy.", "Shadows only show up close. Listen for their eyes."],
    intro: [
      "Ossa trains you blindfolded, so you'll never depend on your eyes.",
      "OSSA: \"Tonight there's no moon. My neighbors' sons are out there with sticks and black cloth. Find them.\"",
      "You learned a new art: SHADOW STEP.",
    ],
    outro: ["OSSA: \"You heard them breathe. Good. Tomorrow you go down the mountain, for one day.\""] },

  { id: "camp", act: 1, name: "Bandits of the Pass", place: "The Northern Pass · Dusk", theme: "camp", tier: 2.5, rec: 8, par: 150, star3: "untouched",
    goal: { type: "boss", text: "Defeat Grel the Bandit King", boss: "grel" },
    floors: [[-13, -22, 13, 20]], start: [0, 17],
    props: [["palisade", -13, 10, -4, 10], ["palisade", 4, 10, 13, 10], ["gate", 0, 10], ["tent", -8, 4, 1.6], ["tent", 8.5, 3, 1.6], ["tent", -9, -6, 1.8], ["tent", 9, -7, 1.6], ["tent", -5, -13, 1.6], ["tent", 6, -14, 1.6],
      ["campfire", 0, 2], ["campfire", -3, -8], ["campfire", 7, -10.5], ["crate", 3, 6], ["crate", 3.9, 6.6], ["crate", -10.5, -15], ["crate", 11, -16], ["throne", 0, -20], ["tree", -11.5, 17, 1], ["tree", 11.5, 15, 1.1], ["torch", -3.5, 11], ["torch", 3.5, 11]],
    enemies: [["bandit", -2, 12.5, [[-2, 12.5], [2, 12.5]]], ["bandit", 0, 7.5, null, { face: 0, look: 0.9 }], ["bandit", -5.5, 0, [[-5.5, 0], [-5.5, -4]]], ["bandit", 5.5, -1, [[5.5, -1], [5.5, -4]]],
      ["bandit", 1.6, 1, null, { face: -2.2 }], ["bandit", -1.6, 3, null, { face: 2.4 }], ["bandit", -2, -10.5, [[-2, -10.5], [3, -10.5]]], ["archer", 10.5, -2, null, { face: -1.2 }]],
    boss: ["grel", 0, -17], unlockAbility: "smoke",
    hints: ["New art: SMOKE BOMB. Tap 💨 (key 2). Stunned foes can be taken down.", "Grel wakes when he hears fighting. Thin his men out quietly first."],
    intro: [
      "Bandits on the pass have been robbing the villages Ossa buys rice from.",
      "OSSA: \"Take this.\" A clay ball of ash and pepper. You learned a new art: SMOKE BOMB.",
      "Grel the Bandit King is as wide as a door and twice as loud.",
    ],
    outro: ["Grel crashes into the snow. The villages below will eat this winter.", "For the first time, somebody thanks you. You don't know what to say."] },

  { id: "ossa", act: 1, name: "Ossa's Trial", place: "Ossa's Hut · Dawn", theme: "dawn", tier: 3, rec: 10, par: 110, star3: "untouched",
    goal: { type: "boss", text: "Beat your master", boss: "ossa" },
    floors: [[-10, -10, 10, 10]], start: [0, 7],
    props: [["hut", 0, -14.5], ["rock", -8, -6, 1.2], ["rock", 8.5, 5, 1], ["tree", -9, 8, 1], ["tree", 9, -8.5, 1.1], ["tree", -9.5, -1, 0.8], ["woodpile", 4, -9], ["lantern", -3, -9], ["lantern", 3, 9.3]],
    enemies: [], boss: ["ossa", 0, -4],
    hints: ["Ossa blinks behind you. Keep moving and punish him after he strikes."],
    intro: [
      "Seven years. On the last morning, the blind master stands in the snow and waits.",
      "OSSA: \"Strength isn't the ability to kill. Any fool with a knife can kill. Strength is the ability to choose.\"",
      "OSSA: \"Beat me, and you may go.\"",
    ],
    outro: ["For the first time in seven years, you beat him.", "You walk down from the mountains with a thin blade, a small vial and a name: VAREK."],
    unlockLook: ["mask", "blindfold"], grow: "You are eighteen." },

  // ===== ACT III — THE YOUNG MAN =====
  { id: "stables", act: 2, name: "Three Keys", place: "The Regent's City · Stables", theme: "city", tier: 3.5, rec: 11, par: 140, star3: "ghost",
    goal: { type: "targets", text: "Eliminate the three informants" },
    floors: [[-12, -22, 12, 20]], start: [0, 17],
    props: [["city", -9, 14, 6, 7], ["city", 9, 13, 6, 8], ["stable", -8.5, 1, 5, 10], ["city", 9, 1, 6, 6], ["city", -9, -12, 6, 6], ["city", 8.5, -15, 7, 7], ["city", 0, -20.5, 8, 3],
      ["cart", 3, 8, 0.4], ["cart", -3, -8, -0.3], ["crate", 4.5, 4], ["crate", 5.2, 4.7], ["crate", -4.5, -3], ["hay", -5, 6], ["hay", -5.2, -4.5], ["well", 3.6, -4], ["lanternpost", -3.5, 12], ["lanternpost", 3.5, -12], ["lanternpost", -4, -17]],
    enemies: [["soldier", -3, 14, [[-3, 14], [3, 14]]], ["soldier", 4.5, 9, [[4.5, 9], [4.5, 0]]], ["soldier", -4.5, 3, [[-4.5, 3], [-2, -6]]], ["soldier", 1, -12, [[1, -12], [5, -9]]], ["archer", -1, -17.5, null, { face: 0 }], ["soldier", -6, -7, [[-6, -7], [-2, -15]]],
      ["spy", -3.2, 2, null, { face: -1.2, target: true }], ["spy", 6.6, -8.6, null, { face: 0.4, target: true }], ["spy", -6.4, -16.6, null, { face: 2.6, target: true }]],
    unlockAbility: "dart",
    hints: ["New art: POISON DART. Tap 🎯 (key 3).", "Informants run if they see you. Don't let them reach the edge."],
    intro: [
      "It takes a year. You are a stable hand, then a kitchen boy, then a lamplighter in the regent's palace.",
      "You still remember every poison your mother taught you. You learned a new art: POISON DART.",
      "Three of Varek's informants meet at the stables tonight. Each carries a key to the palace.",
    ],
    outro: ["Three keys. Three locks. One regent."] },

  { id: "roofs", act: 2, name: "The Rooftops", place: "The Regent's City · Midnight", theme: "roofs", tier: 4, rec: 12, par: 110, star3: "ghost",
    goal: { type: "reach", text: "Reach the palace wall", at: [0, -29.5], r: 2 },
    floors: [[-6, 12, 6, 26], [-0.9, 3.5, 0.9, 12.5], [-8, -4, 8, 4], [4.9, -10.5, 6.7, -3.5], [2, -18, 10, -10], [3.9, -22.5, 5.5, -17.5], [-6, -32, 6, -22]],
    start: [0, 23], rooftops: true,
    props: [["chimney", -4.5, 20], ["chimney", 5, -2.5], ["chimney", 8.8, -16.8], ["crate", 3.5, 14], ["crate", -6.8, 2.8], ["palacewall", 0, -32.5], ["lanternpost", -5, 13], ["lanternpost", 7, 2.8], ["lanternpost", -5, -23]],
    enemies: [["soldier", -4, 17, [[-4, 17], [4, 17]]], ["archer", 3.5, -1, null, { face: 0.2 }], ["soldier", -5, -1, [[-5, -1], [2, 2]]], ["soldier", 3, -12, [[3, -12], [8.5, -12]]], ["archer", 8.5, -16, null, { face: 0.6 }], ["soldier", -4, -24.5, [[-4, -24.5], [4, -24.5]]], ["archer", -4.5, -29, null, { face: 0.3 }]],
    hints: ["Archers see far. Use the chimneys, smoke, and darts."],
    intro: [
      "Varek never sleeps in the same room twice. He wears steel under his silk, even in summer.",
      "Archers watch the rooftops. Their arrows don't miss twice.",
    ],
    outro: ["Below you, the palace courtyard glows with festival lanterns. Eighteen years to the night."] },

  { id: "hask", act: 2, name: "The Iron Hound", place: "Palace Courtyard", theme: "court", tier: 4.5, rec: 14, par: 150, star3: "untouched",
    goal: { type: "boss", text: "Defeat Captain Hask", boss: "hask" },
    floors: [[-12, -12, 12, 12]], start: [0, 9],
    props: [...C8(7.2), ["brazier", -10.5, -10.5], ["brazier", 10.5, -10.5], ["brazier", -10.5, 10.5], ["brazier", 10.5, 10.5], ["banner", -6, -12.3], ["banner", 6, -12.3], ["courtwall", 0, -13]],
    enemies: [], boss: ["hask", 0, -4], unlockAbility: "vanish",
    hints: ["New art: VANISH. Tap 🌫️ (key 4).", "Hask's shield blocks hits from the front. Bait his charge into a pillar, then strike."],
    intro: [
      "Captain Hask led the soldiers into Hollow Pine that night. He wears the village's festival bell on his belt as a trophy.",
      "His shield has turned a hundred blades. Make him charge. Make him miss.",
      "You learned a new art: VANISH.",
    ],
    outro: ["The bell rolls from Hask's belt. You pick it up. It's cracked."], grow: "The last night. You are ready." },

  // ===== ACT IV — THE MAN =====
  { id: "tower", act: 3, name: "The Regent's Tower", place: "The Tower · Great Hall", theme: "hall", tier: 5, rec: 15, par: 150, star3: "time",
    goal: { type: "kill", text: "Cut through the tower guard" },
    floors: [[-9, -18, 9, 18]], start: [0, 15], indoor: true,
    props: [["pillar", -5, 10], ["pillar", 5, 10], ["pillar", -5, 3], ["pillar", 5, 3], ["pillar", -5, -4], ["pillar", 5, -4], ["pillar", -5, -11], ["pillar", 5, -11], ["carpet", 0, 0, 3, 34], ["brazier", -8, 14], ["brazier", 8, 14], ["brazier", -8, -15], ["brazier", 8, -15], ["stairs", 0, -19.5]],
    enemies: [["elite", 0, 6, null, { face: 0, look: 0.6 }], ["elite", -2.5, -2, [[-2.5, -2], [2.5, -2]]], ["elite", 2.5, -8, null, { face: 0.4 }], ["elite", 0, -14.5, null, { face: 0 }], ["soldier", -7, 12, [[-7, 12], [-7, 0]]], ["soldier", 7, 0, [[7, 0], [7, -12]]], ["archer", -7.2, -15, null, { face: 0.6 }], ["archer", 7.2, -15, null, { face: -0.6 }]],
    unlockAbility: "storm",
    hints: ["New art: BLADE STORM. Tap 🌀 (key 5).", "Elites block from the front. Hit them from the side or behind."],
    intro: ["The festival night. Exactly eighteen years after the red snow.", "Varek's elite guard blocks the great hall.", "You learned a new art: BLADE STORM."],
    outro: ["The last door. Behind it, a man drinking alone by a window."] },

  { id: "varek", act: 3, name: "The Regent", place: "The Tower · Top Floor", theme: "top", tier: 5.5, rec: 17, par: 180, star3: "untouched",
    goal: { type: "boss", text: "Defeat Regent Varek", boss: "varek" },
    floors: [[-11, -11, 11, 11]], start: [0, 8],
    props: [...C8(9.3), ["throne", 0, -9.8], ["carpet", 0, 1, 3, 20], ["brazier", -5, -9.5], ["brazier", 5, -9.5], ["window", 0, -11.8]],
    enemies: [], boss: ["varek", 0, -6.5],
    hints: ["Varek's vials leave poison on the ground. Don't stand in the green."],
    intro: [
      "Varek doesn't scream. He only sets down his cup, slowly.",
      "VAREK: \"Doran's boy. You have his eyes.\"",
      "YOU: \"You killed three hundred people.\"",
      "VAREK: \"I did. And I've had eighteen years to get ready for you.\"",
    ],
    mid: [
      "VAREK: \"You think I found your village alone? Hollow Pine stayed hidden for three centuries, boy.\"",
      "VAREK: \"Someone drew me the map. Someone asked for only one thing in return: that the children be spared.\"",
      "VAREK: \"I broke that deal. That part is my sin. The rest belongs to your teacher.\"",
    ],
    outro: ["Hollow Pine's last blade is perfect.", "But you leave the tower emptier than you entered it."] },

  { id: "choice", act: 3, name: "The Choice", place: "Ossa's Hut", theme: "dawn", tier: 0, rec: 17, goal: { type: "choice", text: "Decide" },
    intro: [
      "Ossa is waiting on his porch when you come back up the mountain, as if he knew.",
      "YOU: \"You gave them the map.\"",
      "OSSA: \"I did. I spent sixty years teaching children to kill for men like Varek. The village was a blade that could never stop cutting.\"",
      "OSSA: \"I thought if I broke it, and saved the children, they could become something else. I was a fool to trust a man who paid for murder.\"",
      "He kneels in the snow and bares his neck. \"Finish it. It's your right.\"",
    ],
    light: [
      "You stand over him for a long time. The rage that carried you up the mountain is still there. It would be so easy, and so deserved.",
      "Then you remember the lintel. Your whole life, you've been someone else's target. Someone else's war.",
      "Strength is the ability to choose. You put the blade away.",
      "YOU: \"You'll live, old man. And every day, you'll teach me how to heal the wounds you taught me to make.\"",
      "Years later, travelers speak of a school in the fog, where orphans of the regent's wars learn to read, to set bones, and to stand so still that danger passes them by.",
      "Above its door hangs an old, charred lintel: WE WERE THE SHADOW THE POWERFUL CAST. NOW WE CHOOSE TO BE THE LIGHT.",
    ],
    shadow: [
      "The blade is perfect. The mountain is silent.",
      "You go back down into the world, the last shadow of Hollow Pine, and the powerful pay you well.",
      "Every winter festival, you count to ten thousand. You never stop counting.",
    ] },
];

export const ENDLESS = { id: "ashes", name: "The Ashes", place: "The Ruins of Hollow Pine", theme: "ruins", floors: [[-13, -13, 13, 13]], start: [0, 0],
  props: [["ruin", -8, -8, 5, 4], ["ruin", 8.5, -7, 4, 5], ["ruin", -8.5, 7.5, 4, 4], ["ruin", 8, 8, 5, 4], ["well", 0, -4.5], ["rock", -3, 6, 1], ["rock", 4, 2, 0.8], ["fire", -4, -9.5, 0.7], ["fire", 9.2, 3, 0.6]] };

// ---------- achievements: [id, title, how, silver, jade, points] — checked in main.js ----------
export const ACHIEVEMENTS = [
  ["paper", "First Lesson", "Finish The Straw Men", 50, 5, 5],
  ["ghost_lanes", "Rice-Paper Feet", "Reach the bell in Walking on Paper without being seen", 150, 15, 15],
  ["doran", "Your Father's Eyes", "Win Doran's Lesson", 150, 15, 10],
  ["redsnow", "Ten Thousand", "Survive the Night of Red Snow", 200, 20, 15],
  ["ghost_redsnow", "Nobody Saw the Boy", "Reach the well without being seen", 400, 40, 25],
  ["grel", "Door-Sized", "Defeat Grel the Bandit King", 300, 25, 15],
  ["ossa", "Graduate", "Beat Ossa's Trial", 300, 25, 15],
  ["targets", "Three Keys", "Eliminate all three informants", 300, 25, 15],
  ["hask", "Cracked Bell", "Defeat Captain Hask", 400, 30, 20],
  ["varek", "The Regent Falls", "Defeat Regent Varek", 600, 50, 30],
  ["light", "The Light", "Choose to spare Ossa", 500, 50, 30],
  ["shadow", "The Shadow", "Choose to strike", 500, 50, 30],
  ["td10", "Silent Hands", "Perform 10 takedowns", 100, 10, 10],
  ["td100", "Nobody Saw a Thing", "Perform 100 takedowns", 800, 60, 30],
  ["k100", "A Hundred Cuts", "Defeat 100 enemies", 200, 15, 10],
  ["k1000", "Legend of the Pine", "Defeat 1,000 enemies", 1500, 100, 40],
  ["stars15", "Rising Star", "Earn 15 stars", 250, 20, 15],
  ["stars42", "Perfect Blade", "Earn all 42 stars", 3000, 250, 60],
  ["lv10", "Blooded", "Reach level 10", 200, 20, 10],
  ["lv25", "Master Blade", "Reach level 25", 800, 60, 30],
  ["wave10", "The Ashes Remember", "Reach wave 10 in The Ashes", 400, 30, 20],
  ["wave25", "Unending", "Reach wave 25 in The Ashes", 1200, 100, 40],
  ["multi", "Dance of Death", "Defeat 3 enemies within 2 seconds", 150, 15, 10],
  ["untouched", "Untouched", "Beat a boss without taking damage", 500, 40, 25],
  ["dodge50", "Like Smoke", "Dodge through 50 attacks", 200, 20, 15],
  ["poison25", "Mother's Legacy", "Defeat 25 enemies with poison", 250, 20, 15],
  ["arts", "Every Art", "Learn all five assassin arts", 300, 25, 15],
  ["rich", "Silver Tongue", "Earn 10,000 silver in total", 300, 30, 15],
  ["dress", "New Face", "Buy a cosmetic", 100, 10, 5],
  ["streak3", "Returning Shadow", "Claim a 3-day daily streak", 200, 20, 10],
];
