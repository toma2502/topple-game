// ============================================================
// Game — core loop: draw phase → topple simulation → result
// Custom deterministic topple-sim (no physics engine needed):
// full control over feel, zero jank, mobile-cheap.
// ============================================================
const Game = (() => {
  let canvas, ctx, DPR = 1, viewScale = 1, viewOX = 0, viewOY = 0;

  // ------- state -------
  let level = null;         // generated level data
  let phase = 'draw';       // draw | sim | end
  let dominoes = [];        // {x,y,ang,state:'up'|'falling'|'down', t, chainIdx}
  let towers = [];          // {x,y,blocks,alive}
  let gems = [];            // {x,y,alive}
  let tnts = [];            // {x,y,alive,fuse}
  let balls = [];           // {x,y,vx,vy,moving,alive}
  let walls = [];
  let particles = [], floaters = [];
  let ink = 0, inkMax = 0;
  let stroke = null;        // current drawing stroke {pts, lastPlaced}
  let strokes = [];         // history for undo (arrays of domino indices)
  let firstPlaced = false;
  let shake = 0, timeScale = 1, slowTimer = 0;
  let chainCounter = 0;
  let simIdle = 0;
  let coinsEarned = 0, destroyedTargets = 0;
  let extraInkUsed = false;
  let onEndCb = null;
  let running = false, lastTs = 0;
  let toast = { text: '', t: 0 };

  const S = CFG;

  // ============ setup ============
  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    canvas.addEventListener('pointerdown', onDown, { passive: false });
    canvas.addEventListener('pointermove', onMove, { passive: false });
    canvas.addEventListener('pointerup', onUp, { passive: false });
    canvas.addEventListener('pointercancel', onUp, { passive: false });
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = canvas.clientWidth * DPR;
    canvas.height = canvas.clientHeight * DPR;
    const sx = canvas.width / S.world.w, sy = canvas.height / S.world.h;
    viewScale = Math.min(sx, sy);
    viewOX = (canvas.width - S.world.w * viewScale) / 2;
    viewOY = (canvas.height - S.world.h * viewScale) / 2;
  }

  function toWorld(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * DPR - viewOX) / viewScale,
      y: ((e.clientY - r.top) * DPR - viewOY) / viewScale,
    };
  }

  // ============ level lifecycle ============
  function start(n, cb) {
    level = LevelGenerator.build(n);
    onEndCb = cb;
    phase = 'draw';
    dominoes = []; strokes = []; stroke = null; firstPlaced = false;
    towers = level.towers.map(t => ({ ...t, alive: true }));
    gems = level.gems.map(g => ({ ...g, alive: true }));
    tnts = level.tnt.map(t => ({ ...t, alive: true, fuse: -1 }));
    balls = level.balls.map(b => ({ ...b, vx: 0, vy: 0, moving: false, alive: true }));
    walls = level.walls;
    particles = []; floaters = [];
    inkMax = level.ink + Meta.inkBonus();
    ink = inkMax;
    shake = 0; timeScale = 1; slowTimer = 0; chainCounter = 0; simIdle = 0;
    coinsEarned = 0; destroyedTargets = 0; extraInkUsed = false;
    toastMsg(n === 1 ? 'Draw a line from the green pad!' : '');
    if (!running) { running = true; lastTs = performance.now(); requestAnimationFrame(tick); }
    UI.refreshHud();
  }

  function stop() { running = false; }

  function toastMsg(text) { toast = { text, t: text ? 2.6 : 0 }; }

  // ============ input (draw phase) ============
  function onDown(e) {
    e.preventDefault();
    AudioSystem.unlock();
    if (phase !== 'draw' || ink <= 0) return;
    const p = toWorld(e);
    if (!firstPlaced) {
      const d = Math.hypot(p.x - level.start.x, p.y - level.start.y);
      if (d > S.startPad.r * 1.6) { toastMsg('Start from the green pad!'); return; }
      stroke = { pts: [ { x: level.start.x, y: level.start.y } ], placed: [] };
    } else {
      stroke = { pts: [p], placed: [] };
    }
    canvas.setPointerCapture(e.pointerId);
  }

  function onMove(e) {
    if (!stroke || phase !== 'draw') return;
    e.preventDefault();
    const p = toWorld(e);
    const last = stroke.pts[stroke.pts.length - 1];
    const d = Math.hypot(p.x - last.x, p.y - last.y);
    if (d < S.domino.spacing) return;
    // step along the segment so fast swipes don't skip placements
    const steps = Math.floor(d / S.domino.spacing);
    for (let i = 1; i <= steps && ink > 0; i++) {
      const t = (i * S.domino.spacing) / d;
      const q = { x: last.x + (p.x - last.x) * t, y: last.y + (p.y - last.y) * t };
      tryPlace(q, Math.atan2(p.y - last.y, p.x - last.x));
    }
    stroke.pts.push(p);
  }

  function onUp() {
    if (stroke && stroke.placed.length) { strokes.push(stroke.placed); UI.refreshHud(); }
    stroke = null;
  }

  function blockedByWall(p) {
    return walls.some(w => p.x > w.x - 8 && p.x < w.x + w.w + 8 && p.y > w.y - 8 && p.y < w.y + w.h + 8);
  }

  function tryPlace(p, ang) {
    if (ink <= 0) return;
    if (p.x < 20 || p.x > S.world.w - 20 || p.y < 90 || p.y > S.world.h - 240) return;
    if (blockedByWall(p)) return;
    for (const d of dominoes) {
      if (d.state !== 'gone' && Math.hypot(d.x - p.x, d.y - p.y) < S.domino.minDist) return;
    }
    const idx = dominoes.length;
    dominoes.push({ x: p.x, y: p.y, ang, state: 'up', t: 0, chainIdx: 0 });
    stroke.placed.push(idx);
    ink--; firstPlaced = true;
    AudioSystem.place();
    UI.refreshHud();
  }

  function undo() {
    if (phase !== 'draw' || !strokes.length) return;
    const last = strokes.pop();
    last.sort((a, b) => b - a).forEach(i => dominoes.splice(i, 1));
    ink = Math.min(inkMax, ink + last.length);
    if (!dominoes.length) firstPlaced = false;
    AudioSystem.ui();
    UI.refreshHud();
  }

  function clearAll() {
    if (phase !== 'draw') return;
    dominoes = []; strokes = []; ink = inkMax; firstPlaced = false;
    AudioSystem.ui(); UI.refreshHud();
  }

  // rewarded-ad grant: extra dominoes mid-level
  function grantInk(n) { ink += n; inkMax += n; extraInkUsed = true; UI.refreshHud(); }

  // ============ GO — simulation ============
  function go() {
    if (phase !== 'draw' || !dominoes.length) return;
    phase = 'sim';
    simIdle = 0; chainCounter = 0;
    // push the domino nearest to the start pad
    let bi = 0, bd = Infinity;
    dominoes.forEach((d, i) => {
      const dd = Math.hypot(d.x - level.start.x, d.y - level.start.y);
      if (dd < bd) { bd = dd; bi = i; }
    });
    fall(dominoes[bi], dominoes[bi].ang);
    UI.refreshHud();
  }

  function fall(d, dirAng) {
    if (d.state !== 'up') return;
    d.state = 'falling'; d.t = 0;
    d.fallAng = dirAng;
    d.chainIdx = chainCounter++;
    d.contacted = false;
  }

  function propagateFrom(d) {
    const reach = S.domino.reach;
    const cone = (S.domino.coneDeg * Math.PI) / 180;
    for (const o of dominoes) {
      if (o.state !== 'up') continue;
      const dx = o.x - d.x, dy = o.y - d.y;
      const dist = Math.hypot(dx, dy);
      if (dist > reach) continue;
      const a = Math.atan2(dy, dx);
      let diff = Math.abs(a - d.fallAng);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;
      if (diff <= cone) fall(o, a);
    }
    hitWorld(d.x + Math.cos(d.fallAng) * reach * 0.7, d.y + Math.sin(d.fallAng) * reach * 0.7, d.fallAng);
    AudioSystem.click(d.chainIdx);
    Meta.bump('dominoes');
  }

  // a topple/ball/explosion touches world objects at (x,y)
  function hitWorld(x, y, dirAng, radius = S.ball.knockRadius, fromBlast = false) {
    for (const t of towers) {
      if (t.alive && Math.hypot(t.x - x, t.y - y) < radius + S.tower.blockSize * 1.1) destroyTower(t, dirAng);
    }
    for (const g of gems) {
      if (g.alive && Math.hypot(g.x - x, g.y - y) < radius + 24) collectGem(g);
    }
    for (const t of tnts) {
      if (t.alive && t.fuse < 0 && Math.hypot(t.x - x, t.y - y) < radius + 26) t.fuse = S.tnt.fuse;
    }
    for (const b of balls) {
      if (b.alive && !b.moving && Math.hypot(b.x - x, b.y - y) < radius + S.ball.r) {
        b.moving = true;
        b.vx = Math.cos(dirAng) * S.ball.speed;
        b.vy = Math.sin(dirAng) * S.ball.speed;
        AudioSystem.roll();
      }
    }
    if (fromBlast) {
      for (const d of dominoes) {
        if (d.state === 'up' && Math.hypot(d.x - x, d.y - y) < radius) {
          fall(d, Math.atan2(d.y - y, d.x - x));
        }
      }
    }
  }

  function destroyTower(t, dirAng) {
    t.alive = false;
    destroyedTargets++;
    Meta.bump('towers');
    const coins = t.blocks * S.tower.coinPer;
    coinsEarned += coins;
    spawnDebris(t.x, t.y, t.blocks, dirAng);
    floaters.push({ x: t.x, y: t.y - 30, text: `+${coins}`, t: 1.2, color: '#ffd75e' });
    AudioSystem.crash();
    shake = Math.max(shake, 9);
    checkFinale();
  }

  function collectGem(g) {
    g.alive = false;
    Meta.bump('gems');
    const coins = Math.round(S.gem.coinValue * Meta.gemMult());
    coinsEarned += coins;
    floaters.push({ x: g.x, y: g.y - 26, text: `+${coins} 💎`, t: 1.3, color: '#7ef2ff' });
    for (let i = 0; i < 10; i++) spawnP(g.x, g.y, '#7ef2ff', 3);
    AudioSystem.gem();
  }

  function explode(t) {
    t.alive = false;
    Meta.bump('tnt');
    destroyedTargets++;
    const R = S.tnt.radius * Meta.blastMult();
    shake = Math.max(shake, S.tnt.shake);
    for (let i = 0; i < 42; i++) spawnP(t.x, t.y, i % 3 ? '#ff9c40' : '#ffd75e', 7, 1.1);
    AudioSystem.tnt();
    hitWorld(t.x, t.y, 0, R, true);
    // chain other TNTs
    for (const o of tnts) {
      if (o.alive && o.fuse < 0 && Math.hypot(o.x - t.x, o.y - t.y) < R) o.fuse = S.tnt.fuse;
    }
    checkFinale();
  }

  function checkFinale() {
    if (destroyedTargets >= level.targetCount) {
      timeScale = S.juice.slowMoOnFinale;
      slowTimer = S.juice.slowMoTime;
    }
  }

  // ============ particles ============
  function spawnP(x, y, color, sp = 4, life = 0.7) {
    if (particles.length > S.juice.particleCap) return;
    const a = Math.random() * Math.PI * 2, v = (0.4 + Math.random()) * sp * 60;
    particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: life * (0.6 + Math.random() * 0.6), color, r: 2 + Math.random() * 4 });
  }
  function spawnDebris(x, y, n, dirAng) {
    for (let i = 0; i < n * 4; i++) {
      const a = dirAng + (Math.random() - 0.5) * 1.6;
      const v = 120 + Math.random() * 260;
      particles.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        t: S.tower.debrisLife * (0.5 + Math.random() * 0.7),
        color: ['#e8a05c', '#d18544', '#f2c188'][i % 3],
        r: 4 + Math.random() * 6, spin: Math.random() * 8, sq: true,
      });
    }
  }

  // ============ tick ============
  const FIXED_STEP = 1 / 60;
  let acc = 0;
  function tick(ts) {
    if (!running) return;
    let real = Math.min((ts - lastTs) / 1000, 0.6);   // survive throttled rAF / app pause
    lastTs = ts;
    acc += real;
    let guard = 0;
    while (acc >= FIXED_STEP && guard < 40) {
      if (slowTimer > 0) { slowTimer -= FIXED_STEP; if (slowTimer <= 0) timeScale = 1; }
      update(FIXED_STEP * timeScale);
      acc -= FIXED_STEP; guard++;
    }
    if (guard >= 40) acc = 0;
    render();
    requestAnimationFrame(tick);
  }

  function update(dt) {
    if (toast.t > 0) toast.t -= dt;
    shake *= S.juice.shakeDecay;

    // dominoes
    let active = false;
    for (const d of dominoes) {
      if (d.state === 'falling') {
        active = true;
        d.t += dt / S.domino.fallTime;
        if (!d.contacted && d.t >= S.domino.contactAt) { d.contacted = true; propagateFrom(d); }
        if (d.t >= 1) { d.t = 1; d.state = 'down'; }
      }
    }
    // tnt fuses
    for (const t of tnts) {
      if (t.alive && t.fuse >= 0) { active = true; t.fuse -= dt; if (t.fuse <= 0) explode(t); }
    }
    // balls
    for (const b of balls) {
      if (!b.moving) continue;
      active = true;
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.vx *= Math.pow(S.ball.friction, dt * 60); b.vy *= Math.pow(S.ball.friction, dt * 60);
      const dir = Math.atan2(b.vy, b.vx);
      hitWorld(b.x, b.y, dir, S.ball.knockRadius);
      for (const d of dominoes) {
        if (d.state === 'up' && Math.hypot(d.x - b.x, d.y - b.y) < S.ball.r + 20) fall(d, dir);
      }
      for (const w of walls) {
        if (b.x > w.x - S.ball.r && b.x < w.x + w.w + S.ball.r && b.y > w.y - S.ball.r && b.y < w.y + w.h + S.ball.r) {
          if (w.w > w.h) b.vy *= -0.55; else b.vx *= -0.55;
          b.x += b.vx * dt * 2; b.y += b.vy * dt * 2;
        }
      }
      if (b.x < S.ball.r || b.x > S.world.w - S.ball.r) { b.vx *= -0.55; b.x = Math.max(S.ball.r, Math.min(S.world.w - S.ball.r, b.x)); }
      if (b.y < S.ball.r || b.y > S.world.h - S.ball.r) { b.vy *= -0.55; b.y = Math.max(S.ball.r, Math.min(S.world.h - S.ball.r, b.y)); }
      if (Math.hypot(b.vx, b.vy) < S.ball.minSpeed) { b.moving = false; }
    }
    // particles / floaters
    particles = particles.filter(p => (p.t -= dt) > 0);
    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.97; p.vy *= 0.97; }
    floaters = floaters.filter(f => (f.t -= dt) > 0);
    for (const f of floaters) f.y -= 34 * dt;

    // end detection
    if (phase === 'sim') {
      if (!active) {
        simIdle += dt;
        if (simIdle > 0.85) finish();
      } else simIdle = 0;
    }
  }

  function finish() {
    phase = 'end';
    const frac = level.targetCount ? destroyedTargets / level.targetCount : 1;
    let stars = 0;
    if (frac >= S.scoring.star3) stars = 3;
    else if (frac >= S.scoring.star2) stars = 2;
    else if (frac >= S.scoring.star1) stars = 1;
    const win = stars >= 1;
    let coins = coinsEarned;
    if (win) {
      coins += S.scoring.levelBaseCoins + ink * S.scoring.inkBonusPerDomino;
      Meta.bump('wins');
      if (stars === 3) Meta.bump('perfects');
      AudioSystem.win();
    } else {
      AudioSystem.lose();
    }
    const save = SaveSystem.get();
    if (win) {
      save.stars[level.n] = Math.max(save.stars[level.n] || 0, stars);
      if (level.n === save.level) save.level++;
      Meta.addCoins(coins);
    }
    SaveSystem.save();
    setTimeout(() => onEndCb && onEndCb({ win, stars, coins, frac, level: level.n, extraInkUsed }), 400);
  }

  // ============ render ============
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // bg
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, '#20315b'); g.addColorStop(1, '#141d38');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const shx = (Math.random() - 0.5) * shake * viewScale;
    const shy = (Math.random() - 0.5) * shake * viewScale;
    ctx.setTransform(viewScale, 0, 0, viewScale, viewOX + shx, viewOY + shy);

    // table surface
    ctx.fillStyle = '#2a3b6b';
    rr(14, 80, S.world.w - 28, S.world.h - 300, 26); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 2;
    for (let y = 160; y < S.world.h - 260; y += 80) {
      ctx.beginPath(); ctx.moveTo(30, y); ctx.lineTo(S.world.w - 30, y); ctx.stroke();
    }

    // start pad
    const sp = level.start;
    ctx.fillStyle = 'rgba(80,220,130,0.18)';
    ctx.beginPath(); ctx.arc(sp.x, sp.y, S.startPad.r * 1.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#3ecf72';
    ctx.beginPath(); ctx.arc(sp.x, sp.y, S.startPad.r, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('START', sp.x, sp.y);

    // walls
    for (const w of walls) {
      ctx.fillStyle = '#0d1430';
      rr(w.x, w.y + 5, w.w, w.h, 8); ctx.fill();
      ctx.fillStyle = '#54638f';
      rr(w.x, w.y, w.w, w.h, 8); ctx.fill();
    }

    // gems
    for (const gm of gems) {
      if (!gm.alive) continue;
      const bob = Math.sin(performance.now() / 300 + gm.x) * 4;
      ctx.save(); ctx.translate(gm.x, gm.y + bob); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#7ef2ff'; rr(-13, -13, 26, 26, 6); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; rr(-13, -13, 12, 12, 5); ctx.fill();
      ctx.restore();
    }

    // tnt
    for (const t of tnts) {
      if (!t.alive) continue;
      const flash = t.fuse >= 0 && Math.floor(performance.now() / 60) % 2 === 0;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(t.x, t.y + 16, 24, 9, 0, 0, 7); ctx.fill();
      ctx.fillStyle = flash ? '#ffffff' : '#e33d3d';
      rr(t.x - 20, t.y - 22, 40, 40, 7); ctx.fill();
      ctx.fillStyle = flash ? '#e33d3d' : '#fff';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('TNT', t.x, t.y - 2);
      ctx.strokeStyle = '#803'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(t.x, t.y - 22); ctx.quadraticCurveTo(t.x + 10, t.y - 34, t.x + 4, t.y - 40); ctx.stroke();
    }

    // towers
    const BS = S.tower.blockSize;
    for (const t of towers) {
      if (!t.alive) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(t.x, t.y + BS * 0.8, BS * 1.5, BS * 0.55, 0, 0, 7); ctx.fill();
      for (let i = 0; i < t.blocks; i++) {
        const yy = t.y - i * (BS * 0.62);
        ctx.fillStyle = i % 2 ? '#e8a05c' : '#d18544';
        rr(t.x - BS, yy - BS * 0.6, BS * 2, BS * 0.62, 5); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        rr(t.x - BS, yy - BS * 0.6, BS * 2, 5, 3); ctx.fill();
      }
    }

    // balls
    for (const b of balls) {
      if (!b.alive) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(b.x, b.y + S.ball.r * 0.75, S.ball.r, S.ball.r * 0.4, 0, 0, 7); ctx.fill();
      const bg2 = ctx.createRadialGradient(b.x - 6, b.y - 6, 3, b.x, b.y, S.ball.r);
      bg2.addColorStop(0, '#cfd8ff'); bg2.addColorStop(1, '#5b6bb5');
      ctx.fillStyle = bg2;
      ctx.beginPath(); ctx.arc(b.x, b.y, S.ball.r, 0, 7); ctx.fill();
    }

    // dominoes (pseudo-3D top-down)
    const skin = Meta.activeSkin();
    const DW = S.domino.w, DH = S.domino.h;
    for (const d of dominoes) {
      ctx.save();
      ctx.translate(d.x, d.y);
      if (d.state === 'up') {
        ctx.rotate(d.ang + Math.PI / 2);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        rr(-DW / 2 + 3, -DH / 2 + 4, DW, DH, 4); ctx.fill();
        ctx.fillStyle = skin.body;
        rr(-DW / 2, -DH / 2, DW, DH, 4); ctx.fill();
        ctx.strokeStyle = skin.edge; ctx.lineWidth = 2;
        rr(-DW / 2, -DH / 2, DW, DH, 4); ctx.stroke();
      } else {
        // falling/fallen: rectangle grows forward in fall direction
        const p = d.t;
        ctx.rotate(d.fallAng);
        const len = DW + (DH - DW) * p;      // footprint stretches as it lays down
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        rr(0, -DW * 1.4, len + 4, DW * 2.8, 4); // simple shadow smear
        ctx.fillStyle = shadeColor(skin.body, -18 * p);
        rr(0, -DH / 2 + (DH - DW * 2.2) / 2 * p, len, DH - (DH - DW * 2.2) * p, 4);
        ctx.fill();
        ctx.strokeStyle = skin.edge; ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = skin.pip;
        ctx.beginPath(); ctx.arc(len * 0.5, 0, 2.5, 0, 7); ctx.fill();
      }
      ctx.restore();
    }

    // live stroke preview line
    if (stroke && stroke.pts.length > 1) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 4; ctx.setLineDash([6, 10]);
      ctx.beginPath();
      ctx.moveTo(stroke.pts[0].x, stroke.pts[0].y);
      for (const p of stroke.pts) ctx.lineTo(p.x, p.y);
      ctx.stroke(); ctx.setLineDash([]);
    }

    // particles
    for (const p of particles) {
      ctx.globalAlpha = Math.min(1, p.t * 2);
      ctx.fillStyle = p.color;
      if (p.sq) {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate((p.spin || 0) * p.t);
        ctx.fillRect(-p.r, -p.r, p.r * 2, p.r * 2); ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // floaters
    for (const f of floaters) {
      ctx.globalAlpha = Math.min(1, f.t * 1.6);
      ctx.fillStyle = f.color;
      ctx.font = 'bold 30px sans-serif';
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    // toast
    if (toast.t > 0 && toast.text) {
      ctx.globalAlpha = Math.min(1, toast.t);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      const tw = ctx.measureText(toast.text).width + 60;
      rr(S.world.w / 2 - tw / 2, 96, tw, 54, 27); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 24px sans-serif';
      ctx.fillText(toast.text, S.world.w / 2, 123);
      ctx.globalAlpha = 1;
    }
  }

  function shadeColor(hex, pct) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) + pct, g2 = ((n >> 8) & 255) + pct, b = (n & 255) + pct;
    r = Math.max(0, Math.min(255, r)); g2 = Math.max(0, Math.min(255, g2)); b = Math.max(0, Math.min(255, b));
    return `rgb(${r},${g2},${b})`;
  }

  return {
    init, start, stop, go, undo, clearAll, grantInk,
    getInk: () => ink, getInkMax: () => inkMax,
    getPhase: () => phase,
    hasDominoes: () => dominoes.length > 0,
    _dbg: () => ({
      phase, running, timeScale, simIdle,
      falling: dominoes.filter(d => d.state === 'falling').length,
      up: dominoes.filter(d => d.state === 'up').length,
      down: dominoes.filter(d => d.state === 'down').length,
      ballsMoving: balls.filter(b => b.moving).length,
      fuses: tnts.filter(t => t.alive && t.fuse >= 0).length,
      destroyedTargets, targetCount: level && level.targetCount,
    }),
  };
})();
window.Game = Game;
