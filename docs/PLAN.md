# Build Plan — Raid Rush–style Web Game

Goal: a browser game that plays like Raid Rush: card-drafted tower
defense where **you build the enemy road**, plus deck building and meta progression.
See [`RESEARCH.md`](./RESEARCH.md) for the full breakdown of the original game.

Working title: **"Path Raiders"** (placeholder; we need an original name, since "Raid Rush" is trademarked).

---

## 1. Guiding principles

1. **Battle first.** The 3–5 minute run (draft → place → defend) is the
   product. Meta systems come later and only matter if a run is fun.
2. **Data-driven.** Towers, enemies, cards, waves and chapters live in JSON/TS
   data files, so we add content without new code.
3. **Deterministic simulation.** The fixed-timestep sim uses a seeded RNG and
   is kept separate from rendering. That gives us replays, 2x/4x speed, autoplay,
   headless balance tests, and later server-validated PvP and leaderboards.
4. **Mobile-first web.** Portrait 9:16 layout, touch controls, playable on a phone
   browser, installable as a PWA.
5. **Scope cut.** No monetization, ads, clans or live ops until the core game is done.

---

## 2. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript** | Type-safe data definitions; one language for client and server |
| Build | **Vite** | Fast dev server, simple static deploy |
| Renderer | **Phaser 3** | Batteries-included 2D: sprites, tweens, particles, input, scaling, audio |
| UI (menus) | **Preact** or plain DOM overlay | Menus, deck builder and inventory are easier in DOM than in canvas |
| State (meta) | Small store (Zustand or hand-rolled) + localStorage | Simple, works offline |
| Tests | **Vitest** | Unit tests for sim logic plus headless "simulate 100 runs" balance tests |
| Backend (phase 4+) | **Supabase** (Postgres + Auth + Edge Functions) | Accounts, cloud save, leaderboards, async PvP; MCP already connected |
| Hosting | Cloudflare Pages / Render static | Free tier, CDN |
| Art | Kenney.nl CC0 tower-defense packs → custom art later | Ship without an artist |

---

## 3. Architecture

```
src/
  sim/                 # PURE logic, no Phaser imports — runs in Node for tests
    rng.ts             # seeded PRNG (mulberry32)
    grid.ts            # tile map: land / road / obstacle / blocked
    path.ts            # road graph, path-card placement validation, enemy waypoints
    battle.ts          # BattleState + step(dt) at fixed 30 Hz tick
    entities/          # enemy, tower, projectile, hero, trap, status effects
    combat.ts          # targeting, damage, class multipliers, crit, DoT, chains
    draft.ts           # XP → level-up → roll 3 cards from pool
    waves.ts           # wave spawner from chapter data
    autoplay.ts        # card-scoring AI (also used for balance sims)
  data/
    towers.ts  enemies.ts  skills.ts  heroes.ts  pathCards.ts
    upgrades.ts  chapters/*.json  rarities.ts
  render/              # Phaser scenes that READ sim state and draw it
    BattleScene.ts  BootScene.ts  fx/
  ui/                  # DOM/Preact: HUD, card picker, menus, deck builder
  meta/                # save file, inventory, merge, upgrades, chests, economy
  main.ts
tests/
```

**Battle data flow:** `input → command queue → sim.step() → state → renderer interpolates`.
Commands are things like `PlaceTower(cardId, x, y)`, `PlacePath(cardId, x, y, rot)` and
`CastSkill(id, x, y)`. A recorded command list plus the seed reproduces a run exactly.

---

## 4. Core battle design (MVP spec)

**Board:** portrait grid, roughly 9 columns × 14 rows. The spawn portal sits at the top and
the fortress at the bottom. The run starts with a short pre-placed road stub
from the portal.

**Road building:**
- Path cards are road pieces: straight, corner, S-bend, U-turn, T-junction (later) and long straight.
- Each piece must connect to the current open end of the road. You can rotate it, and it
  can't overlap towers or obstacles.
- Until the road reaches the fortress, enemies walk to the road's open end and then
  head straight to the fortress. (❓ check how the original handles this.)
- Validation lives in `path.ts`. A ghost preview shows a green or red placement.

**Draft loop:**
- Kills give XP. Each level-up offers 3 weighted-random cards, and the game pauses while you pick.
- Card pool: the 6 deck towers, generic path cards, 2 skills, the hero (once), and per-tower
  **star upgrades** (only offered for towers already on the board).
- Weighting makes sure a path card shows up when the road is short, and a tower when
  there are no towers yet.
- Gems can reroll the offer (later).

**Combat:**
- Towers have range, attack speed, damage, target type (ground/air/both),
  targeting rule (first/strongest/closest), and a projectile type (instant, projectile,
  beam, chain, AoE).
- Class triangle: ×1.2 / ×0.8 damage.
- Status effects: slow, stun, burn (DoT), push-back, shield, heal.
- Enemies have HP, speed, class, air/ground, an elite flag, and an optional ability.
- When an enemy reaches the fortress it deals damage. Fortress HP 0 means defeat (revive comes later).

**MVP content (original names, mapped to the original's archetypes):**

| # | Our tower | Archetype | Class | Targets |
|---|---|---|---|---|
| 1 | Cannon | single-target splash | Vanguard | Ground |
| 2 | Flak / Sky Guard | anti-air burst | Vanguard | Air |
| 3 | Gatling (Vulcan) | fast single-target, crit | Swift | Both |
| 4 | Barracks (Garrison) | spawns blockers on road | Swift | Ground |
| 5 | Tesla | chain lightning | Elemental | Both |
| 6 | Frost Gun | slow | Elemental | Both |
| 7 | Laser | ramping beam | Elemental | Both |
| 8 | Wind Blower | push-back utility | Utility | Both |

Plus 3 skills (Airstrike line bomb, Frost nova, Healing for fortress), 1 hero,
8 enemy types (grunt, runner, tank, flyer, healer, shielded, splitter, boss) and
10 campaign chapters.

---

## 5. Meta progression design (post-MVP)

Kept close to the original, minus the pay-to-win parts:

- **Deck:** 6 unique towers + 2 skills + 1 hero.
- **Rarity tiers (simplified to 7):** Common → Good → Rare → Epic → Legendary → Relic → Supreme.
  Merge 3 identical (≤Rare) or 2 identical (≥Epic). Joker exchange for spare cards.
- **Levels:** gold + blueprints raise stats along a defined curve. Star passives unlock at
  levels 10/20/30.
- **Chests:** reward chests after each win, with timed unlock slots (4 slots).
- **Fortress upgrades:** permanent account-wide buffs.
- **Currencies (MVP meta):** Gold, Gems, Blueprints. Keep it to three at first.
- **Modes, in order:** Campaign → Epic difficulty tiers (+/++/+++ modifiers) →
  Endless → Daily seeded challenge (same seed for everyone, leaderboard) → async PvP.

---

## 6. Roadmap

Each milestone ends with something playable that's deployed to a URL.

### M0 — Skeleton (½ week)
- [ ] Vite + TS + Phaser + Vitest + ESLint/Prettier
- [ ] Portrait scaling, boot/menu/battle scenes, deploy pipeline
- [ ] Seeded RNG + fixed-timestep loop

### M1 — "A road and a tower" (1–2 weeks)
- [ ] Grid rendering, tile types
- [ ] Path card placement with rotation, connection validation and ghost preview
- [ ] Enemies follow the road and damage the fortress
- [ ] One tower type, targeting and projectiles
- [ ] Waves from JSON, win/lose screen
- [ ] Unit tests: path validation, waypoint generation, damage math

### M2 — "The draft" ← **first real fun test** (1–2 weeks)
- [ ] XP bar, level-up pause, pick-1-of-3 UI
- [ ] Card pool weighting rules
- [ ] All 8 MVP towers, 8 enemies, class triangle, air/ground
- [ ] Status effects (slow, stun, burn, push, shield, heal)
- [ ] Star-upgrade cards
- [ ] 2x speed, pause
- [ ] Playtest: is the road-building puzzle fun? Tune XP curve and wave pacing.

### M3 — "A full game" (2 weeks)
- [ ] Skills (targeted cast + cooldown) and hero (auto-attack + special)
- [ ] Bosses with abilities
- [ ] 10 chapters with themes, obstacles and enemy-class previews
- [ ] Pre-battle deck builder
- [ ] Save/load (localStorage), chapter unlocks
- [ ] Sound, juice (screen shake, damage numbers, particles)
- [ ] Autoplay AI + headless balance-sim script (`npm run sim -- --chapter 5 --runs 200`)

### M4 — "Progression" (2–3 weeks)
- [ ] Inventory, card rarities, merging, jokers
- [ ] Gold/blueprint upgrades and level curves
- [ ] Reward chests with unlock timers
- [ ] Fortress upgrades
- [ ] Epic +/++/+++ modifiers (land destruction, elites, shields)
- [ ] PWA install, offline play

### M5 — "Online" (2–3 weeks)
- [ ] Supabase auth (guest + email/OAuth), cloud save
- [ ] Daily seeded challenge + leaderboard (server re-sims the submitted command log
      to stop cheating, which the deterministic sim makes possible)
- [ ] Endless mode leaderboard

### M6 — "Competitive & social" (stretch)
- [ ] Async PvP: attack a snapshot of another player's deck/fortress, with trophies and arenas
- [ ] Trick cards, power-grid tiles
- [ ] Clans, boss-brawl style co-op event
- [ ] Core Parts (3-socket gear) for high-rarity cards

---

## 7. Key risks and open questions

| Risk / question | Plan |
|---|---|
| Exact rules of path placement in the original (rotation? branching? does the road have to reach the fortress?) | Watch gameplay videos / play the original during M1; build the rules config-driven so they're easy to change |
| What happens to enemies before the road connects | Prototype both: (a) walk off the road end straight to the fortress; (b) road always pre-connected, path cards *extend/detour* it. Pick the one that playtests better. |
| Balancing dozens of towers | Headless sim + autoplay AI from M3; CSV export of win rates per tower |
| Performance with many enemies/projectiles on phones | Object pooling, sprite atlases, spatial hash for targeting; cap at ~300 entities |
| Art | Start with CC0 packs; keep sprite keys abstract so art can be swapped |
| Scope creep from the huge live-ops feature list | Strict milestone order; nothing from M5–M6 before M3 is fun |

---

## 8. Immediate next steps

1. Pick a working title.
2. Confirm the stack (Phaser + TS + Vite) or swap it (e.g. PixiJS for lighter rendering, or Godot web export).
3. Start **M0 → M1**: scaffold the project and get enemies walking a player-built road.
