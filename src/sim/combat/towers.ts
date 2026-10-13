import { DT } from '../core/const';
import type { Battle } from '../battle';
import type { Projectile, Soldier, Tower } from '../entities/entities';
import type { Enemy } from '../entities/entities';
import { towerStats } from '../../data/towers';
import { findTarget, findTargets, enemiesWithin, inRange } from './targeting';

/** Recompute tower stats for all towers (stars, rarity, power tiles, buffs, hero passive, workshop). */
export function recomputeTowerStats(b: Battle, _only?: Tower): void {
  const ws = b.cfg.workshop;
  const hero = b.hero;
  // amplifier buffs
  for (const t of b.towers) {
    t.buffDmg = 0;
    t.buffApm = 0;
    t.buffCrit = 0;
  }
  for (const a of b.towers) {
    if (a.def.delivery !== 'buff') continue;
    const s = towerStats(a.def, a.rarity, a.level, b.stars[a.def.id] ?? 1);
    const boost = hero && hero.def.id === 'bolt' ? 1.2 : 1;
    for (const t of b.towers) {
      if (t === a || t.def.delivery === 'buff') continue;
      if (Math.hypot(t.x - a.x, t.y - a.y) <= s.buffRadius + 0.01) {
        t.buffDmg += s.buffDmg * boost * (1 + 0.15 * (a.rarity - t.rarity) * 0);
        t.buffApm += s.buffApm * boost;
        t.buffCrit += s.buffCrit;
      }
    }
    a.stats = s;
  }
  for (const t of b.towers) {
    if (t.def.delivery === 'buff') continue;
    const s = towerStats(t.def, t.rarity, t.level, b.stars[t.def.id] ?? 1);
    const classBonus = 1 + 0.04 * (ws['dmg_' + t.def.cls] ?? 0);
    s.dmg *= classBonus * (t.power ? 1.25 : 1) * (1 + Math.min(0.6, t.buffDmg));
    s.burn *= classBonus;
    s.crater *= classBonus;
    s.apm *= 1 + t.buffApm;
    s.crit += t.buffCrit;
    if (hero) {
      if (hero.def.id === 'vex' && t.def.cls === 'vanguard') s.range += 0.4;
      if (hero.def.id === 'kira' && t.def.cls === 'swift') s.crit += 0.1;
      if (hero.def.id === 'sol' && t.def.cls === 'elemental') {
        s.slowDur *= 1.3;
        s.burnDur *= 1.3;
        s.shock *= 1.3;
      }
      if (hero.def.id === 'bolt' && t.def.cls === 'utility') {
        s.push *= 1.2;
        s.pull *= 1.2;
        s.dance *= 1.2;
        s.slow *= 1.2;
        s.stun *= 1.2;
      }
    }
    t.stats = s;
  }
}

const tmp = { x: 0, y: 0, tx: 0, ty: 0 };

function predict(e: Enemy, time: number): { x: number; y: number } {
  const vx = (e.x - e.px) / DT, vy = (e.y - e.py) / DT;
  return { x: e.x + vx * time, y: e.y + vy * time };
}

function proj(b: Battle, t: Tower, p: Partial<Projectile>): Projectile {
  const pr: Projectile = {
    id: b.id(), kind: 'shell', x: t.x, y: t.y, z: 0.6, px: t.x, py: t.y, pz: 0.6, sx: t.x, sy: t.y, tx: t.x, ty: t.y,
    targetId: 0, speed: 6, t: 0, dur: 1, towerId: t.id, dmg: t.stats.dmg, aoe: t.stats.aoe, cls: t.def.cls,
    crit: t.stats.crit, critDmg: t.stats.critDmg, hit: new Set(), leg: 0, legs: 1, air: null, d: 0, dEnd: 0,
    color: t.def.color, dead: false, extra: 0, ...p,
  };
  b.projectiles.push(pr);
  return pr;
}

export function updateTowers(b: Battle, dt: number): void {
  const rally = b.rallyT > 0 ? 1.4 : 1;
  for (const t of b.towers) {
    if (t.fireFx > 0) t.fireFx = Math.max(0, t.fireFx - dt * 4);
    if (t.koT > 0) {
      t.koT -= dt;
      if (t.koT <= 0) t.integrity = 100;
      t.beamTargets = [];
      continue;
    }
    if (t.stunT > 0) {
      t.stunT -= dt;
      t.beamTargets = [];
      continue;
    }
    const s = t.stats;
    const apm = s.apm * rally;
    t.cd -= dt;
    switch (t.def.delivery) {
      case 'hitscan':
        hitscan(b, t, apm, dt);
        break;
      case 'ballistic':
        ballistic(b, t, apm);
        break;
      case 'homing':
        homing(b, t, apm);
        break;
      case 'chain':
        chain(b, t, apm);
        break;
      case 'beam':
        beam(b, t, dt, rally);
        break;
      case 'cone':
        cone(b, t, apm);
        break;
      case 'push':
        push(b, t, apm);
        break;
      case 'pull':
        pull(b, t, apm);
        break;
      case 'rolling':
        rolling(b, t, apm);
        break;
      case 'trap':
        trap(b, t, dt);
        break;
      case 'aura':
        aura(b, t, apm);
        break;
      case 'summon':
        summon(b, t, dt);
        break;
      case 'buff':
        break;
    }
    // frost aura
    if (s.auraSlow > 0) {
      for (const e of enemiesWithin(b, t.x, t.y, s.buffRadius)) b.slowEnemy(e, s.auraSlow, 0.25);
    }
  }
}

function aimAt(t: Tower, x: number, y: number): void {
  t.aim = Math.atan2(y - t.y, x - t.x);
}

function retarget(b: Battle, t: Tower): Enemy | null {
  const s = t.stats;
  const cur = t.targetId ? b.enemyById.get(t.targetId) : undefined;
  if (cur && b.targetable(cur, t.def.targets) && inRange(cur, t.x, t.y, s.range, s.minRange) && t.mode !== 'first') return cur;
  const e = findTarget(b, t.x, t.y, t.def.targets, s.range, s.minRange, t.mode);
  t.targetId = e ? e.id : 0;
  return e;
}

function hitscan(b: Battle, t: Tower, apm: number, dt: number): void {
  const s = t.stats;
  const e = retarget(b, t);
  if (s.spinUp > 0) {
    t.spin = e ? Math.min(1, t.spin + dt / s.spinUp) : Math.max(0, t.spin - dt / s.spinUp);
    apm *= 0.55 + 0.75 * t.spin;
  }
  if (!e) return;
  aimAt(t, e.x, e.y);
  let guard = 0;
  while (t.cd <= 0 && guard++ < 3) {
    t.cd += 60 / apm;
    t.shots++;
    t.fireFx = 1;
    if (s.pierce > 0) {
      // railgun line
      const dx = e.x - t.x, dy = e.y - t.y;
      const L = Math.hypot(dx, dy) || 1;
      const ux = dx / L, uy = dy / L;
      const hits: { e: Enemy; a: number }[] = [];
      for (const o of b.enemies) {
        if (!b.targetable(o, t.def.targets)) continue;
        const rx = o.x - t.x, ry = o.y - t.y;
        const along = rx * ux + ry * uy;
        if (along < 0 || along > s.range + 0.5) continue;
        if (Math.abs(rx * uy - ry * ux) < 0.32 + o.def.size * 0.3) hits.push({ e: o, a: along });
      }
      hits.sort((p, q) => p.a - q.a);
      const mega = s.every > 0 && t.shots % s.every === 0 ? s.special : 1;
      const n = 1 + s.pierce;
      for (let i = 0; i < Math.min(n, hits.length); i++)
        b.damage(hits[i].e, s.dmg * mega * (i === 0 ? 1 : 0.8), { cls: t.def.cls, towerId: t.id, crit: s.crit, critDmg: s.critDmg });
      b.emit({ e: 'shot', tower: t.id, kind: mega > 1 ? 'mega' : 'rail', x: t.x, y: t.y, tx: t.x + ux * (s.range + 0.5), ty: t.y + uy * (s.range + 0.5), cls: t.def.cls });
    } else {
      b.damage(e, s.dmg, { cls: t.def.cls, towerId: t.id, crit: s.crit, critDmg: s.critDmg, shred: s.armorShred });
      if (t.shots % 2 === 0) b.emit({ e: 'shot', tower: t.id, kind: 'bullet', x: t.x, y: t.y, tx: e.x, ty: e.y, cls: t.def.cls });
    }
    if (e.dead) break;
  }
  if (t.cd < 0) t.cd = Math.max(t.cd, -60 / apm);
}

function ballistic(b: Battle, t: Tower, apm: number): void {
  if (t.cd > 0) return;
  const s = t.stats;
  const e = retarget(b, t);
  if (!e) return;
  t.cd = 60 / apm;
  t.fireFx = 1;
  const mortar = s.minRange >= 1.5;
  const dist = Math.hypot(e.x - t.x, e.y - t.y);
  const flight = mortar ? 0.9 + dist * 0.12 : 0.35 + dist * 0.1;
  const p = predict(e, flight);
  aimAt(t, p.x, p.y);
  const n = Math.max(1, s.count);
  for (let i = 0; i < n; i++) {
    const off = i === 0 ? { x: 0, y: 0 } : { x: b.rng.range(-0.7, 0.7), y: b.rng.range(-0.7, 0.7) };
    proj(b, t, {
      kind: 'shell', tx: p.x + off.x, ty: p.y + off.y, dur: flight + i * 0.12, air: false, extra: s.special,
    });
  }
  b.emit({ e: 'shot', tower: t.id, kind: mortar ? 'mortar' : 'cannon', x: t.x, y: t.y, tx: p.x, ty: p.y, cls: t.def.cls });
}

function homing(b: Battle, t: Tower, apm: number): void {
  if (t.cd > 0) return;
  const s = t.stats;
  const id = t.def.id;
  if (id === 'boomerang') {
    const e = retarget(b, t);
    if (!e) return;
    t.cd = 60 / apm;
    t.fireFx = 1;
    aimAt(t, e.x, e.y);
    const legs = 2 + (s.special > 0 ? 2 : 0);
    for (let i = 0; i < s.count; i++) {
      const ang = Math.atan2(e.y - t.y, e.x - t.x) + (i - (s.count - 1) / 2) * 0.5;
      const reach = Math.min(s.range, Math.hypot(e.x - t.x, e.y - t.y) + 0.6);
      proj(b, t, { kind: 'blade', tx: t.x + Math.cos(ang) * reach, ty: t.y + Math.sin(ang) * reach, speed: 7, legs, dur: 99, air: null, aoe: 0.42 });
    }
    return;
  }
  if (id === 'skyguard') {
    const targets = findTargets(b, t.x, t.y, 'air', s.range, 0, t.mode, Math.max(1, s.splitTargets));
    if (!targets.length) return;
    t.cd = 60 / apm;
    t.fireFx = 1;
    aimAt(t, targets[0].x, targets[0].y);
    for (let i = 0; i < s.count; i++) {
      const e = targets[i % targets.length];
      proj(b, t, { kind: 'missile', targetId: e.id, speed: 7.5, dur: 99, air: true, z: 0.9, extra: i * 0.06, sx: t.x + (i - 1) * 0.15 });
    }
    b.emit({ e: 'shot', tower: t.id, kind: 'missiles', x: t.x, y: t.y, tx: targets[0].x, ty: targets[0].y, cls: t.def.cls });
    return;
  }
  // frost & generic homing
  const e = retarget(b, t);
  if (!e) return;
  t.cd = 60 / apm;
  t.fireFx = 1;
  aimAt(t, e.x, e.y);
  proj(b, t, { kind: 'frost', targetId: e.id, speed: 9, dur: 99, air: null });
}

function chain(b: Battle, t: Tower, apm: number): void {
  if (t.cd > 0) return;
  const s = t.stats;
  const first = retarget(b, t);
  if (!first) return;
  t.cd = 60 / apm;
  t.fireFx = 1;
  t.shots++;
  aimAt(t, first.x, first.y);
  const pts = [t.x, t.y];
  const hitSet = new Set<number>();
  let cur: Enemy | null = first;
  let dmg = s.dmg;
  for (let j = 0; cur && j <= s.chains; j++) {
    hitSet.add(cur.id);
    pts.push(cur.x, cur.y);
    b.damage(cur, dmg, { cls: t.def.cls, towerId: t.id, crit: s.crit, critDmg: s.critDmg });
    if (s.shock > 0 && !cur.dead) cur.shockT = Math.max(cur.shockT, s.shock);
    dmg *= 1 - s.chainFalloff;
    const from: Enemy = cur;
    cur = findTarget(b, from.x, from.y, 'both', 1.7, 0, 'closest', hitSet);
  }
  b.emit({ e: 'chain', pts, cls: t.def.cls });
  if (s.every > 0 && t.shots % s.every === 0) {
    for (const e of enemiesWithin(b, t.x, t.y, 2.1)) b.damage(e, s.dmg, { cls: t.def.cls, towerId: t.id });
    b.emit({ e: 'boom', x: t.x, y: t.y, r: 2.1, kind: 'overload', cls: t.def.cls });
  }
}

function beam(b: Battle, t: Tower, dt: number, rally: number): void {
  const s = t.stats;
  const n = Math.max(1, s.splitTargets);
  const keep: number[] = [];
  for (const id of t.beamTargets) {
    const e = b.enemyById.get(id);
    if (e && b.targetable(e, t.def.targets) && inRange(e, t.x, t.y, s.range)) keep.push(id);
  }
  if (keep.length < t.beamTargets.length || keep.length === 0) {
    if (keep.length === 0) t.rampT = 0;
  }
  while (keep.length < n) {
    const ex = new Set(keep);
    const e = findTarget(b, t.x, t.y, t.def.targets, s.range, 0, t.mode, ex);
    if (!e) break;
    keep.push(e.id);
  }
  t.beamTargets = keep;
  if (!keep.length) return;
  t.rampT += dt;
  const stage = t.rampT < s.rampTime ? 1 : t.rampT < s.rampTime * 2 ? s.ramp2 : s.ramp3;
  const first = b.enemyById.get(keep[0])!;
  aimAt(t, first.x, first.y);
  t.cd -= 0; // unused
  t.shots++;
  if (t.shots % 6 === 0) {
    const chunk = s.dmg * stage * rally * 0.2 * (n > 1 ? 0.75 : 1);
    for (const id of keep) {
      const e = b.enemyById.get(id);
      if (!e) continue;
      b.damage(e, chunk, { cls: t.def.cls, towerId: t.id });
      if (s.burn > 0 && !e.dead) b.applyBurn(e, s.burn, s.burnDur, t.id);
    }
  }
}

function cone(b: Battle, t: Tower, apm: number): void {
  if (t.cd > 0) return;
  const s = t.stats;
  const e = retarget(b, t);
  if (!e) return;
  t.cd = 60 / apm;
  t.fireFx = 1;
  aimAt(t, e.x, e.y);
  const half = ((s.coneDeg / 2) * Math.PI) / 180;
  for (const o of enemiesWithin(b, t.x, t.y, s.range, 'ground')) {
    const a = Math.atan2(o.y - t.y, o.x - t.x);
    let da = Math.abs(a - t.aim);
    if (da > Math.PI) da = Math.PI * 2 - da;
    if (da > half && Math.hypot(o.x - t.x, o.y - t.y) > 0.6) continue;
    b.damage(o, s.dmg, { cls: t.def.cls, towerId: t.id, dot: true });
    if (!o.dead) {
      b.applyBurn(o, s.burn, s.burnDur, t.id);
      if (s.special > 0) o.wildfire = true;
    }
  }
}

function push(b: Battle, t: Tower, apm: number): void {
  if (t.cd > 0) return;
  const s = t.stats;
  const targets = findTargets(b, t.x, t.y, t.def.targets, s.range, 0, 'first', s.count);
  if (!targets.length) return;
  t.cd = 60 / apm;
  t.fireFx = 1;
  aimAt(t, targets[0].x, targets[0].y);
  for (const e of targets) {
    b.displace(e, s.push * (e.air ? s.airMult : 1));
    b.damage(e, s.dmg, { cls: t.def.cls, towerId: t.id });
    if (s.stun > 0 && !e.dead) b.stunEnemy(e, s.stun);
  }
  b.emit({ e: 'gust', x: t.x, y: t.y, tx: targets[0].x, ty: targets[0].y });
}

function pull(b: Battle, t: Tower, apm: number): void {
  if (t.cd > 0) return;
  const s = t.stats;
  const targets = findTargets(b, t.x, t.y, t.def.targets, s.range, 0, 'first', s.count);
  if (!targets.length) return;
  t.cd = 60 / apm;
  t.fireFx = 1;
  aimAt(t, targets[0].x, targets[0].y);
  for (const e of targets) {
    b.emit({ e: 'hook', x: t.x, y: t.y, tx: e.x, ty: e.y });
    b.displace(e, s.pull);
    b.slowEnemy(e, s.slow, s.slowDur);
    if (s.vulnerable > 0) {
      e.vuln = Math.max(e.vuln, s.vulnerable);
      e.vulnT = 3;
    }
    b.damage(e, s.dmg, { cls: t.def.cls, towerId: t.id });
  }
}

function rolling(b: Battle, t: Tower, apm: number): void {
  if (t.cd > 0) return;
  const s = t.stats;
  const e = findTarget(b, t.x, t.y, 'ground', s.range, 0, 'first');
  if (!e) return;
  const near = b.board.path.nearest(t.x, t.y);
  if (near.dist > s.range) return;
  t.cd = 60 / apm;
  t.fireFx = 1;
  aimAt(t, e.x, e.y);
  for (let i = 0; i < s.count; i++) {
    proj(b, t, { kind: 'ball', d: near.d, dEnd: near.d + s.rollLen, speed: 3.4, t: -i * 0.45, dur: 99, air: false, aoe: 0.45 });
  }
}

function trap(b: Battle, t: Tower, dt: number): void {
  const s = t.stats;
  if (t.charges <= 0) {
    t.rearmT -= dt;
    if (t.rearmT <= 0) t.charges = s.charges;
    return;
  }
  for (const e of b.enemies) {
    if (e.air || e.dead || e.burrowT > 0) continue;
    if (Math.abs(e.x - t.x) > 0.55 || Math.abs(e.y - t.y) > 0.55) continue;
    const last = t.trapHit.get(e.id);
    if (last !== undefined && b.time - last < 1.0) continue;
    t.trapHit.set(e.id, b.time);
    t.fireFx = 1;
    b.damage(e, s.dmg, { cls: t.def.cls, towerId: t.id });
    if (!e.dead) {
      if (s.burn > 0) b.applyBurn(e, s.burn, s.burnDur, t.id);
      if (s.slow > 0) b.slowEnemy(e, s.slow, s.slowDur);
      if (s.stun > 0) b.stunEnemy(e, s.stun);
    }
    t.charges--;
    if (t.charges <= 0) {
      t.rearmT = s.rearm;
      break;
    }
  }
  if (t.trapHit.size > 64) {
    for (const [id] of t.trapHit) if (!b.enemyById.has(id)) t.trapHit.delete(id);
  }
}

function aura(b: Battle, t: Tower, apm: number): void {
  if (t.cd > 0) return;
  const s = t.stats;
  const list = enemiesWithin(b, t.x, t.y, s.range, 'ground').filter((e) => !e.def.boss);
  if (!list.length) return;
  t.cd = 60 / apm;
  t.fireFx = 1;
  for (const e of list) {
    e.danceT = Math.max(e.danceT, s.dance);
    if (s.vulnerable > 0) {
      e.vuln = Math.max(e.vuln, s.vulnerable);
      e.vulnT = s.dance + 0.5;
    }
    if (s.dmg > 0) b.damage(e, s.dmg, { cls: t.def.cls, towerId: t.id });
  }
  b.emit({ e: 'dance', x: t.x, y: t.y, r: s.range });
}

function summon(b: Battle, t: Tower, dt: number): void {
  const s = t.stats;
  // soldier slots
  if (t.soldiers.length < s.count) {
    const near = b.board.path.nearest(t.x, t.y);
    if (near.dist > s.range) return;
    const n = s.count;
    const existing = new Set(t.soldiers.map((id) => b.soldierById.get(id)?.d ?? -99));
    for (let i = t.soldiers.length; i < n; i++) {
      let d = near.d + (i - (n - 1) / 2) * 0.45;
      d = Math.max(0.6, Math.min(b.board.path.length - 0.3, d));
      if (existing.has(d)) d += 0.1;
      const sol: Soldier = {
        id: b.id(), towerId: t.id, d, x: t.x, y: t.y, px: t.x, py: t.y, hp: s.soldierHp, maxHp: s.soldierHp,
        dmg: s.dmg, apm: s.apm, cd: 0.5, blockCount: s.blockCount, blocking: [], respawnT: 0.6, dead: true,
        barricade: false, ttl: Infinity,
      };
      b.soldiers.push(sol);
      b.soldierById.set(sol.id, sol);
      t.soldiers.push(sol.id);
    }
  }
  for (const id of t.soldiers) {
    const so = b.soldierById.get(id);
    if (!so) continue;
    so.maxHp = s.soldierHp;
    so.dmg = s.dmg;
    so.apm = s.apm;
    so.blockCount = s.blockCount;
    if (so.dead) {
      so.respawnT -= dt;
      if (so.respawnT <= 0) {
        so.dead = false;
        so.hp = so.maxHp;
        so.x = t.x;
        so.y = t.y;
      }
    }
  }
  void tmp;
}

export function soldierRespawn(t: Tower): number {
  return t.stats.rearm;
}
