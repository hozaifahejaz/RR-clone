import { describe, expect, it } from 'vitest';
import { Rng } from '../src/sim/core/rng';
import { Battle, classMult } from '../src/sim/battle';
import { Board, FORT } from '../src/sim/board/board';
import { runAuto, replay } from '../src/sim/runner';
import { starterDeck } from '../src/data/decks';
import { planWave } from '../src/sim/waves/waves';
import { towerStats, TOWERS } from '../src/data/towers';
import type { BattleConfig } from '../src/sim/types';

const cfg = (seed: number, extra: Partial<BattleConfig> = {}): BattleConfig => ({
  seed, mode: 'endless', deck: starterDeck(), workshop: {}, mutators: [], ...extra,
});

describe('rng', () => {
  it('is deterministic', () => {
    const a = new Rng(42), b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });
});

describe('board', () => {
  it('starts with a 3-tile road leading away from the fortress', () => {
    const b = new Board();
    b.generate(1, 'plains', false);
    expect(b.road.length).toBe(3);
    expect(b.gate).toEqual({ x: FORT.x, y: FORT.y - 3 });
    expect(b.path.length).toBeCloseTo(3, 1);
  });
  it('road options attach to the gate and only use revealed land', () => {
    const b = new Board();
    b.generate(2, 'plains', false);
    const opts = b.roadOptions('corner');
    expect(opts.length).toBeGreaterThan(0);
    for (const o of opts) {
      const first = o.tiles[0];
      expect(Math.abs(first.x - b.gate.x) + Math.abs(first.y - b.gate.y)).toBe(1);
      for (const t of o.tiles) expect(b.revealed[Board.idx(t.x, t.y)]).toBe(1);
    }
  });
  it('placing road extends the path and moves the gate', () => {
    const b = new Board();
    b.generate(3, 'plains', false);
    const before = b.path.length;
    const o = b.roadOptions('stub')[0];
    b.placeRoad(o);
    expect(b.path.length).toBeGreaterThan(before + 1.5);
    expect(b.gate).toEqual(o.tiles[o.tiles.length - 1]);
  });
  it('field placement must touch revealed land', () => {
    const b = new Board();
    b.generate(4, 'plains', false);
    expect(b.fieldValid('square', 0, 0, 0)).toBeNull();
    expect(b.fieldOptions('square').length).toBeGreaterThan(0);
  });
});

describe('combat', () => {
  it('class triangle is +/-20%', () => {
    expect(classMult('vanguard', 'swift')).toBe(1.2);
    expect(classMult('swift', 'vanguard')).toBe(0.8);
    expect(classMult('utility', 'swift')).toBe(1);
  });
  it('stars apply perks in order', () => {
    const cannon = TOWERS.find((t) => t.id === 'cannon')!;
    expect(towerStats(cannon, 0, 1, 2).dmg).toBeCloseTo(cannon.base.dmg! * 1.25);
    expect(towerStats(cannon, 0, 1, 3).knock).toBeGreaterThan(0);
  });
  it('armor reduces damage but never below 10%', () => {
    const b = new Battle({ ...cfg(5), mode: 'lab' });
    const e = b.spawnEnemy('brute', 1);
    e.armor = 1000;
    const hp = e.hp;
    b.damage(e, 100, { cls: 'utility' });
    expect(hp - e.hp).toBeCloseTo(10);
  });
  it('push moves an enemy back toward the gate, clamped', () => {
    const b = new Battle({ ...cfg(6), mode: 'lab' });
    const e = b.spawnEnemy('scrapper', 1);
    e.r = 1;
    b.displace(e, 0.5);
    expect(e.r).toBeCloseTo(1.5);
    b.displace(e, 100);
    expect(e.r).toBeLessThanOrEqual(b.board.path.length);
  });
});

describe('waves', () => {
  it('wave plans are pure functions of seed + wave', () => {
    expect(planWave(9, 12, [])).toEqual(planWave(9, 12, []));
  });
  it('every 10th wave has a boss', () => {
    expect(planWave(1, 10, []).boss).toBeTruthy();
    expect(planWave(1, 11, []).boss).toBeNull();
  });
});

describe('draft', () => {
  it('opening offer has a tower, a road and a field', () => {
    const b = new Battle(cfg(7));
    const kinds = b.offer!.map((c) => c.kind).sort();
    expect(kinds).toEqual(['field', 'road', 'tower']);
  });
  it('never offers duplicate cards', () => {
    for (let s = 0; s < 20; s++) {
      const b = new Battle(cfg(100 + s));
      const keys = b.offer!.map((c) => JSON.stringify(c));
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
  it('guarantees anti-air before flyer waves when you have none', () => {
    const b = new Battle(cfg(8));
    // fake: flyers incoming, no air-capable towers
    b.offersMade = 5;
    b.wave = 4;
    b.plans.set(5, { ...b.getPlan(5), hasAir: true });
    b.offer = null;
    b.pendingPicks = 1;
    b.nextOffer();
    expect(b.offer!.some((c) => c.kind === 'tower' && ['skyguard', 'gatling', 'tesla', 'frost', 'gust'].includes(c.id))).toBe(true);
  });
});

describe('determinism', () => {
  it('same seed + autoplay gives identical results', () => {
    const a = runAuto(cfg(11), 15);
    const b = runAuto(cfg(11), 15);
    expect(a.hash).toBe(b.hash);
    expect(a.wave).toBe(b.wave);
  });
  it('replaying a command log reproduces the run', () => {
    const a = runAuto(cfg(12), 12);
    const r = replay(cfg(12), a.log, a.ticks);
    expect(r.hash).toBe(a.hash);
  });
});
