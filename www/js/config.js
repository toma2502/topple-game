// ============================================================
// TOPPLE! — Game Configuration
// Single source of truth for every tunable value.
// (Unity port note: this maps 1:1 to ScriptableObject assets.)
// ============================================================
const CFG = {
  world: { w: 720, h: 1420 },          // logical canvas size (portrait)

  domino: {
    spacing: 34,          // px between dominoes along a stroke
    w: 13, h: 40,         // sprite footprint (top-down)
    fallTime: 0.16,       // s for one domino to fall flat
    contactAt: 0.45,      // fall progress when it can topple neighbours
    reach: 46,            // px forward reach when falling
    coneDeg: 80,          // half-angle cone of propagation
    minDist: 22,          // min distance between any two dominoes
    clickPitchStep: 8,    // Hz added per chain hop (rising cascade)
  },

  startPad: { r: 52 },

  ball: {
    r: 17, speed: 520, friction: 0.988, minSpeed: 24,
    knockRadius: 30,
  },

  tnt: {
    radius: 150, fuse: 0.14, shake: 16,
  },

  tower: {
    blockSize: 26, debrisLife: 1.1, coinPer: 3,
  },
  gem: { coinValue: 8 },

  scoring: {
    star1: 0.5, star2: 0.8, star3: 1.0,   // fraction of targets destroyed
    inkBonusPerDomino: 1,                  // coins per unused domino
    levelBaseCoins: 10,
  },

  economy: {
    upgrades: {
      ink:   { name: 'Extra Ink',   desc: '+4 dominoes per level', icon: '🁢', base: 60,  growth: 1.6, max: 8, perLevel: 4 },
      gems:  { name: 'Lucky Gems',  desc: '+25% gem value',        icon: '💎', base: 80,  growth: 1.7, max: 6, perLevel: 0.25 },
      blast: { name: 'Mega Blast',  desc: '+12% TNT radius',       icon: '🧨', base: 100, growth: 1.7, max: 6, perLevel: 0.12 },
    },
    rewardedAd: {
      continueInk: 8,        // dominoes granted by "watch ad to continue"
      doubleCoins: 2,        // multiplier on result screen
      adDurationSec: 3,      // fake ad stub length (AdMob replaces this)
    },
    daily: [15, 25, 40, 60, 80, 120, 250], // 7-day cycle coins (day 7 also unlocks skin)
  },

  skins: [
    { id: 'classic', name: 'Classic', price: 0,    body: '#f5f0e6', edge: '#c9bfa8', pip: '#2b2b2b' },
    { id: 'neon',    name: 'Neon',    price: 150,  body: '#16f2b3', edge: '#0aa77a', pip: '#062c22' },
    { id: 'gold',    name: 'Gold',    price: 400,  body: '#ffd75e', edge: '#c99a1f', pip: '#7a5200' },
    { id: 'sakura',  name: 'Sakura',  price: 250,  body: '#ffc7dd', edge: '#e08cb0', pip: '#7d2c4f' },
    { id: 'ice',     name: 'Ice',     price: 300,  body: '#bfe8ff', edge: '#6db6dd', pip: '#134a63' },
    { id: 'lava',    name: 'Lava',    price: 500,  body: '#ff7a4d', edge: '#c23c14', pip: '#3d0e00' },
  ],

  missions: [ // pool — 3 rolled daily
    { id: 'towers5',  text: 'Knock down 5 towers',        stat: 'towers',  goal: 5,  reward: 30 },
    { id: 'towers12', text: 'Knock down 12 towers',       stat: 'towers',  goal: 12, reward: 60 },
    { id: 'tnt3',     text: 'Trigger 3 TNT explosions',   stat: 'tnt',     goal: 3,  reward: 40 },
    { id: 'gems4',    text: 'Collect 4 gems',             stat: 'gems',    goal: 4,  reward: 35 },
    { id: 'levels3',  text: 'Beat 3 levels',              stat: 'wins',    goal: 3,  reward: 50 },
    { id: 'perfect1', text: 'Get a 3-star level',         stat: 'perfects',goal: 1,  reward: 45 },
    { id: 'dom100',   text: 'Topple 100 dominoes',        stat: 'dominoes',goal: 100,reward: 40 },
  ],

  achievements: [
    { id: 'dom500',   text: 'Topple 500 dominoes',   stat: 'dominoes', goal: 500,   reward: 100 },
    { id: 'dom5000',  text: 'Topple 5,000 dominoes', stat: 'dominoes', goal: 5000,  reward: 400 },
    { id: 'tower50',  text: 'Destroy 50 towers',     stat: 'towers',   goal: 50,    reward: 150 },
    { id: 'tnt25',    text: 'Explode 25 TNT',        stat: 'tnt',      goal: 25,    reward: 150 },
    { id: 'win10',    text: 'Beat 10 levels',        stat: 'wins',     goal: 10,    reward: 120 },
    { id: 'win30',    text: 'Beat 30 levels',        stat: 'wins',     goal: 30,    reward: 350 },
    { id: 'star15',   text: '15 perfect levels',     stat: 'perfects', goal: 15,    reward: 300 },
  ],

  juice: {
    shakeDecay: 0.86,
    slowMoOnFinale: 0.45,   // time scale during last-target destruction
    slowMoTime: 0.9,
    particleCap: 260,
    hapticMs: { click: 0, crash: 18, tnt: 45, win: 30 },
  },
};
window.CFG = CFG;
