# Build Plan: Endless First, Offline First

**Goal:** a visually stunning, offline, single-player web game that plays and feels like Raid Rush.
**Endless mode is the first thing we ship.** It is a complete game on its own: run → rewards → upgrades → deeper run.
Campaign, then online features, come after.

| Doc | What's in it |
|---|---|
| [`GAME_DESIGN.md`](./GAME_DESIGN.md) | RR philosophy, card rules, **battle physics spec**, roster, **Endless design**, meta |
| [`ART_DIRECTION.md`](./ART_DIRECTION.md) | Look, rendering tech, VFX "juice" catalog, UI, audio |
| [`RESEARCH.md`](./RESEARCH.md) | What we know about Raid Rush, with sources |

Working title: **"Path Raiders"** (placeholder).

---

## 1. Principles

1. **Endless is the product.** Every system we build (board, road, draft, physics, waves, meta) gets judged
   by one question: does it make an Endless run better?
2. **Feels like Raid Rush.** Same core rules: XP-only economy, road + land + tower cards, 6-tower deck, ±20% class
   triangle, ground vs. air, 6★ in-battle stars, physical crowd control, escalating pressure. Where RR
   frustrates players (streaky draws, hidden stats, auto-camera), we fix it.
3. **Offline is the product, not a fallback.** No server, no account. Installable PWA, works in airplane mode,
   saves on the device, one-tap export/import.
4. **Fun in graybox → then stunning.** Prove the loop with boxes first (M1), then build the full visual pipeline on
   that same slice (M2), *then* make content at scale.
5. **Deterministic sim, separate from rendering.** Pure TS, seeded RNG, fixed 30 Hz. This gives speed-up, autoplay,
   headless balance runs and replays now, and makes online leaderboards cheat-proof later.
6. **Data-driven.** Towers, enemies, perks, wave templates, phases and curves are data.

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Language / build | TypeScript + Vite |
| 3D | **Three.js** (stylized low-poly diorama) + pmndrs `postprocessing` (bloom, SMAA, tilt-shift, LUT) |
| Tweens / juice | GSAP |
| UI | Preact + CSS overlay (crisp text, responsive) |
| Audio | Howler.js (sprites, adaptive music layers) |
| Save | IndexedDB (`idb-keyval`), versioned schema + migrations, JSON export/import |
| Offline | `vite-plugin-pwa` (precache everything) |
| Assets | glTF + `gltf-transform` (meshopt, KTX2); CC0 kits restyled with one palette |
| Debug | `lil-gui`, `stats-gl`, cheat console (dev builds only) |
| Tests | Vitest (sim, determinism, draft rules), Playwright (smoke + screenshots) |

---

## 3. Architecture

```
src/
  sim/                    # PURE TS: no DOM/Three imports. Runs in browser, Node, Web Worker.
    core/                 # rng, fixed-step clock, command queue, event bus, ids, pools
    board/                # grid, fog/field reveal, road polyline + arc corners, placement validation
    movement/             # path-distance movement, air lines, lanes, separation, push/pull/knockback
    combat/               # targeting, deliveries (hitscan/homing/ballistic/beam/chain/...), damage, status
    entities/             # tower, enemy, hero, soldier, trap, skill behaviors (data + small components)
    draft/                # XP curve, card pool, weights, guarantees, pity, refresh
    waves/                # endless wave generator (budget + templates), phase table, boss rotation
    battle.ts             # BattleState + step(); win/lose/Last Stand; run record (seed + commands)
    ai/autoplay.ts        # card + placement scoring (balance sims, optional auto mode)
  data/                   # towers, enemies, skills, heroes, roadPieces, fieldShapes, phases,
                          # waveTemplates, curves, mapPresets
  meta/                   # profile, collection, merge/jokers, levels, workshop, crates, records, save
  render/                 # scene, camera rig, board/tile meshes, instanced enemies, tower views,
                          # vfx (pooled), post-fx, quality tiers, interpolation
  ui/                     # Preact: home, deck, battle HUD, draft cards, results, crate, settings
  audio/                  # music director (phase layers), sfx bank
  dev/                    # debug panel, cheats, sandbox hooks
tools/
  sim-cli.ts              # npm run sim: headless balance reports (CSV/JSON)
  build-assets.ts         # asset optimization + card icon renders
```

**Flow:** `input → Command → sim.step() (30 Hz) → events → render (interpolated, 60+ fps) / audio / UI`.
The sim can move to a Web Worker later if the main thread gets busy.

**Online-ready seams (unused until later):** `SaveStore` (IndexedDB → cloud), `Ledger` (all currency changes),
`RunRecord` (seed + commands, so a server can re-simulate for leaderboards).

---

## Status

**M0 through M5 are built**: Endless (all six phases, 6 bosses), the full roster (17 towers, 17 enemies, 8 skills,
4 heroes), the meta game, Daily Endless, Mutators, the Lab, replays and offline PWA support.
What's still open:
- Art is procedural low-poly (generated in code), not CC0 model packs. Asset keys stay swappable.
- Performance has only been checked in a software renderer. Real-device tuning (M4 gate) still needs a phone.
- Balance is tuned against the autoplay AI and still needs human playtesting (M1/M3 gates).
- M6 Campaign and all online features remain future work.

## 4. Roadmap

Every milestone ends in a playable build. **Gates** are go/no-go checks. We don't move on until they pass.

### M0: Foundation (≈ 3–4 days)
- [ ] Vite + TS + Three.js + Preact + Vitest + ESLint/Prettier
- [ ] Fixed-step clock + render interpolation, seeded RNG, command queue, event bus
- [ ] Portrait layout (phone + letterboxed desktop), touch + mouse, camera pan/zoom limits
- [ ] PWA works offline. IndexedDB save with schema version.
- [ ] Debug panel + FPS meter + cheat console skeleton

### M1: Graybox Endless: *is the loop fun?* (≈ 2 weeks)
Boxes and cylinders only, colored by class.
- [ ] Board 13×21 with fog, starting island, obstacles, power tiles, 1 map preset
- [ ] **Road cards** (Extending Gate, 2-shape choice, rotate/mirror, ghost validity) and **Field cards**
- [ ] **Movement physics:** path-distance ground movement, arc corners, lanes, separation, speed cap; straight-line air
- [ ] 6 towers: Cannon (ballistic), Skyguard (homing AA), Gatling (hitscan), Tesla (chain), Frost Gun (slow), Gust Fan (push)
- [ ] 5 enemies: Scrapper, Dasher, Brute, Buzzer, Medic
- [ ] Damage formula, class triangle, armor, crit, slow/stun/push
- [ ] **Draft:** XP orbs, level-up pause, 1-of-3, guarantees + pity, Star cards (to 6★, stat-only for now), Move/Switch, 1 refresh
- [ ] **Endless waves:** budget generator, 3 templates, phases 1–2, boss placeholder every 10, Call Early
- [ ] Fortress HP, Last Stand, game over → results (wave reached), 1x/2x/3x, pause
- [ ] Tests: road validation, movement/push math, damage, draft guarantees, **determinism** (seed+commands → same final state)
- [ ] ✅ **Gate:** 20+ runs played. Runs feel different from each other, picks feel meaningful, death feels fair.
      Tune the XP curve and wave budget until runs last ~15–25 min.

### M2: Visual slice: *make that loop stunning* (≈ 2–3 weeks)
- [ ] Floating diorama board (Plains biome), sky, props, fog-reveal effect
- [ ] Toon shader + rim + outlines, shadows, post-fx stack, Low/Med/High quality tiers
- [ ] Models for the 6 towers (with ★3 and ★6 visual upgrades), 5 enemies, fortress, gate
- [ ] VFX: muzzle flashes, tracers, lightning, frost, explosions, gust, hit flash, damage numbers, dissolve deaths, XP orbs
- [ ] Juice: road tiles pop up, land rises out of the fog, tower drop + shockwave, gate collapse/open, star burst, camera shake
- [ ] Draft cards: rarity frames, 3D tilt, slow-mo + blur. Battle HUD. Results screen.
- [ ] Audio: SFX set + 2-layer music (calm/combat) + phase stingers
- [ ] ✅ **Gate:** 60 fps Medium on a mid-range phone. A 30s capture looks like a store trailer.

### M3: Endless depth (≈ 3 weeks)
- [ ] Remaining 6 MVP towers (Railgun, Barracks + blockers, Spike Strip traps, Prism Laser beam, Grapple pull) + full ★1–★6 perk tracks
- [ ] Remaining MVP enemies (Bomber, Shellback, Splitter) + elites with affixes
- [ ] 4 skills (aim + cooldown), 2 heroes (place, level in-run, special, aura)
- [ ] 2 real bosses (Iron Colossus, Sky Leviathan) with phases + intro cinematics
- [ ] **All 6 Pressure Phases**: shields, Rocketeer/EMP Integrity damage, land collapse, XP starvation
- [ ] More wave templates, 3 map presets (Plains, Islands, Canyon), Bridge road piece
- [ ] Autoplay AI + `npm run sim` reports. First balance pass on medians and damage share.
- [ ] ✅ **Gate:** sim median wave ~25 with the starter deck. A skilled human beats wave 40 with the starter deck.

### M4: Endless meta: *v1.0 offline release* (≈ 2–3 weeks)
- [ ] Home screen with a 3D fortress diorama and a big **Play Endless** button
- [ ] Deck builder (6 towers / 2 skills / 1 hero) with a phase enemy-class preview
- [ ] Collection: rarity (merge 3/2 copies, jokers), levels (gold + blueprints)
- [ ] Rewards: Supply Drops every 10 waves, **Lucky Machine**, end-of-run payout, record crates (instant open)
- [ ] **Depth unlocks** (new towers/skills/hero at first wave 10/20/30/...), Workshop (Medals)
- [ ] Records + run history + replay viewer (seed + commands)
- [ ] Settings: quality, audio, accessibility, save export/import/reset. Tutorial for the first run.
- [ ] Performance + load-size pass (< 60 MB precache), low-end device tuning
- [ ] ✅ **v1.0:** install it, airplane mode on, and play Endless for weeks with real progression.

### M5: Endless+ (≈ 2 weeks)
- [ ] Daily Endless (date seed), Mutators, remaining towers (Mortar, Boomerang, Flamethrower, Bowler, Disco, Amplifier),
      remaining enemies and bosses, heroes 3–4, skills 5–8, more map presets and biomes
- [ ] The Lab (sandbox: any tower/level, spawn any enemy). Partly done already as dev tooling.

### M6: Campaign (later)
- Authored chapters reuse the Endless sim with fixed maps + handwritten wave lists, 3-star ratings and boss chapters.
  Mostly content work at this point.

### Later: Online
1. Cloud save (Supabase) via `SaveStore`
2. Global Endless/Daily leaderboards with server re-simulation of `RunRecord`s
3. Async PvP, clans, co-op boss events, Core Parts gear

---

## 5. Quality bars
| Area | Bar |
|---|---|
| Performance | 60 fps Medium on mid phone, High on laptop; 300 enemies + 1,000 particles; zero GC hitches |
| Load | First load < 10s, repeat/offline < 3s |
| Determinism | Same seed + commands → identical result (CI test across 50 random seeds) |
| Readability | Class, air/ground, elite, shield all readable at a glance during heavy VFX |
| Feel | Every action gets visual + audio feedback within 1 frame; no input ever lost during slow-mo |
| Fairness | No death without a visible cause; no offer you can't use; anti-air guarantee before flyer waves |

## 6. Risks
| Risk | Mitigation |
|---|---|
| Our road/land model doesn't feel like RR | Config-driven rules. Watch RR footage during M1 and adjust. M1 gate. |
| Endless gets repetitive | Phases, wave templates, map presets, boss rotation, mutators, deck variety |
| Balance across infinite waves | Exponential curves in data + sim sweeps to wave 150 |
| 3D perf on phones | Instancing, pooling, quality tiers, render scale, Low = no post-fx |
| Asset consistency | Shared palette texture + one toon shader + outlines on everything |
| Save loss | IndexedDB + `navigator.storage.persist()` + export; migrations tested |

## 7. Next step
**M0 → M1:** scaffold the project and get the graybox Endless loop (road + field + 6 towers + draft + waves) playable.
