import { Rng } from '../core/rng';
import type { Vec2 } from '../types';
import { PIECE_MAP, FIELD_MAP } from '../../data/pieces';

export const W = 13;
export const H = 21;
export const FORT: Vec2 = { x: 6, y: 18 };

export const enum T {
  Land = 0,
  Rock = 1,
  Water = 2,
  Chasm = 3,
}

/** Direction vectors: 0=N(up), 1=E, 2=S, 3=W */
export const DIRS: Vec2[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

export interface RoadOption {
  piece: string;
  rot: number;
  mirror: boolean;
  tiles: Vec2[];
}

export interface FieldOption {
  shape: string;
  x: number;
  y: number;
  rot: number;
  cells: Vec2[];
}

/** Dense sampled path from the fortress (d=0) outward to the gate (d=len). */
export class RoadPath {
  xs: number[] = [];
  ys: number[] = [];
  cum: number[] = [];
  get length(): number {
    return this.cum.length ? this.cum[this.cum.length - 1] : 0;
  }
  build(centers: Vec2[]): void {
    const xs: number[] = [];
    const ys: number[] = [];
    const push = (x: number, y: number) => {
      const n = xs.length;
      if (n && Math.abs(xs[n - 1] - x) < 1e-6 && Math.abs(ys[n - 1] - y) < 1e-6) return;
      xs.push(x);
      ys.push(y);
    };
    const n = centers.length;
    push(centers[0].x, centers[0].y);
    for (let i = 1; i < n - 1; i++) {
      const a = centers[i - 1], c = centers[i], b = centers[i + 1];
      const m1x = (a.x + c.x) / 2, m1y = (a.y + c.y) / 2;
      const m2x = (c.x + b.x) / 2, m2y = (c.y + b.y) / 2;
      const straight = (c.x - a.x) * (b.y - c.y) - (c.y - a.y) * (b.x - c.x) === 0;
      push(m1x, m1y);
      if (straight) {
        push(c.x, c.y);
      } else {
        for (let k = 1; k <= 6; k++) {
          const t = k / 6;
          const u = 1 - t;
          push(u * u * m1x + 2 * u * t * c.x + t * t * m2x, u * u * m1y + 2 * u * t * c.y + t * t * m2y);
        }
      }
    }
    if (n > 1) push(centers[n - 1].x, centers[n - 1].y);
    const cum = [0];
    for (let i = 1; i < xs.length; i++) cum.push(cum[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]));
    this.xs = xs;
    this.ys = ys;
    this.cum = cum;
  }
  private seg(d: number): number {
    const c = this.cum;
    let lo = 0, hi = c.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (c[mid] <= d) lo = mid;
      else hi = mid;
    }
    return lo;
  }
  /** Position at distance d from the fortress. Writes into out. */
  sample(d: number, out: { x: number; y: number; tx: number; ty: number }): void {
    const c = this.cum;
    if (c.length < 2) {
      out.x = this.xs[0] ?? 0;
      out.y = this.ys[0] ?? 0;
      out.tx = 0;
      out.ty = 1;
      return;
    }
    d = Math.max(0, Math.min(d, c[c.length - 1]));
    const i = this.seg(d);
    const j = Math.min(i + 1, c.length - 1);
    const L = c[j] - c[i] || 1;
    const t = (d - c[i]) / L;
    out.x = this.xs[i] + (this.xs[j] - this.xs[i]) * t;
    out.y = this.ys[i] + (this.ys[j] - this.ys[i]) * t;
    // tangent points from gate toward fortress (direction of travel)
    out.tx = (this.xs[i] - this.xs[j]) / L;
    out.ty = (this.ys[i] - this.ys[j]) / L;
  }
  /** Nearest path distance to a point (coarse search over samples). */
  nearest(x: number, y: number): { d: number; dist: number } {
    let best = Infinity, bd = 0;
    for (let i = 0; i < this.xs.length - 1; i++) {
      const ax = this.xs[i], ay = this.ys[i], bx = this.xs[i + 1], by = this.ys[i + 1];
      const dx = bx - ax, dy = by - ay;
      const L2 = dx * dx + dy * dy || 1;
      let t = ((x - ax) * dx + (y - ay) * dy) / L2;
      t = Math.max(0, Math.min(1, t));
      const px = ax + dx * t, py = ay + dy * t;
      const dd = Math.hypot(px - x, py - y);
      if (dd < best) {
        best = dd;
        bd = this.cum[i] + Math.sqrt(L2) * t;
      }
    }
    return { d: bd, dist: best };
  }
}

export class Board {
  terrain = new Uint8Array(W * H);
  revealed = new Uint8Array(W * H);
  power = new Uint8Array(W * H);
  roadIdx = new Int16Array(W * H).fill(-1);
  occupant = new Int32Array(W * H); // tower/hero id
  trap = new Int32Array(W * H); // trap tower id on road
  cracked = new Float32Array(W * H); // seconds until collapse (0 = none)
  road: Vec2[] = []; // from fortress-adjacent tile to gate
  heading = 0;
  path = new RoadPath();
  /** tile index -> distance along path of that tile's center */
  roadD = new Float32Array(W * H);

  static idx(x: number, y: number): number {
    return y * W + x;
  }
  inb(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < W && y < H;
  }
  get gate(): Vec2 {
    return this.road[this.road.length - 1];
  }
  isFort(x: number, y: number): boolean {
    return x === FORT.x && y === FORT.y;
  }

  generate(seed: number, preset: string, bigStart: boolean): void {
    const rng = new Rng(seed ^ 0x51ed);
    const t = this.terrain;
    t.fill(T.Land);
    const blob = (kind: T, n: number, size: number) => {
      for (let i = 0; i < n; i++) {
        let x = rng.int(0, W - 1), y = rng.int(0, H - 8);
        for (let k = 0; k < size; k++) {
          if (this.inb(x, y)) t[Board.idx(x, y)] = kind;
          const d = DIRS[rng.int(0, 3)];
          x += d.x;
          y += d.y;
        }
      }
    };
    if (preset === 'islands') {
      blob(T.Water, 9, 9);
      blob(T.Rock, 6, 2);
    } else if (preset === 'canyon') {
      for (let i = 0; i < 4; i++) {
        let x = rng.int(0, W - 1);
        const y0 = rng.int(0, H - 10);
        for (let y = y0; y < y0 + rng.int(4, 8); y++) {
          if (this.inb(x, y)) t[Board.idx(x, y)] = T.Rock;
          if (rng.chance(0.4)) x += rng.chance(0.5) ? 1 : -1;
        }
      }
      blob(T.Rock, 6, 3);
      blob(T.Water, 2, 4);
    } else {
      blob(T.Rock, 10, 2);
      blob(T.Water, 3, 5);
    }
    // power tiles
    let placed = 0;
    while (placed < 6) {
      const x = rng.int(0, W - 1), y = rng.int(0, H - 4);
      const i = Board.idx(x, y);
      if (t[i] === T.Land && !this.power[i]) {
        this.power[i] = 1;
        placed++;
      }
    }
    // starting island
    const x0 = bigStart ? 2 : 4, x1 = bigStart ? 10 : 8, y0 = bigStart ? 11 : 15, y1 = 19;
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const i = Board.idx(x, y);
        this.revealed[i] = 1;
        if (Math.abs(x - FORT.x) <= 1 || y >= 16) t[i] = T.Land;
      }
    // keep one power tile near the start for flavour
    this.power[Board.idx(FORT.x - 2, 16)] = 1;
    // fortress + initial road
    this.road = [];
    for (let y = FORT.y - 1; y >= FORT.y - 3; y--) this.road.push({ x: FORT.x, y });
    this.heading = 0;
    for (let i = 0; i < this.road.length; i++) {
      const r = this.road[i];
      this.roadIdx[Board.idx(r.x, r.y)] = i;
      this.power[Board.idx(r.x, r.y)] = 0;
    }
    this.power[Board.idx(FORT.x, FORT.y)] = 0;
    this.rebuildPath();
  }

  rebuildPath(): void {
    const centers: Vec2[] = [{ x: FORT.x + 0.5, y: FORT.y + 0.5 }, ...this.road.map((r) => ({ x: r.x + 0.5, y: r.y + 0.5 }))];
    this.path.build(centers);
    for (const r of this.road) this.roadD[Board.idx(r.x, r.y)] = this.path.nearest(r.x + 0.5, r.y + 0.5).d;
  }

  isRoad(x: number, y: number): boolean {
    return this.inb(x, y) && this.roadIdx[Board.idx(x, y)] >= 0;
  }

  /** Free tile for a tower (land, revealed, empty). */
  canBuild(x: number, y: number): boolean {
    if (!this.inb(x, y)) return false;
    const i = Board.idx(x, y);
    return (
      this.revealed[i] === 1 &&
      this.terrain[i] === T.Land &&
      this.roadIdx[i] < 0 &&
      this.occupant[i] === 0 &&
      this.cracked[i] === 0 &&
      !this.isFort(x, y)
    );
  }

  canTrap(x: number, y: number): boolean {
    if (!this.isRoad(x, y)) return false;
    const i = Board.idx(x, y);
    if (this.trap[i]) return false;
    const g = this.gate;
    return !(g.x === x && g.y === y);
  }

  freeBuildTiles(): Vec2[] {
    const out: Vec2[] = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (this.canBuild(x, y)) out.push({ x, y });
    return out;
  }

  freeTrapTiles(): Vec2[] {
    const out: Vec2[] = [];
    for (const r of this.road) if (this.canTrap(r.x, r.y)) out.push({ x: r.x, y: r.y });
    return out;
  }

  private roadTileOk(x: number, y: number, bridge: boolean, seen: Set<number>): boolean {
    if (!this.inb(x, y)) return false;
    const i = Board.idx(x, y);
    if (seen.has(i)) return false;
    if (!this.revealed[i]) return false;
    if (this.roadIdx[i] >= 0 || this.occupant[i] || this.cracked[i] > 0 || this.isFort(x, y)) return false;
    const tt = this.terrain[i];
    if (tt === T.Rock) return false;
    if ((tt === T.Water || tt === T.Chasm) && !bridge) return false;
    return true;
  }

  roadOptions(pieceId: string): RoadOption[] {
    const piece = PIECE_MAP[pieceId];
    if (!piece) return [];
    const out: RoadOption[] = [];
    const seenKeys = new Set<string>();
    const g = this.gate;
    for (let rot = 0; rot < 4; rot++) {
      for (const mirror of [false, true]) {
        let h = rot;
        let x = g.x, y = g.y;
        const tiles: Vec2[] = [];
        const seen = new Set<number>();
        let ok = true;
        let crossed = false;
        for (const ch of piece.steps) {
          if (ch === 'L') h = (h + (mirror ? 1 : 3)) % 4;
          else if (ch === 'R') h = (h + (mirror ? 3 : 1)) % 4;
          x += DIRS[h].x;
          y += DIRS[h].y;
          if (!this.roadTileOk(x, y, !!piece.bridge, seen)) {
            ok = false;
            break;
          }
          const i = Board.idx(x, y);
          if (this.terrain[i] !== T.Land) crossed = true;
          seen.add(i);
          tiles.push({ x, y });
        }
        if (!ok) continue;
        if (piece.bridge && !crossed) continue;
        const key = tiles.map((t) => `${t.x},${t.y}`).join('|');
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        out.push({ piece: pieceId, rot, mirror, tiles });
      }
    }
    return out;
  }

  placeRoad(opt: RoadOption): void {
    for (const t of opt.tiles) {
      const i = Board.idx(t.x, t.y);
      this.roadIdx[i] = this.road.length;
      this.power[i] = 0;
      if (this.terrain[i] !== T.Land) this.terrain[i] = T.Land; // bridge deck
      this.road.push({ x: t.x, y: t.y });
    }
    const n = this.road.length;
    if (n >= 2) {
      const a = this.road[n - 2], b = this.road[n - 1];
      this.heading = DIRS.findIndex((d) => d.x === b.x - a.x && d.y === b.y - a.y);
    }
    this.rebuildPath();
  }

  fieldCells(shapeId: string, x: number, y: number, rot: number): Vec2[] {
    const sh = FIELD_MAP[shapeId];
    return sh.cells.map((c) => (rot % 2 ? { x: x + c.y, y: y + c.x } : { x: x + c.x, y: y + c.y }));
  }

  fieldValid(shapeId: string, x: number, y: number, rot: number): Vec2[] | null {
    const cells = this.fieldCells(shapeId, x, y, rot);
    let fresh = 0, touches = false;
    const out: Vec2[] = [];
    for (const c of cells) {
      if (!this.inb(c.x, c.y)) continue;
      const i = Board.idx(c.x, c.y);
      if (this.revealed[i]) continue;
      fresh++;
      out.push(c);
      for (const d of DIRS) {
        const nx = c.x + d.x, ny = c.y + d.y;
        if (this.inb(nx, ny) && this.revealed[Board.idx(nx, ny)]) touches = true;
      }
    }
    return fresh >= 3 && touches ? out : null;
  }

  fieldOptions(shapeId: string, limit = 9999): FieldOption[] {
    const out: FieldOption[] = [];
    const rots = shapeId === 'strip' ? [0, 1] : [0];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        for (const rot of rots) {
          const c = this.fieldValid(shapeId, x, y, rot);
          if (c) {
            out.push({ shape: shapeId, x, y, rot, cells: c });
            if (out.length >= limit) return out;
          }
        }
    return out;
  }

  reveal(cells: Vec2[]): void {
    for (const c of cells) this.revealed[Board.idx(c.x, c.y)] = 1;
  }

  tileCenterD(x: number, y: number): number {
    return this.roadD[Board.idx(x, y)];
  }
}
