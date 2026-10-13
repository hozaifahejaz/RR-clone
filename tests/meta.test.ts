import { describe, expect, it } from 'vitest';
import {
  newProfile, doMerge, canMerge, doLevel, computeRewards, applyRewards, applyUnlocks, dailyConfig, exchangeJoker, migrate, MERGE_COST,
} from '../src/meta/profile';
import { LEVEL_CAP } from '../src/data/towers';

describe('profile', () => {
  it('starts with the starter deck owned', () => {
    const p = newProfile();
    for (const id of [...p.deck.towers, ...p.deck.skills, p.deck.hero]) expect(p.cards[id].owned).toBe(true);
    expect(p.cards.amp.owned).toBe(false);
  });
  it('merges identical copies into the next rarity', () => {
    const p = newProfile();
    p.gold = 10000;
    p.cards.cannon.copies = MERGE_COST[0];
    expect(canMerge(p, 'cannon').ok).toBe(true);
    expect(doMerge(p, 'cannon')).toBe(true);
    expect(p.cards.cannon.rarity).toBe(1);
    expect(p.cards.cannon.copies).toBe(0);
  });
  it('jokers fill missing copies', () => {
    const p = newProfile();
    p.gold = 10000;
    p.cards.tesla.copies = 1;
    p.jokers = 2;
    expect(doMerge(p, 'tesla')).toBe(true);
    expect(p.jokers).toBe(0);
  });
  it('joker exchange trades 3 copies for 1 joker', () => {
    const p = newProfile();
    p.cards.gust.copies = 4;
    expect(exchangeJoker(p, 'gust')).toBe(true);
    expect(p.jokers).toBe(1);
    expect(p.cards.gust.copies).toBe(1);
  });
  it('levels are capped by rarity', () => {
    const p = newProfile();
    p.gold = 1e9;
    p.blueprints = 1e9;
    for (let i = 0; i < 50; i++) doLevel(p, 'cannon');
    expect(p.cards.cannon.level).toBe(LEVEL_CAP[0]);
  });
  it('rewards scale with waves and flag records', () => {
    const p = newProfile();
    const r10 = computeRewards(p, 10, [], false);
    const r30 = computeRewards(p, 30, [], false);
    expect(r30.gold).toBeGreaterThan(r10.gold);
    expect(r30.record).toBe(true);
    applyRewards(p, r30);
    expect(p.gold).toBeGreaterThan(150);
  });
  it('depth unlocks grant new cards', () => {
    const p = newProfile();
    const got = applyUnlocks(p, 22);
    expect(got).toContain('barracks');
    expect(got).toContain('laser');
    expect(p.cards.kira.owned).toBe(true);
    expect(p.cards.amp.owned).toBe(false);
  });
  it('daily config is stable for a date and has anti-air', () => {
    const a = dailyConfig('2026-10-13'), b = dailyConfig('2026-10-13');
    expect(a).toEqual(b);
    expect(a.deck.towers.length).toBe(6);
    expect(new Set(a.deck.towers.map((t) => t.id)).size).toBe(6);
  });
  it('migrates old saves without losing progress', () => {
    const p = newProfile();
    p.gold = 777;
    delete (p.cards as Record<string, unknown>).amp;
    const m = migrate(p);
    expect(m.gold).toBe(777);
    expect(m.cards.amp).toBeTruthy();
  });
});
