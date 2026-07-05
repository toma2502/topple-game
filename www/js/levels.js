// ============================================================
// LevelGenerator — deterministic procedural levels
// Difficulty curve is fully data-driven from CFG + formulas here.
// ============================================================
const LevelGenerator = (() => {

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const FIELD = { x0: 70, y0: 130, x1: 650, y1: 950 };  // target zone
  const START = { x: 360, y: 1090 };

  function farEnough(p, list, minD) {
    return list.every(q => Math.hypot(p.x - q.x, p.y - q.y) >= minD);
  }

  function place(rng, placed, minD, tries = 40) {
    for (let i = 0; i < tries; i++) {
      const p = {
        x: FIELD.x0 + rng() * (FIELD.x1 - FIELD.x0),
        y: FIELD.y0 + rng() * (FIELD.y1 - FIELD.y0),
      };
      if (farEnough(p, placed, minD)) { placed.push(p); return p; }
    }
    const p = { x: (FIELD.x0 + FIELD.x1) / 2, y: FIELD.y0 + rng() * 200 };
    placed.push(p); return p;
  }

  function build(n) {
    const rng = mulberry32(n * 9973 + 7);
    const placed = [];

    const towerCount = Math.min(1 + Math.floor(n / 2), 6);
    const gemCount   = n >= 3 ? 1 + (n % 3) : 0;
    const tntCount   = n >= 5 ? Math.min(1 + Math.floor((n - 5) / 4), 3) : 0;
    const wallCount  = n >= 4 ? Math.min(1 + Math.floor(n / 5), 4) : 0;
    const ballCount  = (n >= 6 && n % 3 === 0) ? 1 : 0;

    const towers = [];
    for (let i = 0; i < towerCount; i++) {
      const p = place(rng, placed, 130);
      towers.push({ x: p.x, y: p.y, blocks: 3 + Math.floor(rng() * 3) + Math.min(2, Math.floor(n / 8)) });
    }
    const gems = [];
    for (let i = 0; i < gemCount; i++) { const p = place(rng, placed, 110); gems.push({ x: p.x, y: p.y }); }
    const tnt = [];
    for (let i = 0; i < tntCount; i++) { const p = place(rng, placed, 150); tnt.push({ x: p.x, y: p.y }); }
    const balls = [];
    for (let i = 0; i < ballCount; i++) { const p = place(rng, placed, 140); balls.push({ x: p.x, y: p.y }); }

    // walls: horizontal slabs between start and the field, with gaps
    const walls = [];
    for (let i = 0; i < wallCount; i++) {
      const wy = 260 + rng() * 620;
      const ww = 130 + rng() * 190;
      const wx = FIELD.x0 + rng() * (FIELD.x1 - FIELD.x0 - ww);
      const vertical = rng() < 0.3;
      walls.push(vertical
        ? { x: wx, y: wy, w: 22, h: ww }
        : { x: wx, y: wy, w: ww, h: 22 });
    }

    // ink budget: greedy chain distance from start through all interactables
    const pts = [...towers, ...gems, ...tnt, ...balls].map(o => ({ x: o.x, y: o.y }));
    let cur = { ...START }, dist = 0;
    const rest = [...pts];
    while (rest.length) {
      let bi = 0, bd = Infinity;
      rest.forEach((p, i) => { const d = Math.hypot(p.x - cur.x, p.y - cur.y); if (d < bd) { bd = d; bi = i; } });
      dist += bd; cur = rest.splice(bi, 1)[0];
    }
    const slack = Math.max(1.14, 1.42 - n * 0.012);   // gets tighter with level
    const ink = Math.ceil((dist * slack) / CFG.domino.spacing) + pts.length * 2 + 6;

    return {
      n, start: START, ink,
      towers, gems, tnt, balls, walls,
      targetCount: towers.length + tnt.length,   // objects that count for stars
    };
  }

  return { build };
})();
window.LevelGenerator = LevelGenerator;
