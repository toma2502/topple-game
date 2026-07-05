// ============================================================
// UI — DOM screens, HUD, shop, missions, daily, rewarded ads
// ============================================================
const UI = (() => {
  const $ = id => document.getElementById(id);
  const S = () => SaveSystem.get();

  let currentResult = null;

  function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
    $(id).classList.add('on');
  }

  // ---------- HUD ----------
  function refreshHud() {
    $('hud-level').textContent = `LEVEL ${S().level <= (window._playingLevel || S().level) ? (window._playingLevel || S().level) : S().level}`;
    const ink = Game.getInk(), max = Game.getInkMax();
    $('hud-ink-fill').style.width = max ? `${(ink / max) * 100}%` : '0%';
    $('hud-ink-num').textContent = ink;
    $('btn-go').disabled = !Game.hasDominoes() || Game.getPhase() !== 'draw';
    $('btn-undo').style.opacity = Game.getPhase() === 'draw' ? 1 : 0.3;
    $('hud-coins').textContent = S().coins;
  }

  // ---------- menu ----------
  function refreshMenu() {
    $('menu-coins').textContent = S().coins;
    $('menu-level').textContent = S().level;
    const st = Meta.dailyState();
    $('btn-daily').classList.toggle('pulse', st.claimable);
    const missions = Meta.missionsToday();
    const unclaimed = missions.some(m => m.done && !m.claimed) ||
      Meta.achievements().some(a => a.done && !a.claimed);
    $('btn-missions').classList.toggle('pulse', unclaimed);
  }

  function goMenu() {
    Game.stop();
    refreshMenu();
    show('scr-menu');
  }

  function play(n) {
    window._playingLevel = n;
    show('scr-game');
    Game.start(n, onLevelEnd);
    refreshHud();
  }

  // ---------- result ----------
  function onLevelEnd(res) {
    currentResult = res;
    $('res-title').textContent = res.win ? ['NICE!', 'GREAT!', 'PERFECT!'][res.stars - 1] : 'SO CLOSE!';
    $('res-title').style.color = res.win ? '#ffd75e' : '#ff7a6b';
    for (let i = 1; i <= 3; i++) {
      const el = $('star' + i);
      el.classList.remove('lit');
      if (res.win && i <= res.stars) {
        setTimeout(() => { el.classList.add('lit'); AudioSystem.star(i); }, i * 350);
      }
    }
    $('res-coins').textContent = res.win ? `+${res.coins}` : `${Math.round(res.frac * 100)}% destroyed`;
    $('btn-double').style.display = res.win && res.coins > 0 ? 'block' : 'none';
    $('btn-continue-ad').style.display = (!res.win && !res.extraInkUsed) ? 'block' : 'none';
    $('btn-next').textContent = res.win ? 'NEXT LEVEL  ▶' : 'TRY AGAIN  ↻';
    show('scr-result');
  }

  function resultNext() {
    if (currentResult.win) play(S().level);
    else play(currentResult.level);
  }

  // ---------- rewarded ad stub (AdMob drop-in point) ----------
  function showRewardedAd(onReward) {
    show('scr-ad');
    let t = CFG.economy.rewardedAd.adDurationSec;
    $('ad-count').textContent = t;
    const iv = setInterval(() => {
      t--;
      $('ad-count').textContent = t;
      if (t <= 0) {
        clearInterval(iv);
        onReward();
      }
    }, 1000);
  }

  function adDoubleCoins() {
    showRewardedAd(() => {
      const extra = currentResult.coins * (CFG.economy.rewardedAd.doubleCoins - 1);
      Meta.addCoins(extra);
      $('res-coins').textContent = `+${currentResult.coins * CFG.economy.rewardedAd.doubleCoins}`;
      $('btn-double').style.display = 'none';
      AudioSystem.coin();
      show('scr-result');
    });
  }

  function adContinue() {
    showRewardedAd(() => {
      show('scr-game');
      play(currentResult.level);   // fresh try with bonus ink
      Game.grantInk(CFG.economy.rewardedAd.continueInk);
      AudioSystem.coin();
    });
  }

  // ---------- shop ----------
  function refreshShop() {
    $('shop-coins').textContent = S().coins;
    // upgrades
    const uWrap = $('shop-upgrades'); uWrap.innerHTML = '';
    Object.entries(CFG.economy.upgrades).forEach(([id, u]) => {
      const lvl = S().upgrades[id] || 0;
      const maxed = lvl >= u.max;
      const cost = Meta.upgradeCost(id);
      const row = document.createElement('div');
      row.className = 'shop-row';
      row.innerHTML = `
        <div class="shop-ic">${u.icon}</div>
        <div class="shop-info">
          <b>${u.name} <span class="lvl">Lv ${lvl}${maxed ? ' MAX' : ''}</span></b>
          <small>${u.desc}</small>
        </div>
        <button class="buy ${!maxed && Meta.canUpgrade(id) ? '' : 'off'}">${maxed ? '✓' : cost + ' ⬤'}</button>`;
      row.querySelector('button').onclick = () => {
        if (Meta.buyUpgrade(id)) { AudioSystem.coin(); refreshShop(); }
      };
      uWrap.appendChild(row);
    });
    // skins
    const sWrap = $('shop-skins'); sWrap.innerHTML = '';
    CFG.skins.forEach(sk => {
      const owned = Meta.ownsSkin(sk.id);
      const active = S().activeSkin === sk.id;
      const card = document.createElement('div');
      card.className = 'skin-card' + (active ? ' active' : '');
      card.innerHTML = `
        <div class="skin-dom" style="background:${sk.body};border-color:${sk.edge}"><i style="background:${sk.pip}"></i></div>
        <b>${sk.name}</b>
        <button class="buy ${owned || S().coins >= sk.price ? '' : 'off'}">
          ${active ? 'ACTIVE' : owned ? 'USE' : sk.price + ' ⬤'}</button>`;
      card.querySelector('button').onclick = () => {
        if (owned) Meta.setSkin(sk.id);
        else if (Meta.buySkin(sk.id)) AudioSystem.coin();
        refreshShop();
      };
      sWrap.appendChild(card);
    });
  }

  // ---------- missions & achievements ----------
  function refreshMissions() {
    const mWrap = $('missions-list'); mWrap.innerHTML = '';
    Meta.missionsToday().forEach(m => {
      const row = document.createElement('div');
      row.className = 'shop-row';
      row.innerHTML = `
        <div class="shop-info">
          <b>${m.text}</b>
          <div class="mbar"><i style="width:${(m.prog / m.goal) * 100}%"></i></div>
          <small>${m.prog}/${m.goal}</small>
        </div>
        <button class="buy ${m.done && !m.claimed ? '' : 'off'}">${m.claimed ? '✓' : '+' + m.reward + ' ⬤'}</button>`;
      row.querySelector('button').onclick = () => {
        if (Meta.claimMission(m.id)) { AudioSystem.coin(); refreshMissions(); refreshMenu(); }
      };
      mWrap.appendChild(row);
    });
    const aWrap = $('ach-list'); aWrap.innerHTML = '';
    Meta.achievements().forEach(a => {
      const row = document.createElement('div');
      row.className = 'shop-row';
      row.innerHTML = `
        <div class="shop-info">
          <b>${a.text}</b>
          <div class="mbar"><i style="width:${(a.prog / a.goal) * 100}%"></i></div>
          <small>${a.prog}/${a.goal}</small>
        </div>
        <button class="buy ${a.done && !a.claimed ? '' : 'off'}">${a.claimed ? '✓' : '+' + a.reward + ' ⬤'}</button>`;
      row.querySelector('button').onclick = () => {
        if (Meta.claimAchievement(a.id)) { AudioSystem.coin(); refreshMissions(); refreshMenu(); }
      };
      aWrap.appendChild(row);
    });
  }

  // ---------- daily ----------
  function refreshDaily() {
    const st = Meta.dailyState();
    const wrap = $('daily-grid'); wrap.innerHTML = '';
    CFG.economy.daily.forEach((amt, i) => {
      const day = i + 1;
      const cell = document.createElement('div');
      const cur = st.claimable && day === st.day;
      const past = day < st.day || (!st.claimable && day <= st.day);
      cell.className = 'daily-cell' + (cur ? ' cur' : '') + (past ? ' past' : '');
      cell.innerHTML = `<small>Day ${day}</small><b>${amt} ⬤</b>${day === 7 ? '<em>+ SKIN</em>' : ''}`;
      wrap.appendChild(cell);
    });
    $('btn-claim-daily').disabled = !st.claimable;
    $('btn-claim-daily').textContent = st.claimable ? `CLAIM DAY ${st.day}` : 'COME BACK TOMORROW';
  }

  // ---------- settings ----------
  function refreshSettings() {
    $('set-sound').checked = S().settings.sound;
    $('set-haptics').checked = S().settings.haptics;
  }

  // ---------- wiring ----------
  function bind() {
    $('btn-play').onclick = () => { AudioSystem.ui(); play(S().level); };
    $('btn-shop').onclick = () => { AudioSystem.ui(); refreshShop(); show('scr-shop'); };
    $('btn-missions').onclick = () => { AudioSystem.ui(); refreshMissions(); show('scr-missions'); };
    $('btn-daily').onclick = () => { AudioSystem.ui(); refreshDaily(); show('scr-daily'); };
    $('btn-settings').onclick = () => { AudioSystem.ui(); refreshSettings(); show('scr-settings'); };
    document.querySelectorAll('.btn-back').forEach(b => b.onclick = goMenu);

    $('btn-go').onclick = () => { AudioSystem.ui(); Game.go(); refreshHud(); };
    $('btn-undo').onclick = () => Game.undo();
    $('btn-clear').onclick = () => Game.clearAll();
    $('btn-quit').onclick = goMenu;

    $('btn-next').onclick = () => { AudioSystem.ui(); resultNext(); };
    $('btn-res-menu').onclick = goMenu;
    $('btn-double').onclick = adDoubleCoins;
    $('btn-continue-ad').onclick = adContinue;

    $('btn-claim-daily').onclick = () => {
      const r = Meta.claimDaily();
      if (r) { AudioSystem.win(); refreshDaily(); refreshMenu(); }
    };

    $('set-sound').onchange = e => { S().settings.sound = e.target.checked; SaveSystem.save(); };
    $('set-haptics').onchange = e => { S().settings.haptics = e.target.checked; SaveSystem.save(); };
  }

  function boot() {
    SaveSystem.load();
    Game.init($('game-canvas'));
    bind();
    goMenu();
  }

  return { boot, refreshHud, refreshMenu };
})();
window.addEventListener('DOMContentLoaded', UI.boot);
