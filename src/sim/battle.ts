import { Rng, hash32 } from './core/rng';
import { Board, FORT, T } from './board/board';
import type { RoadOption } from './board/board';
import type { BattleConfig, Card, ClassId, Command, TimedCommand, Vec2 } from './types';
import type { BEvent } from './events';
import type { Enemy, Hero, Projectile, Soldier, Tower, Zone } from './entities/entities';
import { TOWER_MAP, towerStats } from '../data/towers';
import { ENEMY_MAP } from '../data/enemies';
import { HERO_MAP, SKILL_MAP } from '../data/skills';
import { FIRST_WAVE_DELAY, WAVE_INTERVAL, hpScale, phaseFor, xpNeeded } from '../data/endless';
import { planWave } from './waves/waves';
import type { Spawn, WavePlan } from './waves/waves';
import { updateTowers, recomputeTowerStats } from './combat/towers';
import { updateEnemies } from './combat/enemies';
import { updateProjectiles, updateZones, updateSoldiers, updateHero, castSkill, heroSpecial } from './combat/effects';
import { makeOffer } from './draft/draft';

import { DT } from './core/const';
export { DT };

export const CLASS_BEATS: Record<ClassId, ClassId | null> = {
  vanguard: 'swift',
  swift: 'elemental',
  elemental: 'vanguard',
  utility: null,
};

export function classMult(att: ClassId, def: ClassId): number {
  if (CLASS_BEATS[att] === def) return 1.2;
  if (CLASS_BEATS[def] === att) return 0.8;
  return 1;
}

export interface SkillState {
  id: string;
  rarity: number;
  mlevel: number;
  level: number; // in-run level (0 = locked)
  cd: number;
}

export interface DmgOpts {
  cls: ClassId;
  towerId?: number;
  hero?: boolean;
  crit?: number;
  critDmg?: number;
  dot?: boolean;
  noArmor?: boolean;
  shred?: number;
}

export class Battle {
  cfg: BattleConfig;
  board = new Board();
  rng: Rng;
  draftRng: Rng;
  tick = 0;
  time = 0;
  enemies: Enemy[] = [];
  towers: Tower[] = [];
  soldiers: Soldier[] = [];
  projectiles: Projectile[] = [];
  zones: Zone[] = [];
  hero: Hero | null = null;
  events: BEvent[] = [];
  nextId = 1;
  wave = 0;
  waveTimer = FIRST_WAVE_DELAY;
  waveInterval = WAVE_INTERVAL;
  spawnQueue: (Spawn & { t: number; wave: number })[] = [];
  plans = new Map<number, WavePlan>();
  earlyBonus = new Map<number, number>();
  fortHp: number;
  fortMax: number;
  lastStandUsed = false;
  over = false;
  xp = 0;
  level = 0;
  pendingPicks = 3;
  offer: Card[] | null = null;
  placing: Card | null = null;
  refreshes: number;
  stars: Record<string, number> = {};
  skills: SkillState[];
  rallyT = 0;
  repairT = 0;
  pity = { tower: 0, road: 0, field: 0 };
  offersMade = 0;
  kills = 0;
  leaks = 0;
  picks = 0;
  log: TimedCommand[] = [];
  phaseId = 'setup';
  supplyDrops = 0;
  heroUsed = false;
  lab: boolean;
  bossesKilled = 0;
  lastWaveCleared = 0;
  towerById = new Map<number, Tower>();
  enemyById = new Map<number, Enemy>();
  soldierById = new Map<number, Soldier>();

  constructor(cfg: BattleConfig) {
    this.cfg = cfg;
    this.lab = cfg.mode === 'lab';
    this.rng = new Rng(hash32(cfg.seed, 'combat'));
    this.draftRng = new Rng(hash32(cfg.seed, 'draft'));
    const presets = ['plains', 'islands', 'canyon'];
    const preset = cfg.preset ?? presets[hash32(cfg.seed, 'preset') % 3];
    this.cfg.preset = preset;
    this.board.generate(cfg.seed, preset, this.mut('noField') || this.lab);
    const ws = cfg.workshop;
    this.fortMax = 100 + 10 * (ws.fortHp ?? 0);
    if (this.mut('glass')) this.fortMax = Math.round(this.fortMax * 0.4);
    this.fortHp = this.fortMax;
    this.refreshes = 1 + (ws.refresh ?? 0);
    if (this.mut('blitz')) this.waveInterval = 10;
    this.skills = cfg.deck.skills.map((s) => ({ id: s.id, rarity: s.rarity, mlevel: s.level, level: 0, cd: 0 }));
    if (ws.startField) this.pendingPicks += ws.startField;
    if (this.lab) {
      this.pendingPicks = 0;
      this.waveTimer = Infinity;
      for (const s of this.skills) s.level = 1;
    }
    this.nextOffer();
  }

  mut(id: string): boolean {
    return this.cfg.mutators.includes(id);
  }

  id(): number {
    return this.nextId++;
  }

  get frozen(): boolean {
    return this.over || this.offer !== null || this.placing !== null;
  }

  get phase() {
    return phaseFor(Math.max(1, this.wave));
  }

  getPlan(w: number): WavePlan {
    let p = this.plans.get(w);
    if (!p) {
      p = planWave(this.cfg.seed, w, this.cfg.mutators);
      this.plans.set(w, p);
    }
    return p;
  }

  emit(ev: BEvent): void {
    this.events.push(ev);
  }

  // ───────────────────────── main loop ─────────────────────────
  step(): void {
    if (this.frozen) return;
    this.tick++;
    this.time += DT;
    const dt = DT;
    this.updateWaves(dt);
    updateEnemies(this, dt);
    updateSoldiers(this, dt);
    updateTowers(this, dt);
    updateHero(this, dt);
    updateProjectiles(this, dt);
    updateZones(this, dt);
    this.updateMisc(dt);
    this.cleanup();
    this.checkXp();
    this.checkFortress();
  }

  private updateWaves(dt: number): void {
    if (this.lab) {
      this.processSpawns(dt);
      return;
    }
    this.waveTimer -= dt;
    if (this.waveTimer <= 0) {
      this.startWave();
    }
    this.processSpawns(dt);
  }

  startWave(): void {
    this.wave++;
    this.waveTimer = this.waveInterval;
    const plan = this.getPlan(this.wave);
    for (const s of plan.spawns) this.spawnQueue.push({ ...s, t: s.at, wave: this.wave });
    const ph = phaseFor(this.wave);
    if (ph.id !== this.phaseId) {
      this.phaseId = ph.id;
      this.emit({ e: 'phase', id: ph.id, name: ph.name, blurb: ph.blurb });
    }
    if (this.wave > 1 && (this.wave - 1) % 10 === 0) {
      this.supplyDrops++;
      this.emit({ e: 'supply', wave: this.wave - 1 });
    }
    this.lastWaveCleared = this.wave - 1;
    this.emit({ e: 'wave', wave: this.wave, name: plan.name, boss: plan.boss, air: plan.hasAir });
  }

  private processSpawns(dt: number): void {
    for (const s of this.spawnQueue) s.t -= dt;
    while (this.spawnQueue.length && this.spawnQueue[0].t <= 0) {
      const s = this.spawnQueue.shift()!;
      this.spawnEnemy(s.enemy, s.wave, { elite: s.elite, affix: s.affix });
    }
  }

  spawnEnemy(
    type: string,
    wave: number,
    o: { elite?: boolean; affix?: string | null; at?: { r?: number; x?: number; y?: number }; hpMul?: number; decoy?: boolean; noReward?: boolean } = {},
  ): Enemy {
    const def = ENEMY_MAP[type];
    const scale = hpScale(Math.max(1, wave));
    let hp = def.hp * scale * (o.hpMul ?? 1);
    if (o.elite) hp *= 2.5;
    const path = this.board.path;
    const g = this.board.gate;
    const e: Enemy = {
      id: this.id(), def, cls: def.cls, air: def.air, hp, maxHp: hp, shield: 0, maxShield: 0,
      armor: def.armor * (1 + wave / 60), speed: def.speed, r: 0, lane: (this.rng.next() - 0.5) * 0.36,
      x: 0, y: 0, px: 0, py: 0, dirX: 0, dirY: 1, ax: g.x + 0.5, ay: g.y + 0.5, aLen: 0,
      elite: !!o.elite, affix: o.affix ?? null, slow: 0, slowT: 0, stunT: 0, burn: 0, burnT: 0, burnSrc: 0,
      shockT: 0, danceT: 0, vuln: 0, vulnT: 0, chill: 0, chillT: 0, freezeT: 0, freezeImm: 0,
      burrowT: 0, burrowCd: 3 + this.rng.next() * 3, sprintT: 0, lockT: 0, disp: 0, dispT: 0, blockedBy: 0,
      atkCd: 0, abilT: 4, abilT2: 6, bossPhase: 0, decoy: !!o.decoy, blinked: false, dead: false, leaked: false,
      noReward: !!o.noReward, xp: def.xp, fortDmg: def.dmg, melee: (4 + def.dmg * 3) * Math.sqrt(scale),
      wave, flash: 0, lastHitBy: 0, wildfire: false,
    };
    if (def.shieldPct) {
      e.maxShield = e.shield = hp * def.shieldPct;
    }
    if (this.phase.shields && !def.boss && this.rng.chance(0.25)) {
      e.maxShield = e.shield = Math.max(e.shield, hp * 0.35);
    }
    if (e.affix === 'hasted') e.speed *= 1.3;
    if (e.affix === 'shielded') e.maxShield = e.shield = hp * 0.5;
    if (e.affix === 'armored') e.armor += 6;
    if (e.decoy) {
      e.xp = 0;
      e.fortDmg = 5;
    }
    if (def.air) {
      const sx = o.at?.x ?? g.x + 0.5;
      const sy = o.at?.y ?? g.y + 0.5;
      e.ax = sx;
      e.ay = sy;
      e.aLen = Math.hypot(FORT.x + 0.5 - sx, FORT.y + 0.5 - sy);
      e.r = e.aLen;
    } else {
      e.r = o.at?.r ?? path.length;
    }
    this.positionEnemy(e);
    e.px = e.x;
    e.py = e.y;
    this.enemies.push(e);
    this.enemyById.set(e.id, e);
    this.emit({ e: 'spawn', id: e.id });
    if (def.boss) this.emit({ e: 'bossIntro', id: e.id, name: def.name, type: def.id });
    return e;
  }

  private tmp = { x: 0, y: 0, tx: 0, ty: 0 };
  positionEnemy(e: Enemy): void {
    if (e.air) {
      const fx = FORT.x + 0.5, fy = FORT.y + 0.5;
      const L = e.aLen || 1;
      const t = e.r / L;
      const wob = Math.sin(e.r * 2.2 + e.id) * 0.12;
      const dx = (e.ax - fx) / L, dy = (e.ay - fy) / L;
      e.x = fx + (e.ax - fx) * t - dy * wob;
      e.y = fy + (e.ay - fy) * t + dx * wob;
      e.dirX = -dx;
      e.dirY = -dy;
    } else {
      const s = this.tmp;
      this.board.path.sample(e.r, s);
      e.x = s.x - s.ty * e.lane;
      e.y = s.y + s.tx * e.lane;
      e.dirX = s.tx;
      e.dirY = s.ty;
    }
  }

  // ───────────────────────── combat helpers ─────────────────────────
  damage(e: Enemy, amount: number, o: DmgOpts): number {
    if (e.dead || amount <= 0) return 0;
    let hit = amount * classMult(o.cls, e.cls);
    const strong = classMult(o.cls, e.cls) > 1;
    let crit = false;
    if (o.crit && this.rng.next() < o.crit) {
      crit = true;
      hit *= o.critDmg ?? 2;
    }
    let amp = 0;
    if (e.shockT > 0) amp += 0.15;
    if (e.vulnT > 0) amp += e.vuln;
    if (e.lockT > 0) amp += 0.5;
    hit *= 1 + amp;
    if (crit && o.shred) e.armor = Math.max(0, e.armor - o.shred);
    let final = o.noArmor || o.dot ? hit : Math.max(hit - e.armor, hit * 0.1);
    if (e.shield > 0) {
      const mult = o.cls === 'elemental' ? 1.5 : 1;
      const absorbed = Math.min(e.shield, final * mult);
      e.shield -= absorbed;
      final -= absorbed / mult;
    }
    e.hp -= final;
    e.flash = 1;
    if (o.towerId) {
      const t = this.towerById.get(o.towerId);
      if (t) t.dmgDealt += final;
      e.lastHitBy = o.towerId;
    }
    if (o.hero && this.hero) {
      this.hero.dmgDealt += final;
      e.lastHitBy = -1;
    }
    if (this.hero && this.hero.specialT <= 0) {
      const rate = o.hero ? 1 : 0.35;
      this.hero.charge = Math.min(this.hero.def.charge, this.hero.charge + final * rate * (1 + 0.1 * (this.cfg.workshop.heroCharge ?? 0)));
    }
    if (e.def.sprint && !e.sprintT) e.sprintT = 1.4;
    if (!o.dot || final > 30) this.emit({ e: 'hit', x: e.x, y: e.y, amount: final + 0, crit, strong, dot: o.dot });
    if (e.hp <= 0) this.kill(e);
    return final;
  }

  kill(e: Enemy): void {
    if (e.dead) return;
    e.dead = true;
    e.hp = 0;
    if (!e.leaked) {
      this.kills++;
      if (e.lastHitBy > 0) {
        const t = this.towerById.get(e.lastHitBy);
        if (t) t.kills++;
      } else if (e.lastHitBy === -1 && this.hero) {
        this.hero.kills++;
      }
      let xp = 0;
      if (!e.noReward) {
        xp = e.xp * this.xpMult(e.wave) * (e.elite ? 2 : 1);
        this.xp += xp;
        if (this.hero) {
          const d = Math.hypot(this.hero.x - e.x, this.hero.y - e.y);
          if (d < 3.5) this.heroGainXp(e.xp);
        }
      }
      if (e.def.boss) this.bossesKilled++;
      this.emit({ e: 'death', id: e.id, x: e.x, y: e.y, type: e.def.id, air: e.air, xp, elite: e.elite, boss: !!e.def.boss });
      // on-death effects
      if (e.def.split && !e.leaked) {
        for (let i = 0; i < e.def.split; i++) {
          const m = this.spawnEnemy('mini', e.wave, { at: { r: e.r + (i - 1) * 0.25 } });
          m.lane = (i - 1) * 0.15;
        }
      }
      if (e.def.emp || e.affix === 'explosive') {
        const r = e.def.emp ? 1.6 : 1.2;
        const dur = e.def.emp ? 2.5 : 1;
        this.emit({ e: 'emp', x: e.x, y: e.y, r });
        for (const t of this.towers) if (Math.hypot(t.x - e.x, t.y - e.y) < r) this.stunTower(t, dur);
      }
      if (e.wildfire) {
        for (const o of this.enemies)
          if (!o.dead && !o.air && Math.hypot(o.x - e.x, o.y - e.y) < 1.1) this.applyBurn(o, e.burn, 3, e.burnSrc);
        this.emit({ e: 'boom', x: e.x, y: e.y, r: 1.1, kind: 'fire', cls: 'elemental' });
      }
    }
  }

  xpMult(w: number): number {
    let m = 1 + 0.045 * (w - 1);
    m *= 1 + 0.04 * (this.cfg.workshop.xpGain ?? 0);
    m *= this.earlyBonus.get(w) ?? 1;
    if (this.phase.xpDecay) m *= Math.max(0.3, Math.pow(0.97, this.wave - 70));
    return m;
  }

  heroGainXp(x: number): void {
    const h = this.hero!;
    h.runXp += x;
    const need = 20 + h.runLevel * 18;
    if (h.runXp >= need && h.runLevel < 10) {
      h.runXp -= need;
      h.runLevel++;
    }
  }

  slowEnemy(e: Enemy, amount: number, dur: number): void {
    if (e.def.slowImmune) return;
    if (e.def.boss) dur *= 0.5;
    if (amount >= e.slow || e.slowT <= 0) e.slow = Math.min(0.7, amount);
    e.slowT = Math.max(e.slowT, dur);
  }

  chillEnemy(e: Enemy, slow: number, dur: number): boolean {
    this.slowEnemy(e, slow, dur);
    if (e.def.slowImmune || e.freezeImm > 0) return false;
    e.chill++;
    e.chillT = 2;
    if (e.chill >= 4) {
      e.chill = 0;
      e.freezeT = e.def.boss ? 0.5 : 1.0;
      e.freezeImm = 3.5;
      return true;
    }
    return false;
  }

  stunEnemy(e: Enemy, dur: number): void {
    if (e.def.boss) dur *= 0.5;
    e.stunT = Math.max(e.stunT, dur);
  }

  applyBurn(e: Enemy, dps: number, dur: number, src: number): void {
    if (e.def.id === 'titan') return;
    if (dps >= e.burn || e.burnT <= 0) {
      e.burn = dps;
      e.burnSrc = src;
    }
    e.burnT = Math.max(e.burnT, dur);
  }

  /** Move enemy along its route. positive = toward gate (push back). */
  displace(e: Enemy, amount: number): void {
    if (e.dead) return;
    if (e.def.boss) amount *= 0.25;
    if (amount > 0) {
      const budget = 1.6 - e.disp;
      if (budget <= 0) return;
      amount = Math.min(amount, budget);
      e.disp += amount;
    }
    const maxR = e.air ? e.aLen + 0.6 : this.board.path.length;
    e.r = Math.max(0, Math.min(maxR, e.r + amount));
    if (e.blockedBy && amount > 0.05) this.unblock(e);
  }

  unblock(e: Enemy): void {
    if (!e.blockedBy) return;
    const s = this.soldierById.get(e.blockedBy);
    if (s) s.blocking = s.blocking.filter((id) => id !== e.id);
    e.blockedBy = 0;
  }

  stunTower(t: Tower, dur: number): void {
    t.stunT = Math.max(t.stunT, dur);
    this.emit({ e: 'towerStun', id: t.id, t: dur });
  }

  damageTower(t: Tower, amount: number): void {
    if (t.koT > 0) return;
    t.integrity -= amount;
    if (t.integrity <= 0) {
      t.integrity = 0;
      t.koT = 8;
      this.emit({ e: 'towerKO', id: t.id });
    }
  }

  targetable(e: Enemy, kind: 'ground' | 'air' | 'both' | 'none'): boolean {
    if (e.dead || e.burrowT > 0) return false;
    if (kind === 'none') return false;
    if (kind === 'ground' && e.air) return false;
    if (kind === 'air' && !e.air) return false;
    return true;
  }

  // ───────────────────────── misc ─────────────────────────
  private updateMisc(dt: number): void {
    for (const s of this.skills) if (s.cd > 0) s.cd -= dt;
    if (this.rallyT > 0) this.rallyT -= dt;
    if (this.repairT > 0) {
      this.repairT -= dt;
      const lvl = this.skills.find((s) => s.id === 'repair');
      const rate = (this.fortMax * 0.3 * (1 + 0.15 * ((lvl?.level ?? 1) - 1))) / 6;
      this.fortHp = Math.min(this.fortMax, this.fortHp + rate * dt);
    }
    // collapse
    const b = this.board;
    for (let i = 0; i < b.cracked.length; i++) {
      if (b.cracked[i] > 0) {
        b.cracked[i] -= dt;
        if (b.cracked[i] <= 0) {
          b.cracked[i] = 0;
          b.terrain[i] = T.Chasm;
          b.power[i] = 0;
          this.emit({ e: 'collapse', x: i % 13, y: Math.floor(i / 13) });
        }
      }
    }
  }

  private cleanup(): void {
    if (this.enemies.some((e) => e.dead)) {
      for (const e of this.enemies) if (e.dead) {
        this.enemyById.delete(e.id);
        if (e.blockedBy) this.unblock(e);
      }
      this.enemies = this.enemies.filter((e) => !e.dead);
    }
    if (this.projectiles.some((p) => p.dead)) this.projectiles = this.projectiles.filter((p) => !p.dead);
    if (this.zones.some((z) => z.t >= z.dur)) this.zones = this.zones.filter((z) => z.t < z.dur);
    if (this.soldiers.some((s) => s.dead && s.barricade)) {
      for (const s of this.soldiers) if (s.dead && s.barricade) this.soldierById.delete(s.id);
      this.soldiers = this.soldiers.filter((s) => !(s.dead && s.barricade));
    }
  }

  private checkXp(): void {
    while (this.xp >= xpNeeded(this.level + 1)) {
      this.xp -= xpNeeded(this.level + 1);
      this.level++;
      this.pendingPicks++;
      this.emit({ e: 'levelup', level: this.level });
    }
    if (this.pendingPicks > 0 && !this.offer && !this.placing) this.nextOffer();
  }

  private checkFortress(): void {
    if (this.fortHp > 0 || this.over) return;
    if (this.lab) {
      this.fortHp = this.fortMax;
      return;
    }
    if (!this.lastStandUsed && !this.mut('glass')) {
      this.lastStandUsed = true;
      this.fortHp = this.fortMax * (0.3 + 0.1 * (this.cfg.workshop.lastStand ?? 0));
      this.emit({ e: 'lastStand' });
      for (const e of this.enemies) {
        if (e.def.boss) {
          this.displace(e, 3);
          e.disp = 0;
          this.damage(e, e.maxHp * 0.08, { cls: 'utility', noArmor: true });
        } else {
          e.noReward = true;
          this.kill(e);
        }
      }
      this.spawnQueue = this.spawnQueue.filter((s) => s.boss);
      return;
    }
    this.over = true;
    this.emit({ e: 'gameOver', wave: this.wave });
  }

  leak(e: Enemy): void {
    e.leaked = true;
    e.dead = true;
    this.leaks++;
    let dmg = e.fortDmg * (e.elite ? 2 : 1);
    if (this.lab) dmg = 0;
    this.fortHp -= dmg;
    this.emit({ e: 'leak', id: e.id, dmg });
    this.emit({ e: 'fortHit', dmg });
  }

  // ───────────────────────── draft / commands ─────────────────────────
  nextOffer(): void {
    if (this.pendingPicks <= 0 || this.over) return;
    this.offer = makeOffer(this);
    if (!this.offer.length) {
      this.offer = null;
      this.pendingPicks = 0;
    }
  }

  command(cmd: Command): boolean {
    const ok = this.apply(cmd);
    if (ok) this.log.push({ tick: this.tick, cmd });
    return ok;
  }

  private apply(cmd: Command): boolean {
    const b = this.board;
    switch (cmd.t) {
      case 'pick': {
        if (!this.offer || !this.offer[cmd.index]) return false;
        const card = this.offer[cmd.index];
        this.offer = null;
        this.pendingPicks--;
        this.picks++;
        this.resolveCard(card);
        if (!this.placing) this.nextOffer();
        return true;
      }
      case 'refresh': {
        if (!this.offer || this.refreshes <= 0) return false;
        this.refreshes--;
        this.offer = makeOffer(this);
        return true;
      }
      case 'placeRoad': {
        const c = this.placing;
        if (!c || c.kind !== 'road' || !c.pieces.includes(cmd.piece)) return false;
        const opt = b.roadOptions(cmd.piece).find((o) => o.rot === cmd.rot && o.mirror === cmd.mirror);
        if (!opt) return false;
        this.placeRoad(opt);
        this.donePlacing();
        return true;
      }
      case 'placeField': {
        const c = this.placing;
        if (!c || c.kind !== 'field' || c.shape !== cmd.shape) return false;
        const cells = b.fieldValid(cmd.shape, cmd.x, cmd.y, cmd.rot);
        if (!cells) return false;
        b.reveal(cells);
        this.emit({ e: 'field', cells });
        this.donePlacing();
        return true;
      }
      case 'placeTower': {
        const c = this.placing;
        if (!c || c.kind !== 'tower') return false;
        const def = TOWER_MAP[c.id];
        if (def.onRoad ? !b.canTrap(cmd.x, cmd.y) : !b.canBuild(cmd.x, cmd.y)) return false;
        this.addTower(c.id, cmd.x, cmd.y);
        this.donePlacing();
        return true;
      }
      case 'placeHero': {
        const c = this.placing;
        if (!c || c.kind !== 'hero' || !b.canBuild(cmd.x, cmd.y)) return false;
        this.addHero(c.id, cmd.x, cmd.y);
        this.donePlacing();
        return true;
      }
      case 'move': {
        const c = this.placing;
        if (!c || c.kind !== 'move') return false;
        return this.moveUnit(cmd.from, cmd.to) && (this.donePlacing(), true);
      }
      case 'switch': {
        const c = this.placing;
        if (!c || c.kind !== 'switch') return false;
        return this.switchUnits(cmd.a, cmd.b) && (this.donePlacing(), true);
      }
      case 'cast':
        return castSkill(this, cmd.skill, cmd.x, cmd.y);
      case 'heroSpecial':
        return heroSpecial(this);
      case 'targeting': {
        const id = b.inb(cmd.x, cmd.y) ? b.occupant[Board.idx(cmd.x, cmd.y)] || b.trap[Board.idx(cmd.x, cmd.y)] : 0;
        const t = this.towerById.get(id);
        if (!t) return false;
        const modes = ['first', 'last', 'strongest', 'weakest', 'closest'] as const;
        t.mode = modes[(modes.indexOf(t.mode) + 1) % modes.length];
        return true;
      }
      case 'callEarly': {
        if (this.lab || this.frozen) return false;
        const next = this.wave + 1;
        this.earlyBonus.set(next, 1.25);
        this.waveTimer = 0;
        return true;
      }
      case 'lab':
        return this.labOp(cmd.op, cmd.arg);
    }
  }

  private donePlacing(): void {
    this.placing = null;
    this.nextOffer();
  }

  resolveCard(card: Card): void {
    switch (card.kind) {
      case 'star': {
        this.stars[card.id] = Math.min(6, (this.stars[card.id] ?? 1) + 1);
        for (const t of this.towers) if (t.def.id === card.id) recomputeTowerStats(this, t);
        recomputeTowerStats(this);
        this.emit({ e: 'star', tower: card.id, stars: this.stars[card.id] });
        break;
      }
      case 'skill': {
        const s = this.skills.find((x) => x.id === card.id);
        if (s) {
          s.level = Math.min(5, s.level + 1);
          if (s.level === 1) s.cd = 0;
          else s.cd = Math.max(0, s.cd - 8);
        }
        break;
      }
      case 'repair':
        this.fortHp = Math.min(this.fortMax, this.fortHp + this.fortMax * 0.25);
        break;
      default:
        this.placing = card;
    }
  }

  placeRoad(opt: RoadOption): void {
    const old = { ...this.board.gate };
    this.board.placeRoad(opt);
    this.emit({ e: 'road', tiles: opt.tiles, oldGate: old });
  }

  addTower(id: string, x: number, y: number): Tower {
    const def = TOWER_MAP[id];
    const dc = this.cfg.deck.towers.find((d) => d.id === id) ?? { id, rarity: 0, level: 1 };
    if (!this.stars[id]) this.stars[id] = 1;
    const b = this.board;
    const i = Board.idx(x, y);
    const t: Tower = {
      id: this.id(), def, tx: x, ty: y, x: x + 0.5, y: y + 0.5, rarity: dc.rarity, level: dc.level,
      stats: towerStats(def, dc.rarity, dc.level, this.stars[id]), cd: 0.3, targetId: 0,
      mode: def.id === 'railgun' ? 'strongest' : 'first', integrity: 100, koT: 0, stunT: 0, spin: 0, rampT: 0,
      beamTargets: [], shots: 0, charges: 0, rearmT: 0, aim: -Math.PI / 2, power: !def.onRoad && b.power[i] === 1,
      soldiers: [], dmgDealt: 0, kills: 0, buffDmg: 0, buffApm: 0, buffCrit: 0, placedTick: this.tick, fireFx: 0,
      trapHit: new Map(),
    };
    if (def.onRoad) b.trap[i] = t.id;
    else b.occupant[i] = t.id;
    this.towers.push(t);
    this.towerById.set(t.id, t);
    recomputeTowerStats(this);
    t.charges = t.stats.charges;
    this.emit({ e: 'towerPlaced', id: t.id, x, y });
    if (this.phase.collapse && !def.onRoad) this.crackNear(x, y);
    return t;
  }

  private crackNear(x: number, y: number): void {
    const b = this.board;
    const cands: Vec2[] = [];
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        if (b.canBuild(x + dx, y + dy)) cands.push({ x: x + dx, y: y + dy });
      }
    if (!cands.length) return;
    const c = this.rng.pick(cands);
    b.cracked[Board.idx(c.x, c.y)] = 20;
    this.emit({ e: 'crack', x: c.x, y: c.y });
  }

  addHero(id: string, x: number, y: number): void {
    const def = HERO_MAP[id];
    const dc = this.cfg.deck.hero ?? { id, rarity: 0, level: 1 };
    const h: Hero = {
      id: this.id(), def, tx: x, ty: y, x: x + 0.5, y: y + 0.5, rarity: dc.rarity, level: dc.level, runLevel: 1, runXp: 0,
      cd: 0.5, charge: 0, specialT: 0, targetId: 0, dmgDealt: 0, kills: 0, aim: -Math.PI / 2, stunT: 0,
      dashTargets: [], dashT: 0, fireFx: 0,
    };
    this.board.occupant[Board.idx(x, y)] = h.id;
    this.hero = h;
    this.heroUsed = true;
    recomputeTowerStats(this);
    this.emit({ e: 'towerPlaced', id: h.id, x, y });
  }

  private unitAt(p: Vec2): { tower?: Tower; hero?: Hero } {
    const b = this.board;
    if (!b.inb(p.x, p.y)) return {};
    const i = Board.idx(p.x, p.y);
    const id = b.occupant[i];
    if (this.hero && id === this.hero.id) return { hero: this.hero };
    const t = this.towerById.get(id);
    return t ? { tower: t } : {};
  }

  private moveUnit(from: Vec2, to: Vec2): boolean {
    const b = this.board;
    const u = this.unitAt(from);
    if (!u.tower && !u.hero) return false;
    if (!b.canBuild(to.x, to.y)) return false;
    const id = u.tower?.id ?? u.hero!.id;
    b.occupant[Board.idx(from.x, from.y)] = 0;
    b.occupant[Board.idx(to.x, to.y)] = id;
    if (u.tower) {
      const t = u.tower;
      t.tx = to.x; t.ty = to.y; t.x = to.x + 0.5; t.y = to.y + 0.5;
      t.power = b.power[Board.idx(to.x, to.y)] === 1;
      this.resetSoldiers(t);
    } else if (u.hero) {
      const h = u.hero;
      h.tx = to.x; h.ty = to.y; h.x = to.x + 0.5; h.y = to.y + 0.5;
    }
    recomputeTowerStats(this);
    this.emit({ e: 'towerMoved', id });
    return true;
  }

  private switchUnits(a: Vec2, c: Vec2): boolean {
    const b = this.board;
    const ua = this.unitAt(a), ub = this.unitAt(c);
    const A = ua.tower ?? ua.hero, B = ub.tower ?? ub.hero;
    if (!A || !B || A === B) return false;
    b.occupant[Board.idx(a.x, a.y)] = B.id;
    b.occupant[Board.idx(c.x, c.y)] = A.id;
    const place = (u: Tower | Hero, p: Vec2) => {
      u.tx = p.x; u.ty = p.y; u.x = p.x + 0.5; u.y = p.y + 0.5;
      if ('def' in u && 'stats' in u) {
        (u as Tower).power = b.power[Board.idx(p.x, p.y)] === 1;
        this.resetSoldiers(u as Tower);
      }
    };
    place(A, c);
    place(B, a);
    recomputeTowerStats(this);
    this.emit({ e: 'towerMoved', id: A.id });
    this.emit({ e: 'towerMoved', id: B.id });
    return true;
  }

  resetSoldiers(t: Tower): void {
    for (const sid of t.soldiers) {
      const s = this.soldierById.get(sid);
      if (!s) continue;
      for (const eid of s.blocking) {
        const e = this.enemyById.get(eid);
        if (e) e.blockedBy = 0;
      }
      this.soldierById.delete(sid);
    }
    this.soldiers = this.soldiers.filter((s) => s.towerId !== t.id);
    t.soldiers = [];
  }

  // ───────────────────────── lab ─────────────────────────
  private labOp(op: string, arg?: string): boolean {
    if (!this.lab) return false;
    if (op === 'spawn' && arg && ENEMY_MAP[arg]) {
      this.spawnEnemy(arg, Math.max(1, this.wave || 10));
      return true;
    }
    if (op === 'spawnElite' && arg && ENEMY_MAP[arg]) {
      this.spawnEnemy(arg, Math.max(1, this.wave || 10), { elite: true, affix: 'armored' });
      return true;
    }
    if (op === 'wave' && arg) {
      this.wave = Math.max(1, parseInt(arg, 10) || 1);
      return true;
    }
    if (op === 'card' && arg) {
      if (this.offer || this.placing) return false;
      const card = JSON.parse(arg) as Card;
      this.resolveCard(card);
      return true;
    }
    if (op === 'clear') {
      for (const e of this.enemies) {
        e.noReward = true;
        this.kill(e);
      }
      return true;
    }
    if (op === 'xp') {
      this.pendingPicks++;
      this.nextOffer();
      return true;
    }
    if (op === 'skillsReady') {
      for (const s of this.skills) s.cd = 0;
      if (this.hero) this.hero.charge = this.hero.def.charge;
      return true;
    }
    if (op === 'revealAll') {
      this.board.revealed.fill(1);
      this.emit({ e: 'field', cells: [] });
      return true;
    }
    return false;
  }

  // ───────────────────────── queries ─────────────────────────
  get score(): number {
    const mult = Math.pow(1.5, this.cfg.mutators.length);
    return Math.round(this.wave * 100 * mult);
  }

  skillDef(id: string) {
    return SKILL_MAP[id];
  }
}
