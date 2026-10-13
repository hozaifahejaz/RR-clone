import type { ClassId, EnemyDef, HeroDef, TargetMode, TowerDef, TowerStats } from '../types';

export interface Enemy {
  id: number;
  def: EnemyDef;
  cls: ClassId;
  air: boolean;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  armor: number;
  speed: number;
  /** distance remaining to the fortress along its route */
  r: number;
  lane: number;
  x: number;
  y: number;
  px: number;
  py: number;
  dirX: number;
  dirY: number;
  // air route
  ax: number;
  ay: number;
  aLen: number;
  elite: boolean;
  affix: string | null;
  slow: number;
  slowT: number;
  stunT: number;
  burn: number;
  burnT: number;
  burnSrc: number;
  shockT: number;
  danceT: number;
  vuln: number;
  vulnT: number;
  chill: number;
  chillT: number;
  freezeT: number;
  freezeImm: number;
  burrowT: number;
  burrowCd: number;
  sprintT: number;
  lockT: number;
  disp: number;
  dispT: number;
  blockedBy: number;
  atkCd: number;
  abilT: number;
  abilT2: number;
  bossPhase: number;
  decoy: boolean;
  blinked: boolean;
  dead: boolean;
  leaked: boolean;
  noReward: boolean;
  xp: number;
  fortDmg: number;
  melee: number;
  wave: number;
  flash: number;
  lastHitBy: number;
  wildfire: boolean;
}

export interface Tower {
  id: number;
  def: TowerDef;
  tx: number;
  ty: number;
  x: number;
  y: number;
  rarity: number;
  level: number;
  stats: TowerStats;
  cd: number;
  targetId: number;
  mode: TargetMode;
  integrity: number;
  koT: number;
  stunT: number;
  spin: number;
  rampT: number;
  beamTargets: number[];
  shots: number;
  charges: number;
  rearmT: number;
  aim: number;
  power: boolean;
  soldiers: number[];
  dmgDealt: number;
  kills: number;
  buffDmg: number;
  buffApm: number;
  buffCrit: number;
  placedTick: number;
  fireFx: number;
  trapHit: Map<number, number>;
}

export interface Soldier {
  id: number;
  towerId: number;
  d: number; // rally distance on the road
  x: number;
  y: number;
  px: number;
  py: number;
  hp: number;
  maxHp: number;
  dmg: number;
  apm: number;
  cd: number;
  blockCount: number;
  blocking: number[];
  respawnT: number;
  dead: boolean;
  barricade: boolean;
  ttl: number;
}

export type ProjKind = 'shell' | 'missile' | 'frost' | 'blade' | 'ball' | 'rocket' | 'orb';

export interface Projectile {
  id: number;
  kind: ProjKind;
  x: number;
  y: number;
  z: number;
  px: number;
  py: number;
  pz: number;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  targetId: number;
  speed: number;
  t: number;
  dur: number;
  towerId: number;
  dmg: number;
  aoe: number;
  cls: ClassId;
  crit: number;
  critDmg: number;
  hit: Set<number>;
  leg: number;
  legs: number;
  air: boolean | null; // null = both
  d: number; // for rolling
  dEnd: number;
  color: number;
  dead: boolean;
  extra: number;
}

export interface Zone {
  id: number;
  kind: 'flak' | 'crater' | 'blizzard' | 'fire' | 'orbital';
  x: number;
  y: number;
  radius: number;
  dps: number;
  t: number;
  dur: number;
  air: boolean | null;
  slow: number;
  towerId: number;
  cls: ClassId;
  tick: number;
  delay: number;
}

export interface Hero {
  id: number;
  def: HeroDef;
  tx: number;
  ty: number;
  x: number;
  y: number;
  rarity: number;
  level: number; // meta level
  runLevel: number;
  runXp: number;
  cd: number;
  charge: number;
  specialT: number;
  targetId: number;
  dmgDealt: number;
  kills: number;
  aim: number;
  stunT: number;
  dashTargets: number[];
  dashT: number;
  fireFx: number;
}
