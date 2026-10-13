# Game Design Document

A single-player, offline tower defense game built on Raid Rush's core idea:
**you draft the road and the defenses one card at a time.**
See [`RESEARCH.md`](./RESEARCH.md) for the original game and [`PLAN.md`](./PLAN.md) for the build roadmap.

All names here are original placeholders (no Raid Rush IP).

---

## 1. Design pillars

1. **You build the maze.** Every run is a spatial puzzle: where does the road go, and what guards each bend?
2. **Steerable luck.** Pick 1 of 3 cards each level-up. The offer is random, but the weighting rules
   guarantee you're never stuck with no path card or no tower.
3. **Counter-building.** Class triangle × air/ground × enemy abilities means the deck you bring matters.
4. **Short and punchy.** A chapter run takes 4–6 minutes. One more run, every time.
5. **Respect the player.** It's an offline game for one player, so there are no timers, energy, ads or paywalls.
   Progression is generous and progress always comes from playing.

---

## 2. The battle

### 2.1 Board
- Square tile grid, **9 columns × 15 rows**, viewed from a tilted 3D camera in portrait.
- **Fortress** (2×2) at the bottom center. **Enemy Gate** (the portal) sits at the end of the road.
- Tile types:

| Tile | Rule |
|---|---|
| Land | Towers can be built here |
| Road | Enemies walk on it. Traps go here. |
| Obstacle | Rocks, trees, ruins. Blocks everything. Some can be cleared by skills. |
| Water / chasm | Blocks road and towers. Air enemies fly over it. |
| **Power tile** | Glowing tile. A tower built on it gets +25% damage (or a biome-specific bonus). |
| Cracked land | Collapses into a chasm after a tower is placed next to it (Epic modifiers). |

### 2.2 The road: "Extending Gate" model
Our version of the Raid Rush mechanic, designed to be simple and readable:

- The run starts with a **short road** of 3 tiles from the fortress, with the **Gate at its end**.
- A **Path card** is a road piece of 2–5 tiles. You attach it to the Gate end, and the
  **Gate moves to the new end**. Every path card makes the enemies' route longer.
- The road **is always connected** from Gate to Fortress, so enemies always have a valid route
  and the game never has to ask what happens before the road connects.
- Placement: drag the piece and it snaps to the Gate. Tap to rotate or mirror. Valid placements show a green
  ghost and blocked ones show red. The road can't overlap itself, obstacles or towers.
- If no valid placement exists for an offered path piece, it isn't offered (see draft rules).
- Enemies already on the field keep walking. New enemies spawn from the new Gate position.
  The old Gate plays a "portal collapse" effect.

**Path piece set** (rarity sets how often each is offered):

| Piece | Tiles | Shape | Notes |
|---|---|---|---|
| Straight | 2 | `I` | Common filler |
| Long Straight | 4 | `IIII` | Big length gain, hard to fit late |
| Corner | 3 | `L` | Common |
| Zig | 4 | `S` / `Z` | Creates two bends: great kill zones |
| Hairpin | 5 | `U` | Doubles back. Enemies pass the same towers twice. |
| Spiral | 5 | hook | Rare. Coils around a 1-tile pocket, perfect for one strong tower. |
| Bridge | 2 | `I` | Can cross water / chasm tiles |

The skill ceiling comes from **using land efficiently.** You have a limited board, and the best runs coil
the road around a few high-value tower spots and power tiles.

### 2.3 Drafting
- Killing an enemy drops **XP orbs** that fly to the XP bar. When the bar fills, the game slows to 10%,
  the board blurs, and **3 cards fan in**. You pick one. Rerolls: 1 free per run, more from Workshop upgrades.
- XP to next level: `xpNeeded(n) = round(8 + 5n + 0.6n²)`. This is tuned for roughly **16–20 picks per
  normal chapter**. Pacing gets checked with the headless simulator.

**Card types in the pool:**

| Card | Source | Effect |
|---|---|---|
| Tower | Your 6 deck towers | Place one tower of that type |
| Path | Global path set | Extend the road |
| Star Upgrade | Towers already on the board | +1 star to **all** towers of that type (max 5★). Each star is a named perk. |
| Skill | Your 2 deck skills | First pick unlocks the skill button, later picks empower it |
| Hero | Your deck hero | Once per run. Place the hero on a land tile. |
| Fortress | Global | Repair 25% HP, or +1 fortress turret |

**Weighting rules** (`draft.ts`):
1. Picks 1–2 always include at least one Path and one Tower.
2. If the road length is under the target for the current wave, path weight goes up.
3. If there are 0 towers that can hit air and air enemies are coming in the next 2 waves, an AA tower is guaranteed.
4. Star upgrades only appear for tower types already on the board, and their weight scales with tower count.
5. You never get 3 copies of the same card. The pool shrinks as cards hit their caps.
6. "Pity" counters stop long streaks without a card type you need.

### 2.4 Waves and pacing
- Normal chapter: **10 waves**, and the last one is a **boss**. Boss chapters (every 5th) have a mid-boss on wave 5.
- Waves are authored in JSON as spawn groups: `{enemy, count, interval, delay, elite?}`.
  An overlap of 2–4 seconds keeps the pressure on.
- **Call Early** button: start the next wave now for +30% XP from it, which rewards confident players.
- A chapter's enemy classes and air/ground mix are previewed before battle so you can pick your deck.

### 2.5 Combat model
- **Fixed tick: 30 Hz.** Rendering interpolates between ticks.
- **Damage:** `dmg = base × levelMult × rarityMult × classMult × critMult × (1 + buffs) − armor`, with a minimum of 10% of base.
- **Class triangle:** Vanguard > Swift > Elemental > Vanguard at ×1.2 / ×0.8. Utility is neutral.
- **Targeting modes** (cycle by tapping a tower): First, Last, Strongest, Closest.
- **Status effects:** Slow (stacks diminish), Stun, Burn (DoT), Shock (damage amp), Push-back, Pull,
  Freeze (stun from max slow), Dance (confused, wanders back along the road). Bosses take 50% duration.
- **Air units** fly a smoothed version of the road with a small shortcut, so they're slightly faster to the fortress.

### 2.6 Fortress, losing, Last Stand
- Fortress HP: 100. Each enemy deals damage by type (grunt 2, brute 8, boss 40+).
- **Last Stand:** once per run, the first time HP hits 0, a shockwave clears the screen and you revive at 30% HP.
- **Chapter stars:** ★ clear, ★★ ≥50% HP, ★★★ ≥90% HP. Stars feed the Workshop.

---

## 3. Content: v1 roster

### 3.1 Towers (16: 4 per class)
Each tower has 5 star perks unlocked in order during a run. Examples are shown below. The full perk table lives in `data/towers.ts`.

| Tower | Class | Hits | Role | Signature / star perks (examples) |
|---|---|---|---|---|
| **Cannon** | Vanguard | Ground | Splash | Bigger splash · knockback · cluster shells |
| **Flak Battery** | Vanguard | Air | Anti-air burst | Flak clouds linger · +shots per burst |
| **Railgun** | Vanguard | Both | Sniper, pierces in a line | Min-range dead zone · charge shot · pierce +2 |
| **Mortar** | Vanguard | Ground | Long-range AoE | Burning craters · double shell |
| **Gatling** | Swift | Both | Fast single target, crit | Spin-up attack speed · crits shred armor |
| **Barracks** | Swift | Ground | Spawns 3 soldiers that block the road | +soldier · soldiers taunt · respawn faster |
| **Boomerang** | Swift | Both | Out-and-back pierce | Ricochet · returns twice |
| **Spike Trap** | Swift | Ground | Road trap, damages on contact | Bleed · re-arms faster · stuns elites |
| **Tesla Coil** | Elemental | Both | Chain lightning | +chain jumps · Shock amp · storm overload |
| **Frost Cannon** | Elemental | Both | Slow → Freeze | Freeze shatters for AoE · slow aura |
| **Prism Laser** | Elemental | Both | Ramping beam (3 stages) | Faster ramp · beam splits to 2 targets |
| **Flamethrower** | Elemental | Ground | Cone, burn DoT | Burn spreads on death · wider cone |
| **Gust Fan** | Utility | Both | Pushes enemies back | Air units get pushed further · gust stuns |
| **Gravity Hook** | Utility | Both | Pulls and slows | +hooks · pulled enemies take +dmg |
| **Disco Beacon** | Utility | Both | Makes enemies dance (stop/turn back) | Longer dance · dancing enemies take +dmg |
| **Amplifier** | Utility | — | Buffs adjacent towers (+dmg/+atk spd) | Larger radius · +crit to buffed towers |

**Tower roles to make sure every deck needs:** a boss killer, AoE clear, anti-air, and control.

### 3.2 Skills (8)
Active abilities with a cooldown. You tap the button, aim on the board, and release.

| Skill | Class | Effect |
|---|---|---|
| Orbital Strike | Vanguard | Huge single-point blast after a 1s telegraph |
| Carpet Bomb | Vanguard | Line of explosions along a dragged path |
| Blizzard | Elemental | Area slow + freeze pulses |
| Chain Storm | Elemental | Lightning hits the 5 highest-HP enemies |
| Caltrops | Swift | Scatter spike traps on the road |
| Rally | Swift | All towers +40% attack speed for 8s |
| Barricade | Utility | Wall on the road. Enemies must break it. |
| Repair Drones | Utility | Heal the fortress over 6s |

### 3.3 Heroes (4: one per class)
A hero is placed once per run. It auto-attacks, levels up with kills during the run, and has a **special**
that charges with damage dealt (tap the hero portrait to fire). It also has a passive aura for towers of the same class.

| Hero | Class | Attack | Special | Passive |
|---|---|---|---|---|
| **Vex** (mech pilot) | Vanguard | Heavy cannon | *Siege Mode*: rooted, ×3 damage, splash | Vanguard towers +range |
| **Kira** (blade dancer) | Swift | Dashing melee | *Thousand Cuts*: dashes through 8 enemies | Swift towers +crit |
| **Sol** (storm mage) | Elemental | Arc bolts | *Tempest*: lightning storm for 6s | Elemental towers +status duration |
| **Bolt & Byte** (engineer + robot dog) | Utility | Wrench + bite | *Lockdown*: dog pins the strongest enemy | Utility towers +effect strength |

### 3.4 Enemies (14 + elites)

| Enemy | Class | Type | Trait |
|---|---|---|---|
| Scrapper | Swift | Ground | Basic |
| Dasher | Swift | Ground | Fast, low HP, sprints when hit |
| Brute | Vanguard | Ground | Tanky, armor |
| Shieldbearer | Vanguard | Ground | Front shield blocks projectiles until flanked or broken |
| Juggernaut | Vanguard | Ground | Armored and **immune to slow** |
| Medic | Utility | Ground | Heals nearby allies over time |
| EMP Drone | Utility | Air | Disables towers in a radius for 2s when it dies |
| Splitter | Elemental | Ground | Splits into 3 minis on death |
| Burrower | Elemental | Ground | Goes underground (untargetable) for 2s every 6s |
| Phase Walker | Elemental | Ground | Blinks 2 tiles forward when below 50% HP |
| Buzzer | Swift | Air | Basic flyer, comes in swarms |
| Bomber | Vanguard | Air | Tanky flyer, deals heavy fortress damage |
| Swarm Mite | Swift | Ground | Tiny, comes in groups of 20. AoE check. |
| Warden | Utility | Ground | Grants a shield aura to allies |

**Elites:** glowing outline, ×2.5 HP, plus one random affix (Hasted, Regenerating, Shielded, Explosive).

### 3.5 Bosses (6: one per biome)
Each has 2–3 phases, a clear telegraph, and an intro cinematic.

| Boss | Biome | Mechanic |
|---|---|---|
| **Iron Colossus** | Meadow Outpost | Stomp disables nearby towers. Spawns Scrappers. |
| **Dune Leviathan** | Sunscorch Ruins | Burrows, resurfaces further along the road |
| **Frost Wyrm** (air) | Frostpeak | Freezes a column of towers. Immune while diving. |
| **Neon Phantom** | Neon Sprawl | Splits into decoys. Only the real one takes damage. |
| **Magma Titan** | Ember Forge | Leaves burning road that heals fire enemies. Burn immune. |
| **Rift Sovereign** | Rift Core | Swaps its class every phase. Final boss. |

---

## 4. Meta progression (offline, generous)

### 4.1 Collection
- Every tower, skill and hero is a **card** with **Rarity** and **Level**.
- **Rarity:** Common → Rare → Epic → Legendary → Mythic. Rank up by collecting **shards** of that card
  (10 / 25 / 50 / 100). Each rarity raises base stats ×1.25 and unlocks a stronger version of one star perk.
- **Level:** 1 → 50, paid with **Gold**. The level cap goes up with rarity (Common 10, Rare 20, Epic 30, Legendary 40, Mythic 50).
- No duplicate-merging confusion: shards are the only rarity currency. **Wildcard shards** fit any card.

### 4.2 Rewards
- Every chapter clear gives Gold + a **Supply Crate** with shards. Crates open **instantly** with a satisfying
  animation. There are no timers.
- First clear gives a bigger crate and a guaranteed new card when one is available.
- Replays always give rewards, so farming is fine. Higher difficulty gives more.

### 4.3 Workshop (permanent upgrades)
Spend **Stars** earned from chapter ratings in a talent tree:
- Fortress: +HP, Last Stand heals more, +1 fortress turret
- Draft: +1 reroll, see 4 cards instead of 3 (late node), start with an extra path card
- Economy: +gold, +shard drops
- Combat: +5% damage per class, hero charges faster

### 4.4 Unlock pacing
| Chapter | Unlock |
|---|---|
| 1 | Tutorial: 3 towers, path cards |
| 2–4 | New tower each chapter, first star upgrades |
| 5 | First boss, **Skills** unlocked |
| 6 | Deck builder (choose 6 of your towers) |
| 8 | **Hero** unlocked |
| 10 | Workshop |
| 15 | Epic difficulty |
| 20 | Endless, Daily Challenge |

---

## 5. Modes (all offline)

| Mode | Description |
|---|---|
| **Campaign** | 30 chapters in 6 biomes (5 each, boss on every 5th). Each biome adds one enemy mechanic and one map feature (water + bridges, cracked land, power tiles, fog, conveyor road...). |
| **Epic tiers** | Replay a cleared chapter at Epic+ / ++ / +++. Each tier adds 1 buff + 1–3 debuffs from a modifier pool (elites, shields, land collapse, less XP, more obstacles). Best rewards. |
| **Endless** | Waves forever on a large board, scaling HP, local high score. |
| **Daily Challenge** | Seed from today's date: fixed deck, fixed modifiers, one attempt counts. Local streaks. |
| **Boss Rush** | Fight all unlocked bosses back to back. |
| **The Lab** | Sandbox: any tower, any level, spawn any enemy, infinite XP. Good for experimenting (and for testing). |

---

## 6. UX flow

```
Title → Home (Chapter map) ─┬─ Chapter details (enemy preview, stars, rewards) → Deck check → Battle → Results → Crate
                            ├─ Collection / Deck builder
                            ├─ Workshop
                            ├─ Modes (Epic, Endless, Daily, Boss Rush, Lab)
                            └─ Settings (graphics quality, audio, speed, accessibility, save export/import)
```

Battle HUD (portrait): top bar = wave counter, fortress HP, pause. Bottom = XP bar, skill buttons,
hero portrait, speed toggle (1x / 2x / 3x), Call Early.

Accessibility: colorblind-safe class colors (shapes + icons, not color alone), reduced screen shake toggle,
reduced flashing toggle, adjustable text size.

---

## 7. Balance approach
- All numbers live in data files. Stats are defined at Common/Lv1, and multipliers are global curves.
- **Headless simulator** runs N seeded games with the **autoplay AI** (`npm run sim -- --chapter 12 --deck X --runs 500`)
  and reports win rate, average HP left, per-tower damage share and pick rates.
- Targets: chapter N at the expected power level is about 70% win rate with an average player AI. No tower over 30%
  damage share across all decks.
