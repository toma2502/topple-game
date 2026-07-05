// ============================================================
// SaveSystem — versioned localStorage persistence
// ============================================================
const SaveSystem = (() => {
  const KEY = 'topple_save_v1';

  const DEFAULTS = () => ({
    v: 1,
    coins: 0,
    level: 1,                 // next level to play (1-based)
    stars: {},                // levelIndex -> 0..3
    upgrades: { ink: 0, gems: 0, blast: 0 },
    skins: ['classic'],
    activeSkin: 'classic',
    stats: { dominoes: 0, towers: 0, tnt: 0, gems: 0, wins: 0, perfects: 0 },
    achievementsClaimed: [],
    daily: { lastClaim: 0, streak: 0 },
    missions: { date: '', list: [], claimed: [] },
    settings: { sound: true, haptics: true },
  });

  let data = DEFAULTS();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        data = Object.assign(DEFAULTS(), parsed);
        data.stats = Object.assign(DEFAULTS().stats, parsed.stats || {});
        data.upgrades = Object.assign(DEFAULTS().upgrades, parsed.upgrades || {});
      }
    } catch (e) { data = DEFAULTS(); }
    return data;
  }

  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
    }, 120);
  }

  return { load, save, get: () => data };
})();
window.SaveSystem = SaveSystem;
