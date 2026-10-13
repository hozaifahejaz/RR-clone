# Art Direction: "Living Diorama"

Target look: **a polished premium mobile game running in the browser.** Stylized 3D, bright and readable,
with a lot of juice on every action. The reference mood is Raid Rush / Clash Royale / Kingdom Rush Vengeance:
toy-like miniatures on a little floating battlefield.

---

## 1. Look and feel

- **The board is a floating diorama**: a chunky tile island with thick earth/rock edges, hanging in a
  biome-themed sky (clouds, distant silhouettes, drifting particles). This frames the playfield and makes
  every screenshot look good.
- **Stylized low-poly 3D** with soft toon shading: a 3-band light ramp, a colored rim light, and baked or SSAO ambient occlusion.
  No photorealism.
- **Camera:** perspective at about 55° pitch, slightly zoomed so the 9×15 board fills a portrait screen. Subtle
  **tilt-shift depth of field** at the top and bottom edges sells the miniature look. Pinch-to-zoom and pan are allowed within limits.
- **The camera never moves on its own** during play (a common Raid Rush complaint). Auto-framing is an opt-in setting.
- **Fog:** unrevealed board areas are soft volumetric cloud over the void, so the island visibly grows as you play.
- **Readability first:** enemies are saturated with a class-colored rim. The ground is desaturated and low contrast.
  Road tiles have a clear border. Elites get an animated outline. Gameplay info is never hidden behind effects.

### Class colors (used everywhere: rims, card frames, damage numbers, icons)
| Class | Color | Icon shape |
|---|---|---|
| Vanguard | Warm orange `#FF8A3D` | Shield |
| Swift | Electric green `#5CFF9D` | Arrow/chevron |
| Elemental | Arc blue-violet `#7A8CFF` | Diamond/flame |
| Utility | Gold `#FFD45C` | Gear |

### Biome palettes
| Biome | Ground | Sky | Accent / lighting |
|---|---|---|---|
| Meadow Outpost | Fresh greens, dirt road | Morning blue, puffy clouds | Warm sun |
| Sunscorch Ruins | Sand, sandstone | Orange haze | Low golden sun, heat shimmer |
| Frostpeak | Snow, ice | Pale cyan, falling snow | Cool key, pink rim |
| Neon Sprawl | Dark asphalt, holo panels | Night, neon fog | Magenta/cyan emissives (bloom heavy) |
| Ember Forge | Basalt, lava cracks | Smoky red | Glowing lava from below |
| Rift Core | Crystal, void stone | Swirling nebula | Purple/teal, shifting light |

---

## 2. Rendering tech (Three.js)

| Feature | Approach |
|---|---|
| Shading | Custom toon `MeshStandardMaterial` patch (gradient ramp + rim) via `onBeforeCompile` |
| Post-processing | `postprocessing` (pmndrs): **Bloom** (selective, emissives), **SMAA**, **tilt-shift DoF**, vignette, ACES / AgX tone mapping, subtle color LUT per biome |
| Shadows | One directional shadow map fitted tightly to the board (cheap since the board is small) |
| Outlines | Inverted-hull outline for units and towers (elites get an animated color) |
| Enemies | **InstancedMesh** per enemy type + vertex-animation textures or simple procedural bob/walk cycles |
| Effects | GPU-instanced particle system (pooled), flipbook sprites for explosions, custom shaders for beams/lightning |
| Death | Dissolve shader with emissive edge, and the enemy drops XP orbs |
| Sky / background | Gradient dome + parallax cloud cards + biome props outside the play area |
| Quality tiers | Low / Medium / High: toggles bloom, DoF, shadows, particle caps, render scale (DPR 1 → 2) |

**Performance budget:** 60 fps on a mid-range phone and a laptop iGPU. Under 150 draw calls, under 300k triangles,
~300 live enemies, ~1,000 particles. All assets go through glTF + Draco/meshopt + KTX2 textures.

---

## 3. Juice catalog (what makes it feel stunning)

| Moment | Treatment |
|---|---|
| **Field reveal** | Fog cloud parts, land chunk rises out of the void with rocks crumbling off its underside, grass/props sprout |
| **Phase change (Endless)** | Banner slam ("SIEGE"), sky and light shift a step darker and more intense, music adds a layer |
| **Land collapse** | Cracks glow along the tile for 20s, then it crumbles into the void with debris |
| **Lucky Machine** | 3-reel slot with chunky reels, light chase, coin burst on win |
| **Path placement** | Tiles pop up from the ground one by one with a bounce (staggered 40ms), dust puffs, the old Gate implodes, the new Gate swirls open with a light pillar |
| **Tower placement** | Tower drops from above with squash & stretch, ground shockwave ring, small camera kick, class-colored sparkle |
| **Star upgrade** | Every tower of that type does a synced flash + star burst, then a model change at 3★ and 5★ (extra barrels, glowing parts) |
| **Firing** | Muzzle flash, recoil animation, shell casings (Gatling), tracers, impact sparks tinted by class |
| **Tesla** | Procedural jagged lightning (re-randomized every frame) with bloom and an arc flicker on targets |
| **Prism Laser** | Scrolling-noise beam shader that thickens and changes color by ramp stage, plus a heat glow on the target |
| **Frost** | Ice crystals growing on slowed enemies, frozen enemies turn into ice sculptures, shatter on freeze-break |
| **Explosions** | Flipbook fireball + shockwave ring + debris + scorch decal that fades + screen shake scaled by size |
| **Hits** | White hit-flash (1 frame), floating damage numbers (crits bigger with a pop; class color when strong vs. class) |
| **Kills** | Dissolve, XP orbs arc into the XP bar with a satisfying "tick" pitch-up chain |
| **Level-up** | Time slows to 10%, the world desaturates and blurs, 3 cards fly in fanned with rarity glow; cards tilt with pointer (3D parallax), selection whooshes into the board |
| **Boss intro** | Letterbox bars, camera dolly to the gate, boss name title card slam, roar, music switches to the boss layer |
| **Fortress hit** | Red vignette pulse, crack decals on the fortress model at HP thresholds |
| **Last Stand** | Freeze frame → shockwave dome clears the screen → color returns |
| **Victory** | Slow-mo on the last kill, confetti burst, stars stamp in one by one with impacts |

## 4. UI style
- Chunky, rounded, tactile mobile-game UI: thick outlines, soft drop shadows, glossy gradients, bouncy
  press states (scale 0.94 → 1.04 → 1). All UI is **DOM/CSS over the canvas**, so text stays crisp and layout is responsive.
- Cards: rarity frames (Common grey, Rare blue, Epic purple, Legendary gold with shimmer shader, Mythic animated
  prismatic), class icon in the corner, tower render on top (rendered to texture at build time).
- Fonts: one bold display font (e.g. "Lilita One" / "Luckiest Guy") + one readable UI font ("Nunito"),
  **bundled locally** for offline use.
- Screen transitions: iris/wipe with the class emblem. Menus feel alive, with idle animations and a 3D diorama of
  your fortress on the home screen.

## 5. Audio
- Layered adaptive music per biome (calm build layer → combat layer → boss layer), crossfaded by intensity.
- Punchy SFX with random pitch variation (±8%) on every repeated sound. Kill-tick pitch climbs with combo.
- Howler.js, with sprites for SFX. All audio is cached for offline play.

## 6. Asset pipeline
1. **Graybox:** primitive shapes with class colors (M1).
2. **Kitbash from CC0 libraries:** e.g. Kenney (Tower Defense Kit, space/city kits), Quaternius
   (sci-fi, mechs, robots, nature), KayKit packs. Everything gets re-textured with **one shared gradient palette
   texture** so different kits look like one game. Blender for edits.
3. **Hero assets** (fortress, heroes, bosses) are custom-modeled or commissioned later. Asset keys stay abstract
   (`tower.tesla.t3`) so swapping art never touches game code.
4. Build step: `gltf-transform` optimizes everything (meshopt, KTX2, dedupe), and an icon renderer generates card art.
5. Licensing tracked in `assets/CREDITS.md`.
