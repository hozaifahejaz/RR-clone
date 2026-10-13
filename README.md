# Path Raiders

An **offline, single-player 3D tower defense** for the web, inspired by Raid Rush.
You don't get a map. You **draft it**: road pieces, new land, towers, stars, skills and a hero arrive one
card at a time as you level up, while endless raids get nastier.

- **Endless mode** with six pressure phases: Setup → Raid → Elite → Siege → Collapse (building cracks the land) → Starvation (XP dries up)
- **17 towers**, each with a 6-star in-battle perk track and visual upgrades at ★3 and ★6
- **17 enemies + elites, 6 multi-phase bosses**, class triangle (±20%), air units that ignore your road
- **8 skills, 4 heroes**, Move/Switch tactic cards, power tiles, three map presets
- **Meta progression**: collection, rarity merging and jokers, levels, Workshop talents, depth unlocks, Lucky Machine, supply crates
- **Daily Endless**, **Mutators**, **The Lab** sandbox, **run replays**, autoplay
- Stylized low-poly 3D diorama (Three.js), bloom, tilt-shift, toon shading, procedural audio (no asset files)
- Installable PWA. Works in airplane mode. Saves stay on your device (export/import in Settings).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/ (with offline service worker)
npm run preview    # serve the production build
```

Open on your phone (same Wi-Fi: `npm run dev -- --host`) and use **Add to Home Screen** to install it.

## Controls

| Action | Touch | Keyboard |
|---|---|---|
| Pick a card | tap | `1` `2` `3` |
| Place / confirm | tap a tile, tap again or ✓ | `Enter` |
| Cycle road shape | ⟳ | `R` |
| Skills / hero special | buttons | `Q` `W` / `E` |
| Speed 1×/2×/3× | button | `F` |
| Pause | ❚❚ | `Space` |
| Zoom / pan | pinch / drag | mouse wheel |

## Develop

```bash
npm test           # simulation + meta unit tests (determinism, replay, draft rules, merging...)
npm run typecheck
npm run sim -- --runs 20                       # headless balance report with the autoplay AI
npm run sim -- --runs 10 --rarity 3 --level 30 # upgraded deck
npm run sim -- --deck railgun,laser,barracks,spike,grapple,skyguard --mut blitz
```

The battle simulation (`src/sim`) is pure, deterministic TypeScript (seeded RNG, fixed 30 Hz tick) with no
rendering imports. A seed + command log reproduces any run exactly, which powers replays and balance sims, and
will make online leaderboards cheat-resistant later.

```
src/sim      battle logic: board/road/fog, movement & physics, combat, draft, waves, autoplay AI
src/data     towers, enemies, skills, heroes, road pieces, Endless phases & curves
src/render   Three.js renderer: diorama board, instanced units, VFX, post-processing
src/game     game controller: loop, input modes, events → audio/toasts
src/meta     profile, rewards, unlocks, merging, workshop, save (IndexedDB)
src/ui       Preact HUD and menus
src/audio    procedural Web Audio SFX + adaptive music
```

## Docs

- [Build plan](docs/PLAN.md) · [Game design](docs/GAME_DESIGN.md) · [Art direction](docs/ART_DIRECTION.md) · [Raid Rush research](docs/RESEARCH.md)

All names, art and audio are original. "Raid Rush" is a trademark of Panteon; this project is an independent fan-inspired game.
