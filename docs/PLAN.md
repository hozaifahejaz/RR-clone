# Build Plan (Offline-First)

**Goal:** a visually stunning, single-player, fully offline web game that plays like Raid Rush:
card-drafted tower defense where you build the enemy road. Online features (cloud save,
leaderboards, PvP, clans) come **later** and stay out of the way until then.

Companion docs:
- [`GAME_DESIGN.md`](./GAME_DESIGN.md): rules, content roster, progression, modes
- [`ART_DIRECTION.md`](./ART_DIRECTION.md): look, rendering tech, VFX "juice" catalog, UI, audio
- [`RESEARCH.md`](./RESEARCH.md): breakdown of the original game

Working title: **"Path Raiders"** (placeholder).

---

## 1. Principles

1. **Offline is the product, not a fallback.** No server, no account, no network calls. Installable
   PWA. Everything (assets, fonts, audio) is cached on first load. Save data lives on the device and can be exported.
2. **Fun before pretty, then very pretty.** Prove the gameplay in graybox (M1), then build the full visual
   pipeline on that one slice (M2) before producing content at scale.
3. **Simulation ≠ rendering.** A pure, deterministic TypeScript sim (seeded RNG, fixed 30 Hz tick) with
   no Three.js imports. The renderer only reads state. This gives us 2x/3x speed, autoplay,
   headless balance testing and replays now, and anti-cheat online features later at no extra cost.
4. **Data-driven content.** Towers, enemies, perks, waves, chapters and modifiers are data. New content shouldn't need new code.
5. **Built for one player (you).** Dev tools are a first-class feature: the Lab sandbox, a debug panel, and cheat
   commands for testing.

---

## 2. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Language / build | **TypeScript + Vite** | |
| 3D rendering | **Three.js** | Stylized low-poly 3D diorama look (see Art Direction) |
| Post-processing | **pmndrs `postprocessing`** | Bloom, SMAA, tilt-shift DoF, LUTs |
| Particles | Custom GPU-instanced pool | Full control and performance |
| Tweening | **GSAP** (or `@tweenjs/tween.js`) | All the juice |
| UI | **Preact + CSS** DOM overlay | Crisp text, responsive, fast to build menus |
| Audio | **Howler.js** | Sprites, crossfades |
| Save | **IndexedDB** via `idb-keyval`, versioned schema + migrations | Export/import JSON file |
| Offline | **`vite-plugin-pwa`** (Workbox precache) | Install to home screen / desktop |
| Assets | glTF + `gltf-transform` (meshopt, KTX2) | CC0 kits → custom later |
| Debug | `lil-gui` + `stats-gl` (dev builds only) | |
| Tests | **Vitest** (sim), **Playwright** (smoke + screenshot) | Chromium is preinstalled here |
| Optional later | Tauri / Capacitor wrapper | Native desktop / phone app from the same build |

---

## 3. Architecture

```
src/
  sim/                  # PURE TS — runs in browser, Node (tests) and later a server
    core/               # rng (mulberry32), fixed-step loop, events bus, command queue
    board/              # grid, tiles, road graph, path-piece placement ("Extending Gate")
    battle/             # BattleState, step(), wave spawner, XP/levels, fortress, Last Stand
    combat/             # targeting, damage formula, status effects, projectiles, spatial hash
    draft/              # card pool, weighting/pity rules, rerolls
    entities/           # towers, enemies, heroes, skills, traps — behavior components
    ai/autoplay.ts      # card scoring + placement AI (balance sims, "auto" toggle)
  data/                 # towers.ts, enemies.ts, skills.ts, heroes.ts, pathPieces.ts,
                        # modifiers.ts, chapters/*.json, curves.ts
  meta/                 # profile, collection, shards/levels, crates, workshop, unlocks,
                        # save (IndexedDB) + migrations, export/import
  render/               # Three.js: scene, camera rig, biome environments, materials/shaders,
                        # instanced enemy renderer, tower views, VFX, post-fx, quality tiers
  ui/                   # Preact screens: home/chapter map, deck builder, collection, workshop,
                        # battle HUD, draft cards, results, settings
  audio/                # music director (adaptive layers), sfx bank
  dev/                  # debug panel, cheats, Lab mode hooks (stripped in prod)
  main.ts
tools/
  sim-cli.ts            # headless balance runner
  build-assets.ts       # gltf-transform pipeline + card icon renders
tests/
```

**Battle flow:** `input → Command (PlacePath/PlaceTower/PickCard/CastSkill...) → sim.step() →
events (onHit, onKill, onLevelUp...) → render + audio + UI react`. Seed + command log = exact replay.

**Online-ready seams (unused for now):** save goes through a `SaveStore` interface (IndexedDB now,
cloud later), the economy goes through a `Ledger` service, and runs record their command log. Adding online
later means adding implementations, not rewriting.

---

## 4. Roadmap

Every milestone ends in a playable build. Rough estimates assume one developer working with Claude.

### M0: Foundation (≈ 3–4 days)
- [ ] Vite + TS + Three.js + Preact + Vitest + ESLint/Prettier scaffold
- [ ] Fixed-step sim loop with render interpolation, seeded RNG, command queue
- [ ] Portrait responsive layout (phone + desktop letterboxed), touch + mouse input
- [ ] PWA (installable, works with network off), IndexedDB save with schema version
- [ ] Debug panel + FPS meter

### M1: Graybox vertical slice: *is it fun?* (≈ 1.5–2 weeks)
- [ ] Board: grid, tiles, obstacles, camera rig (pan/zoom limits)
- [ ] **Extending Gate road**: path pieces, snap to gate, rotate/mirror, ghost validity
- [ ] Enemies follow the road (ground) and a smoothed route (air), damage the fortress
- [ ] 4 towers (Cannon, Gatling, Tesla, Frost), targeting, projectiles, class triangle
- [ ] 5 enemies (Scrapper, Dasher, Brute, Buzzer, Medic), waves from JSON
- [ ] **Draft**: XP orbs, level-up, pick 1 of 3, weighting + pity rules, star-upgrade cards
- [ ] Win/lose, Last Stand, 1x/2x speed, pause
- [ ] Unit tests: placement validation, waypoints, damage, draft rules, determinism (same seed → same result)
- [ ] ✅ **Gate:** play 20+ runs. Is road-building plus drafting fun? Iterate before moving on.

### M2: Visual slice: *make one chapter look stunning* (≈ 2 weeks)
- [ ] Floating diorama board, Meadow biome environment, sky, props
- [ ] Toon shader + rim + outlines, shadows, post-fx stack, quality tiers
- [ ] Real models for the 4 towers / 5 enemies (CC0 kitbash, shared palette), fortress, gate
- [ ] VFX pass: muzzle flashes, tracers, lightning, frost, explosions, hit flash, damage numbers, dissolve deaths
- [ ] Juice pass: tile pop-in, tower drop, gate open/collapse, star-upgrade burst, camera shake
- [ ] Draft card UI with rarity frames, 3D tilt, slow-mo + blur
- [ ] Battle HUD, results screen, audio (music layers + SFX)
- [ ] ✅ **Gate:** 60 fps on a mid-range phone at Medium; a recorded clip looks like a store trailer.

### M3: Content core (≈ 3 weeks)
- [ ] All 16 towers with 5 star perks each
- [ ] All 14 enemies + elite affixes
- [ ] 8 skills (aim + cooldown UI), 4 heroes (placement, special charge, passive aura)
- [ ] Bosses 1–2 with phases + intro cinematics
- [ ] Biomes 1–2 (Meadow, Sunscorch), chapters 1–10, power tiles, water + bridge pieces
- [ ] Autoplay AI + `npm run sim` balance reports, first balance pass

### M4: Meta game (≈ 2 weeks)
- [ ] Home screen (fortress diorama) + chapter map
- [ ] Collection, card rarities (shards) and levels (gold), deck builder (6 towers + 2 skills + 1 hero)
- [ ] Supply crates (instant open, great animation), first-clear rewards
- [ ] Chapter stars → Workshop talent tree
- [ ] Unlock pacing / tutorial for chapters 1–6
- [ ] Settings: graphics quality, audio, accessibility, save export/import, reset

### M5: Full offline game (≈ 3–4 weeks)
- [ ] Biomes 3–6, chapters 11–30, bosses 3–6
- [ ] Epic +/++/+++ modifier tiers
- [ ] Endless, Daily Challenge (date seed), Boss Rush, **The Lab** sandbox
- [ ] Full balance pass with sim reports, difficulty curve tuning
- [ ] Polish: transitions, idle animations, music for all biomes, loading screen
- [ ] Performance pass on low-end devices, asset size budget (< 60 MB total precache)
- [ ] ✅ **v1.0 offline release**: install it, put the phone in airplane mode, play the full campaign

### Later: online and extras (after v1.0)
1. **Cloud save** (Supabase auth + a `SaveStore` implementation): sync between your devices
2. **Leaderboards** for Daily / Endless / Speed Run: server re-simulates submitted command logs
3. **Async PvP**: attack snapshots of other players' decks and fortresses, trick cards, trophies
4. Clans, co-op boss events, seasonal content, Core Parts gear
5. Native wrappers (Tauri desktop, Capacitor mobile)

---

## 5. Quality bars
| Area | Bar |
|---|---|
| Performance | 60 fps Medium on mid phone; 60 fps High on laptop; no GC hitches (pool everything) |
| Load | First load < 10s on broadband; repeat/offline load < 3s |
| Determinism | Same seed + commands → identical outcome (CI test) |
| Readability | You can tell enemy class, air/ground and elite status at a glance, even during big VFX |
| Feel | Every player action gets visual + audio feedback within 1 frame |

## 6. Risks
| Risk | Mitigation |
|---|---|
| Road model doesn't feel as good as the original | M1 gate is all about this. Rules are config-driven, so variants are cheap to try. |
| 3D in the browser is too slow on phones | Instancing, quality tiers, render-scale; Low tier = no post-fx; profile from M2 onward |
| Art consistency from mixed asset packs | Shared palette texture + same toon shader + outline on everything |
| Scope (16 towers × perks × 30 chapters) | Content is data; M3 ships half the content; balance via simulator, not by hand |
| Save loss | IndexedDB + persistent-storage request + one-tap export; versioned migrations |

## 7. Next step
Start **M0 → M1**: scaffold the project and get the graybox road-building + draft loop playable.
