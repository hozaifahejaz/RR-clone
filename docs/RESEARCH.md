# Raid Rush — Game Research

Research notes on **Raid Rush: Tower Defense TD** to guide a web clone.
Researched October 2026 (current game version ~1.499).

Confidence markers:
- ✅ **Confirmed**: official source (raidrush.com blog / patch notes, App Store listing)
- 🟡 **Likely**: fan guides, or inferred from official notes
- ❓ **Unverified**: needs hands-on play or video review to confirm

---

## 1. Overview

| | |
|---|---|
| Title | Raid Rush: Tower Defense TD |
| Developer / Publisher | Panteon (Istanbul, Turkey) ✅ |
| Released | Dec 16, 2022 (Android) ✅ |
| Platforms | iOS, Android, Mac (Apple Silicon), visionOS ✅ |
| Genre | Roguelite card-draft tower defense ✅ |
| Rating | 4.5★ on ~55K App Store ratings ✅ |
| Business model | F2P: IAP packs ($1.99–$49.99), Monthly / Mega Monthly / Permanent Favor cards, Autoplay weekly sub ($7.99), 4x speed via monthly sub, rewarded ads, web store with "RR Credits" ✅ |
| Setting | Sci-fi / mechs / modern military with whimsical towers (Disco Ball, Bowling) and licensed collabs (Terminator 2) ✅ |

**The pitch in one sentence:** a tower defense game where you *don't* get the
map up front. You draft the road the enemies walk and the towers that guard
it one card at a time, from a 6-tower deck you built before the battle.

---

## 2. Core battle loop

### 2.1 The board ✅/🟡
- Grid of land tiles with a **Fortress** (your base, has HP) and an enemy
  **spawn portal**.
- Enemies walk along a **road**. You build the road yourself by placing
  **Path cards**, which extend the route toward your fortress. ✅
- Towers sit on land tiles next to the road. Some "towers" are **traps** placed on
  the road itself (Mine, Spike, Garrison troops). ✅ (Overwatch "buffs Towers & Traps")
- Some modifiers make **tower placement destroy land tiles**, which cuts down
  future placement options. ✅ (Epic++, Elite League)
- Maps can include **obstacles**. ✅ (Epic+++: "More map obstacles")

### 2.2 Drafting during battle ✅
1. Enemies come in **waves**. Killing them gives **battle XP**.
2. When the XP bar fills, you **level up** and pick **1 of 3 random cards**.
3. The card pool is built from your loadout plus generic cards:
   - **Tower cards** (from your 6-tower deck): place a new tower
   - **Path cards**: extend or reshape the enemy route
   - **Skill cards** (from your 2 skills): active abilities on cooldown
   - **Hero card**: deploys your hero, who has a special skill
   - **Upgrade cards** (in-battle "Star upgrades"): per-tower-type stat boosts
     such as hook count, cooldown reduction, or range 🟡
4. Waves get harder and the last wave usually has a **boss**.
5. If the fortress HP hits 0 you lose, though **Revives** are available
   (gems or ads). ✅
6. Refreshing the card offer costs gems. 🟡

Official notes say "XP gained from defeated enemies will decrease, limiting the
number of cards you can play", so **XP is the main pacing lever**.

### 2.3 Speed and automation ✅
- 1x / 2x by default. 4x is a subscription perk.
- **Autoplay** (subscription) scores the offered cards and picks
  towers, skills, heroes, upgrades and paths automatically.
- Pause screen shows revives left, boss info and kill count.

---

## 3. Loadout (pre-battle deck) ✅

Each deck has:
- **6 Towers**, all different
- **2 Skills**
- **1 Hero**
- **Fortress** upgrades (permanent, account-wide)

### 3.1 Class system (rock-paper-scissors) ✅
Units deal **+20% damage** to the class they're strong against and
**−20%** to the class they're weak against.

```
Vanguard ──beats──▶ Swift ──beats──▶ Elemental ──beats──▶ Vanguard
                 Utility (support role; neutral)
```

Every chapter shows the enemy classes, so you build your deck against them.

### 3.2 Known towers by class ✅

| Class | Towers / traps / skills |
|---|---|
| **Vanguard** | Cannon, Mortar, Sky Guard (AA), Mine, Double Cannon, Sniper, Aeroblast, Ballista, Eagle Eye*; skills: Boom Blast, Tough Wall, Airstrike* |
| **Swift** | Vulcan, Boomerang, Garrison, Drone Launcher, Spike, Multi Barrel, Stronghold*; skills: Boom Rain (Bomb Rain), Troop Calls |
| **Elemental** | Tesla, Laser, Frost Gun, Fireworks, Inferno, Tornado, Mecha Nest, Flame, Spark Link*; skills: Frostfall, Earth Attack, Electro Path, Thunderstrike |
| **Utility** | Hook, Bowling, Wind Blower (Air Blower), Disco Ball, Support, Overwatch*; skills: Combat Charge, Sleep Mist, Divine Defense, Magnetic Wall* |
| Unclassified | Fury Tower* (missiles, AoE burst after sustained fire), Gambler (crit gimmick) |

\* = "Special" cards, which come from events and can't be upgraded with Jokers.

Towers target **Ground**, **Air**, or both. Fan guides recommend this deck shape:
1 ground single-target boss killer, 1 anti-air, 2 hybrid
air/ground towers, and 2 support/control towers. 🟡

### 3.3 Example tower mechanics (from balance notes) ✅
| Tower | Mechanic |
|---|---|
| Laser | Damage ramps in 3 stages (80 → 270 → 430) while it stays on target |
| Inferno | Base damage + DoT (60 dmg, 10s DoT) |
| Multi Barrel | High crit (40/60/80% by tier), 120 dmg, attack speed 125 |
| Boomerang | Crit 20/25/35%, 145 dmg, crowd control |
| Wind Blower | Pushes enemies back along the path (push 0.3) |
| Hook | Slows / pulls enemies; star upgrades add hook count and length |
| Sniper | Long range with a **minimum-range dead zone** |
| Tesla / Spark Link | Chain lightning |
| Garrison / Stronghold | Spawns melee soldiers that block the road |
| Bowling | Stun |
| Disco Ball | "Dance" (crowd control that makes enemies stop and dance) |
| Overwatch | Drones that buff nearby towers (HP, dmg, crit, push, dance duration) |

### 3.4 Heroes ✅
Unlocked at account level 7. 🟡 Each hero has a class, an auto-attack,
a **special skill**, and **passives** that unlock with stars/levels, mostly buffing
towers of the same class.

| Hero | Class | Notes |
|---|---|---|
| Astra | Vanguard | Spinfinity event hero |
| Thorn, Brim | Vanguard | Brim L3 passive: −10% HP to Vanguard enemies |
| Mai | Swift | Air+ground; L30 passive +50% crit to Swift towers 🟡 |
| Kenji | Swift | |
| Jaden | Swift (Relic) | Dual pistols; special "Bullet Rain" spin |
| Osiris, Lily, Orion | Elemental | Lily: electric damage |
| Toby & Bobby | Elemental (Legendary) | Revolver plus a dog that dashes and stuns ("Guardian's Fury") |

### 3.5 Enemies ✅
- **Types:** Ground and Air. **Elite** variants have higher stats. **Shielded** enemies appear in endgame.
- **Support enemies:** Doctor heals nearby enemies over time. Protector and EMP Droid
  (Utility) probably shield allies or disable towers. 🟡
- **Movement speed is capped** globally.

| Class | Regular | Bosses |
|---|---|---|
| Vanguard | Heavy Infantry, Heavy Bomber, Hoverbike, Hammerlord | Big Horn, Khepri, Skylord, Augustus X, Easterminator |
| Swift | Infantry, Air Striker, Ranger, Phantom Striker, Mechabeast, Blade Sentinel | Juggernaut, Havoc, Freya, Leviathan, Beach Saber |
| Elemental | Fire Blaster, Laser Drone, Toxic Terror | Starbreaker, Riftwalker, Santatron, Pumpkin Head, Driller, Fireclaw |
| Utility | Protector, Demolisher, EMP Droid, Doctor | — |

---

## 4. Meta progression

### 4.1 Card rarity ladder ✅
```
Common → Good → Rare → Epic → Epic+ → Legendary → Legendary+ → Relic → Relic+ → Supreme → Supreme+ → Eternal
```
- **Merging:** Common/Good/Rare need **3 identical** cards to go up a tier.
  Epic and above need **2 identical** cards.
- **Supreme+:** 2× Supreme, raises the level cap to 110.
- **Eternal:** 2× Supreme+ plus a **Fusion Core**, raises the level cap to 150 (Nano Cubes needed past 110).
- **Levels:** max 100 before Supreme+. Upgrades cost **gold + blueprints** of that tower. 🟡
- **Joker Exchange:** trade unused same-rarity cards for a **Joker**, which works as
  any card of that rarity in a merge. Not allowed for Special cards.
- **Salvage:** dismantle Legendary+ cards into Chips or Nano Cubes.
- **Stars:** each tower or hero has passives that unlock through upgrades. 🟡

### 4.2 Core Parts (gear sockets) ✅
Legendary+ towers and skills get **3 sockets**: Primary, Secondary, Utility.
Upgrading parts costs **Cyber Hammers**. Exchange: 3 parts → 1 Joker part.

| Primary | Secondary | Utility |
|---|---|---|
| Power Strike (+base dmg) | Rapid Fire (+atk spd) | Frost Touch (slow) |
| Lingering Pain (DoT) | Sharp Eyes (+crit chance) | Stun Shot (mini-stun) |
| Deadly Blow (+crit dmg) | Boosted Sight (+range) | Broken Spirit (−enemy dmg) |
| Exploding Burst (on-death explosion) | Weak Spot (enemies take +dmg) | Fear Backlash* (enemies flee) |
| Lightning Blast (random lightning) | | Fowl Play (turns enemies into chickens) |
| Blood Hunt* (bonus vs low-HP) | | |

### 4.3 Fortress upgrades ✅
Permanent upgrades bought with **Permanent Upgrade Tokens** from Epic Challenges:
tower damage, hero damage, gold drop, skill damage, fortress HP regen.

### 4.4 Currencies and items
| Item | Use |
|---|---|
| Gold | Card upgrades; also earned offline ✅ |
| Gems | Premium: heroes, revives, refreshes, chests ✅ |
| Blueprints | Per-tower upgrade material 🟡 |
| Hero Shards / Hero Dust | Hero upgrades; Hero Exchange turns spare shards into joker shards ✅ |
| Keys (Gold, High Power Supplies) | Open chests ✅ |
| Cyber Hammer | Core Part upgrades ✅ |
| Chips | Salvage output / upgrade material ✅ |
| Nano Cube, Fusion Core | Endgame upgrades (Elite Shop only) ✅ |
| Permanent Upgrade Token | Fortress upgrades ✅ |
| Clan Coins, Elite Coins, Spark, Brawl Coins | Shop currencies ✅ |
| Boss Brawl Tickets | Mode entry ✅ |

### 4.5 Chests ✅
Clash-Royale-style chest slots: you win chests in battle and they take time to unlock.
Known chests: Standard, Obsidian, Royal, High Power Supplies, Retro Special
(pity: a Legendary every 60 opens). Unwanted chests can be removed by watching an ad.
Chests have **wishlists**.

### 4.6 Account level
Account XP comes from battles, scaled by difficulty, and gives gems and gifts on level-up. 🟡

---

## 5. Game modes ✅

| Mode | Summary |
|---|---|
| **Campaign** | Chapters 1–110, each a themed map (e.g. Ch.66 Botanical Garden, Ch.100 Raid Gateway). 5 new chapters per update. |
| **Epic Mode / Challenges** | Harder replay of a chapter with 3 modifier tiers: **Epic+** (buff: +range; debuff: stronger elites), **Epic++** (2x hero dmg; stronger elites, placing towers destroys land), **Epic+++** (more card draws; max-stat elites, more obstacles, shielded enemies, land destruction). Main farm for blueprints. |
| **Speed Run** | Unlocked after Epic+++. Fastest-clear leaderboard at a fixed 2x speed, rarity caps, timer pauses during card picks. |
| **PvP Arena** | Unlocked at Ch.12. Async/real-time duel where you destroy the opponent's fortress. **Trick Cards** (Voltage Shock, Gridlock, Power Drain, Swift Drift) disrupt the opponent, **Power Grids** are bonus tiles, matchmaking uses **PvP Power**, and trophies decide 4+ arenas. Offline defense battles give gold. "Battle Fever": 5 wins in a row gives perks. |
| **Endless Battle** | Timed event with endless waves, league tiers, and a "Lucky Machine". Gets harsher over time (land destruction, shields, less XP). |
| **Boss Brawl** | Clan event: 3-day prep plus 6-day attack, 30 boss chapters, 1 free daily ticket (+2 from ads), stage skip. |
| **Clan War** | 5 clans. Each player registers up to 4 non-overlapping decks. Attack rival decks once per day; wins deal damage equal to their deck power. The clan with the most Castle HP left wins. |
| **Elite League** | Post-campaign. 2-week seasons with 1 buff and 3 debuffs, class bans, and Elite Shop rewards. |
| **Weekend / Mayhem / Lottery / Spinfinity / Fishing Frenzy** | Rotating live events with their own currencies, exclusive towers and heroes. |

### Social and live ops ✅
Clans (chat, card requests, clan shop), seasonal **Album** sticker collections,
Battle Pass, Brawl Pass, Hero Pass, daily quests, mail, flash offers, leaderboards,
and Game Center / Play Games achievements.

---

## 6. What makes it fun (design takeaways)

1. **You build the maze.** Path cards turn every run into a puzzle. The best players
   loop the road back past the same kill zone.
2. **Luck you can steer.** You pick 1 of 3, so you have agency, but the card offer
   is random enough that you have to adapt.
3. **Short sessions.** One chapter takes a few minutes.
4. **Counter-building.** The class triangle plus air/ground split means your deck
   should change from chapter to chapter.
5. **Deep collection.** Dozens of towers × 12 rarities × levels × core parts.

---

## 7. Legal note for the clone

Game mechanics can't be copyrighted, but **names, art, audio, logos and text
can**, and "Raid Rush" is a trademark. The clone should:
- use an **original title** and original tower, hero and enemy names
  (the reference names above are for research only)
- use original or properly licensed art and sound (e.g. CC0 packs like Kenney.nl)
- avoid copying Panteon's UI layouts pixel-for-pixel, along with their text and collab IP (Terminator)

---

## Sources
- App Store listing: https://apps.apple.com/us/app/-/id1662335371
- Google Play listing: https://play.google.com/store/apps/details?id=com.wireless.defenseland
- Official blog: https://raidrush.com/en/blog
  - Classes guide (/5581), Merge guide (/5540), Joker Exchange (/5519), Core Parts (/5867),
    Epic Challenges (/5664), Clan War (/6541), Patch notes 1.400 (/5441), 1.410 (/5733),
    1.420 (/5858), 1.430 (/6039), 1.460 (/6537), 1.470 (/6711), 1.480 (/6864), 1.495 (/7035)
- GameFAQs release data: https://gamefaqs.gamespot.com/android/439728-raid-rush-tower-defense-td/data
- Fan guide (GrindnStrat): https://grindnstrat.com/raid-rush-guide/
- ChapterCheats hints: https://www.chaptercheats.com/cheat/android/649923/raid-rush-tower-defense-td/hint/201263
