import type { TowerDef, TowerStats } from '../sim/types';

export function defaultStats(): TowerStats {
  return {
    dmg: 0, apm: 0, range: 0, minRange: 0, aoe: 0, crit: 0.05, critDmg: 2,
    slow: 0, slowDur: 0, stun: 0, push: 0, pull: 0, knock: 0, chains: 0, chainFalloff: 0.15,
    pierce: 0, burn: 0, burnDur: 0, shock: 0, count: 1, soldierHp: 0, blockCount: 0,
    coneDeg: 0, charges: 0, rearm: 0, dance: 0, buffDmg: 0, buffApm: 0, buffCrit: 0,
    buffRadius: 0, rampTime: 0, ramp2: 1, ramp3: 1, spinUp: 0, airMult: 1, every: 0,
    special: 0, splitTargets: 1, vulnerable: 0, armorShred: 0, crater: 0, rollLen: 0, auraSlow: 0,
  };
}

const p = (name: string, desc: string, apply: (s: TowerStats) => void) => ({ name, desc, apply });
const dmgUp = (pct: number) => p(`+${pct}% Damage`, `Damage +${pct}%`, (s) => (s.dmg *= 1 + pct / 100));
const apmUp = (pct: number) => p(`+${pct}% Fire Rate`, `Attack speed +${pct}%`, (s) => (s.apm *= 1 + pct / 100));
const rangeUp = (t: number) => p(`+${t} Range`, `Range +${t} tiles`, (s) => (s.range += t));

export const TOWERS: TowerDef[] = [
  // ───────────── VANGUARD ─────────────
  {
    id: 'cannon', name: 'Cannon', archetype: 'Cannon', cls: 'vanguard', targets: 'ground', delivery: 'ballistic',
    role: 'Splash', desc: 'Lobs explosive shells at ground enemies. Shells can miss fast movers.',
    base: { dmg: 54, apm: 38, range: 3.2, aoe: 0.9 },
    perks: [
      dmgUp(25),
      p('Concussion', 'Shells knock enemies back', (s) => (s.knock = 0.25)),
      p('Big Shells', 'Splash +25%, damage +15%', (s) => { s.aoe *= 1.25; s.dmg *= 1.15; }),
      apmUp(25),
      p('Cluster Shells', 'Each shell bursts into 3 bomblets', (s) => (s.special = 3)),
    ],
    color: 0xff8a3d,
  },
  {
    id: 'skyguard', name: 'Skyguard', archetype: 'Sky Guard', cls: 'vanguard', targets: 'air', delivery: 'homing',
    role: 'Anti-Air', desc: 'Fires bursts of homing missiles at flying enemies only.',
    base: { dmg: 30, apm: 34, range: 3.8, count: 3, aoe: 0.35 },
    perks: [
      dmgUp(25),
      p('Flak Cloud', 'Missiles leave a damaging flak cloud', (s) => (s.crater = 18)),
      p('+1 Missile', 'One extra missile per burst', (s) => (s.count += 1)),
      rangeUp(0.6),
      p('Twin Lock', 'Bursts split between 2 targets, +20% dmg', (s) => { s.splitTargets = 2; s.dmg *= 1.2; }),
    ],
    color: 0xffa860,
  },
  {
    id: 'railgun', name: 'Railgun', archetype: 'Sniper', cls: 'vanguard', targets: 'both', delivery: 'hitscan',
    role: 'Boss Killer', desc: 'Long-range piercing slug. Has a dead zone up close.',
    base: { dmg: 150, apm: 17, range: 5.6, minRange: 1.6, pierce: 1, crit: 0.1 },
    perks: [
      dmgUp(25),
      p('Overpenetration', 'Pierces 2 more enemies', (s) => (s.pierce += 2)),
      p('Tight Coils', 'Dead zone shrinks, +15% damage', (s) => { s.minRange = 0.8; s.dmg *= 1.15; }),
      apmUp(20),
      p('Mega Shot', 'Every 4th shot deals x3 damage', (s) => { s.every = 4; s.special = 3; }),
    ],
    color: 0xff7040,
  },
  {
    id: 'mortar', name: 'Mortar', archetype: 'Mortar', cls: 'vanguard', targets: 'ground', delivery: 'ballistic',
    role: 'Long AoE', desc: 'Very long-range artillery with big splash. Dead zone up close.',
    base: { dmg: 95, apm: 16, range: 6.2, minRange: 2, aoe: 1.25 },
    perks: [
      dmgUp(25),
      p('Incendiary', 'Leaves a burning crater', (s) => (s.crater = 26)),
      p('Heavy Rounds', 'Splash +20%, +15% damage', (s) => { s.aoe *= 1.2; s.dmg *= 1.15; }),
      apmUp(25),
      p('Triple Salvo', 'Fires 3 shells per volley', (s) => (s.count = 3)),
    ],
    color: 0xd96a2c,
  },
  // ───────────── SWIFT ─────────────
  {
    id: 'gatling', name: 'Gatling', archetype: 'Vulcan', cls: 'swift', targets: 'both', delivery: 'hitscan',
    role: 'Rapid Fire', desc: 'Spins up to a hail of bullets. Crits often.',
    base: { dmg: 11, apm: 330, range: 2.9, crit: 0.15, spinUp: 2.2 },
    perks: [
      dmgUp(25),
      p('Hot Barrels', 'Spins up twice as fast', (s) => (s.spinUp *= 0.5)),
      p('Shredder', 'Crits shred 2 armor', (s) => { s.armorShred = 2; s.crit += 0.05; }),
      p('+15% Crit', 'Crit chance +15%', (s) => (s.crit += 0.15)),
      p('Twin Gatling', 'Second barrel: +60% fire rate', (s) => (s.apm *= 1.6)),
    ],
    color: 0x5cff9d,
  },
  {
    id: 'barracks', name: 'Barracks', archetype: 'Garrison', cls: 'swift', targets: 'ground', delivery: 'summon',
    role: 'Blocker', desc: 'Deploys soldiers onto the nearest road. They block and fight ground enemies.',
    base: { dmg: 14, apm: 70, range: 2.4, count: 2, soldierHp: 140, blockCount: 1, rearm: 9 },
    perks: [
      p('Drilled', 'Soldiers +30% HP and damage', (s) => { s.soldierHp *= 1.3; s.dmg *= 1.3; }),
      p('Reinforcements', 'Respawn 40% faster', (s) => (s.rearm *= 0.6)),
      p('Third Squad', '+1 soldier', (s) => (s.count += 1)),
      p('Shield Wall', 'Each soldier blocks 2 enemies', (s) => (s.blockCount = 2)),
      p('Elite Guard', 'Soldiers +60% HP, +40% damage', (s) => { s.soldierHp *= 1.6; s.dmg *= 1.4; }),
    ],
    color: 0x44e08a,
  },
  {
    id: 'boomerang', name: 'Boomerang', archetype: 'Boomerang', cls: 'swift', targets: 'both', delivery: 'homing',
    role: 'Pierce', desc: 'Throws a blade that slices everything on its way out and back.',
    base: { dmg: 46, apm: 40, range: 3.1, crit: 0.2, pierce: 99 },
    perks: [
      dmgUp(25),
      apmUp(20),
      p('Double Back', 'Blade returns twice', (s) => (s.special = 2)),
      p('+15% Crit', 'Crit chance +15%', (s) => (s.crit += 0.15)),
      p('Twin Blades', 'Throws 2 blades', (s) => (s.count = 2)),
    ],
    color: 0x7dffb0,
  },
  {
    id: 'spike', name: 'Spike Strip', archetype: 'Spike', cls: 'swift', targets: 'ground', delivery: 'trap', onRoad: true,
    role: 'Road Trap', desc: 'Placed ON the road. Damages every ground enemy that crosses it.',
    base: { dmg: 34, apm: 120, range: 0.6, charges: 14, rearm: 5 },
    perks: [
      dmgUp(30),
      p('Barbed', 'Applies bleed (burn) 3s', (s) => { s.burn = 12; s.burnDur = 3; }),
      p('Deep Spikes', '+8 charges, slows 25%', (s) => { s.charges += 8; s.slow = 0.25; s.slowDur = 1; }),
      p('Fast Rearm', 'Rearms twice as fast', (s) => (s.rearm *= 0.5)),
      p('Impaler', 'Stuns 0.5s, +30% dmg', (s) => { s.stun = 0.5; s.dmg *= 1.3; }),
    ],
    color: 0x3fcf7a,
  },
  // ───────────── ELEMENTAL ─────────────
  {
    id: 'tesla', name: 'Tesla Coil', archetype: 'Tesla', cls: 'elemental', targets: 'both', delivery: 'chain',
    role: 'Chain', desc: 'Lightning that jumps between nearby enemies. Great vs shields.',
    base: { dmg: 34, apm: 46, range: 2.9, chains: 3, chainFalloff: 0.15 },
    perks: [
      dmgUp(25),
      p('Arc Jump', '+2 chain jumps', (s) => (s.chains += 2)),
      p('Shock', 'Targets take +15% damage for 3s', (s) => (s.shock = 3)),
      apmUp(25),
      p('Overload', 'Every 5th zap hits everything nearby', (s) => { s.every = 5; s.special = 2.2; }),
    ],
    color: 0x7a8cff,
  },
  {
    id: 'frost', name: 'Frost Gun', archetype: 'Frost Gun', cls: 'elemental', targets: 'both', delivery: 'homing',
    role: 'Slow', desc: 'Chills enemies. Fully chilled enemies freeze solid.',
    base: { dmg: 16, apm: 60, range: 3.0, slow: 0.35, slowDur: 2.2 },
    perks: [
      p('Deep Chill', 'Slow +15%', (s) => (s.slow += 0.15)),
      dmgUp(40),
      p('Shatter', 'Frozen enemies shatter for AoE damage', (s) => { s.aoe = 0.9; s.special = 1; }),
      rangeUp(0.6),
      p('Permafrost Aura', 'Constant 25% slow around the tower', (s) => { s.buffRadius = 1.6; s.auraSlow = 0.25; }),
    ],
    color: 0x8fd8ff,
  },
  {
    id: 'laser', name: 'Prism Laser', archetype: 'Laser', cls: 'elemental', targets: 'both', delivery: 'beam',
    role: 'Ramp Beam', desc: 'Continuous beam that ramps through 3 stages while it stays on target.',
    base: { dmg: 40, apm: 60, range: 3.2, rampTime: 1.4, ramp2: 3, ramp3: 5.5 },
    perks: [
      dmgUp(25),
      p('Quick Focus', 'Ramps 40% faster', (s) => (s.rampTime *= 0.6)),
      p('Searing', 'Beam burns targets', (s) => { s.burn = 20; s.burnDur = 2; }),
      rangeUp(0.6),
      p('Prism Split', 'Beam splits to 2 targets', (s) => (s.splitTargets = 2)),
    ],
    color: 0xb48cff,
  },
  {
    id: 'flame', name: 'Flamethrower', archetype: 'Inferno', cls: 'elemental', targets: 'ground', delivery: 'cone',
    role: 'Burn Cone', desc: 'Short-range cone of fire. Sets ground enemies ablaze.',
    base: { dmg: 9, apm: 300, range: 2.2, coneDeg: 60, burn: 14, burnDur: 3 },
    perks: [
      dmgUp(25),
      p('Napalm', 'Burn +60%, lasts longer', (s) => { s.burn *= 1.6; s.burnDur += 2; }),
      p('Wildfire', 'Burning enemies spread fire on death', (s) => (s.special = 1)),
      rangeUp(0.5),
      p('Inferno', 'Cone widens to 100°, +25% dmg', (s) => { s.coneDeg = 100; s.dmg *= 1.25; }),
    ],
    color: 0x9a7cff,
  },
  // ───────────── UTILITY ─────────────
  {
    id: 'gust', name: 'Gust Fan', archetype: 'Wind Blower', cls: 'utility', targets: 'both', delivery: 'push',
    role: 'Push Back', desc: 'Blasts enemies back along their route. Extra strong against flyers.',
    base: { dmg: 8, apm: 42, range: 2.7, push: 0.3, count: 3, airMult: 1.5 },
    perks: [
      p('Stronger Gust', 'Push +25%', (s) => (s.push *= 1.25)),
      apmUp(20),
      p('Jet Stream', 'Flyers pushed 2x further', (s) => (s.airMult *= 2)),
      p('Wide Fan', 'Hits 2 more enemies', (s) => (s.count += 2)),
      p('Gale Stun', 'Gusts stun for 0.6s', (s) => (s.stun = 0.6)),
    ],
    color: 0xffd45c,
  },
  {
    id: 'grapple', name: 'Grapple', archetype: 'Hook', cls: 'utility', targets: 'both', delivery: 'pull',
    role: 'Pull + Slow', desc: 'Hooks the front-most enemy and drags it back, slowing it.',
    base: { dmg: 22, apm: 26, range: 3.1, pull: 0.8, slow: 0.25, slowDur: 2 },
    perks: [
      p('Long Chain', 'Pull +40%', (s) => (s.pull *= 1.4)),
      p('Barbed Hook', 'Slow +15%, +30% dmg', (s) => { s.slow += 0.15; s.dmg *= 1.3; }),
      p('Twin Hooks', '+1 hook per throw', (s) => (s.count += 1)),
      apmUp(30),
      p('Expose', 'Hooked enemies take +25% dmg for 3s', (s) => (s.vulnerable = 0.25)),
    ],
    color: 0xffc23d,
  },
  {
    id: 'bowler', name: 'Bowler', archetype: 'Bowling', cls: 'utility', targets: 'ground', delivery: 'rolling',
    role: 'Roll Stun', desc: 'Rolls a heavy ball back up the road, stunning everything it hits.',
    base: { dmg: 52, apm: 14, range: 2.6, stun: 0.5, knock: 0.15, rollLen: 4.5 },
    perks: [
      dmgUp(30),
      p('Long Lane', 'Ball rolls 50% further', (s) => (s.rollLen *= 1.5)),
      p('Heavy Ball', '+40% dmg, stun +0.3s', (s) => { s.dmg *= 1.4; s.stun += 0.3; }),
      apmUp(30),
      p('Double Strike', 'Rolls 2 balls', (s) => (s.count = 2)),
    ],
    color: 0xffe08a,
  },
  {
    id: 'disco', name: 'Disco Beacon', archetype: 'Disco Ball', cls: 'utility', targets: 'ground', delivery: 'aura',
    role: 'Crowd Control', desc: 'Pulses a beat that makes nearby enemies stop and dance.',
    base: { dmg: 0, apm: 11, range: 2.1, dance: 1.4 },
    perks: [
      p('Longer Set', 'Dance +0.6s', (s) => (s.dance += 0.6)),
      rangeUp(0.5),
      p('Bass Drop', 'Pulses deal damage', (s) => (s.dmg = 30)),
      apmUp(30),
      p('Spotlight', 'Dancing enemies take +30% dmg', (s) => (s.vulnerable = 0.3)),
    ],
    color: 0xfff07a,
  },
  {
    id: 'amp', name: 'Amplifier', archetype: 'Support', cls: 'utility', targets: 'none', delivery: 'buff',
    role: 'Buff', desc: 'Does not attack. Boosts damage and fire rate of nearby towers.',
    base: { buffDmg: 0.2, buffApm: 0.1, buffRadius: 1.5 },
    perks: [
      p('Gain +', 'Buff damage +10%', (s) => (s.buffDmg += 0.1)),
      p('Wide Field', 'Radius 2.5 tiles', (s) => (s.buffRadius = 2.5)),
      p('Overdrive', 'Buff fire rate +10%', (s) => (s.buffApm += 0.1)),
      p('Gain ++', 'Buff damage +10%', (s) => (s.buffDmg += 0.1)),
      p('Precision Field', 'Buffed towers +15% crit', (s) => (s.buffCrit = 0.15)),
    ],
    color: 0xffd45c,
  },
];

export const TOWER_MAP: Record<string, TowerDef> = Object.fromEntries(TOWERS.map((t) => [t.id, t]));

export const RARITY_NAMES = ['Common', 'Good', 'Rare', 'Epic', 'Legendary', 'Relic', 'Supreme'];
export const RARITY_COLORS = ['#a9b1bd', '#5fd36a', '#4aa8ff', '#b46bff', '#ffc23d', '#ff4d5e', '#ff7cf0'];
export const RARITY_MULT = [1, 1.15, 1.32, 1.52, 1.76, 2.05, 2.4];
export const LEVEL_CAP = [10, 20, 30, 40, 50, 60, 70];

export function levelMult(level: number): number {
  return 1 + 0.07 * (level - 1);
}

/** Compute effective stats for a tower at a given rarity/level/stars. */
export function towerStats(def: TowerDef, rarity: number, level: number, stars: number): TowerStats {
  const s = defaultStats();
  Object.assign(s, def.base);
  const m = RARITY_MULT[rarity] * levelMult(level);
  s.dmg *= m;
  s.soldierHp *= m;
  s.burn *= m;
  s.crater *= m;
  for (let i = 0; i < stars - 1 && i < def.perks.length; i++) def.perks[i].apply(s);
  return s;
}
