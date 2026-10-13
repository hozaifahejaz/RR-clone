import * as THREE from 'three';
import type { Battle } from '../sim/battle';
import type { BEvent } from '../sim/events';
import { FORT } from '../sim/board/board';
import { World, wx, wz } from './world';
import { BoardView } from './boardView';
import { UnitsView } from './unitsView';
import { Decals, Particles, Ribbons, Rings } from './fx';
import { CLASS_COLORS } from './materials';
import { PHASES } from '../data/endless';
import { ENEMY_MAP } from '../data/enemies';

interface Delayed {
  t: number;
  fn: () => void;
}

class DamageNumbers {
  private pool: HTMLDivElement[] = [];
  private active: { el: HTMLDivElement; x: number; y: number; z: number; t: number; dur: number }[] = [];
  constructor(private root: HTMLElement, private world: World) {}
  add(x: number, y: number, amount: number, crit: boolean, strong: boolean, color?: string): void {
    if (this.active.length > 45) return;
    const el = this.pool.pop() ?? document.createElement('div');
    el.className = 'dmg' + (crit ? ' crit' : '') + (strong ? ' strong' : '');
    el.textContent = amount >= 1000 ? (amount / 1000).toFixed(1) + 'k' : String(Math.max(1, Math.round(amount)));
    el.style.color = color ?? '';
    if (!el.parentElement) this.root.appendChild(el);
    el.style.display = 'block';
    this.active.push({ el, x: x + (Math.random() - 0.5) * 0.25, y, z: 0.9 + Math.random() * 0.2, t: 0, dur: crit ? 0.9 : 0.65 });
  }
  update(dt: number): void {
    for (const a of this.active) {
      a.t += dt;
      const k = a.t / a.dur;
      const p = this.world.project(wx(a.x), a.z + k * 0.6, wz(a.y));
      const s = k < 0.15 ? 0.6 + k * 4 : 1.2 - k * 0.3;
      a.el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%,-50%) scale(${s})`;
      a.el.style.opacity = String(k > 0.7 ? (1 - k) / 0.3 : 1);
    }
    const done = this.active.filter((a) => a.t >= a.dur);
    for (const d of done) {
      d.el.style.display = 'none';
      this.pool.push(d.el);
    }
    this.active = this.active.filter((a) => a.t < a.dur);
  }
  clear(): void {
    for (const a of this.active) {
      a.el.style.display = 'none';
      this.pool.push(a.el);
    }
    this.active = [];
  }
}

export class BattleView {
  world: World;
  board: BoardView;
  units: UnitsView;
  glowP = new Particles(3500, true);
  smokeP = new Particles(1800, false);
  debrisP = new Particles(1200, false, true);
  rings = new Rings(56);
  ribbons = new Ribbons(72);
  decals = new Decals(48);
  numbers: DamageNumbers;
  private delayed: Delayed[] = [];
  private zoneTick = 0;
  time = 0;
  showNumbers = true;
  private camDir = new THREE.Vector3();
  onBigHit?: () => void;

  constructor(world: World, overlay: HTMLElement, public b: Battle) {
    this.world = world;
    this.world.setBiome(b.cfg.preset ?? 'plains');
    this.world.stormTarget = 0;
    this.world.stormK = 0;
    this.board = new BoardView(b.board, this.world.biome, b.cfg.seed);
    this.units = new UnitsView();
    const s = this.world.scene;
    s.add(this.board.group, this.units.group, this.glowP.mesh, this.smokeP.mesh, this.debrisP.mesh, this.rings.group, this.ribbons.group, this.decals.group);
    this.numbers = new DamageNumbers(overlay, this.world);
    this.board.intro();
  }

  setBattle(b: Battle): void {
    this.b = b;
  }

  later(t: number, fn: () => void): void {
    this.delayed.push({ t, fn });
  }

  frame(dt: number, alpha: number, events: BEvent[]): void {
    this.time += dt;
    const t = this.time;
    for (const e of events) this.onEvent(e);
    for (const d of this.delayed) d.t -= dt;
    const due = this.delayed.filter((d) => d.t <= 0);
    this.delayed = this.delayed.filter((d) => d.t > 0);
    for (const d of due) d.fn();
    this.world.update(dt, t);
    this.board.update(dt, t, this.b.fortHp / this.b.fortMax);
    this.units.update(this.b, alpha, dt, t, this.world.camera);
    this.trails(dt);
    this.zones(dt);
    this.world.camera.getWorldDirection(this.camDir);
    this.glowP.update(dt);
    this.smokeP.update(dt);
    this.debrisP.update(dt);
    this.rings.update(dt);
    this.ribbons.update(dt, this.camDir);
    this.decals.update(dt);
    this.numbers.update(dt);
    // gate ambient particles
    if (Math.random() < dt * 20) {
      const g = this.b.board.gate;
      const a = Math.random() * Math.PI * 2;
      this.glowP.emit({ x: wx(g.x + 0.5) + Math.cos(a) * 0.7, y: 0.3 + Math.random() * 0.8, z: wz(g.y + 0.5) + Math.sin(a) * 0.7, vx: -Math.cos(a) * 1.2, vz: -Math.sin(a) * 1.2, vy: 0.2, life: 0.55, s0: 0.1, s1: 0.02, color: 0xff4fd8, bright: 2.5, drag: 1 });
    }
    // fortress sparkles
    if (Math.random() < dt * 6) {
      this.glowP.emit({ x: wx(FORT.x + 0.5) + (Math.random() - 0.5) * 0.4, y: 1.6, z: wz(FORT.y + 0.5) + (Math.random() - 0.5) * 0.4, vy: 0.6, life: 1, s0: 0.08, s1: 0, color: 0x5ce1ff, bright: 2 });
    }
    this.world.render();
  }

  // ───────────────────── particles helpers ─────────────────────
  burst(x: number, y: number, h: number, color: number, n: number, speed: number, size: number, life = 0.5, bright = 2.5): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const u = Math.random() * 2 - 1;
      const sp = speed * (0.4 + Math.random() * 0.6);
      const r = Math.sqrt(1 - u * u);
      this.glowP.emit({ x: wx(x), y: h, z: wz(y), vx: Math.cos(a) * r * sp, vy: Math.abs(u) * sp, vz: Math.sin(a) * r * sp, life: life * (0.6 + Math.random() * 0.6), s0: size, s1: 0, color, bright, drag: 3 });
    }
  }
  smoke(x: number, y: number, h: number, n: number, size: number, color = 0x6a6470, life = 0.9): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.5 + Math.random() * 0.9;
      this.smokeP.emit({ x: wx(x), y: h, z: wz(y), vx: Math.cos(a) * sp, vy: 0.4 + Math.random() * 0.8, vz: Math.sin(a) * sp, life: life * (0.7 + Math.random() * 0.6), s0: size * 0.6, s1: size * 1.6, color, a: 0.55, drag: 2.5 });
    }
  }
  debris(x: number, y: number, h: number, n: number, color: number, speed = 3): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.4 + Math.random() * 0.6);
      this.debrisP.emit({ x: wx(x), y: h, z: wz(y), vx: Math.cos(a) * sp, vy: 2 + Math.random() * 3, vz: Math.sin(a) * sp, life: 0.8 + Math.random() * 0.5, s0: 0.07 + Math.random() * 0.05, s1: 0.04, color, grav: 12, a: 1 });
    }
  }
  explosion(x: number, y: number, r: number, h = 0.3, color = 0xff8a3d): void {
    const big = r > 1.0;
    this.glowP.emit({ x: wx(x), y: h + 0.2, z: wz(y), life: 0.18, s0: r * 2.2, s1: r * 3.0, color: 0xfff0c0, bright: 3 });
    this.burst(x, y, h + 0.1, color, big ? 26 : 14, 3.5 * Math.max(0.6, r), 0.22 * Math.max(0.7, r), 0.45);
    this.smoke(x, y, h + 0.2, big ? 10 : 5, 0.5 * Math.max(0.7, r));
    this.debris(x, y, h + 0.1, big ? 10 : 5, 0x3a3030);
    this.rings.spawn(wx(x), 0.08, wz(y), 0.1, r * 1.4, 0.35, color, 2.2);
    this.decals.spawn(wx(x), wz(y), r * 0.7);
    this.world.shake(big ? 0.16 : 0.035);
  }

  private trails(dt: number): void {
    const n = Math.min(1, dt * 60);
    for (const p of this.b.projectiles) {
      if (p.dead) continue;
      if (Math.random() > n) continue;
      const X = wx(p.x), Z = wz(p.y);
      switch (p.kind) {
        case 'shell':
          this.smokeP.emit({ x: X, y: p.z, z: Z, life: 0.35, s0: 0.08, s1: 0.18, color: 0x8a8490, a: 0.4 });
          break;
        case 'missile':
          if (p.extra > 0) break;
          this.glowP.emit({ x: X, y: p.z, z: Z, life: 0.15, s0: 0.12, s1: 0.02, color: 0xffa860, bright: 2.5 });
          this.smokeP.emit({ x: X, y: p.z, z: Z, life: 0.4, s0: 0.06, s1: 0.16, color: 0xb0aab8, a: 0.35 });
          break;
        case 'frost':
          this.glowP.emit({ x: X, y: 0.6, z: Z, life: 0.25, s0: 0.1, s1: 0, color: 0x9fe6ff, bright: 2.5 });
          break;
        case 'blade':
          this.glowP.emit({ x: X, y: 0.55, z: Z, life: 0.18, s0: 0.14, s1: 0, color: 0x7dffb0, bright: 2 });
          break;
        case 'ball':
          if (p.t >= 0 && Math.random() < 0.4) this.smokeP.emit({ x: X, y: 0.05, z: Z, vy: 0.3, life: 0.4, s0: 0.1, s1: 0.25, color: 0xc8b08a, a: 0.5 });
          break;
      }
    }
    // laser impact sparks
    for (const t of this.b.towers) {
      if (t.def.delivery !== 'beam' || !t.beamTargets.length || Math.random() > n * 0.7) continue;
      const e = this.b.enemyById.get(t.beamTargets[0]);
      if (e) this.glowP.emit({ x: wx(e.x), y: e.air ? 1 : 0.35, z: wz(e.y), vx: (Math.random() - 0.5) * 2, vy: Math.random() * 2, vz: (Math.random() - 0.5) * 2, life: 0.25, s0: 0.1, s1: 0, color: 0xff7cf0, bright: 3 });
    }
    // burning enemies
    for (const e of this.b.enemies) {
      if (e.burnT > 0 && Math.random() < n * 0.4) this.glowP.emit({ x: wx(e.x) + (Math.random() - 0.5) * 0.2, y: (e.air ? 1 : 0.3) + Math.random() * 0.2, z: wz(e.y), vy: 1.2, life: 0.35, s0: 0.12, s1: 0, color: 0xff7a2a, bright: 2.4 });
      if (e.freezeT > 0 && Math.random() < n * 0.2) this.glowP.emit({ x: wx(e.x), y: 0.5, z: wz(e.y), vy: 0.4, life: 0.4, s0: 0.08, s1: 0, color: 0xcff4ff, bright: 2 });
    }
  }

  private zones(dt: number): void {
    this.zoneTick += dt;
    if (this.zoneTick < 1 / 30) return;
    this.zoneTick = 0;
    for (const z of this.b.zones) {
      const X = z.x, Y = z.y;
      if (z.kind === 'blizzard') {
        for (let i = 0; i < 4; i++) {
          const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * z.radius;
          this.glowP.emit({ x: wx(X + Math.cos(a) * r), y: 1.6 + Math.random(), z: wz(Y + Math.sin(a) * r), vx: 0.6, vy: -2.2, life: 0.8, s0: 0.07, s1: 0.05, color: 0xe8f8ff, bright: 1.8 });
        }
        if (Math.random() < 0.15) this.rings.spawn(wx(X), 0.06, wz(Y), z.radius * 0.95, z.radius, 0.6, 0x9fe6ff, 1.4, 0.6);
      } else if (z.kind === 'crater') {
        if (Math.random() < 0.6) this.glowP.emit({ x: wx(X + (Math.random() - 0.5) * z.radius), y: 0.1, z: wz(Y + (Math.random() - 0.5) * z.radius), vy: 0.9, life: 0.4, s0: 0.14, s1: 0, color: z.cls === 'swift' ? 0x9cff8a : 0xff7a2a, bright: 2.2 });
      } else if (z.kind === 'flak') {
        if (Math.random() < 0.4) this.smokeP.emit({ x: wx(X + (Math.random() - 0.5) * z.radius), y: 1.0, z: wz(Y + (Math.random() - 0.5) * z.radius), life: 0.5, s0: 0.2, s1: 0.35, color: 0x4a4450, a: 0.5 });
      } else if (z.kind === 'orbital' && z.delay > 0) {
        if (Math.random() < 0.3) this.rings.spawn(wx(X), 0.07, wz(Y), z.radius * 1.4, z.radius * 0.2, 0.3, 0xff5040, 2.4);
        this.glowP.emit({ x: wx(X), y: 4 + Math.random() * 2, z: wz(Y), vy: -8, life: 0.4, s0: 0.25, s1: 0.1, color: 0xffd0a0, bright: 2 });
      }
    }
  }

  // ───────────────────── events ─────────────────────
  onEvent(ev: BEvent): void {
    const b = this.b;
    switch (ev.e) {
      case 'shot': {
        const col = CLASS_COLORS[ev.cls] ?? 0xffffff;
        const tv = this.units.towers.get(ev.tower);
        const mh = tv ? tv.model.muzzle + tv.model.turretY : 0.6;
        if (ev.kind === 'bullet') {
          this.ribbons.spawn([wx(ev.x), mh, wz(ev.y), wx(ev.tx), 0.4, wz(ev.ty)], 0xfff0a0, { dur: 0.05, width: 0.025, bright: 3 });
          this.glowP.emit({ x: wx(ev.x) + Math.cos(Math.atan2(ev.ty - ev.y, ev.tx - ev.x)) * 0.45, y: mh, z: wz(ev.y) + Math.sin(Math.atan2(ev.ty - ev.y, ev.tx - ev.x)) * 0.45, life: 0.05, s0: 0.25, s1: 0.1, color: 0xffe080, bright: 3 });
        } else if (ev.kind === 'rail' || ev.kind === 'mega') {
          const w = ev.kind === 'mega' ? 0.16 : 0.07;
          this.ribbons.spawn([wx(ev.x), mh, wz(ev.y), wx(ev.tx), 0.4, wz(ev.ty)], ev.kind === 'mega' ? 0xffffff : col, { dur: 0.22, width: w, bright: 4 });
          this.burst(ev.x, ev.y, mh, col, 6, 2, 0.12, 0.25);
          if (ev.kind === 'mega') this.world.shake(0.08);
        } else if (ev.kind === 'cannon' || ev.kind === 'mortar' || ev.kind === 'hero' || ev.kind === 'siege') {
          const a = Math.atan2(ev.ty - ev.y, ev.tx - ev.x);
          const mx = ev.x + Math.cos(a) * 0.45, my = ev.y + Math.sin(a) * 0.45;
          this.glowP.emit({ x: wx(mx), y: mh, z: wz(my), life: 0.08, s0: 0.45, s1: 0.2, color: 0xffd080, bright: 3 });
          this.smoke(mx, my, mh, 3, 0.3, 0x9a94a0, 0.6);
        }
        break;
      }
      case 'hit':
        if (this.showNumbers && !ev.dot) this.numbers.add(ev.x, ev.y, ev.amount, ev.crit, ev.strong);
        if (!ev.dot && Math.random() < 0.5) this.glowP.emit({ x: wx(ev.x), y: 0.45, z: wz(ev.y), vx: (Math.random() - 0.5) * 2, vy: Math.random() * 2, vz: (Math.random() - 0.5) * 2, life: 0.15, s0: 0.12, s1: 0, color: 0xffffff, bright: 2.5 });
        break;
      case 'boom': {
        const col = ev.cls ? CLASS_COLORS[ev.cls] : 0xff8a3d;
        switch (ev.kind) {
          case 'shell':
          case 'big':
            this.explosion(ev.x, ev.y, ev.r, 0.25, ev.kind === 'big' ? 0xff6a2a : 0xff9a4a);
            break;
          case 'small':
            this.burst(ev.x, ev.y, 0.3, 0xffa860, 8, 2.2, 0.14, 0.3);
            this.smoke(ev.x, ev.y, 0.3, 2, 0.25);
            break;
          case 'air':
            this.burst(ev.x, ev.y, 1.0, 0xffb070, 8, 2.2, 0.14, 0.3);
            this.smokeP.emit({ x: wx(ev.x), y: 1.0, z: wz(ev.y), life: 0.6, s0: 0.2, s1: 0.45, color: 0x5a5460, a: 0.5 });
            break;
          case 'frost':
            this.burst(ev.x, ev.y, 0.5, 0x9fe6ff, 6, 1.8, 0.1, 0.3);
            break;
          case 'shatter':
            this.burst(ev.x, ev.y, 0.4, 0xcff4ff, 22, 4, 0.16, 0.5, 3);
            this.debris(ev.x, ev.y, 0.4, 10, 0xbfe8ff, 3.5);
            this.rings.spawn(wx(ev.x), 0.1, wz(ev.y), 0.1, ev.r * 1.2, 0.35, 0x9fe6ff, 2.4);
            break;
          case 'overload':
            this.rings.spawn(wx(ev.x), 0.3, wz(ev.y), 0.2, ev.r, 0.35, col, 3);
            this.burst(ev.x, ev.y, 0.6, col, 24, 5, 0.12, 0.35, 3);
            break;
          case 'orbital':
            this.glowP.emit({ x: wx(ev.x), y: 3, z: wz(ev.y), life: 0.3, s0: 1.6, s1: 0.2, color: 0xfff0d0, bright: 3 });
            for (let i = 0; i < 12; i++) this.glowP.emit({ x: wx(ev.x), y: i * 0.6, z: wz(ev.y), life: 0.35, s0: 0.9, s1: 0.1, color: 0xffd0a0, bright: 3 });
            this.explosion(ev.x, ev.y, ev.r * 1.3, 0.3, 0xffa040);
            this.world.shake(0.35);
            this.onBigHit?.();
            break;
          case 'zap':
            this.burst(ev.x, ev.y, 0.5, col, 10, 3, 0.12, 0.25, 3);
            break;
          case 'slash':
            this.ribbons.spawn([wx(ev.x - 0.3), 0.6, wz(ev.y - 0.2), wx(ev.x + 0.3), 0.3, wz(ev.y + 0.2)], 0x7dffb0, { dur: 0.12, width: 0.06, bright: 3 });
            this.burst(ev.x, ev.y, 0.4, 0x5cff9d, 5, 2, 0.1, 0.2);
            break;
          case 'fire':
            this.burst(ev.x, ev.y, 0.3, 0xff7a2a, 14, 2.5, 0.18, 0.45);
            break;
        }
        break;
      }
      case 'chain': {
        const pts: number[] = [];
        for (let i = 0; i < ev.pts.length; i += 2) {
          const first = i === 0;
          pts.push(wx(ev.pts[i]), first ? 0.95 : 0.45, wz(ev.pts[i + 1]));
        }
        if (ev.pts.length === 4 && Math.abs(ev.pts[1] - ev.pts[3]) > 2) {
          // sky strike
          pts[1] = 6;
        }
        const col = CLASS_COLORS[ev.cls] ?? 0x7a8cff;
        this.ribbons.spawn(pts, col, { dur: 0.14, width: 0.06, jag: 0.25, bright: 4 });
        this.ribbons.spawn(pts, 0xffffff, { dur: 0.08, width: 0.025, jag: 0.15, bright: 3 });
        for (let i = 3; i < pts.length; i += 3) this.glowP.emit({ x: pts[i], y: pts[i + 1], z: pts[i + 2], life: 0.15, s0: 0.35, s1: 0, color: col, bright: 3 });
        break;
      }
      case 'death': {
        const size = ev.boss ? 1.6 : 1;
        const def = ENEMY_MAP[ev.type];
        this.units.killEnemy({ type: ev.type, x: wx(ev.x), y: wz(ev.y), air: ev.air }, def ? (def.boss ? def.size * 1.6 : def.size / 0.4) : 1, 0);
        const h = ev.air ? 1 : 0.35;
        this.burst(ev.x, ev.y, h, 0xffd890, ev.boss ? 60 : 8, ev.boss ? 6 : 2.5, 0.14 * size, 0.4);
        this.debris(ev.x, ev.y, h, ev.boss ? 30 : 4, 0x4a4a5a, ev.boss ? 6 : 2.5);
        if (ev.air) this.smoke(ev.x, ev.y, 1, 3, 0.3, 0x3a3440, 1.0);
        // xp orbs
        const orbs = Math.min(6, Math.ceil(ev.xp / 2));
        for (let i = 0; i < orbs; i++)
          this.glowP.emit({ x: wx(ev.x), y: h + 0.2, z: wz(ev.y), vx: (Math.random() - 0.5) * 1.5, vy: 3 + Math.random() * 2, vz: -2 - Math.random() * 2, life: 0.9, s0: 0.13, s1: 0.06, color: 0x7af0ff, bright: 3, drag: 0.5 });
        if (ev.boss) {
          this.world.shake(0.6);
          for (let i = 0; i < 5; i++) this.later(i * 0.12, () => this.explosion(ev.x + (Math.random() - 0.5) * 1.5, ev.y + (Math.random() - 0.5) * 1.5, 1.1, 0.5));
          this.rings.spawn(wx(ev.x), 0.1, wz(ev.y), 0.2, 4, 0.8, 0xffd45c, 2.5);
        }
        if (ev.elite) this.rings.spawn(wx(ev.x), 0.1, wz(ev.y), 0.1, 1.0, 0.4, 0xff4fd8, 2.5);
        break;
      }
      case 'leak': {
        const fx = FORT.x + 0.5, fy = FORT.y + 0.5;
        this.burst(fx, fy, 0.8, 0xff4040, 14, 3, 0.18, 0.4);
        this.rings.spawn(wx(fx), 0.2, wz(fy), 0.3, 1.6, 0.4, 0xff3030, 2.5);
        this.world.shake(0.12 + Math.min(0.3, ev.dmg * 0.01));
        break;
      }
      case 'towerPlaced': {
        const x = ev.x + 0.5, y = ev.y + 0.5;
        this.later(0.18, () => {
          this.rings.spawn(wx(x), 0.06, wz(y), 0.2, 1.3, 0.4, 0xffffff, 1.8);
          this.smoke(x, y, 0.1, 8, 0.3, 0xd8c8a8, 0.7);
          this.world.shake(0.06);
        });
        break;
      }
      case 'towerMoved': {
        const t = b.towerById.get(ev.id);
        const p = t ?? (b.hero && b.hero.id === ev.id ? b.hero : null);
        if (p) this.burst(p.x, p.y, 0.4, 0xffffff, 12, 2, 0.12, 0.4);
        break;
      }
      case 'towerKO': {
        const t = b.towerById.get(ev.id);
        if (t) {
          this.explosion(t.x, t.y, 0.6, 0.5, 0xff5040);
          this.smoke(t.x, t.y, 0.6, 8, 0.4, 0x2a2a30, 1.6);
        }
        break;
      }
      case 'towerStun': {
        const t = b.towerById.get(ev.id);
        if (t) this.burst(t.x, t.y, 0.6, 0x8fd8ff, 6, 1.5, 0.1, 0.4);
        break;
      }
      case 'star':
        for (const t of b.towers) {
          if (t.def.id !== ev.tower) continue;
          this.rings.spawn(wx(t.x), 0.1, wz(t.y), 0.2, 1.1, 0.5, 0xffd45c, 2.6);
          for (let i = 0; i < 14; i++) this.glowP.emit({ x: wx(t.x) + (Math.random() - 0.5) * 0.5, y: 0.2, z: wz(t.y) + (Math.random() - 0.5) * 0.5, vy: 2 + Math.random() * 2, life: 0.8, s0: 0.12, s1: 0, color: 0xffd45c, bright: 3, drag: 1 });
        }
        break;
      case 'road': {
        this.board.rebuildRoad();
        this.board.placeGate(false);
        const og = ev.oldGate;
        this.rings.spawn(wx(og.x + 0.5), 0.3, wz(og.y + 0.5), 1.2, 0.05, 0.4, 0xff4fd8, 2.5);
        this.burst(og.x + 0.5, og.y + 0.5, 0.5, 0xff4fd8, 18, 3, 0.15, 0.45);
        ev.tiles.forEach((t, i) =>
          this.later(i * 0.06, () => {
            this.smoke(t.x + 0.5, t.y + 0.5, 0.05, 4, 0.25, 0xd8c8a8, 0.6);
            this.rings.spawn(wx(t.x + 0.5), 0.05, wz(t.y + 0.5), 0.2, 0.7, 0.3, 0xffe9a8, 1.6);
          }),
        );
        const g = ev.tiles[ev.tiles.length - 1];
        this.later(0.45, () => {
          this.rings.spawn(wx(g.x + 0.5), 0.3, wz(g.y + 0.5), 0.1, 1.4, 0.5, 0xff4fd8, 3);
          this.world.shake(0.05);
        });
        break;
      }
      case 'field': {
        this.board.reveal(ev.cells);
        ev.cells.forEach((c, i) =>
          this.later(0.25 + i * 0.03, () => {
            this.smoke(c.x + 0.5, c.y + 0.5, 0.0, 2, 0.35, 0xffffff, 0.8);
            if (Math.random() < 0.5) this.glowP.emit({ x: wx(c.x + 0.5), y: 0.2, z: wz(c.y + 0.5), vy: 1.5, life: 0.7, s0: 0.1, s1: 0, color: 0xfff4c0, bright: 2.5 });
          }),
        );
        break;
      }
      case 'skill': {
        switch (ev.id) {
          case 'rally':
            for (const t of b.towers) this.rings.spawn(wx(t.x), 0.1, wz(t.y), 0.2, 0.9, 0.5, 0x5cff9d, 2.5);
            break;
          case 'repair':
            this.burst(FORT.x + 0.5, FORT.y + 0.5, 1, 0x5cff9d, 30, 2, 0.15, 1);
            break;
          case 'storm':
            this.world.shake(0.15);
            break;
          case 'blizzard':
            this.rings.spawn(wx(ev.x), 0.1, wz(ev.y), 0.2, 2.2, 0.5, 0x9fe6ff, 2.5);
            break;
          case 'barricade':
          case 'caltrops':
          case 'carpet':
            this.smoke(ev.x, ev.y, 0.2, 6, 0.3, 0xd8c8a8, 0.6);
            break;
        }
        break;
      }
      case 'lastStand': {
        const fx = FORT.x + 0.5, fy = FORT.y + 0.5;
        this.rings.spawn(wx(fx), 0.3, wz(fy), 0.3, 18, 1.2, 0x5ce1ff, 3);
        this.rings.spawn(wx(fx), 0.6, wz(fy), 0.3, 14, 1.0, 0xffffff, 2.5);
        this.burst(fx, fy, 1.2, 0x5ce1ff, 80, 9, 0.25, 1);
        this.world.shake(0.6);
        break;
      }
      case 'gameOver': {
        const fx = FORT.x + 0.5, fy = FORT.y + 0.5;
        for (let i = 0; i < 8; i++) this.later(i * 0.15, () => this.explosion(fx + (Math.random() - 0.5), fy + (Math.random() - 0.5), 1.2, 0.8, 0xff5030));
        break;
      }
      case 'supply': {
        const fx = FORT.x + 0.5, fy = FORT.y + 0.5;
        this.burst(fx, fy, 2, 0xffd45c, 40, 4, 0.18, 1);
        this.rings.spawn(wx(fx), 0.2, wz(fy), 0.3, 3, 0.8, 0xffd45c, 2.5);
        break;
      }
      case 'crack':
        this.smoke(ev.x + 0.5, ev.y + 0.5, 0.05, 4, 0.3, 0x8a6a4a, 0.8);
        break;
      case 'collapse':
        this.debris(ev.x + 0.5, ev.y + 0.5, 0, 14, 0x6a4a3a, 2);
        this.smoke(ev.x + 0.5, ev.y + 0.5, 0, 8, 0.4, 0x8a6a4a, 1);
        this.world.shake(0.08);
        break;
      case 'heroSpecial': {
        const h = b.hero;
        if (h) {
          const col = CLASS_COLORS[h.def.cls];
          this.rings.spawn(wx(h.x), 0.1, wz(h.y), 0.2, 2.5, 0.6, col, 3);
          this.burst(h.x, h.y, 0.6, col, 40, 5, 0.18, 0.7);
          this.world.shake(0.2);
        }
        break;
      }
      case 'blink':
        this.burst(ev.x, ev.y, 0.5, 0xff4fd8, 14, 2.5, 0.14, 0.4);
        break;
      case 'heal':
        for (let i = 0; i < 4; i++) this.glowP.emit({ x: wx(ev.x) + (Math.random() - 0.5) * 1.2, y: 0.3, z: wz(ev.y) + (Math.random() - 0.5) * 1.2, vy: 1.2, life: 0.7, s0: 0.12, s1: 0, color: 0x5cff9d, bright: 2.4 });
        break;
      case 'dance':
        this.rings.spawn(wx(ev.x), 0.15, wz(ev.y), 0.3, ev.r, 0.6, [0xff7cf0, 0x7af0ff, 0xfff07a][Math.floor(Math.random() * 3)], 2.5);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          this.glowP.emit({ x: wx(ev.x), y: 0.8, z: wz(ev.y), vx: Math.cos(a) * 2, vz: Math.sin(a) * 2, vy: 0.5, life: 0.7, s0: 0.12, s1: 0.04, color: 0xff7cf0 + i * 0x1010, bright: 2.5, drag: 1.5 });
        }
        break;
      case 'gust': {
        const a = Math.atan2(ev.ty - ev.y, ev.tx - ev.x);
        for (let i = 0; i < 8; i++) {
          const sp = 5 + Math.random() * 3;
          const spread = (Math.random() - 0.5) * 0.6;
          this.smokeP.emit({ x: wx(ev.x), y: 0.5 + Math.random() * 0.3, z: wz(ev.y), vx: Math.cos(a + spread) * sp, vz: Math.sin(a + spread) * sp, life: 0.4, s0: 0.1, s1: 0.3, color: 0xffffff, a: 0.45, drag: 3 });
        }
        break;
      }
      case 'hook':
        this.ribbons.spawn([wx(ev.x), 0.6, wz(ev.y), wx(ev.tx), 0.4, wz(ev.ty)], 0xffd45c, { dur: 0.25, width: 0.03, bright: 2 });
        break;
      case 'stomp':
        this.rings.spawn(wx(ev.x), 0.08, wz(ev.y), 0.3, ev.r * 1.3, 0.5, 0xd8c8a8, 1.6);
        this.smoke(ev.x, ev.y, 0.1, 12, 0.4, 0xb8a888, 0.8);
        this.world.shake(0.25);
        break;
      case 'freezeCol':
        for (let y = 0; y < 21; y += 0.5) this.glowP.emit({ x: wx(ev.x), y: 0.4, z: wz(y), vy: 1 + Math.random(), life: 0.8, s0: 0.25, s1: 0, color: 0x9fe6ff, bright: 2.5 });
        this.world.shake(0.15);
        break;
      case 'emp':
        this.rings.spawn(wx(ev.x), 0.5, wz(ev.y), 0.2, ev.r, 0.4, 0x6af0ff, 3);
        this.burst(ev.x, ev.y, 0.8, 0x6af0ff, 16, 3, 0.12, 0.35);
        break;
      case 'rocket': {
        const pts = [wx(ev.x), 0.6, wz(ev.y), wx((ev.x + ev.tx) / 2), 1.4, wz((ev.y + ev.ty) / 2), wx(ev.tx), 0.5, wz(ev.ty)];
        this.ribbons.spawn(pts, 0xff6a3a, { dur: 0.3, width: 0.05, bright: 2.5 });
        this.later(0.2, () => this.explosion(ev.tx, ev.ty, 0.5, 0.5, 0xff5030));
        break;
      }
      case 'soldierDie':
        this.smoke(ev.x, ev.y, 0.2, 4, 0.25, 0xd8d8d8, 0.5);
        break;
      case 'phase': {
        const idx = PHASES.findIndex((p) => p.id === ev.id);
        this.world.stormTarget = Math.max(0, idx) * 0.14;
        break;
      }
      case 'bossIntro': {
        const g = b.board.gate;
        this.rings.spawn(wx(g.x + 0.5), 0.2, wz(g.y + 0.5), 0.3, 4, 1, 0xff4fd8, 3);
        this.world.shake(0.3);
        break;
      }
    }
  }

  dispose(): void {
    this.numbers.clear();
    const s = this.world.scene;
    s.remove(this.board.group, this.units.group, this.glowP.mesh, this.smokeP.mesh, this.debrisP.mesh, this.rings.group, this.ribbons.group, this.decals.group);
    const disposeTree = (o: THREE.Object3D) =>
      o.traverse((c) => {
        const m = c as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
    disposeTree(this.board.group);
    disposeTree(this.units.group);
  }
}
