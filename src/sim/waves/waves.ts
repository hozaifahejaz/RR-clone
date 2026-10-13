import { Rng, hash32 } from '../core/rng';
import { ENEMY_MAP } from '../../data/enemies';
import { BOSS_ROTATION, ELITE_AFFIXES, WAVE_TEMPLATES, phaseFor, waveBudget } from '../../data/endless';

export interface Spawn {
  at: number; // seconds after wave start
  enemy: string;
  elite: boolean;
  affix: string | null;
  boss: boolean;
}

export interface WavePlan {
  wave: number;
  name: string;
  boss: string | null;
  hasAir: boolean;
  spawns: Spawn[];
}

export const ENEMY_UNLOCK: Record<string, number> = {
  scrapper: 1, dasher: 2, buzzer: 3, brute: 4, swarm: 5, medic: 11, bomber: 13, splitter: 15,
  shellback: 21, rocketeer: 23, burrower: 25, phase: 27, emp: 36, warden: 38, frostblade: 40, juggernaut: 42,
};

export function planWave(seed: number, w: number, mutators: string[]): WavePlan {
  const rng = new Rng(hash32(seed, 'wave', w));
  const phase = phaseFor(w);
  const eliteRush = mutators.includes('eliteRush');
  const eliteChance = eliteRush ? Math.max(0.1, phase.eliteChance * 2) : phase.eliteChance;
  const isBoss = w % 10 === 0;
  const boss = isBoss ? BOSS_ROTATION[(w / 10 - 1) % BOSS_ROTATION.length] : null;
  const templates = WAVE_TEMPLATES.filter((t) => t.minWave <= w);
  const tpl = isBoss ? WAVE_TEMPLATES[0] : rng.weighted(templates, (t) => t.weight)!;
  let budget = waveBudget(w) * (isBoss ? 0.45 : 1);
  const pool = phase.pool.filter((id) => (ENEMY_UNLOCK[id] ?? 1) <= w);
  const spawns: Spawn[] = [];
  let t = 0;
  const addGroup = (id: string, count: number, interval: number) => {
    for (let i = 0; i < count; i++) {
      const elite = rng.chance(eliteChance) && id !== 'swarm' && id !== 'mini';
      spawns.push({ at: t, enemy: id, elite, affix: elite ? rng.pick(ELITE_AFFIXES) : null, boss: false });
      t += interval;
    }
    t += 0.6;
  };
  if (boss) {
    spawns.push({ at: 0, enemy: boss, elite: false, affix: null, boss: true });
    t = 2.5;
  }
  let groups = 0;
  while (budget > 0.6 && groups < 6) {
    const cand = pool.filter((id) => ENEMY_MAP[id].threat <= budget + 0.5);
    if (!cand.length) break;
    const id = rng.weighted(cand, (e) => tpl.prefer(e))!;
    const def = ENEMY_MAP[id];
    const maxCount = Math.max(1, Math.floor(budget / def.threat));
    const want = id === 'swarm' ? rng.int(8, 18) : rng.int(2, 7);
    const count = Math.min(maxCount, want);
    addGroup(id, count, tpl.interval);
    budget -= count * def.threat;
    groups++;
  }
  if (mutators.includes('doubleAir') && w >= 2) {
    const airPool = pool.filter((id) => ENEMY_MAP[id].air);
    const id = airPool.length ? rng.pick(airPool) : 'buzzer';
    const n = Math.max(2, Math.round((waveBudget(w) * 0.4) / ENEMY_MAP[id].threat));
    addGroup(id, Math.min(n, 14), 0.6);
  }
  // compress if spawning would take longer than ~11s
  const last = spawns.length ? spawns[spawns.length - 1].at : 0;
  if (last > 11) {
    const k = 11 / last;
    for (const s of spawns) s.at *= k;
  }
  const hasAir = spawns.some((s) => ENEMY_MAP[s.enemy].air);
  return { wave: w, name: boss ? ENEMY_MAP[boss].name : tpl.name, boss, hasAir, spawns };
}
