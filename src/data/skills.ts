import type { HeroDef, SkillDef } from '../sim/types';

export const SKILLS: SkillDef[] = [
  { id: 'orbital', name: 'Orbital Strike', cls: 'vanguard', aim: 'point', cooldown: 30, radius: 1.3, desc: 'A massive beam from orbit after a short delay.', color: 0xff8a3d },
  { id: 'carpet', name: 'Carpet Bomb', cls: 'vanguard', aim: 'road', cooldown: 34, radius: 0.9, desc: 'A line of bombs along the road.', color: 0xffa860 },
  { id: 'blizzard', name: 'Blizzard', cls: 'elemental', aim: 'point', cooldown: 32, radius: 2.0, desc: 'Slows and freezes everything in an area for 6s.', color: 0x8fd8ff },
  { id: 'storm', name: 'Chain Storm', cls: 'elemental', aim: 'none', cooldown: 28, radius: 0, desc: 'Lightning strikes the 5 toughest enemies.', color: 0x7a8cff },
  { id: 'caltrops', name: 'Caltrops', cls: 'swift', aim: 'road', cooldown: 26, radius: 0.6, desc: 'Scatters spike traps along the road.', color: 0x5cff9d },
  { id: 'rally', name: 'Rally', cls: 'swift', aim: 'none', cooldown: 40, radius: 0, desc: 'All towers +40% fire rate for 8s.', color: 0x44e08a },
  { id: 'barricade', name: 'Barricade', cls: 'utility', aim: 'road', cooldown: 30, radius: 0.5, desc: 'A wall on the road that enemies must break.', color: 0xffd45c },
  { id: 'repair', name: 'Repair Drones', cls: 'utility', aim: 'none', cooldown: 45, radius: 0, desc: 'Repairs the fortress over 6s.', color: 0xfff07a },
];
export const SKILL_MAP: Record<string, SkillDef> = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

export const HEROES: HeroDef[] = [
  { id: 'vex', name: 'Vex', title: 'Siege Pilot', cls: 'vanguard', targets: 'both', dmg: 44, apm: 50, range: 3.0, aoe: 0.5, special: 'Siege Mode', specialDesc: '8s: triple damage, bigger splash.', passive: 'Vanguard towers +0.4 range', charge: 2400, color: 0xff8a3d },
  { id: 'kira', name: 'Kira', title: 'Blade Dancer', cls: 'swift', targets: 'ground', dmg: 36, apm: 90, range: 1.8, aoe: 0, special: 'Thousand Cuts', specialDesc: 'Dashes through 8 enemies for huge damage.', passive: 'Swift towers +10% crit', charge: 2200, color: 0x5cff9d },
  { id: 'sol', name: 'Sol', title: 'Storm Caller', cls: 'elemental', targets: 'both', dmg: 30, apm: 55, range: 3.0, aoe: 0, special: 'Tempest', specialDesc: '6s lightning storm around Sol.', passive: 'Elemental effects last 30% longer', charge: 2400, color: 0x7a8cff },
  { id: 'bolt', name: 'Bolt & Byte', title: 'Engineer Duo', cls: 'utility', targets: 'both', dmg: 28, apm: 60, range: 2.8, aoe: 0, special: 'Lockdown', specialDesc: 'Byte pins the strongest enemy for 4s (+50% dmg taken).', passive: 'Utility towers +20% effect', charge: 2000, color: 0xffd45c },
];
export const HERO_MAP: Record<string, HeroDef> = Object.fromEntries(HEROES.map((h) => [h.id, h]));
