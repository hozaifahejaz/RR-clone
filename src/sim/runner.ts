import { Battle } from './battle';
import { Autoplay } from './ai/autoplay';
import type { BattleConfig, TimedCommand } from './types';

export interface RunResult {
  wave: number;
  ticks: number;
  kills: number;
  picks: number;
  towers: { id: string; dmg: number }[];
  hash: number;
  log: TimedCommand[];
}

/** Run a battle headlessly with the autoplay AI. */
export function runAuto(cfg: BattleConfig, maxWave = 200, maxTicks = 30 * 60 * 90): RunResult {
  const b = new Battle(cfg);
  const ai = new Autoplay();
  let guard = 0;
  while (!b.over && b.wave < maxWave && b.tick < maxTicks) {
    if (b.frozen) {
      const cmd = ai.decide(b);
      if (!cmd || !b.command(cmd)) {
        // AI couldn't resolve: skip the pick to avoid deadlock
        if (b.offer) b.command({ t: 'pick', index: 0 });
        else if (b.placing) { b.placing = null; b.nextOffer(); }
        if (++guard > 1000) break;
      }
      b.events.length = 0;
      continue;
    }
    const cmd = ai.decide(b);
    if (cmd) b.command(cmd);
    b.step();
    b.events.length = 0;
  }
  return summarize(b);
}

/** Replay a recorded command log. */
export function replay(cfg: BattleConfig, log: TimedCommand[], maxTicks = 30 * 60 * 120): RunResult {
  const b = new Battle(cfg);
  let i = 0;
  while (!b.over && b.tick < maxTicks) {
    while (i < log.length && log[i].tick === b.tick) {
      b.command(log[i].cmd);
      i++;
    }
    if (b.frozen) {
      if (i >= log.length) break;
      if (log[i].tick !== b.tick) break; // desync guard
      continue;
    }
    if (i >= log.length && b.over) break;
    b.step();
    b.events.length = 0;
  }
  return summarize(b);
}

export function stateHash(b: Battle): number {
  let h = 0;
  const mix = (v: number) => { h = (Math.imul(h ^ Math.round(v * 1000), 2654435761) >>> 0); };
  mix(b.tick); mix(b.wave); mix(b.fortHp); mix(b.kills); mix(b.xp); mix(b.level);
  for (const e of b.enemies) { mix(e.id); mix(e.hp); mix(e.r); }
  for (const t of b.towers) { mix(t.id); mix(t.dmgDealt); }
  return h;
}

function summarize(b: Battle): RunResult {
  const agg: Record<string, number> = {};
  for (const t of b.towers) agg[t.def.id] = (agg[t.def.id] ?? 0) + t.dmgDealt;
  return {
    wave: b.wave, ticks: b.tick, kills: b.kills, picks: b.picks,
    towers: Object.entries(agg).map(([id, dmg]) => ({ id, dmg })).sort((a, c) => c.dmg - a.dmg),
    hash: stateHash(b), log: b.log,
  };
}
