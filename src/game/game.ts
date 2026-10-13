import { Battle, DT } from '../sim/battle';
import type { BattleConfig, Card, Command, TimedCommand, Vec2 } from '../sim/types';
import type { BEvent } from '../sim/events';
import { Board } from '../sim/board/board';
import type { RoadOption } from '../sim/board/board';
import { Autoplay } from '../sim/ai/autoplay';
import { BattleView } from '../render/view';
import type { World } from '../render/world';
import { TOWER_MAP, towerStats } from '../data/towers';
import { HERO_MAP, SKILL_MAP } from '../data/skills';
import { ENEMY_MAP } from '../data/enemies';
import { audio } from '../audio/audio';
import { CLASS_COLORS } from '../render/materials';
import { PHASES } from '../data/endless';

export type Toast = { id: number; text: string; kind: 'info' | 'good' | 'bad' | 'boss' | 'phase' | 'supply' | 'wave'; sub?: string; t: number };

export interface PlaceState {
  card: Card;
  // road
  options?: RoadOption[];
  optIdx?: number;
  // field / tower / hero / move / switch
  tile?: Vec2 | null;
  from?: Vec2 | null;
  rot?: number;
  valid?: boolean;
}

export class Game {
  b: Battle;
  view: BattleView;
  ai = new Autoplay();
  speed = 1;
  paused = false;
  auto = false;
  acc = 0;
  over = false;
  replayLog: TimedCommand[] | null = null;
  private replayIdx = 0;
  place: PlaceState | null = null;
  aiming: string | null = null; // skill id being aimed
  selected: number | null = null; // tower id
  toasts: Toast[] = [];
  private toastId = 1;
  private listeners = new Set<() => void>();
  frameEvents: BEvent[] = [];
  bossBar: { id: number; name: string } | null = null;
  cinematicT = 0;
  hitstop = 0;
  levelFlash = 0;
  fortFlash = 0;
  onOver?: (g: Game) => void;
  private dirtyT = 0;
  hint: string | null = null;
  silent = false;
  tutorial: boolean;
  private seenHints = new Set<string>();

  private replayTicks = Infinity;

  constructor(public world: World, overlay: HTMLElement, cfg: BattleConfig, opts: { replay?: TimedCommand[]; replayTicks?: number; tutorial?: boolean; speed?: number } = {}) {
    this.replayTicks = opts.replayTicks ?? Infinity;
    this.b = new Battle(cfg);
    this.view = new BattleView(world, overlay, this.b);
    this.replayLog = opts.replay ?? null;
    this.tutorial = !!opts.tutorial && !opts.replay;
    this.speed = opts.speed ?? 1;
    this.view.onBigHit = () => (this.hitstop = 0.06);
    audio.setIntensity(opts.replay ? 1 : 1);
    this.syncPlacement();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  notify(): void {
    for (const l of this.listeners) l();
  }

  private toastQueue: Toast[] = [];
  toast(text: string, kind: Toast['kind'] = 'info', sub?: string, dur = 2.2): void {
    const t: Toast = { id: this.toastId++, text, kind, sub, t: dur };
    // small toasts show immediately; banners (wave/boss/phase/supply) play one at a time
    if (kind === 'good' || kind === 'info' || kind === 'bad') {
      this.toasts.push(t);
      if (this.toasts.length > 3) this.toasts.shift();
      return;
    }
    if (kind === 'wave' && this.toastQueue.length) return; // stale wave banners are skipped
    this.toastQueue.push(t);
  }
  private pumpToasts(): void {
    if (this.cinematicT > 0.4) return;
    const bannerActive = this.toasts.some((t) => t.kind === 'wave' || t.kind === 'boss' || t.kind === 'phase' || t.kind === 'supply');
    if (!bannerActive && this.toastQueue.length) this.toasts.push(this.toastQueue.shift()!);
  }

  // ───────────────────────── loop ─────────────────────────
  frame(realDt: number): void {
    const dt = Math.min(0.1, realDt);
    if (this.hitstop > 0) this.hitstop -= dt;
    // cinematic camera for boss intros
    if (this.cinematicT > 0) {
      this.cinematicT -= dt;
      const k = this.cinematicT > 1.6 ? (2.4 - this.cinematicT) / 0.8 : this.cinematicT > 0.6 ? 1 : this.cinematicT / 0.6;
      this.world.cinematic = Math.max(0, Math.min(1, k)) * 0.8;
    } else this.world.cinematic = 0;
    const slow = this.cinematicT > 0.6 ? 0.25 : this.hitstop > 0 ? 0.05 : 1;
    if (!this.paused && !this.b.over) {
      if (this.replayLog) this.applyReplay();
      if (!this.b.frozen) {
        this.acc += dt * this.speed * slow;
        let steps = 0;
        while (this.acc >= DT && steps < 10) {
          if (this.auto) {
            const c = this.ai.decide(this.b);
            if (c) this.command(c, true);
          }
          if (this.replayLog) {
            this.applyReplay();
            if (this.b.tick >= this.replayTicks) {
              this.b.over = true;
              break;
            }
          }
          if (this.b.frozen) break;
          this.b.step();
          this.collect();
          this.acc -= DT;
          steps++;
        }
        if (steps >= 10) this.acc = 0;
      } else {
        this.acc = 0;
        if (this.auto && !this.replayLog) {
          const c = this.ai.decide(this.b);
          if (c) this.command(c, true);
          else if (this.b.offer) this.command({ t: 'pick', index: 0 }, true);
        }
      }
    }
    this.collect();
    const events = this.frameEvents;
    this.frameEvents = [];
    for (const e of events) this.react(e);
    const alpha = this.b.frozen ? 1 : Math.min(1, this.acc / DT);
    const renderDt = this.paused ? 0 : this.b.frozen ? dt * 0.25 : dt * Math.min(this.speed, 2) * (slow < 1 ? 0.5 : 1);
    const bb = this.view.board.bounds;
    if (this.cinematicT <= 0) this.world.frame(bb.minX, bb.maxX, bb.minY, bb.maxY);
    this.view.frame(renderDt, alpha, events);
    this.updatePlacementVisuals();
    for (const t of this.toasts) t.t -= dt;
    this.toasts = this.toasts.filter((t) => t.t > 0);
    this.pumpToasts();
    if (this.levelFlash > 0) this.levelFlash -= dt;
    if (this.fortFlash > 0) this.fortFlash -= dt;
    this.dirtyT += dt;
    if (this.dirtyT > 0.1 || events.length) {
      this.dirtyT = 0;
      this.notify();
    }
    if (this.b.over && !this.over) {
      this.over = true;
      window.setTimeout(() => this.onOver?.(this), 1800);
    }
  }

  private collect(): void {
    if (this.b.events.length) {
      for (const e of this.b.events) this.frameEvents.push(e);
      this.b.events.length = 0;
    }
  }

  private applyReplay(): void {
    const log = this.replayLog!;
    while (this.replayIdx < log.length && log[this.replayIdx].tick <= this.b.tick) {
      this.b.command(log[this.replayIdx].cmd);
      this.replayIdx++;
    }
    this.syncPlacement();
  }

  get replaying(): boolean {
    return !!this.replayLog;
  }

  // ───────────────────────── reactions (audio, toasts) ─────────────────────────
  private react(e: BEvent): void {
    if (this.silent) return;
    switch (e.e) {
      case 'shot':
        audio.play(e.kind === 'bullet' ? 'gun' : e.kind === 'rail' || e.kind === 'mega' ? 'rail' : e.kind === 'missiles' ? 'missile' : 'cannon', { vol: 0.6 });
        break;
      case 'chain':
        audio.play('zap', { vol: 0.6 });
        break;
      case 'boom':
        if (e.kind === 'big' || e.kind === 'orbital') audio.play('bigBoom', { vol: 0.8 });
        else if (e.kind === 'shell' || e.kind === 'air') audio.play('boom', { vol: 0.5 });
        else if (e.kind === 'frost' || e.kind === 'shatter') audio.play('frost', { vol: 0.6 });
        break;
      case 'death':
        audio.play('pop', { vol: 0.5 });
        audio.play('xp', { vol: 0.8 });
        if (e.boss) {
          audio.play('bigBoom');
          this.toast('BOSS DEFEATED', 'good', ENEMY_MAP[e.type]?.name, 2.5);
          this.hitstop = 0.25;
          this.bossBar = null;
        }
        break;
      case 'leak':
        audio.play('leak');
        this.fortFlash = 0.4;
        break;
      case 'levelup':
        audio.play('levelUp');
        this.levelFlash = 0.6;
        break;
      case 'wave': {
        audio.play('wave', { vol: 0.6 });
        if (e.boss) {
          audio.play('boss');
          this.toast(e.name, 'boss', `Wave ${e.wave} — Boss`, 3);
        } else this.toast(`Wave ${e.wave}`, 'wave', e.name + (e.air ? ' · Air' : ''), 1.8);
        if (this.tutorial && e.wave === 1) this.showHint('wave1', 'Enemies march from the Gate along your road. Flyers ignore the road and head straight for the fortress!');
        break;
      }
      case 'phase': {
        audio.play('phase');
        this.toast(e.name.toUpperCase(), 'phase', e.blurb, 3.2);
        const idx = PHASES.findIndex((p) => p.id === e.id);
        audio.setIntensity(1 + Math.min(3, idx * 0.6));
        break;
      }
      case 'bossIntro':
        this.bossBar = { id: e.id, name: e.name };
        this.cinematicT = 2.4;
        this.world.cinematicTarget.set(this.b.board.gate.x + 0.5 - 6.5, 0, this.b.board.gate.y + 0.5 - 10.5);
        audio.setIntensity(4);
        break;
      case 'towerPlaced':
        audio.play('place');
        break;
      case 'road':
        audio.play('road');
        break;
      case 'field':
        audio.play('field');
        break;
      case 'star':
        audio.play('star');
        this.toast(`${TOWER_MAP[e.tower].name} ${'★'.repeat(e.stars)}`, 'good', TOWER_MAP[e.tower].perks[e.stars - 2]?.name, 2);
        break;
      case 'skill':
        audio.play('skill');
        break;
      case 'heroSpecial':
        audio.play('hero');
        this.toast(HERO_MAP[e.id].special.toUpperCase(), 'good', undefined, 1.5);
        break;
      case 'lastStand':
        audio.play('lastStand');
        this.toast('LAST STAND', 'bad', 'The fortress unleashes everything!', 2.8);
        this.hitstop = 0.4;
        break;
      case 'gameOver':
        audio.play('gameOver');
        audio.setIntensity(0);
        break;
      case 'supply':
        audio.play('supply');
        this.toast('SUPPLY DROP', 'supply', `Wave ${e.wave} cleared — rewards banked`, 2.4);
        break;
      case 'towerKO':
        audio.play('error');
        break;
      case 'crack':
        if (this.b.phase.collapse) this.showHint('collapse', 'COLLAPSE: building cracks nearby land. It falls away in 20 seconds!');
        break;
      case 'gust':
        audio.play('gust', { vol: 0.5 });
        break;
      case 'hook':
        audio.play('hook', { vol: 0.6 });
        break;
      case 'stomp':
      case 'freezeCol':
        audio.play('boom');
        break;
    }
    if (e.e === 'bossPhase') audio.play('phase', { vol: 0.5 });
  }

  showHint(key: string, text: string): void {
    if (!this.tutorial || this.seenHints.has(key)) return;
    this.seenHints.add(key);
    this.hint = text;
  }

  // ───────────────────────── commands ─────────────────────────
  command(c: Command, fromAuto = false): boolean {
    if (this.replayLog && !fromAuto) return false;
    const ok = this.b.command(c);
    if (ok) {
      this.collect();
      this.syncPlacement();
      if (c.t === 'pick' && !this.silent) audio.play('pick');
    } else if (!fromAuto && !this.silent) audio.play('error');
    this.notify();
    return ok;
  }

  pick(i: number): void {
    this.command({ t: 'pick', index: i });
  }
  refresh(): void {
    if (this.command({ t: 'refresh' })) audio.play('card');
  }

  /** Recompute placement helpers when the sim asks for a placement. */
  syncPlacement(): void {
    const c = this.b.placing;
    if (!c) {
      this.place = null;
      this.view.board.clearGhosts();
      return;
    }
    if (this.place && this.place.card === c) return;
    const bd = this.b.board;
    this.place = { card: c, tile: null, from: null, rot: 0 };
    if (c.kind === 'road') {
      const opts: RoadOption[] = [];
      for (const pid of new Set(c.pieces)) opts.push(...bd.roadOptions(pid));
      this.place.options = opts;
      this.place.optIdx = opts.length ? this.bestRoadIdx(opts) : -1;
      if (this.tutorial) this.showHint('road', 'Road card: the road grows from the Gate. Tap a highlighted tile to aim it, ⟳ to cycle shapes, then ✓ to build.');
    } else if (c.kind === 'field') {
      const opts = bd.fieldOptions(c.shape);
      const g = bd.gate;
      opts.sort((a, b2) => Math.hypot(a.x - g.x, a.y - g.y) - Math.hypot(b2.x - g.x, b2.y - g.y));
      if (opts.length) this.place.tile = { x: opts[0].x, y: opts[0].y };
      this.place.rot = opts[0]?.rot ?? 0;
      if (this.tutorial) this.showHint('field', 'Field card: reveal new land from the clouds. Tap where to expand, then ✓.');
    } else if (c.kind === 'tower' || c.kind === 'hero') {
      if (this.tutorial) this.showHint('tower', 'Tap a glowing tile to preview, then ✓ to build. Glowing blue tiles are power tiles (+25% damage).');
      const best = c.kind === 'tower' ? this.ai.bestTile(this.b, c.id) : null;
      this.place.tile = best;
    }
  }

  private bestRoadIdx(opts: RoadOption[]): number {
    let best = 0, bs = -Infinity;
    opts.forEach((o, i) => {
      const end = o.tiles[o.tiles.length - 1];
      let s = o.tiles.length * 2;
      const bd = this.b.board;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) if (bd.canBuild(end.x + dx, end.y + dy)) s += 0.5;
      if (s > bs) {
        bs = s;
        best = i;
      }
    });
    return best;
  }

  cycleRoad(dir = 1): void {
    const p = this.place;
    if (!p?.options?.length) return;
    p.optIdx = ((p.optIdx ?? 0) + dir + p.options.length) % p.options.length;
    audio.play('click');
    this.notify();
  }

  rotateField(): void {
    if (!this.place) return;
    this.place.rot = ((this.place.rot ?? 0) + 1) % 2;
    audio.play('click');
    this.notify();
  }

  confirm(): void {
    const p = this.place;
    if (!p) return;
    const c = p.card;
    switch (c.kind) {
      case 'road': {
        const o = p.options?.[p.optIdx ?? -1];
        if (o) this.command({ t: 'placeRoad', piece: o.piece, rot: o.rot, mirror: o.mirror });
        break;
      }
      case 'field':
        if (p.tile) this.command({ t: 'placeField', shape: c.shape, x: p.tile.x, y: p.tile.y, rot: p.rot ?? 0 });
        break;
      case 'tower':
        if (p.tile) this.command({ t: 'placeTower', x: p.tile.x, y: p.tile.y });
        break;
      case 'hero':
        if (p.tile) this.command({ t: 'placeHero', x: p.tile.x, y: p.tile.y });
        break;
      case 'move':
        if (p.from && p.tile) this.command({ t: 'move', from: p.from, to: p.tile });
        break;
      case 'switch':
        if (p.from && p.tile) this.command({ t: 'switch', a: p.from, b: p.tile });
        break;
    }
  }

  canConfirm(): boolean {
    const p = this.place;
    if (!p) return false;
    const bd = this.b.board;
    const c = p.card;
    switch (c.kind) {
      case 'road':
        return (p.optIdx ?? -1) >= 0;
      case 'field':
        return !!p.tile && !!bd.fieldValid(c.shape, p.tile.x, p.tile.y, p.rot ?? 0);
      case 'tower':
        return !!p.tile && (TOWER_MAP[c.id].onRoad ? bd.canTrap(p.tile.x, p.tile.y) : bd.canBuild(p.tile.x, p.tile.y));
      case 'hero':
        return !!p.tile && bd.canBuild(p.tile.x, p.tile.y);
      case 'move':
        return !!p.from && !!p.tile && bd.canBuild(p.tile.x, p.tile.y);
      case 'switch':
        return !!p.from && !!p.tile && this.unitAt(p.tile) !== null && !(p.tile.x === p.from.x && p.tile.y === p.from.y);
    }
    return false;
  }

  private unitAt(t: Vec2): number | null {
    const bd = this.b.board;
    if (!bd.inb(t.x, t.y)) return null;
    const id = bd.occupant[Board.idx(t.x, t.y)];
    return id || null;
  }

  // ───────────────────────── input ─────────────────────────
  tapTile(fx: number, fy: number): void {
    const x = Math.floor(fx), y = Math.floor(fy);
    const bd = this.b.board;
    if (this.replayLog) return;
    if (this.aiming) {
      const sk = this.aiming;
      this.aiming = null;
      this.command({ t: 'cast', skill: sk, x: fx, y: fy });
      return;
    }
    const p = this.place;
    if (p) {
      const c = p.card;
      if (c.kind === 'road' && p.options) {
        // choose option touching tapped tile; prefer end tile
        let best = -1, bs = Infinity;
        p.options.forEach((o, i) => {
          o.tiles.forEach((t, k) => {
            const d = Math.hypot(t.x - x, t.y - y) - (k === o.tiles.length - 1 ? 0.3 : 0) + (i === p.optIdx ? 0.01 : 0);
            if (d < bs) {
              bs = d;
              best = i;
            }
          });
        });
        if (best >= 0) {
          if (best === p.optIdx && bs < 0.8) {
            this.confirm();
            return;
          }
          p.optIdx = best;
          audio.play('click');
        }
      } else if (c.kind === 'field') {
        if (p.tile && p.tile.x === x && p.tile.y === y && this.canConfirm()) return this.confirm();
        p.tile = { x, y };
        audio.play('click');
      } else if (c.kind === 'tower' || c.kind === 'hero') {
        if (p.tile && p.tile.x === x && p.tile.y === y && this.canConfirm()) return this.confirm();
        p.tile = { x, y };
        audio.play('click');
      } else if (c.kind === 'move') {
        if (!p.from) {
          if (this.unitAt({ x, y })) {
            p.from = { x, y };
            audio.play('click');
          }
        } else {
          if (this.unitAt({ x, y }) && !(p.tile && p.tile.x === x && p.tile.y === y)) {
            p.from = { x, y };
            p.tile = null;
          } else if (p.tile && p.tile.x === x && p.tile.y === y && this.canConfirm()) return this.confirm();
          else p.tile = { x, y };
          audio.play('click');
        }
      } else if (c.kind === 'switch') {
        if (!this.unitAt({ x, y })) return;
        if (!p.from) p.from = { x, y };
        else if (p.from.x === x && p.from.y === y) p.from = null;
        else if (p.tile && p.tile.x === x && p.tile.y === y) return this.confirm();
        else p.tile = { x, y };
        audio.play('click');
      }
      this.notify();
      return;
    }
    // normal mode: select towers
    if (!bd.inb(x, y)) {
      this.selected = null;
      this.notify();
      return;
    }
    const id = bd.occupant[Board.idx(x, y)] || bd.trap[Board.idx(x, y)];
    this.selected = id && this.b.towerById.has(id) ? id : null;
    if (this.selected) audio.play('click');
    this.notify();
  }

  hoverTile(fx: number, fy: number): void {
    const bd = this.view.board;
    const x = Math.floor(fx), y = Math.floor(fy);
    if (this.aiming && this.b.board.inb(x, y)) {
      const def = SKILL_MAP[this.aiming];
      bd.showRange(fx, fy, Math.max(0.6, def.radius), 0, CLASS_COLORS[def.cls]);
    }
  }

  cycleTargeting(): void {
    const t = this.selected ? this.b.towerById.get(this.selected) : null;
    if (t) this.command({ t: 'targeting', x: t.tx, y: t.ty });
  }

  castSkill(id: string): void {
    const s = this.b.skills.find((k) => k.id === id);
    const def = SKILL_MAP[id];
    if (!s || s.level <= 0 || s.cd > 0) {
      audio.play('error');
      return;
    }
    if (def.aim === 'none') {
      this.command({ t: 'cast', skill: id, x: 0, y: 0 });
      return;
    }
    this.aiming = this.aiming === id ? null : id;
    if (this.aiming) {
      this.selected = null;
      this.showHint('aim', 'Tap the battlefield to drop the skill.');
    }
    this.notify();
  }

  heroSpecial(): void {
    this.command({ t: 'heroSpecial' });
  }

  callEarly(): void {
    if (this.command({ t: 'callEarly' })) this.toast('Called early!', 'good', '+25% XP from the next wave', 1.4);
  }

  // ───────────────────────── placement visuals ─────────────────────────
  private updatePlacementVisuals(): void {
    const bv = this.view.board;
    const p = this.place;
    const bd = this.b.board;
    const t = this.view.time;
    if (!p) {
      bv.ghostTiles.count = 0;
      bv.ghostRoad.count = 0;
      if (this.aiming) return;
      const sel = this.selected ? this.b.towerById.get(this.selected) : null;
      if (sel) bv.showRange(sel.x, sel.y, sel.def.delivery === 'buff' ? sel.stats.buffRadius : sel.stats.range, sel.stats.minRange, CLASS_COLORS[sel.def.cls]);
      else bv.rangeRing.visible = false;
      return;
    }
    const c = p.card;
    switch (c.kind) {
      case 'road': {
        const o = p.options?.[p.optIdx ?? -1];
        const ends: Vec2[] = [];
        for (const op of p.options ?? []) ends.push(op.tiles[op.tiles.length - 1]);
        bv.showTiles(ends, 0xffe9a8, 0.18 + 0.08 * Math.sin(t * 5));
        bv.showRoadGhost(o?.tiles ?? [], !!o, t);
        bv.rangeRing.visible = false;
        break;
      }
      case 'field': {
        const cells = p.tile ? bd.fieldCells(c.shape, p.tile.x, p.tile.y, p.rot ?? 0).filter((q) => bd.inb(q.x, q.y)) : [];
        const ok = this.canConfirm();
        bv.showTiles(cells, ok ? 0x9cff8a : 0xff5050, 0.45 + 0.1 * Math.sin(t * 6));
        bv.ghostRoad.count = 0;
        bv.rangeRing.visible = false;
        break;
      }
      case 'tower':
      case 'hero': {
        const onRoad = c.kind === 'tower' && TOWER_MAP[c.id].onRoad;
        const tiles = onRoad ? bd.freeTrapTiles() : bd.freeBuildTiles();
        bv.showTiles(tiles, 0x9cff8a, 0.16 + 0.06 * Math.sin(t * 4));
        bv.ghostRoad.count = 0;
        if (p.tile) {
          const ok = this.canConfirm();
          bv.showRoadGhost([p.tile], ok, t);
          let r = 0, mr = 0;
          if (c.kind === 'tower') {
            const st = towerStats(TOWER_MAP[c.id], 0, 1, this.b.stars[c.id] ?? 1);
            r = TOWER_MAP[c.id].delivery === 'buff' ? st.buffRadius : st.range;
            mr = st.minRange;
          } else r = HERO_MAP[c.id].range;
          bv.showRange(p.tile.x + 0.5, p.tile.y + 0.5, r, mr, ok ? 0x9cff8a : 0xff5050);
        } else bv.rangeRing.visible = false;
        break;
      }
      case 'move':
      case 'switch': {
        const units: Vec2[] = this.b.towers.filter((x) => !x.def.onRoad).map((x) => ({ x: x.tx, y: x.ty }));
        if (this.b.hero) units.push({ x: this.b.hero.tx, y: this.b.hero.ty });
        if (!p.from) bv.showTiles(units, 0xffd45c, 0.3 + 0.1 * Math.sin(t * 5));
        else if (c.kind === 'move') bv.showTiles(bd.freeBuildTiles(), 0x9cff8a, 0.16);
        else bv.showTiles(units.filter((u) => !(u.x === p.from!.x && u.y === p.from!.y)), 0xffd45c, 0.25);
        const ghosts = [p.from, p.tile].filter(Boolean) as Vec2[];
        bv.showRoadGhost(ghosts, true, t);
        bv.rangeRing.visible = false;
        break;
      }
    }
  }

  dispose(): void {
    this.view.dispose();
    this.listeners.clear();
  }
}
