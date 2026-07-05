# TOPPLE! — Game Design Document
**Genre:** Hybrid-casual physics puzzle · **Sessions:** 3–5 min · **Input:** one finger · **Orientation:** portrait

---

## 1. Concept Selection Process

### Ten candidate concepts (scored 1–10)

| # | Concept | Mechanic (5-sec pitch) | Orig. | Replay | Viral | Dev ease | Monet. | TOTAL |
|---|---------|------------------------|-------|--------|-------|----------|--------|-------|
| 1 | **Topple!** | Draw a domino run with your finger, press GO, watch the chain destroy everything | 7 | 9 | 9 | 6 | 9 | **40** |
| 2 | Polarity | Hold = attract, release = repel a magnetic orb through debris fields | 8 | 7 | 6 | 7 | 6 | 34 |
| 3 | Crowd Conductor | Hold to stop / release to march an accordion-crowd through traffic | 6 | 7 | 8 | 7 | 8 | 36 |
| 4 | Pour Master | Tilt to pour & mix liquids to match cocktail orders (ASMR) | 7 | 7 | 8 | 4 | 8 | 34 |
| 5 | Tongue | Chameleon grapple: aim tongue, pull objects OR swing yourself | 6 | 8 | 7 | 6 | 7 | 34 |
| 6 | Split Slime | Tap to split your blob through grates; mass = life | 7 | 6 | 6 | 7 | 6 | 32 |
| 7 | Wreck Pendulum | Time the release of a crane wrecking ball to demolish towers | 5 | 6 | 7 | 7 | 7 | 32 |
| 8 | Shadow Stack | Rotate stacked objects until their shadow matches a silhouette | 8 | 5 | 6 | 6 | 5 | 30 |
| 9 | Swarm Pilot | Steer a fluid bee swarm; swarm size is your health bar | 6 | 6 | 7 | 5 | 7 | 31 |
| 10 | Knit Runner | Draw yarn paths that a knitter turns into bridges mid-run | 7 | 6 | 6 | 5 | 6 | 30 |

### Why Topple! wins
- **Spectacle = virality.** Domino chain reactions are natively shareable content (domino art videos routinely pull 10M+ views). The game *produces* TikTok material every round.
- **Near-miss psychology.** "The chain died one domino short" is the strongest retry trigger in casual design — and it happens organically here.
- **Draw input** is the current top-performing control scheme in hybrid-casual (low CPI).
- **Perfect rewarded-ad fit**: +8 dominoes to bridge the gap is an offer players *want* at the exact moment of highest motivation.
- **Market timing:** the only notable prior title (Domino Smash, 2019) hit top charts then died — because it had *zero meta*. The mechanic is proven; the retention layer is the gap we fill. Reviving a proven-dormant mechanic with a modern meta stack is a classic hybrid-casual winning pattern.
- Content scales procedurally (deterministic level generator = infinite levels, zero content cost).

---

## 2. Core Gameplay Loop (30–60 s per level)
1. **SEE** the board: START pad, towers, gems, TNT, walls, ball.
2. **DRAW** domino runs with one finger (limited "ink" = domino count). First stroke must leave the START pad.
3. **GO** — the first domino is pushed; the chain propagates, launches balls, triggers TNT, smashes towers.
4. **PAYOFF** — slow-mo on the final target, debris, coins, stars.
5. **RESULT** — stars (50/80/100% targets), coins, double-coins ad, next level.

Fail state = chain dies with <50% destroyed → "SO CLOSE!" + rewarded continue (+8 dominoes).

## 3. Economy
- **Coins** (soft currency): tower blocks ×3, gems ×8 (upgradeable), level base 10, +1 per unused domino.
- **Sinks:** upgrades (60→exponential ×1.6–1.7), skins (150–500).
- Sources ≈ 30–60 coins/level → first upgrade after ~2 levels (early dopamine), skin after ~5 (day-1 goal).

## 4. Progression & Difficulty
- Procedural deterministic levels (seeded per level N — same for every player, leaderboard-safe).
- Curve: towers 1→6, gems from L3, TNT from L5, walls from L4, ball from L6; ink slack 1.42→1.14 (tighter budgets).
- **Upgrades:** Extra Ink (+4/lv), Lucky Gems (+25%/lv), Mega Blast (+12% TNT radius/lv) — permanent power ramp.

## 5. Retention Stack
- **Daily reward:** 7-day escalating cycle (15→250 coins, day 7 = exclusive skin). Streak resets after a missed day.
- **Daily missions:** 3 rolled from pool (deterministic per date), claimable coins.
- **Achievements:** 7 lifetime tiers (dominoes toppled, towers, TNT, wins, perfects).
- **Skins:** 6 domino materials (cosmetic-only, one gated behind daily streak).

## 6. Monetization
- **Rewarded ads** (stub in build, AdMob drop-in): ① +8 dominoes continue on fail (highest-intent moment), ② 2× coins on win, ③ (roadmap) skin spins.
- **Interstitials** (roadmap): every 3rd level, frequency-capped.
- **IAP** (roadmap): remove-ads 4.99, coin packs, skin bundle.

## 7. Audio & Haptics
WebAudio synth (zero asset weight): rising-pitch click cascade per chain hop (the signature sound), tower crash noise burst, TNT sub-boom, gem sparkle, coin, 4-note win fanfare. Haptics on crash/TNT/win.

## 8. UI/UX Flow
SPLASH → MENU (Play, Shop, Goals, Daily, Settings — red-dot pulses on claimables) → GAME (ink bar, undo, clear, GO) → RESULT (stars stagger-in, coin count, ad offers) → next.

## 9. Save System
Versioned JSON in localStorage (`topple_save_v1`), debounced writes, corruption-safe defaults merge. (Unity: Json + PlayerPrefs/File.)

## 10. Architecture (shipped web build)
```
www/
  index.html         — shell + all screens (DOM UI)
  js/config.js       — CFG: every tunable value (≈ ScriptableObjects)
  js/save.js         — SaveSystem
  js/audio.js        — AudioSystem (synth)
  js/meta.js         — economy/upgrades/skins/daily/missions/achievements
  js/levels.js       — LevelGenerator (seeded procedural)
  js/game.js         — core sim + render + input + juice
  js/ui.js           — screens, HUD, rewarded-ad stub
```
Custom deterministic topple-sim (no physics engine): cone-propagation falls, fixed-timestep accumulator (60 Hz, hiccup-proof), particle cap, zero GC pressure in hot loop.

## 11. Unity 6 port map (when Android module installed)
```
Assets/
  Scripts/Core/        GameLoop.cs, TopplleSim.cs, FixedStepper.cs
  Scripts/Data/        GameConfigSO.cs, SkinSO.cs, MissionSO.cs (ScriptableObjects = config.js)
  Scripts/Meta/        Economy.cs, DailyRewards.cs, Missions.cs, Achievements.cs, SaveSystem.cs
  Scripts/Input/       DrawInput.cs (New Input System, EnhancedTouch)
  Scripts/Pooling/     Pool<T>.cs (dominoes, debris, floaters)
  Scripts/UI/          Screens/*.cs (UI Toolkit)
  Scripts/Ads/         RewardedAdGate.cs (LevelPlay/AdMob adapter)
  Prefabs/ Art/ Audio/ Addressables/ (skins as addressable groups)
```
URP 2D renderer, dominoes as pooled sprites, same cone-propagation sim (deterministic → replay/ghost systems possible).

## 12. KPI targets (hybrid-casual benchmarks)
CPI < $0.40 (draw mechanic + destruction creative) · D1 ≥ 42% (daily+missions) · D7 ≥ 12% (streak skin) · playtime ≥ 22 min/day · rewarded engagement ≥ 35% of DAU.
