export type ClassId = 'vanguard' | 'swift' | 'elemental' | 'utility';
export type TargetKind = 'ground' | 'air' | 'both' | 'none';
export type Delivery =
  | 'ballistic'
  | 'homing'
  | 'hitscan'
  | 'beam'
  | 'chain'
  | 'cone'
  | 'rolling'
  | 'trap'
  | 'summon'
  | 'push'
  | 'pull'
  | 'aura'
  | 'buff';

export type TargetMode = 'first' | 'last' | 'strongest' | 'weakest' | 'closest';
export const TARGET_MODES: TargetMode[] = ['first', 'last', 'strongest', 'weakest', 'closest'];

/** Every tower stat. Perks mutate a copy of this. Unused stats stay 0. */
export interface TowerStats {
  dmg: number;
  apm: number; // attacks per minute (Raid Rush-style unit)
  range: number; // tiles
  minRange: number;
  aoe: number; // splash radius in tiles
  crit: number; // 0..1
  critDmg: number; // multiplier
  slow: number; // 0..1
  slowDur: number;
  stun: number; // seconds
  push: number; // tiles per hit
  pull: number;
  knock: number;
  chains: number;
  chainFalloff: number;
  pierce: number;
  burn: number; // dps
  burnDur: number;
  shock: number; // seconds of +15% dmg taken
  count: number; // missiles / hooks / soldiers / balls per attack
  soldierHp: number;
  blockCount: number;
  coneDeg: number;
  charges: number;
  rearm: number;
  dance: number;
  buffDmg: number;
  buffApm: number;
  buffCrit: number;
  buffRadius: number;
  rampTime: number;
  ramp2: number; // damage multiplier at stage 2
  ramp3: number;
  spinUp: number; // seconds to full spin
  airMult: number; // push multiplier vs air
  every: number; // every Nth attack gets special
  special: number; // special magnitude
  splitTargets: number; // beams/targets
  vulnerable: number; // +dmg taken applied
  armorShred: number;
  crater: number; // burning crater dps
  rollLen: number;
  auraSlow: number;
}

export interface StarPerk {
  name: string;
  desc: string;
  apply(s: TowerStats): void;
}

export interface TowerDef {
  id: string;
  name: string;
  archetype: string;
  cls: ClassId;
  targets: TargetKind;
  delivery: Delivery;
  onRoad?: boolean;
  role: string;
  desc: string;
  base: Partial<TowerStats>;
  /** Perks for stars 2..6 (index 0 = 2 stars). */
  perks: StarPerk[];
  color: number;
}

export interface EnemyDef {
  id: string;
  name: string;
  cls: ClassId;
  air: boolean;
  hp: number;
  speed: number; // tiles / sec
  armor: number;
  xp: number;
  dmg: number; // fortress damage
  size: number;
  threat: number; // wave budget cost
  shieldPct?: number;
  boss?: boolean;
  desc: string;
  /** behaviour flags */
  heal?: number; // % max hp/s to allies in radius
  healRadius?: number;
  sprint?: boolean;
  slowImmune?: boolean;
  split?: number;
  burrow?: boolean;
  blink?: boolean;
  rocket?: boolean; // ranged attack on towers
  frost?: boolean; // stuns towers near it
  emp?: boolean; // disables towers on death
  shieldAura?: boolean;
  color: number;
}

export interface SkillDef {
  id: string;
  name: string;
  cls: ClassId;
  aim: 'point' | 'road' | 'none';
  cooldown: number;
  radius: number;
  desc: string;
  color: number;
}

export interface HeroDef {
  id: string;
  name: string;
  title: string;
  cls: ClassId;
  targets: TargetKind;
  dmg: number;
  apm: number;
  range: number;
  aoe: number;
  special: string;
  specialDesc: string;
  passive: string;
  charge: number; // damage to charge special
  color: number;
}

export interface DeckCard {
  id: string;
  rarity: number; // 0..6
  level: number; // 1..70
}

export interface Deck {
  towers: DeckCard[];
  skills: DeckCard[];
  hero: DeckCard | null;
}

export type Mode = 'endless' | 'daily' | 'lab';

export interface BattleConfig {
  seed: number;
  mode: Mode;
  deck: Deck;
  workshop: Record<string, number>;
  mutators: string[];
  preset?: string;
}

export interface Vec2 {
  x: number;
  y: number;
}

export type Card =
  | { kind: 'tower'; id: string }
  | { kind: 'road'; pieces: [string, string] }
  | { kind: 'field'; shape: string }
  | { kind: 'star'; id: string }
  | { kind: 'move' }
  | { kind: 'switch' }
  | { kind: 'skill'; id: string }
  | { kind: 'hero'; id: string }
  | { kind: 'repair' };

export type Command =
  | { t: 'pick'; index: number }
  | { t: 'refresh' }
  | { t: 'placeRoad'; piece: string; rot: number; mirror: boolean }
  | { t: 'placeField'; shape: string; x: number; y: number; rot: number }
  | { t: 'placeTower'; x: number; y: number }
  | { t: 'placeHero'; x: number; y: number }
  | { t: 'move'; from: Vec2; to: Vec2 }
  | { t: 'switch'; a: Vec2; b: Vec2 }
  | { t: 'cast'; skill: string; x: number; y: number }
  | { t: 'heroSpecial' }
  | { t: 'targeting'; x: number; y: number }
  | { t: 'callEarly' }
  | { t: 'lab'; op: string; arg?: string };

export interface TimedCommand {
  tick: number;
  cmd: Command;
}
