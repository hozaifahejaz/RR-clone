import type { EnemyDef } from '../sim/types';

export const ENEMIES: EnemyDef[] = [
  { id: 'scrapper', name: 'Scrapper', cls: 'swift', air: false, hp: 70, speed: 1.0, armor: 0, xp: 2, dmg: 2, size: 0.32, threat: 1, desc: 'Basic raider.', color: 0x9fb4c8 },
  { id: 'dasher', name: 'Dasher', cls: 'swift', air: false, hp: 50, speed: 1.55, armor: 0, xp: 2, dmg: 2, size: 0.28, threat: 1.2, sprint: true, desc: 'Fast. Sprints when hit and slips past blockers while sprinting.', color: 0x6ff2c2 },
  { id: 'brute', name: 'Brute', cls: 'vanguard', air: false, hp: 320, speed: 0.62, armor: 6, xp: 6, dmg: 8, size: 0.46, threat: 4, desc: 'Tanky and armored.', color: 0xc77b4a },
  { id: 'shellback', name: 'Shellback', cls: 'vanguard', air: false, hp: 160, speed: 0.8, armor: 2, xp: 5, dmg: 4, size: 0.4, threat: 3.2, shieldPct: 0.8, desc: 'Carries a big energy shield. Elemental damage breaks shields faster.', color: 0x5b8bd9 },
  { id: 'juggernaut', name: 'Juggernaut', cls: 'vanguard', air: false, hp: 900, speed: 0.48, armor: 12, xp: 14, dmg: 15, size: 0.56, threat: 10, slowImmune: true, desc: 'Huge HP, heavy armor, immune to slow.', color: 0x8a5a3a },
  { id: 'medic', name: 'Medic', cls: 'utility', air: false, hp: 110, speed: 0.9, armor: 0, xp: 4, dmg: 2, size: 0.32, threat: 2.6, heal: 0.035, healRadius: 1.6, desc: 'Heals nearby allies over time.', color: 0xf2f2f2 },
  { id: 'warden', name: 'Warden', cls: 'utility', air: false, hp: 200, speed: 0.75, armor: 3, xp: 6, dmg: 4, size: 0.38, threat: 4, shieldAura: true, desc: 'Grants shields to nearby allies.', color: 0xd9c35b },
  { id: 'splitter', name: 'Splitter', cls: 'elemental', air: false, hp: 180, speed: 0.85, armor: 0, xp: 4, dmg: 4, size: 0.4, threat: 3, split: 3, desc: 'Splits into 3 minis when destroyed.', color: 0x9b6bff },
  { id: 'mini', name: 'Mini', cls: 'elemental', air: false, hp: 40, speed: 1.2, armor: 0, xp: 1, dmg: 1, size: 0.22, threat: 0.5, desc: 'Splitter fragment.', color: 0xbf9bff },
  { id: 'burrower', name: 'Burrower', cls: 'elemental', air: false, hp: 150, speed: 0.95, armor: 1, xp: 4, dmg: 4, size: 0.34, threat: 3, burrow: true, desc: 'Digs underground (untargetable) every few seconds.', color: 0xb58a5a },
  { id: 'phase', name: 'Phase Walker', cls: 'elemental', air: false, hp: 140, speed: 0.95, armor: 0, xp: 4, dmg: 4, size: 0.34, threat: 3, blink: true, desc: 'Blinks forward when badly hurt.', color: 0x5ce1ff },
  { id: 'rocketeer', name: 'Rocketeer', cls: 'vanguard', air: false, hp: 170, speed: 0.75, armor: 3, xp: 5, dmg: 4, size: 0.36, threat: 3.6, rocket: true, desc: 'Fires rockets that knock out nearby towers.', color: 0xe05a4a },
  { id: 'frostblade', name: 'Frostblade', cls: 'elemental', air: false, hp: 220, speed: 0.7, armor: 4, xp: 6, dmg: 5, size: 0.38, threat: 4, frost: true, desc: 'Icy strikes stun nearby defenders.', color: 0x9fe6ff },
  { id: 'swarm', name: 'Swarm Mite', cls: 'swift', air: false, hp: 22, speed: 1.35, armor: 0, xp: 0.6, dmg: 1, size: 0.18, threat: 0.35, desc: 'Tiny, comes in huge groups.', color: 0xc8f25b },
  { id: 'buzzer', name: 'Buzzer', cls: 'swift', air: true, hp: 60, speed: 1.15, armor: 0, xp: 2, dmg: 2, size: 0.28, threat: 1.3, desc: 'Basic flyer. Ignores the road.', color: 0xffe066 },
  { id: 'bomber', name: 'Bomber', cls: 'vanguard', air: true, hp: 300, speed: 0.6, armor: 4, xp: 7, dmg: 12, size: 0.5, threat: 5, desc: 'Armored flyer that hits the fortress hard.', color: 0xff9a4a },
  { id: 'emp', name: 'EMP Drone', cls: 'utility', air: true, hp: 120, speed: 0.95, armor: 0, xp: 4, dmg: 3, size: 0.32, threat: 3, emp: true, desc: 'Disables towers near where it dies.', color: 0x6af0ff },
];

export const BOSSES: EnemyDef[] = [
  { id: 'colossus', name: 'Iron Colossus', cls: 'vanguard', air: false, boss: true, hp: 5200, speed: 0.4, armor: 10, xp: 60, dmg: 40, size: 1.0, threat: 0, desc: 'Stomps to disable towers and summons Scrappers.', color: 0x8e9aa8 },
  { id: 'leviathan', name: 'Sky Leviathan', cls: 'swift', air: true, boss: true, hp: 4200, speed: 0.38, armor: 6, xp: 60, dmg: 40, size: 1.1, threat: 0, desc: 'A flying carrier that drops Buzzers.', color: 0x4ad9c2 },
  { id: 'wyrm', name: 'Frost Wyrm', cls: 'elemental', air: true, boss: true, hp: 4600, speed: 0.42, armor: 4, xp: 60, dmg: 40, size: 1.0, threat: 0, desc: 'Freezes columns of towers and dives out of reach.', color: 0xa8e8ff },
  { id: 'phantom', name: 'Neon Phantom', cls: 'elemental', air: false, boss: true, hp: 4800, speed: 0.46, armor: 2, xp: 60, dmg: 40, size: 0.9, threat: 0, desc: 'Teleports forward and splits into decoys.', color: 0xff4fd8 },
  { id: 'titan', name: 'Magma Titan', cls: 'vanguard', air: false, boss: true, hp: 6200, speed: 0.36, armor: 8, xp: 60, dmg: 40, size: 1.05, threat: 0, slowImmune: false, desc: 'Burn immune. Heals nearby raiders. Erupts into Splitters.', color: 0xff6a2a },
  { id: 'sovereign', name: 'Rift Sovereign', cls: 'utility', air: false, boss: true, hp: 7000, speed: 0.4, armor: 6, xp: 80, dmg: 50, size: 1.1, threat: 0, desc: 'Changes class every phase and raises shields.', color: 0xa070ff },
];

export const ENEMY_MAP: Record<string, EnemyDef> = Object.fromEntries([...ENEMIES, ...BOSSES].map((e) => [e.id, e]));
