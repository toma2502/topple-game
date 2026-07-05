// ============================================================
// Meta — economy, upgrades, skins, daily, missions, achievements
// ============================================================
const Meta = (() => {
  const S = () => SaveSystem.get();

  // ---------- coins ----------
  function addCoins(n) { S().coins += n; SaveSystem.save(); }
  function spend(n) {
    if (S().coins < n) return false;
    S().coins -= n; SaveSystem.save(); return true;
  }

  // ---------- upgrades ----------
  function upgradeCost(id) {
    const u = CFG.economy.upgrades[id];
    const lvl = S().upgrades[id] || 0;
    return Math.round(u.base * Math.pow(u.growth, lvl));
  }
  function canUpgrade(id) {
    const u = CFG.economy.upgrades[id];
    return (S().upgrades[id] || 0) < u.max && S().coins >= upgradeCost(id);
  }
  function buyUpgrade(id) {
    if (!canUpgrade(id)) return false;
    if (!spend(upgradeCost(id))) return false;
    S().upgrades[id]++; SaveSystem.save(); return true;
  }
  const inkBonus   = () => (S().upgrades.ink   || 0) * CFG.economy.upgrades.ink.perLevel;
  const gemMult    = () => 1 + (S().upgrades.gems  || 0) * CFG.economy.upgrades.gems.perLevel;
  const blastMult  = () => 1 + (S().upgrades.blast || 0) * CFG.economy.upgrades.blast.perLevel;

  // ---------- skins ----------
  function ownsSkin(id) { return S().skins.includes(id); }
  function buySkin(id) {
    const sk = CFG.skins.find(s => s.id === id);
    if (!sk || ownsSkin(id) || !spend(sk.price)) return false;
    S().skins.push(id); S().activeSkin = id; SaveSystem.save(); return true;
  }
  function setSkin(id) { if (ownsSkin(id)) { S().activeSkin = id; SaveSystem.save(); } }
  function activeSkin() { return CFG.skins.find(s => s.id === S().activeSkin) || CFG.skins[0]; }

  // ---------- daily reward ----------
  const dayKey = (t = Date.now()) => new Date(t).toDateString();
  function dailyState() {
    const d = S().daily;
    const today = dayKey();
    if (d.lastClaim && dayKey(d.lastClaim) === today) return { claimable: false, day: d.streak };
    // broke the streak? (missed a full day)
    const yesterday = dayKey(Date.now() - 86400000);
    const streak = (d.lastClaim && dayKey(d.lastClaim) === yesterday) ? d.streak : 0;
    return { claimable: true, day: (streak % 7) + 1, streak };
  }
  function claimDaily() {
    const st = dailyState();
    if (!st.claimable) return 0;
    const reward = CFG.economy.daily[st.day - 1];
    S().daily.lastClaim = Date.now();
    S().daily.streak = st.streak + 1;
    addCoins(reward);
    if (st.day === 7 && !ownsSkin('sakura')) { S().skins.push('sakura'); }
    SaveSystem.save();
    return reward;
  }

  // ---------- missions (3 rolled per day) ----------
  function missionsToday() {
    const m = S().missions;
    const today = dayKey();
    if (m.date !== today) {
      const pool = [...CFG.missions];
      const list = [];
      let seed = new Date().getDate() * 7 + new Date().getMonth();
      for (let i = 0; i < 3 && pool.length; i++) {
        seed = (seed * 9301 + 49297) % 233280;
        list.push(pool.splice(seed % pool.length, 1)[0].id);
      }
      m.date = today; m.list = list; m.claimed = [];
      m.base = JSON.parse(JSON.stringify(S().stats));   // progress counts from today
      SaveSystem.save();
    }
    return m.list.map(id => {
      const def = CFG.missions.find(x => x.id === id);
      const prog = Math.min(def.goal, (S().stats[def.stat] || 0) - ((m.base || {})[def.stat] || 0));
      return { ...def, prog: Math.max(0, prog), done: prog >= def.goal, claimed: m.claimed.includes(id) };
    });
  }
  function claimMission(id) {
    const list = missionsToday();
    const it = list.find(x => x.id === id);
    if (!it || !it.done || it.claimed) return 0;
    S().missions.claimed.push(id);
    addCoins(it.reward);
    return it.reward;
  }

  // ---------- achievements ----------
  function achievements() {
    return CFG.achievements.map(a => {
      const prog = Math.min(a.goal, S().stats[a.stat] || 0);
      return { ...a, prog, done: prog >= a.goal, claimed: S().achievementsClaimed.includes(a.id) };
    });
  }
  function claimAchievement(id) {
    const it = achievements().find(x => x.id === id);
    if (!it || !it.done || it.claimed) return 0;
    S().achievementsClaimed.push(id);
    addCoins(it.reward);
    return it.reward;
  }

  // ---------- stats ----------
  function bump(stat, n = 1) { S().stats[stat] = (S().stats[stat] || 0) + n; SaveSystem.save(); }

  return {
    addCoins, spend,
    upgradeCost, canUpgrade, buyUpgrade, inkBonus, gemMult, blastMult,
    ownsSkin, buySkin, setSkin, activeSkin,
    dailyState, claimDaily,
    missionsToday, claimMission,
    achievements, claimAchievement,
    bump,
  };
})();
window.Meta = Meta;
