# Game Design Document

A single-player, offline 3D tower defense game that plays like **Raid Rush**: you build the road, the land and
the defenses one card at a time, under steadily growing pressure.
**Endless mode is the first mode we build and ship.** Campaign comes later and reuses everything.

See [`RESEARCH.md`](./RESEARCH.md) for the sources behind the "Raid Rush does X" claims, and
[`PLAN.md`](./PLAN.md) for the build order. All names here are original placeholders (no Raid Rush IP).

---

## 1. Raid Rush's design philosophy (what we copy)

| # | Raid Rush principle | How it shows up in our game |
|---|---|---|
| 1 | **The map is a card too.** You build the enemy road *and* expand the land you can build on. | Road, Field, Move and Switch cards sit in the same draft as towers |
| 2 | **Steerable luck.** Pick 1 of 3 random cards per level-up, from your deck plus generic cards. | Same, plus fixes for RR's top complaint (streaky draws, no anti-air when flyers come) |
| 3 | **XP is the economy.** No in-battle gold. Kills give XP, XP gives picks. Less XP = fewer choices = harder. | XP is the single in-battle resource. Endless difficulty partly comes from XP decay. |
| 4 | **Many short waves, continuous flow.** Chapters are long chains of quick waves (reports of ~40 waves), with a boss as the climax. | Waves every ~15s that overlap, a boss every 10 waves, and Endless has no wave limit |
| 5 | **Deck of 6 unique towers + 2 skills + 1 hero.** | Same |
| 6 | **Class triangle ±20%** (Vanguard > Swift > Elemental > Vanguard; Utility supports). | Same numbers |
| 7 | **Ground vs. air.** Roads only steer ground units, so you always need real anti-air. | Air units ignore the road and fly straight at the fortress |
| 8 | **In-battle stars.** Upgrade cards give a tower type stars (up to 6★) that unlock perks. | Same, applied to every tower of that type |
| 9 | **Physical crowd control.** Push (Wind Blower), pull (Hook), block (Garrison soldiers), roll-through (Bowling), dance (Disco), stun, slow. | A physics layer built around path distance (§4) |
| 10 | **Endgame = pressure escalators.** Endless / Elite: towers destroy land tiles, shielded enemies, XP decays. | Endless "Pressure Phases" (§6) |

**What we do differently (fixing known RR complaints):**
- **Anti-streak draft rules:** guaranteed anti-air before flyer waves, pity timers, no triple offers.
- **Visible stats:** long-press any card, tower or enemy for full numbers.
- **The camera never moves on its own** unless you turn that on.
- **No paywalls, timers or ads.** Progress always comes from play.

---

## 2. Battle overview

```
           ┌─── fog (unrevealed land) ───┐
           │   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓    │
           │   ▓▓▓  [G]═══╗  ░░░  ▓▓▓    │   [G] Enemy Gate (moves as road grows)
           │   ▓▓▓  T  ░░ ║ T ░░  ▓▓▓    │   ═ road   T tower   ░ buildable land
           │   ▓▓▓  ░░ ╔══╝ ░░ T  ▓▓▓    │   ✈ air units fly straight at the fortress
           │   ▓▓▓  T  ║  ░░  ░░  ▓▓▓    │
           │   ▓▓▓  ░░ ╚═══[F]░░  ▓▓▓    │   [F] Fortress
           └─────────────────────────────┘
```

1. The run starts with a small revealed island: the fortress, a 3-tile road with the **Gate** at its end,
   and about 12 buildable land tiles. The rest of the board (**13 × 21** for Endless) is fog.
2. Waves spawn from the Gate. Ground units walk the road. Air units fly in a straight line to the fortress.
3. Kills drop **XP orbs**. When the XP bar fills, the game pauses and offers **3 cards**. You pick one.
4. You place it: grow the road, reveal land, place or move towers, upgrade, cast skills.
5. Survive as long as possible (Endless) or clear the final wave (Campaign).

---

## 3. Cards

### 3.1 Card types in the draft

| Card | Source | Effect |
|---|---|---|
| **Tower** | Your 6 deck towers | Place a tower of that type on a free land tile |
| **Road** | Generic | Road piece (2–5 tiles) attached at the Gate. The Gate moves to the new end. |
| **Field** | Generic | Reveal a land chunk (3×3 / 2×4 / plus-shape) next to existing land. |
| **Star** | Towers on board | +1★ to **every** tower of that type (max 6★) |
| **Move** | Generic | Relocate one tower to any free tile (keeps stars) |
| **Switch** | Generic | Swap the positions of two towers |
| **Skill** | Your 2 deck skills | First pick unlocks the skill (cooldown button). Later picks empower it. |
| **Hero** | Your deck hero | Once per run. Placed on land; can be moved later with Move. |
| **Repair** | Generic, rare | Fortress +25% HP |

### 3.2 Road rules ("Extending Gate")
- A piece must connect to the Gate tile. Tap to rotate or mirror. The ghost shows green (valid) or red (invalid).
- The road can't overlap itself, towers, obstacles or fog. It can only be laid on **revealed land**, so
  Field cards and Road cards depend on each other.
- The road is always connected Gate → Fortress, so ground units always have a route.
- Enemies already walking keep their path. Their path is extended at the back, so nobody teleports.
- The old Gate collapses and a new one opens at the end.

| Piece | Tiles | Shape | Note |
|---|---|---|---|
| Stub | 2 | `I` | Filler |
| Long | 4 | `IIII` | Big gain, hard to fit |
| Corner | 3 | `L` | |
| Zig | 4 | `S/Z` | Two bends, kill-zone maker |
| Hairpin | 5 | `U` | Doubles back past the same towers |
| Hook | 5 | `J`-spiral | Coils around one tile: the "sniper nest" |
| Bridge | 2 | `I` | Can cross water/chasm |

When a Road card is offered, it shows **2 alternative shapes** and you choose one (RR offers road choices like this).

### 3.3 Draft rules (`sim/draft`)
- XP for the next level: `xpNeeded(n) = round(10 + 6n + 0.5n²)`. Tuned so you get about one pick every 1–2 waves early on.
- **Guarantees:**
  1. Pick 1 is always Tower + Road + Field.
  2. If a flyer wave is within the next 2 waves and you have no anti-air tower, one offer slot is an AA tower.
  3. If the Gate has no valid extension, Field cards get more weight. If there's no free land, Field or Move is guaranteed.
  4. Stars only appear for towers on the board. Weight goes up with that tower's count.
  5. You never see the same card twice in one offer, and you never see an offer you can't use.
  6. **Pity counters** per card type stop dry streaks (e.g. no Tower for 3 picks → forced Tower).
- **Refresh:** 1 free reroll per run (Workshop adds more).
- Picking pauses the sim, so you never lose to a decision timer.

---

## 4. Battle physics (the "feel" spec)

All simulation runs in `sim/` at a **fixed 30 Hz tick** with a seeded RNG, so it's deterministic.
**1 world unit = 1 tile.** RR-style units are kept so the balance numbers we found (e.g. "attack speed 150") read naturally.

### 4.1 Ground movement
- The road is a polyline through tile centers. Corners are rounded with a quarter-circle arc (radius 0.5) so
  movement is smooth and looks good.
- Each ground enemy stores **`d` = distance traveled along the road**. Position = `road.sample(d) + laneOffset`.
  This one scalar powers targeting ("First" = highest `d`), push, pull and fortress arrival.
- `laneOffset`: a small random perpendicular offset (±0.18 tiles) so crowds look like crowds, not a conga line.
- **Speed** is in tiles/second. Base speeds: swarm 1.6, normal 1.0, tank 0.6, boss 0.45.
  The **global cap is 2.2** (RR caps enemy speed).
- **Soft separation:** enemies on the same lane can't overlap closer than 0.25 tiles. A cheap 1D sort per
  road segment, no full physics engine needed.

### 4.2 Air movement
- Air units fly a straight line Gate → Fortress at a cruise height, with a small sine wobble.
  **Roads don't affect them.**
- Air enemies store `d` along their own line, so push and pull work the same way.
- Gate moves change new spawns only.

### 4.3 Displacement (push, pull, knockback)
- **Push** (Wind Blower-type): `d -= pushStrength` per hit (e.g. 0.25–0.3 tiles), clamped to `d ≥ 0`.
  Air units pushed past the Gate get "blown out" for a short off-map time and then return.
  This avoids RR's bug where units got pushed off the map for good.
- **Pull** (Hook-type): snaps the target `d` toward the tower's nearest road point plus a slow.
- **Knockback** (explosions, Bowling): small `d` reduction plus a brief stagger.
- **Diminishing returns:** each unit has a displacement budget per 3s window, so it can't be juggled
  forever. Bosses get 25% displacement.

### 4.4 Blocking and melee
- **Blockers** (Barracks soldiers, some heroes, Barricade skill) stand on road tiles. The first ground
  enemy that reaches a blocker stops and fights it (enemy DPS vs. blocker HP).
  A blocker holds `blockCount` enemies at once. Extra enemies walk past.
- Fast enemies flagged `unblockable` (e.g. Dasher while sprinting) ignore blockers.

### 4.5 Enemies hitting back
RR's later enemies attack defenses (Siegebreaker rockets, Frostlance stuns, EMP Droid). We model:
- **Disable**, not destroy: towers have an **Integrity** bar. At 0 the tower is knocked out for 8s, then reboots.
  You never permanently lose a tower to enemy fire.
- Stun / EMP effects on towers have short durations with a visible effect.
- Soldiers and heroes have HP. Heroes respawn after 10s, soldiers on the tower's cooldown.

### 4.6 Attacks and projectiles

| Delivery | Behavior | Examples |
|---|---|---|
| **Hitscan** | Instant hit, tracer VFX | Gatling, Railgun |
| **Homing** | Never misses, travel time | Missile tower, Boomerang |
| **Ballistic** | Arcs to the *predicted* position. AoE on landing. **Can miss** fast units. | Cannon, Mortar |
| **Beam** | Continuous, damage ramps in 3 stages while it stays on one target | Prism Laser, Nexus-style line beam |
| **Chain** | Jumps N times to the nearest unchained enemy within 1.5 tiles, −15% damage per jump | Tesla |
| **Cone** | Ticks damage + burn in a 60° cone | Flamethrower |
| **Rolling** | Spawns a ball that rolls *backward along the road* from the tower's nearest road point, hitting everything | Bowling |
| **Trap** | Placed on a road tile, triggers on contact, has charges / re-arm time | Mine, Spike |
| **Summon** | Spawns soldiers or drones with HP | Barracks, Drone Bay |
| **Aura** | Buffs or debuffs in a radius | Amplifier (towers), Disco (enemies) |

- **Attack speed** is in attacks per minute (RR-style): Gatling 150 = 2.5 shots/s.
- **Range** is in tiles, from the tower center. Some towers have a **minimum range** (Railgun, Mortar dead zone).
- **Targeting priority** (per tower, tap to cycle): First · Last · Strongest · Weakest · Closest.
- **Target filter:** Ground / Air / Both. This is a hard rule.

### 4.7 Damage formula
```
raw   = base × levelMult(level) × rarityMult(rarity) × starMult(stars)
hit   = raw × classMult(attacker, target)       // 1.2 strong / 0.8 weak / 1.0
          × (crit ? critDmg : 1)                 // default critDmg 2.0
          × (1 + Σ damageAmp)                    // Shock, Weak-spot, Amplifier...
final = max(hit − armor, hit × 0.1)              // armor is flat; at least 10% gets through
shield absorbs final first; shields take ×1.5 from Elemental (shield-breaker role)
```

### 4.8 Status effects
| Status | Rule |
|---|---|
| Slow | Strongest slow wins (no stacking). Max 70%. Bosses take half. |
| Freeze | Slow at the 70% cap for 1.5s → 1s freeze, then 3s immunity |
| Stun | Hard stop. Diminishing returns ×0.5 per repeat within 4s. |
| Burn | DoT. Re-applying refreshes duration and keeps the highest tick. |
| Shock | Target takes +15% damage for 3s |
| Dance | Enemy stops and dances (can't move or attack) for X s. Bosses immune. |
| Chicken | (later) Polymorph to a harmless chicken for 2s. Bosses immune. |

---

## 5. Content roster (RR archetypes, original names)

### 5.1 Towers
★ = Endless MVP set (12). Each tower has a **6-star perk track**: stats at ★1–2, a mechanic change at ★3,
stats at ★4–5, and a showpiece at ★6 with a visible model upgrade.

| Tower | RR archetype | Class | Hits | Delivery | ★3 / ★6 perks (examples) |
|---|---|---|---|---|---|
| ★ Cannon | Cannon | Vanguard | G | Ballistic AoE | Knockback / cluster shells |
| ★ Skyguard | Sky Guard | Vanguard | A | Homing burst | Flak cloud lingers / 2 targets |
| ★ Railgun | Sniper | Vanguard | G+A | Hitscan pierce | Pierce +2 / charged mega-shot every 5th |
| Mortar | Mortar | Vanguard | G | Ballistic, long range | Burning crater / triple shell |
| ★ Gatling | Vulcan | Swift | G+A | Hitscan | Spin-up / crits shred armor |
| ★ Barracks | Garrison | Swift | G | Summon blockers | 3rd soldier / soldiers taunt |
| Boomerang | Boomerang | Swift | G+A | Homing pierce | Returns twice / ricochet |
| ★ Spike Strip | Spike | Swift | G | Trap | Bleed / stuns elites |
| ★ Tesla | Tesla | Elemental | G+A | Chain | +2 jumps / overload burst |
| ★ Frost Gun | Frost Gun | Elemental | G+A | Projectile slow | Freeze shatter AoE / slow aura |
| ★ Prism Laser | Laser | Elemental | G+A | Ramp beam | Faster ramp / splits to 2 |
| Flamethrower | Inferno | Elemental | G | Cone burn | Burn spreads / wider cone |
| ★ Gust Fan | Wind Blower | Utility | G+A | Push | Stronger push on air / gust stuns |
| ★ Grapple | Hook | Utility | G+A | Pull + slow | +1 hook / pulled take +dmg |
| Bowler | Bowling | Utility | G | Rolling stun | Bigger ball / 2 balls |
| Disco Beacon | Disco Ball | Utility | G | Aura dance | Longer dance / +dmg taken |
| Amplifier | Support | Utility | — | Aura buff adjacent | Radius 2 / +crit to buffed |

### 5.2 Skills (4 for the MVP, 8 total)
Orbital Strike (V), Carpet Bomb (V, drag a line), Blizzard (E), Chain Storm (E, top-5 HP targets),
Caltrops (S), Rally (S, +atk speed), Barricade (U, road wall), Repair Drones (U).

### 5.3 Heroes (2 for the MVP, 4 total)
Vex (Vanguard mech, *Siege Mode*), Kira (Swift blade dancer, blocks + dashes), Sol (Elemental storm mage),
Bolt & Byte (Utility engineer + robot dog). A hero levels up within the run from nearby kills, has a special
that charges with damage dealt, and an aura for towers of its class.

### 5.4 Enemies
★ = Endless MVP set (8).

| Enemy | Class | Type | Trait |
|---|---|---|---|
| ★ Scrapper | Swift | G | Basic |
| ★ Dasher | Swift | G | Fast. Unblockable while sprinting. |
| ★ Brute | Vanguard | G | Armor |
| ★ Buzzer | Swift | A | Swarms |
| ★ Bomber | Vanguard | A | Tanky flyer, big fortress damage |
| ★ Medic | Utility | G | Heals nearby allies (RR "Doctor") |
| ★ Shellback | Vanguard | G | Shield (needs Elemental / burst) |
| ★ Splitter | Elemental | G | Splits into 3 on death |
| Rocketeer | Vanguard | G | Ranged: damages tower Integrity (RR "Siegebreaker") |
| Frostblade | Elemental | G | Melee: stuns blockers and adjacent towers (RR "Frostlance") |
| EMP Drone | Utility | A | On death disables towers in a radius |
| Burrower | Elemental | G | Untargetable underground 2s every 6s |
| Juggernaut | Vanguard | G | Slow-immune, huge HP |
| Warden | Utility | G | Shield aura for allies |

**Elites:** ×2.5 HP, glowing outline, plus 1 affix (Hasted / Regenerating / Shielded / Explosive / Vampiric).

### 5.5 Bosses (Endless rotates them every 10 waves)
Iron Colossus (stomp disables towers, spawns Scrappers) · Sky Leviathan (air, drops Buzzers) ·
Frost Wyrm (freezes a tower column) · Neon Phantom (decoys) · Magma Titan (burning road heals fire units) ·
Rift Sovereign (changes class each phase). Each has a telegraph, 2–3 phases and an intro cinematic.

---

## 6. ENDLESS MODE (first shippable mode)

Based on Raid Rush's *Endless Battle*: survive as long as you can while the battlefield turns against you.

### 6.1 Run structure
- **Board:** 13×21, starting island ~4×5 around the fortress, plus scattered obstacles, water and **power tiles**
  (seeded per run). The board shape is a seeded "map preset" (Plains, Islands, Canyon...).
- **Waves:** a new wave every **15s** (or immediately with **Call Early**, +25% XP from it). Waves overlap.
  The wave counter is your **score**.
- **Wave budget:** each wave has a threat budget `B(w) = 10 × 1.085^w`. The generator spends it on enemies
  allowed by the current phase, with templates (rush, swarm, air raid, tank column, mixed) so waves feel designed, not random.
- **HP scaling:** enemy HP × `1.06^w` past wave 20 (tuned by sim). Bosses on every 10th wave.
- **Fortress:** 100 HP, no regen except Repair cards and Workshop perks. **Last Stand** once per run.

### 6.2 Pressure Phases (RR's escalators)
| Waves | Phase | New pressure |
|---|---|---|
| 1–10 | **Setup** | Basic units, generous XP, Field cards weighted up |
| 11–20 | **Raid** | Air waves, Medics, first boss at 10 & 20 |
| 21–35 | **Elite** | Elites appear (10% → 30%), Shellbacks, Rocketeers |
| 36–50 | **Siege** | **Shielded** waves, EMP Drones, two-boss waves |
| 51–70 | **Collapse** | **Placing a tower cracks 1 adjacent land tile** (it becomes a chasm after 20s) |
| 71+ | **Starvation** | **XP per kill decays 3% per wave** (min 30%), elite affixes stack |

A banner slams in at each phase change, and the music shifts up a layer.

### 6.3 Milestones and rewards
- Every 10 waves: a **Supply Drop** (gold + card copies), plus a spin of the **Lucky Machine** (a 3-reel slot with
  reward tiers, a nod to RR's Endless "Lucky Machine").
- End of run: gold and copies scale with waves survived. **First-time records** (new best wave) give a bonus crate.
- **Depth unlocks:** reaching waves 10/20/30/... the first time unlocks new towers, skills, the 2nd hero, and the Workshop.
  This makes Endless a complete progression loop on its own.
- **Local records:** best wave, fastest wave-50, best per deck, run history with seed and deck. Any run can be replayed from its seed plus command log.

### 6.4 Endless variants (cheap once the base works)
- **Daily Endless:** the date sets the seed, map and deck. Compare against your own past days.
- **Mutators:** pick optional modifiers (×1.5 score each): no Field cards, double air, fog of war, glass fortress.

---

## 7. Meta progression (RR-style, offline-friendly)

- **Collection:** every tower, skill and hero is a card with **Rarity** and **Level**.
- **Rarity (RR ladder, trimmed):** Common → Good → Rare → Epic → Legendary → Relic → Supreme.
  **Merge identical copies:** 3 copies (Common–Rare), 2 copies (Epic+). **Jokers** come from trading in
  spare cards of the same rarity. Rarity raises the stat multiplier and the level cap.
- **Level:** costs gold + blueprints (blueprints are tower-specific and drop from runs).
  Caps: Common 10 → Supreme 70.
- **Workshop** (permanent): fortress HP, Last Stand strength, +1 refresh, starting land size, class damage,
  hero charge. Paid with **Medals** earned from wave milestones and records.
- **Crates** open instantly with a big animation. No timers or keys.
- **Currencies:** Gold, Blueprints, Medals. That's all.

---

## 8. UX

**Flow:** Title → Home (3D fortress diorama, "Play Endless" big button) → Deck (6 towers, 2 skills, 1 hero, with
enemy-class preview of the next phases) → Battle → Results (wave, records, rewards) → Crate.
Later: Campaign chapter map, Collection, Workshop, Settings.

**Battle HUD (portrait):**
- Top: wave counter + phase name, next-wave timer, fortress HP, pause.
- Bottom: XP bar, skill buttons, hero portrait/special, speed (1x/2x/3x), Call Early.
- Long-press anything for its stats. Range circles show while dragging. Damage meter panel is optional.

**Accessibility:** class shown by color **and** icon shape, reduced shake/flash toggles, text size, left-handed HUD.

---

## 9. Balance method
- All numbers live in `data/` (towers, enemies, curves, phase table, wave templates).
- **Headless simulator + autoplay AI:** `npm run sim -- --mode endless --deck starter --runs 500`
  → median wave reached, death cause, damage share per tower, pick rates.
- Targets for v1 Endless with the starter deck and no upgrades: median wave ~25. Fully upgraded, a strong
  player should reach 80–120. No single tower over 30% damage share across sampled decks.
