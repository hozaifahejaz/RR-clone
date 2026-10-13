/** Endless mode tuning: phases, curves, wave templates, unlocks. */

export interface Phase {
  id: string;
  name: string;
  from: number; // first wave
  pool: string[]; // enemies available
  eliteChance: number;
  shields: boolean;
  collapse: boolean;
  xpDecay: boolean;
  blurb: string;
}

export const PHASES: Phase[] = [
  { id: 'setup', name: 'Setup', from: 1, pool: ['scrapper', 'dasher', 'brute', 'buzzer', 'swarm'], eliteChance: 0, shields: false, collapse: false, xpDecay: false, blurb: 'Build your island.' },
  { id: 'raid', name: 'Raid', from: 11, pool: ['scrapper', 'dasher', 'brute', 'buzzer', 'swarm', 'medic', 'bomber', 'splitter'], eliteChance: 0.04, shields: false, collapse: false, xpDecay: false, blurb: 'Air raids and healers incoming.' },
  { id: 'elite', name: 'Elite', from: 21, pool: ['scrapper', 'dasher', 'brute', 'buzzer', 'swarm', 'medic', 'bomber', 'splitter', 'shellback', 'rocketeer', 'burrower', 'phase'], eliteChance: 0.12, shields: false, collapse: false, xpDecay: false, blurb: 'Elites and tower-breakers.' },
  { id: 'siege', name: 'Siege', from: 36, pool: ['dasher', 'brute', 'buzzer', 'swarm', 'medic', 'bomber', 'splitter', 'shellback', 'rocketeer', 'burrower', 'phase', 'emp', 'warden', 'frostblade', 'juggernaut'], eliteChance: 0.2, shields: true, collapse: false, xpDecay: false, blurb: 'Shielded raiders lay siege.' },
  { id: 'collapse', name: 'Collapse', from: 51, pool: ['dasher', 'brute', 'buzzer', 'swarm', 'medic', 'bomber', 'splitter', 'shellback', 'rocketeer', 'burrower', 'phase', 'emp', 'warden', 'frostblade', 'juggernaut'], eliteChance: 0.28, shields: true, collapse: true, xpDecay: false, blurb: 'Building cracks the land beneath you.' },
  { id: 'starve', name: 'Starvation', from: 71, pool: ['dasher', 'brute', 'buzzer', 'swarm', 'medic', 'bomber', 'splitter', 'shellback', 'rocketeer', 'burrower', 'phase', 'emp', 'warden', 'frostblade', 'juggernaut'], eliteChance: 0.36, shields: true, collapse: true, xpDecay: true, blurb: 'XP runs dry. Every pick counts.' },
];

export function phaseFor(wave: number): Phase {
  let p = PHASES[0];
  for (const ph of PHASES) if (wave >= ph.from) p = ph;
  return p;
}

export const WAVE_INTERVAL = 15; // seconds
export const FIRST_WAVE_DELAY = 6;

/** Threat budget for a wave. */
export function waveBudget(w: number): number {
  return 7 * Math.pow(1.075, w - 1) + w * 0.6;
}

/** Enemy HP multiplier for a wave. */
export function hpScale(w: number): number {
  const early = 1 + 0.05 * (w - 1);
  return w <= 25 ? early : early * Math.pow(1.045, w - 25);
}

export function xpNeeded(level: number): number {
  return Math.round(6 + 4 * level + 0.42 * level * level);
}

export interface WaveTemplate {
  id: string;
  name: string;
  weight: number;
  minWave: number;
  /** filter / preference over pool */
  prefer: (id: string) => number;
  interval: number; // spawn interval
}

const AIR = new Set(['buzzer', 'bomber', 'emp']);
const FAST = new Set(['dasher', 'swarm', 'scrapper', 'phase']);
const TANK = new Set(['brute', 'juggernaut', 'shellback', 'warden', 'frostblade']);

export const WAVE_TEMPLATES: WaveTemplate[] = [
  { id: 'mixed', name: 'Raiding Party', weight: 5, minWave: 1, prefer: (id) => (AIR.has(id) ? 0.4 : 1), interval: 0.75 },
  { id: 'rush', name: 'Rush', weight: 3, minWave: 2, prefer: (id) => (FAST.has(id) ? 3 : 0.15), interval: 0.45 },
  { id: 'swarm', name: 'Swarm', weight: 2, minWave: 4, prefer: (id) => (id === 'swarm' ? 6 : id === 'medic' ? 1 : 0.1), interval: 0.22 },
  { id: 'air', name: 'Air Raid', weight: 2, minWave: 5, prefer: (id) => (AIR.has(id) ? 5 : 0.1), interval: 0.8 },
  { id: 'tank', name: 'Tank Column', weight: 2, minWave: 6, prefer: (id) => (TANK.has(id) ? 4 : id === 'medic' ? 1.5 : 0.2), interval: 1.3 },
  { id: 'escort', name: 'Escort', weight: 1.5, minWave: 12, prefer: (id) => (id === 'medic' || id === 'warden' ? 3 : TANK.has(id) ? 1.5 : 0.5), interval: 0.9 },
];

export const BOSS_ROTATION = ['colossus', 'leviathan', 'wyrm', 'phantom', 'titan', 'sovereign'];

export const ELITE_AFFIXES = ['hasted', 'regen', 'shielded', 'explosive', 'armored'];

export interface Mutator {
  id: string;
  name: string;
  desc: string;
}
export const MUTATORS: Mutator[] = [
  { id: 'noField', name: 'No Expansion', desc: 'Field cards never appear. Bigger starting island.' },
  { id: 'doubleAir', name: 'Sky Fall', desc: 'Every wave brings extra flyers.' },
  { id: 'glass', name: 'Glass Fortress', desc: 'Fortress has 40% HP and no Last Stand.' },
  { id: 'eliteRush', name: 'Elite Rush', desc: 'Elites appear from wave 1 and twice as often.' },
  { id: 'blitz', name: 'Blitz', desc: 'Waves arrive every 10 seconds.' },
];
export const MUTATOR_SCORE = 1.5;
