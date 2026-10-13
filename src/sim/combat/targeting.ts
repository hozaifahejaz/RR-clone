import type { Battle } from '../battle';
import type { Enemy } from '../entities/entities';
import type { TargetKind, TargetMode } from '../types';

export function inRange(e: Enemy, x: number, y: number, range: number, minRange = 0): boolean {
  const d = Math.hypot(e.x - x, e.y - y);
  return d <= range && d >= minRange;
}

function score(e: Enemy, mode: TargetMode, x: number, y: number): number {
  switch (mode) {
    case 'first':
      return -e.r;
    case 'last':
      return e.r;
    case 'strongest':
      return e.hp + e.shield + (e.def.boss ? 1e6 : 0);
    case 'weakest':
      return -(e.hp + e.shield);
    case 'closest':
      return -Math.hypot(e.x - x, e.y - y);
  }
}

export function findTarget(
  b: Battle,
  x: number,
  y: number,
  kind: TargetKind,
  range: number,
  minRange: number,
  mode: TargetMode,
  exclude?: Set<number>,
): Enemy | null {
  let best: Enemy | null = null;
  let bs = -Infinity;
  for (const e of b.enemies) {
    if (!b.targetable(e, kind)) continue;
    if (exclude && exclude.has(e.id)) continue;
    if (!inRange(e, x, y, range, minRange)) continue;
    const s = score(e, mode, x, y);
    if (s > bs) {
      bs = s;
      best = e;
    }
  }
  return best;
}

export function findTargets(
  b: Battle,
  x: number,
  y: number,
  kind: TargetKind,
  range: number,
  minRange: number,
  mode: TargetMode,
  n: number,
): Enemy[] {
  const list: { e: Enemy; s: number }[] = [];
  for (const e of b.enemies) {
    if (!b.targetable(e, kind)) continue;
    if (!inRange(e, x, y, range, minRange)) continue;
    list.push({ e, s: score(e, mode, x, y) });
  }
  list.sort((a, c) => c.s - a.s || a.e.id - c.e.id);
  return list.slice(0, n).map((l) => l.e);
}

export function enemiesWithin(b: Battle, x: number, y: number, r: number, kind: TargetKind = 'both'): Enemy[] {
  const out: Enemy[] = [];
  for (const e of b.enemies) {
    if (!b.targetable(e, kind)) continue;
    if (Math.hypot(e.x - x, e.y - y) <= r + e.def.size * 0.4) out.push(e);
  }
  return out;
}
