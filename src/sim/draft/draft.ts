import type { Battle } from '../battle';
import type { Card } from '../types';
import { TOWER_MAP } from '../../data/towers';
import { ROAD_PIECES } from '../../data/pieces';
import { FIELD_SHAPES } from '../../data/pieces';

const CONTROL_ROLES = new Set(['Slow', 'Push Back', 'Pull + Slow', 'Crowd Control', 'Buff', 'Road Trap', 'Blocker', 'Anti-Air', 'Roll Stun']);
export function isDamageDealer(id: string): boolean {
  return !CONTROL_ROLES.has(TOWER_MAP[id].role);
}

export function cardKey(c: Card): string {
  switch (c.kind) {
    case 'tower':
    case 'star':
    case 'skill':
    case 'hero':
      return `${c.kind}:${c.id}`;
    case 'field':
      return `field:${c.shape}`;
    default:
      return c.kind;
  }
}

interface Ctx {
  freeLand: number;
  freeTrap: number;
  validPieces: string[];
  validShapes: string[];
  onBoard: Record<string, number>;
  units: number;
}

function context(b: Battle): Ctx {
  const bd = b.board;
  const onBoard: Record<string, number> = {};
  for (const t of b.towers) onBoard[t.def.id] = (onBoard[t.def.id] ?? 0) + 1;
  return {
    freeLand: bd.freeBuildTiles().length,
    freeTrap: bd.freeTrapTiles().length,
    validPieces: ROAD_PIECES.filter((p) => bd.roadOptions(p.id).length > 0).map((p) => p.id),
    validShapes: b.mut('noField') ? [] : FIELD_SHAPES.filter((s) => bd.fieldOptions(s.id, 1).length > 0).map((s) => s.id),
    onBoard,
    units: b.towers.filter((t) => !t.def.onRoad).length + (b.hero ? 1 : 0),
  };
}

function towerValid(id: string, c: Ctx): boolean {
  return TOWER_MAP[id].onRoad ? c.freeTrap > 0 : c.freeLand > 0;
}

function roadCard(b: Battle, c: Ctx): Card | null {
  if (!c.validPieces.length) return null;
  const pieces = ROAD_PIECES.filter((p) => c.validPieces.includes(p.id));
  const a = b.draftRng.weighted(pieces, (p) => p.rarity)!;
  const rest = pieces.filter((p) => p.id !== a.id);
  const second = rest.length ? b.draftRng.weighted(rest, (p) => p.rarity)! : a;
  return { kind: 'road', pieces: [a.id, second.id] };
}

function fieldCard(b: Battle, c: Ctx): Card | null {
  if (!c.validShapes.length) return null;
  return { kind: 'field', shape: b.draftRng.pick(c.validShapes) };
}

export function makeOffer(b: Battle): Card[] {
  const c = context(b);
  const deck = b.cfg.deck;
  const rng = b.draftRng;
  const cands: { card: Card; w: number }[] = [];
  const hpFrac = b.fortHp / b.fortMax;
  const picksSoFar = b.picks;

  for (const d of deck.towers) {
    if (!towerValid(d.id, c)) continue;
    const n = c.onBoard[d.id] ?? 0;
    cands.push({ card: { kind: 'tower', id: d.id }, w: 7 / (1 + 0.18 * n) });
  }
  const road = roadCard(b, c);
  if (road) {
    const desired = 8 + b.wave * 0.7;
    const len = b.board.road.length;
    cands.push({ card: road, w: 13 + Math.max(-9, Math.min(18, (desired - len) * 1.5)) });
  }
  const field = fieldCard(b, c);
  if (field) {
    let w = 9;
    if (c.freeLand < 4) w += 22;
    else if (c.freeLand < 8) w += 8;
    if (!c.validPieces.length) w += 16;
    cands.push({ card: field, w });
  }
  for (const id of Object.keys(c.onBoard)) {
    const st = b.stars[id] ?? 1;
    if (st >= 6) continue;
    cands.push({ card: { kind: 'star', id }, w: 4 + 2.5 * c.onBoard[id] });
  }
  if (c.units >= 2 && c.freeLand > 0) cands.push({ card: { kind: 'move' }, w: 2.2 });
  if (c.units >= 2) cands.push({ card: { kind: 'switch' }, w: 1.6 });
  if (picksSoFar >= 2) {
    for (const s of b.skills) {
      if (s.level >= 5) continue;
      cands.push({ card: { kind: 'skill', id: s.id }, w: s.level === 0 ? 6 : 2.5 });
    }
  }
  if (deck.hero && !b.heroUsed && picksSoFar >= 2 && c.freeLand > 0) cands.push({ card: { kind: 'hero', id: deck.hero.id }, w: 10 });
  if (hpFrac < 0.7) cands.push({ card: { kind: 'repair' }, w: 2 + (1 - hpFrac) * 12 });

  const forced: Card[] = [];
  const find = (pred: (x: Card) => boolean) => cands.find((x) => pred(x.card))?.card;
  if (b.offersMade === 0) {
    // opening hand: a ground-capable tower, a road and a field
    const groundTowers = cands.filter((x) => x.card.kind === 'tower' && isDamageDealer((x.card as { id: string }).id));
    if (groundTowers.length) forced.push(rng.pick(groundTowers).card);
    if (road) forced.push(road);
    if (field) forced.push(field);
  } else {
    // anti-air guarantee
    const canHitAir = b.towers.some((t) => t.def.targets === 'air' || t.def.targets === 'both') || (b.hero && b.hero.def.targets !== 'ground');
    const airSoon = !b.lab && [b.wave + 1, b.wave + 2].some((w) => b.getPlan(w).hasAir);
    if (airSoon && !canHitAir) {
      const aa = cands.filter((x) => x.card.kind === 'tower' && ['air', 'both'].includes(TOWER_MAP[(x.card as { id: string }).id].targets));
      if (aa.length) forced.push(rng.weighted(aa, (x) => (TOWER_MAP[(x.card as { id: string }).id].targets === 'air' ? 2 : 1))!.card);
    }
    if (c.freeLand === 0) {
      const f = field ?? find((x) => x.kind === 'move');
      if (f) forced.push(f);
    }
    if (b.towers.length === 0) {
      const dmg = cands.filter((x) => x.card.kind === 'tower' && isDamageDealer((x.card as { id: string }).id));
      if (dmg.length) forced.push(rng.pick(dmg).card);
    }
    if (b.pity.tower >= 3) {
      const t = cands.filter((x) => x.card.kind === 'tower');
      if (t.length) forced.push(rng.weighted(t, (x) => x.w)!.card);
    }
    if (b.pity.road >= 3 && road) forced.push(road);
    if (b.pity.field >= 4 && field) forced.push(field);
  }

  const out: Card[] = [];
  const keys = new Set<string>();
  for (const f of forced) {
    if (out.length >= 3) break;
    const k = cardKey(f);
    if (keys.has(k)) continue;
    keys.add(k);
    out.push(f);
  }
  let pool = cands.filter((x) => !keys.has(cardKey(x.card)));
  while (out.length < 3 && pool.length) {
    const pick = rng.weighted(pool, (x) => x.w);
    if (!pick) break;
    out.push(pick.card);
    keys.add(cardKey(pick.card));
    pool = pool.filter((x) => !keys.has(cardKey(x.card)));
  }
  // shuffle slot order (deterministic)
  rng.shuffle(out);
  const has = (k: Card['kind']) => out.some((x) => x.kind === k);
  b.pity.tower = has('tower') ? 0 : b.pity.tower + 1;
  b.pity.road = has('road') ? 0 : b.pity.road + 1;
  b.pity.field = has('field') ? 0 : b.pity.field + 1;
  b.offersMade++;
  return out;
}
