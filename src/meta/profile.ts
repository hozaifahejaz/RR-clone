import { TOWERS, LEVEL_CAP } from '../data/towers';
import { SKILLS, HEROES } from '../data/skills';
import { STARTER_HERO, STARTER_SKILLS, STARTER_TOWERS } from '../data/decks';
import { MUTATORS } from '../data/endless';
import type { BattleConfig, Deck, TimedCommand } from '../sim/types';
import { hash32 } from '../sim/core/rng';
import type { Quality } from '../render/world';

export type CardKind = 'tower' | 'skill' | 'hero';

export interface CardState {
  id: string;
  kind: CardKind;
  owned: boolean;
  rarity: number;
  level: number;
  copies: number;
  isNew?: boolean;
}

export interface RunRecord {
  id: string;
  date: number;
  mode: 'endless' | 'daily';
  seed: number;
  preset: string;
  wave: number;
  score: number;
  kills: number;
  mutators: string[];
  deck: Deck;
  workshop: Record<string, number>;
  log: TimedCommand[];
  ticks: number;
  dailyDate?: string;
}

export interface Settings {
  quality: Quality;
  music: number;
  sfx: number;
  numbers: boolean;
  reduceShake: boolean;
  reduceFlash: boolean;
  textScale: number;
  leftHanded: boolean;
  defaultSpeed: number;
}

export interface Profile {
  version: number;
  created: number;
  gold: number;
  blueprints: number;
  medals: number;
  jokers: number;
  cards: Record<string, CardState>;
  deck: { towers: string[]; skills: string[]; hero: string };
  workshop: Record<string, number>;
  bestWave: number;
  bestScore: number;
  bestByMutators: Record<string, number>;
  totalRuns: number;
  totalKills: number;
  daily: { date: string; best: number; streak: number; lastPlayed: string; attempts: number };
  history: RunRecord[];
  settings: Settings;
  tutorialDone: boolean;
  unlockNotes: string[];
}

export const SAVE_VERSION = 2;

/** First-time-reached wave unlocks (Endless depth progression). */
export const UNLOCKS: { wave: number; items: string[]; label: string }[] = [
  { wave: 5, items: ['barracks'], label: 'Barracks tower' },
  { wave: 10, items: ['rally', 'daily'], label: 'Rally skill + Daily Endless' },
  { wave: 15, items: ['railgun', 'mutators'], label: 'Railgun tower + Mutators' },
  { wave: 20, items: ['laser', 'kira', 'workshop'], label: 'Prism Laser, hero Kira + Workshop' },
  { wave: 25, items: ['spike', 'storm'], label: 'Spike Strip + Chain Storm' },
  { wave: 30, items: ['grapple', 'barricade'], label: 'Grapple + Barricade' },
  { wave: 35, items: ['mortar'], label: 'Mortar tower' },
  { wave: 40, items: ['boomerang', 'sol', 'carpet'], label: 'Boomerang, hero Sol + Carpet Bomb' },
  { wave: 50, items: ['flame', 'caltrops'], label: 'Flamethrower + Caltrops' },
  { wave: 60, items: ['bowler', 'bolt', 'repair'], label: 'Bowler, Bolt & Byte + Repair Drones' },
  { wave: 70, items: ['disco'], label: 'Disco Beacon' },
  { wave: 80, items: ['amp'], label: 'Amplifier' },
];

export function isFeatureUnlocked(p: Profile, f: 'daily' | 'mutators' | 'workshop'): boolean {
  return UNLOCKS.some((u) => u.items.includes(f) && p.bestWave >= u.wave);
}

export const WORKSHOP: { id: string; name: string; desc: string; max: number; group: string }[] = [
  { id: 'fortHp', name: 'Fortified Walls', desc: '+10 fortress HP', max: 5, group: 'Fortress' },
  { id: 'lastStand', name: 'Last Stand', desc: 'Last Stand restores +10% more HP', max: 3, group: 'Fortress' },
  { id: 'refresh', name: 'Strategist', desc: '+1 card refresh per run', max: 2, group: 'Draft' },
  { id: 'startField', name: 'Head Start', desc: '+1 extra opening pick', max: 2, group: 'Draft' },
  { id: 'xpGain', name: 'Scholar', desc: '+4% XP from kills', max: 5, group: 'Draft' },
  { id: 'dmg_vanguard', name: 'Vanguard Drills', desc: '+4% Vanguard damage', max: 5, group: 'Combat' },
  { id: 'dmg_swift', name: 'Swift Drills', desc: '+4% Swift damage', max: 5, group: 'Combat' },
  { id: 'dmg_elemental', name: 'Elemental Drills', desc: '+4% Elemental damage', max: 5, group: 'Combat' },
  { id: 'dmg_utility', name: 'Utility Drills', desc: '+4% Utility damage', max: 5, group: 'Combat' },
  { id: 'heroCharge', name: 'Heroic Focus', desc: 'Hero special charges 10% faster', max: 3, group: 'Combat' },
  { id: 'skillDmg', name: 'Ordnance', desc: '+4% skill power', max: 5, group: 'Combat' },
  { id: 'goldGain', name: 'Quartermaster', desc: '+10% gold from runs', max: 5, group: 'Economy' },
];
export function workshopCost(rank: number): number {
  return 2 + rank * 2;
}

export const MERGE_COST = [3, 3, 3, 2, 2, 2]; // identical copies to go from rarity r → r+1
export function mergeGold(r: number): number {
  return 100 * (r + 1) * (r + 1);
}
export function levelCost(level: number): { gold: number; bp: number } {
  return { gold: Math.round(30 * Math.pow(1.13, level)), bp: Math.ceil(level / 2) };
}

export function kindOf(id: string): CardKind {
  if (TOWERS.some((t) => t.id === id)) return 'tower';
  if (SKILLS.some((s) => s.id === id)) return 'skill';
  return 'hero';
}

export function defaultSettings(): Settings {
  const mobile = typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) < 600;
  return { quality: mobile ? 'medium' : 'high', music: 0.5, sfx: 0.8, numbers: true, reduceShake: false, reduceFlash: false, textScale: 1, leftHanded: false, defaultSpeed: 1 };
}

export function newProfile(): Profile {
  const cards: Record<string, CardState> = {};
  const starter = new Set([...STARTER_TOWERS, ...STARTER_SKILLS, STARTER_HERO]);
  for (const id of [...TOWERS.map((t) => t.id), ...SKILLS.map((s) => s.id), ...HEROES.map((h) => h.id)])
    cards[id] = { id, kind: kindOf(id), owned: starter.has(id), rarity: 0, level: 1, copies: 0 };
  return {
    version: SAVE_VERSION,
    created: Date.now(),
    gold: 150,
    blueprints: 10,
    medals: 0,
    jokers: 0,
    cards,
    deck: { towers: [...STARTER_TOWERS], skills: [...STARTER_SKILLS], hero: STARTER_HERO },
    workshop: {},
    bestWave: 0,
    bestScore: 0,
    bestByMutators: {},
    totalRuns: 0,
    totalKills: 0,
    daily: { date: '', best: 0, streak: 0, lastPlayed: '', attempts: 0 },
    history: [],
    settings: defaultSettings(),
    tutorialDone: false,
    unlockNotes: [],
  };
}

export function migrate(p: Profile): Profile {
  const fresh = newProfile();
  const out: Profile = { ...fresh, ...p, settings: { ...fresh.settings, ...(p.settings ?? {}) } };
  for (const id of Object.keys(fresh.cards)) if (!out.cards[id]) out.cards[id] = fresh.cards[id];
  out.version = SAVE_VERSION;
  return out;
}

export function deckFor(p: Profile): Deck {
  const c = (id: string) => ({ id, rarity: p.cards[id]?.rarity ?? 0, level: p.cards[id]?.level ?? 1 });
  return { towers: p.deck.towers.map(c), skills: p.deck.skills.map(c), hero: p.deck.hero ? c(p.deck.hero) : null };
}

export function battleConfig(p: Profile, mutators: string[], seed?: number): BattleConfig {
  return { seed: seed ?? (Math.random() * 2 ** 31) >>> 0, mode: 'endless', deck: deckFor(p), workshop: { ...p.workshop }, mutators };
}

export function todayStr(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Daily Endless: the date decides seed, deck and mutator. Everyone (you, every day) gets a fresh puzzle. */
export function dailyConfig(date = todayStr()): BattleConfig & { mutatorName: string } {
  const h = hash32('daily', date);
  const pick = <T,>(arr: T[], salt: string) => arr[hash32(date, salt) % arr.length];
  const aa = ['skyguard', 'gatling', 'tesla', 'frost', 'laser', 'railgun', 'boomerang'];
  const towers = new Set<string>([pick(aa, 'aa')]);
  let k = 0;
  while (towers.size < 6) towers.add(pick(TOWERS.map((t) => t.id), 't' + k++));
  const skills = new Set<string>();
  k = 0;
  while (skills.size < 2) skills.add(pick(SKILLS.map((s) => s.id), 's' + k++));
  const hero = pick(HEROES.map((x) => x.id), 'h');
  const mut = pick(MUTATORS, 'm');
  const c = (id: string) => ({ id, rarity: 3, level: 30 });
  return {
    seed: h,
    mode: 'daily',
    deck: { towers: [...towers].map(c), skills: [...skills].map(c), hero: c(hero) },
    workshop: {},
    mutators: [mut.id],
    mutatorName: mut.name,
  };
}

// ───────────────────────── rewards ─────────────────────────
export interface CardDrop {
  id: string;
  n: number;
}
export interface Rewards {
  gold: number;
  blueprints: number;
  medals: number;
  drops: CardDrop[];
  supplyDrops: number;
  spins: number;
  record: boolean;
  unlocked: string[];
}

export function computeRewards(p: Profile, wave: number, mutators: string[], daily: boolean): Rewards {
  const mult = Math.pow(1.25, mutators.length);
  const waves = Math.max(0, wave - 1);
  const record = !daily && wave > p.bestWave;
  const gold = Math.round((20 * waves + 0.6 * waves * waves) * (1 + 0.1 * (p.workshop.goldGain ?? 0)) * mult);
  const blueprints = Math.floor(waves / 2) + 2;
  const medals = Math.floor(waves / 10) + (record ? 2 : 0) + (daily ? 1 : 0);
  const supplyDrops = Math.floor(waves / 10);
  const spins = waves >= 5 ? Math.max(1, Math.floor(waves / 10)) : 0;
  const owned = Object.values(p.cards).filter((c) => c.owned);
  const deckIds = new Set([...p.deck.towers, ...p.deck.skills, p.deck.hero]);
  const dropsMap = new Map<string, number>();
  const nCopies = 2 + supplyDrops * 3 + (record ? 4 : 0);
  for (let i = 0; i < nCopies && owned.length; i++) {
    let total = 0;
    for (const c of owned) total += deckIds.has(c.id) ? 2 : 1;
    let r = Math.random() * total;
    for (const c of owned) {
      r -= deckIds.has(c.id) ? 2 : 1;
      if (r < 0) {
        dropsMap.set(c.id, (dropsMap.get(c.id) ?? 0) + 1);
        break;
      }
    }
  }
  const unlocked: string[] = [];
  if (!daily) for (const u of UNLOCKS) if (wave >= u.wave && p.bestWave < u.wave) unlocked.push(u.label);
  return { gold, blueprints, medals, drops: [...dropsMap].map(([id, n]) => ({ id, n })), supplyDrops, spins, record, unlocked };
}

export interface SpinResult {
  reels: string[];
  label: string;
  gold: number;
  blueprints: number;
  medals: number;
  jokers: number;
}
export const REEL_SYMBOLS = ['coin', 'gear', 'star', 'medal', 'joker', 'gem'];
export function spinMachine(wave: number): SpinResult {
  const pick = () => {
    const w = [30, 22, 16, 10, 8, 4];
    let r = Math.random() * 90;
    for (let i = 0; i < w.length; i++) {
      r -= w[i];
      if (r < 0) return REEL_SYMBOLS[i];
    }
    return REEL_SYMBOLS[0];
  };
  let reels = [pick(), pick(), pick()];
  if (Math.random() < 0.18) reels = [reels[0], reels[0], reels[2]];
  if (Math.random() < 0.06) reels = [reels[0], reels[0], reels[0]];
  const counts = new Map<string, number>();
  for (const s of reels) counts.set(s, (counts.get(s) ?? 0) + 1);
  const [sym, n] = [...counts].sort((a, b) => b[1] - a[1])[0];
  const base = 40 + wave * 6;
  const out: SpinResult = { reels, label: 'Small prize', gold: base, blueprints: 0, medals: 0, jokers: 0 };
  const k = n === 3 ? 6 : n === 2 ? 2.5 : 1;
  out.label = n === 3 ? 'JACKPOT!' : n === 2 ? 'Nice pair!' : 'Small prize';
  switch (sym) {
    case 'coin': out.gold = Math.round(base * k); break;
    case 'gear': out.blueprints = Math.round(4 * k); break;
    case 'star': out.gold = Math.round(base * k * 0.6); out.blueprints = Math.round(2 * k); break;
    case 'medal': out.medals = n >= 2 ? Math.round(k / 2) : 0; out.gold = n < 2 ? base : 0; break;
    case 'joker': out.jokers = n >= 2 ? Math.round(k / 2) : 0; out.gold = n < 2 ? base : 0; break;
    case 'gem': out.gold = Math.round(base * k * 1.5); out.medals = n === 3 ? 3 : 0; break;
  }
  return out;
}

export function applyRewards(p: Profile, r: Rewards): void {
  p.gold += r.gold;
  p.blueprints += r.blueprints;
  p.medals += r.medals;
  for (const d of r.drops) {
    const c = p.cards[d.id];
    if (c) c.copies += d.n;
  }
}

export function applyUnlocks(p: Profile, wave: number): string[] {
  const out: string[] = [];
  for (const u of UNLOCKS) {
    if (wave >= u.wave) {
      for (const id of u.items) {
        const c = p.cards[id];
        if (c && !c.owned) {
          c.owned = true;
          c.isNew = true;
          out.push(id);
        }
      }
    }
  }
  return out;
}

export function canMerge(p: Profile, id: string): { ok: boolean; need: number; gold: number; useJokers: number } {
  const c = p.cards[id];
  if (!c || !c.owned || c.rarity >= 6) return { ok: false, need: 0, gold: 0, useJokers: 0 };
  const need = MERGE_COST[c.rarity];
  const gold = mergeGold(c.rarity);
  const useJokers = Math.max(0, need - c.copies);
  return { ok: c.copies + p.jokers >= need && p.gold >= gold, need, gold, useJokers: Math.min(useJokers, p.jokers) };
}

export function doMerge(p: Profile, id: string): boolean {
  const m = canMerge(p, id);
  if (!m.ok) return false;
  const c = p.cards[id];
  const fromCopies = Math.min(c.copies, m.need);
  c.copies -= fromCopies;
  p.jokers -= m.need - fromCopies;
  p.gold -= m.gold;
  c.rarity++;
  return true;
}

export function canLevel(p: Profile, id: string): { ok: boolean; gold: number; bp: number; capped: boolean } {
  const c = p.cards[id];
  if (!c || !c.owned) return { ok: false, gold: 0, bp: 0, capped: false };
  const capped = c.level >= LEVEL_CAP[c.rarity];
  const cost = levelCost(c.level);
  return { ok: !capped && p.gold >= cost.gold && p.blueprints >= cost.bp, gold: cost.gold, bp: cost.bp, capped };
}

export function doLevel(p: Profile, id: string): boolean {
  const l = canLevel(p, id);
  if (!l.ok) return false;
  p.gold -= l.gold;
  p.blueprints -= l.bp;
  p.cards[id].level++;
  return true;
}

/** Joker exchange: trade 3 spare copies (any cards) for 1 joker. */
export function exchangeJoker(p: Profile, id: string): boolean {
  const c = p.cards[id];
  if (!c || c.copies < 3) return false;
  c.copies -= 3;
  p.jokers += 1;
  return true;
}

export function power(p: Profile): number {
  let s = 0;
  for (const id of [...p.deck.towers, ...p.deck.skills, p.deck.hero]) {
    const c = p.cards[id];
    if (c) s += (c.rarity + 1) * 100 + c.level * 12;
  }
  return s;
}
