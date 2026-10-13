import type { Battle } from '../battle';
import { Board, FORT, W, H } from '../board/board';
import type { Card, Command, Vec2 } from '../types';
import { TOWER_MAP, towerStats } from '../../data/towers';
import { HERO_MAP, SKILL_MAP } from '../../data/skills';
import { isDamageDealer } from '../draft/draft';

/** Heuristic player used for balance sims and the in-game Auto toggle. */
export class Autoplay {
  private castCooldown = 0;

  pathSamples(b: Battle): Vec2[] {
    const out: Vec2[] = [];
    const p = b.board.path;
    const s = { x: 0, y: 0, tx: 0, ty: 0 };
    for (let d = 0.5; d < p.length; d += 0.5) {
      p.sample(d, s);
      out.push({ x: s.x, y: s.y });
    }
    return out;
  }

  airSamples(b: Battle): Vec2[] {
    const g = b.board.gate;
    const out: Vec2[] = [];
    const fx = FORT.x + 0.5, fy = FORT.y + 0.5;
    for (let k = 0; k <= 1; k += 0.08) out.push({ x: fx + (g.x + 0.5 - fx) * k, y: fy + (g.y + 0.5 - fy) * k });
    return out;
  }

  coverage(pts: Vec2[], x: number, y: number, range: number, minRange: number): number {
    let n = 0;
    for (const p of pts) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d <= range && d >= minRange) n++;
    }
    return n;
  }

  decide(b: Battle): Command | null {
    if (b.over) return null;
    if (b.offer) return { t: 'pick', index: this.pickCard(b, b.offer) };
    if (b.placing) return this.place(b, b.placing);
    return this.combat(b);
  }

  private pickCard(b: Battle, offer: Card[]): number {
    let best = 0, bs = -Infinity;
    const onBoard: Record<string, number> = {};
    for (const t of b.towers) onBoard[t.def.id] = (onBoard[t.def.id] ?? 0) + 1;
    const canAir = b.towers.some((t) => t.def.targets !== 'ground' && t.def.targets !== 'none');
    const airSoon = !b.lab && [b.wave + 1, b.wave + 2].some((w) => b.getPlan(w).hasAir);
    const freeLand = b.board.freeBuildTiles().length;
    offer.forEach((c, i) => {
      let s = 0;
      switch (c.kind) {
        case 'tower': {
          const d = TOWER_MAP[c.id];
          s = 50 - 9 * (onBoard[c.id] ?? 0);
          if (airSoon && !canAir && d.targets !== 'ground') s += 70;
          if (d.delivery === 'buff') s = b.towers.length >= 4 ? 40 : 5;
          if (b.towers.length < 2 && d.targets === 'air') s -= 25;
          if (isDamageDealer(c.id)) s += b.towers.length < 3 ? 25 : 8;
          break;
        }
        case 'road':
          s = 38 + Math.max(-25, Math.min(30, (8 + b.wave * 0.7 - b.board.road.length) * 3));
          break;
        case 'field':
          s = 25 + (freeLand < 4 ? 55 : freeLand < 8 ? 15 : 0);
          break;
        case 'star':
          s = 28 + 9 * (onBoard[c.id] ?? 0) - 3 * (b.stars[c.id] ?? 1);
          break;
        case 'skill': {
          const st = b.skills.find((x) => x.id === c.id);
          s = st && st.level === 0 ? 45 : 18;
          break;
        }
        case 'hero':
          s = 58;
          break;
        case 'repair':
          s = (1 - b.fortHp / b.fortMax) * 110;
          break;
        case 'move':
        case 'switch':
          s = 4;
          break;
      }
      if (s > bs) {
        bs = s;
        best = i;
      }
    });
    return best;
  }

  private place(b: Battle, card: Card): Command | null {
    const bd = b.board;
    switch (card.kind) {
      case 'road': {
        let best: Command | null = null, bs = -Infinity;
        const towers = b.towers;
        for (const pid of new Set(card.pieces)) {
          for (const o of bd.roadOptions(pid)) {
            let s = o.tiles.length * 4;
            for (const t of o.tiles) {
              for (const tw of towers) {
                const d = Math.hypot(tw.x - (t.x + 0.5), tw.y - (t.y + 0.5));
                if (d <= tw.stats.range && d >= tw.stats.minRange) s += 3;
              }
            }
            const end = o.tiles[o.tiles.length - 1];
            let freeN = 0, fog = 0;
            for (let dy = -2; dy <= 2; dy++)
              for (let dx = -2; dx <= 2; dx++) {
                const x = end.x + dx, y = end.y + dy;
                if (!bd.inb(x, y)) continue;
                const i = Board.idx(x, y);
                if (!bd.revealed[i]) fog++;
                else if (bd.canBuild(x, y) && !o.tiles.some((t) => t.x === x && t.y === y)) freeN++;
              }
            s += freeN * 1.2 + fog * 0.4;
            // prefer heading away from the fortress (longer routes later)
            s += Math.hypot(end.x - FORT.x, end.y - FORT.y) * 0.8;
            if (s > bs) {
              bs = s;
              best = { t: 'placeRoad', piece: pid, rot: o.rot, mirror: o.mirror };
            }
          }
        }
        return best;
      }
      case 'field': {
        const g = bd.gate;
        let best: Command | null = null, bs = -Infinity;
        for (const o of bd.fieldOptions(card.shape)) {
          const s = o.cells.length * 2 - Math.hypot(o.x - g.x, o.y - g.y) * 1.5 - Math.abs(o.x - 6) * 0.2;
          if (s > bs) {
            bs = s;
            best = { t: 'placeField', shape: card.shape, x: o.x, y: o.y, rot: o.rot };
          }
        }
        return best;
      }
      case 'tower': {
        const p = this.bestTile(b, card.id);
        return p ? { t: 'placeTower', x: p.x, y: p.y } : null;
      }
      case 'hero': {
        const h = HERO_MAP[card.id];
        const pts = this.pathSamples(b);
        let best: Vec2 | null = null, bs = -Infinity;
        for (const t of bd.freeBuildTiles()) {
          const s = this.coverage(pts, t.x + 0.5, t.y + 0.5, h.range, 0);
          if (s > bs) {
            bs = s;
            best = t;
          }
        }
        return best ? { t: 'placeHero', x: best.x, y: best.y } : null;
      }
      case 'move': {
        const free = bd.freeBuildTiles();
        const tw = b.towers.find((t) => !t.def.onRoad);
        if (!tw || !free.length) return null;
        const p = this.bestTile(b, tw.def.id) ?? free[0];
        return { t: 'move', from: { x: tw.tx, y: tw.ty }, to: p };
      }
      case 'switch': {
        const units: Vec2[] = b.towers.filter((t) => !t.def.onRoad).map((t) => ({ x: t.tx, y: t.ty }));
        if (b.hero) units.push({ x: b.hero.tx, y: b.hero.ty });
        if (units.length < 2) return null;
        return { t: 'switch', a: units[0], b: units[1] };
      }
      default:
        return null;
    }
  }

  bestTile(b: Battle, id: string): Vec2 | null {
    const bd = b.board;
    const def = TOWER_MAP[id];
    const st = towerStats(def, 0, 1, b.stars[id] ?? 1);
    if (def.onRoad) {
      const tiles = bd.freeTrapTiles();
      if (!tiles.length) return null;
      let best = tiles[0], bs = -Infinity;
      for (const t of tiles) {
        let s = 0;
        for (const tw of b.towers) if (Math.hypot(tw.x - t.x - 0.5, tw.y - t.y - 0.5) <= tw.stats.range) s++;
        s -= Math.abs(bd.tileCenterD(t.x, t.y) - bd.path.length * 0.4) * 0.1;
        if (s > bs) {
          bs = s;
          best = t;
        }
      }
      return best;
    }
    const pts = def.targets === 'air' ? this.airSamples(b) : this.pathSamples(b);
    const air = def.targets === 'both' ? this.airSamples(b) : [];
    let best: Vec2 | null = null, bs = -Infinity;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!bd.canBuild(x, y)) continue;
        const cx = x + 0.5, cy = y + 0.5;
        let s: number;
        if (def.delivery === 'buff') {
          s = 0;
          for (const t of b.towers) if (Math.hypot(t.x - cx, t.y - cy) <= st.buffRadius) s += 3;
        } else {
          s = this.coverage(pts, cx, cy, st.range, st.minRange) + this.coverage(air, cx, cy, st.range, 0) * 0.5;
          if (def.delivery === 'summon' || def.delivery === 'rolling') s = this.coverage(pts, cx, cy, Math.min(st.range, 1.6), 0) * 2;
        }
        if (bd.power[Board.idx(x, y)]) s *= 1.2;
        if (s > bs) {
          bs = s;
          best = { x, y };
        }
      }
    return best;
  }

  private combat(b: Battle): Command | null {
    this.castCooldown -= 1;
    if (this.castCooldown > 0) return null;
    this.castCooldown = 15;
    if (b.hero && b.hero.charge >= b.hero.def.charge && b.enemies.length >= 4) return { t: 'heroSpecial' };
    if (b.enemies.length < 4 && !b.enemies.some((e) => e.def.boss)) return null;
    for (const s of b.skills) {
      if (s.level <= 0 || s.cd > 0) continue;
      const def = SKILL_MAP[s.id];
      if (def.id === 'repair') {
        if (b.fortHp < b.fortMax * 0.6) return { t: 'cast', skill: s.id, x: 0, y: 0 };
        continue;
      }
      if (def.aim === 'none') return { t: 'cast', skill: s.id, x: 0, y: 0 };
      // densest cluster
      let best = b.enemies[0], bc = -1;
      for (const e of b.enemies) {
        let c = 0;
        for (const o of b.enemies) if (Math.hypot(o.x - e.x, o.y - e.y) < Math.max(1, def.radius)) c += o.def.boss ? 6 : 1;
        if (c > bc) {
          bc = c;
          best = e;
        }
      }
      if (best) return { t: 'cast', skill: s.id, x: best.x, y: best.y };
    }
    return null;
  }
}
