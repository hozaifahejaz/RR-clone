import type { Battle } from '../battle';
import type { Enemy, Projectile, Soldier, Zone } from '../entities/entities';
import type { ClassId } from '../types';
import { enemiesWithin, findTarget, findTargets } from './targeting';
import { killSoldier } from './enemies';
import { RARITY_MULT, levelMult } from '../../data/towers';
import { SKILL_MAP } from '../../data/skills';

const tmp = { x: 0, y: 0, tx: 0, ty: 0 };

// ───────────────────────── projectiles ─────────────────────────
export function updateProjectiles(b: Battle, dt: number): void {
  for (const p of b.projectiles) {
    if (p.dead) continue;
    p.px = p.x;
    p.py = p.y;
    p.pz = p.z;
    switch (p.kind) {
      case 'shell':
        shell(b, p, dt);
        break;
      case 'missile':
      case 'frost':
        homingProj(b, p, dt);
        break;
      case 'blade':
        blade(b, p, dt);
        break;
      case 'ball':
        ball(b, p, dt);
        break;
      default:
        p.dead = true;
    }
  }
}

function shell(b: Battle, p: Projectile, dt: number): void {
  p.t += dt;
  const k = Math.min(1, p.t / p.dur);
  p.x = p.sx + (p.tx - p.sx) * k;
  p.y = p.sy + (p.ty - p.sy) * k;
  const dist = Math.hypot(p.tx - p.sx, p.ty - p.sy);
  p.z = 0.6 + Math.sin(k * Math.PI) * (0.6 + dist * 0.35);
  if (k < 1) return;
  p.dead = true;
  const t = b.towerById.get(p.towerId);
  const s = t?.stats;
  explode(b, p.x, p.y, p.aoe, p.dmg, p.cls, p.towerId, false, p.crit, p.critDmg, s?.knock ?? 0);
  b.emit({ e: 'boom', x: p.x, y: p.y, r: p.aoe, kind: p.aoe > 1.1 ? 'big' : 'shell', cls: p.cls });
  if (s && s.crater > 0) addZone(b, { kind: 'crater', x: p.x, y: p.y, radius: p.aoe * 0.8, dps: s.crater, dur: 3, air: false, towerId: p.towerId, cls: p.cls });
  if (p.extra >= 3) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + b.rng.next();
      const bx = p.x + Math.cos(a) * 0.6, by = p.y + Math.sin(a) * 0.6;
      explode(b, bx, by, 0.5, p.dmg * 0.4, p.cls, p.towerId, false, 0, 2, 0);
      b.emit({ e: 'boom', x: bx, y: by, r: 0.5, kind: 'small', cls: p.cls });
    }
  }
}

export function explode(
  b: Battle, x: number, y: number, r: number, dmg: number, cls: ClassId, towerId: number,
  air: boolean | null, crit: number, critDmg: number, knock: number,
): void {
  const kind = air === null ? 'both' : air ? 'air' : 'ground';
  for (const e of enemiesWithin(b, x, y, r, kind)) {
    const falloff = 1 - 0.35 * Math.min(1, Math.hypot(e.x - x, e.y - y) / Math.max(0.01, r));
    b.damage(e, dmg * falloff, { cls, towerId, crit, critDmg });
    if (knock > 0 && !e.dead) b.displace(e, knock);
  }
}

function homingProj(b: Battle, p: Projectile, dt: number): void {
  if (p.extra > 0) {
    p.extra -= dt;
    return;
  }
  let e = b.enemyById.get(p.targetId);
  if (!e || e.dead || e.burrowT > 0) {
    const kind = p.air === true ? 'air' : p.air === false ? 'ground' : 'both';
    e = findTarget(b, p.x, p.y, kind, 2.5, 0, 'closest') ?? undefined;
    if (!e) {
      p.dead = true;
      return;
    }
    p.targetId = e.id;
  }
  const dx = e.x - p.x, dy = e.y - p.y;
  const d = Math.hypot(dx, dy);
  const step = p.speed * dt;
  p.t += dt;
  if (p.kind === 'missile') p.z = 0.9 + Math.sin(Math.min(1, p.t * 2.5) * Math.PI) * 0.5;
  if (d <= step + 0.15) {
    p.dead = true;
    impact(b, p, e);
    return;
  }
  p.x += (dx / d) * step;
  p.y += (dy / d) * step;
}

function impact(b: Battle, p: Projectile, e: Enemy): void {
  const t = b.towerById.get(p.towerId);
  const s = t?.stats;
  if (p.kind === 'missile') {
    explode(b, e.x, e.y, p.aoe, p.dmg, p.cls, p.towerId, true, p.crit, p.critDmg, 0);
    b.emit({ e: 'boom', x: e.x, y: e.y, r: 0.4, kind: 'air', cls: p.cls });
    if (s && s.crater > 0) addZone(b, { kind: 'flak', x: e.x, y: e.y, radius: 0.7, dps: s.crater, dur: 2, air: true, towerId: p.towerId, cls: p.cls });
    return;
  }
  // frost
  b.damage(e, p.dmg, { cls: p.cls, towerId: p.towerId, crit: p.crit, critDmg: p.critDmg });
  if (e.dead || !s) return;
  const froze = b.chillEnemy(e, s.slow, s.slowDur);
  b.emit({ e: 'boom', x: e.x, y: e.y, r: 0.3, kind: 'frost', cls: p.cls });
  if (froze && s.special > 0) {
    explode(b, e.x, e.y, s.aoe, s.dmg * 2.5, p.cls, p.towerId, null, 0, 2, 0);
    b.emit({ e: 'boom', x: e.x, y: e.y, r: s.aoe, kind: 'shatter', cls: p.cls });
  }
}

function blade(b: Battle, p: Projectile, dt: number): void {
  const t = b.towerById.get(p.towerId);
  const homeX = t ? t.x : p.sx, homeY = t ? t.y : p.sy;
  const outward = p.leg % 2 === 0;
  const gx = outward ? p.tx : homeX, gy = outward ? p.ty : homeY;
  const dx = gx - p.x, dy = gy - p.y;
  const d = Math.hypot(dx, dy);
  const step = p.speed * dt;
  if (d <= step) {
    p.x = gx;
    p.y = gy;
    p.leg++;
    p.hit.clear();
    if (p.leg >= p.legs) p.dead = true;
  } else {
    p.x += (dx / d) * step;
    p.y += (dy / d) * step;
  }
  p.z = 0.55;
  for (const e of enemiesWithin(b, p.x, p.y, p.aoe)) {
    if (p.hit.has(e.id)) continue;
    p.hit.add(e.id);
    b.damage(e, p.dmg, { cls: p.cls, towerId: p.towerId, crit: p.crit, critDmg: p.critDmg });
  }
}

function ball(b: Battle, p: Projectile, dt: number): void {
  p.t += dt;
  if (p.t < 0) {
    b.board.path.sample(p.d, tmp);
    p.x = p.px = tmp.x;
    p.y = p.py = tmp.y;
    p.z = -1;
    return;
  }
  p.d += p.speed * dt;
  if (p.d >= p.dEnd || p.d >= b.board.path.length) {
    p.dead = true;
    b.emit({ e: 'boom', x: p.x, y: p.y, r: 0.4, kind: 'small', cls: p.cls });
    return;
  }
  b.board.path.sample(p.d, tmp);
  p.x = tmp.x;
  p.y = tmp.y;
  p.z = 0.25;
  const t = b.towerById.get(p.towerId);
  const s = t?.stats;
  for (const e of enemiesWithin(b, p.x, p.y, p.aoe, 'ground')) {
    if (p.hit.has(e.id)) continue;
    p.hit.add(e.id);
    b.damage(e, p.dmg, { cls: p.cls, towerId: p.towerId, crit: p.crit, critDmg: p.critDmg });
    if (!e.dead && s) {
      b.stunEnemy(e, s.stun);
      b.displace(e, s.knock);
    }
  }
}

// ───────────────────────── zones ─────────────────────────
export function addZone(b: Battle, z: Partial<Zone> & Pick<Zone, 'kind' | 'x' | 'y' | 'radius'>): Zone {
  const zone: Zone = { id: b.id(), dps: 0, t: 0, dur: 1, air: null, slow: 0, towerId: 0, cls: 'utility', tick: 0, delay: 0, ...z };
  b.zones.push(zone);
  return zone;
}

export function updateZones(b: Battle, dt: number): void {
  for (const z of b.zones) {
    if (z.delay > 0) {
      z.delay -= dt;
      if (z.delay <= 0 && z.kind === 'orbital') {
        const kind = z.air === null ? 'both' : z.air ? 'air' : 'ground';
        for (const e of enemiesWithin(b, z.x, z.y, z.radius, kind)) b.damage(e, z.dps, { cls: z.cls });
        b.emit({ e: 'boom', x: z.x, y: z.y, r: z.radius, kind: z.radius > 1 ? 'orbital' : 'big', cls: z.cls });
        z.t = z.dur;
      }
      continue;
    }
    z.t += dt;
    z.tick += dt;
    if (z.kind === 'orbital') continue;
    if (z.tick >= 0.25) {
      z.tick -= 0.25;
      const kind = z.air === null ? 'both' : z.air ? 'air' : 'ground';
      for (const e of enemiesWithin(b, z.x, z.y, z.radius, kind)) {
        if (z.dps > 0) b.damage(e, z.dps * 0.25, { cls: z.cls, towerId: z.towerId || undefined, dot: true });
        if (z.slow > 0 && !e.dead) {
          if (z.kind === 'blizzard') b.chillEnemy(e, z.slow, 0.6);
          else b.slowEnemy(e, z.slow, 0.5);
        }
      }
    }
  }
}

// ───────────────────────── soldiers ─────────────────────────
export function updateSoldiers(b: Battle, dt: number): void {
  for (const s of b.soldiers) {
    s.px = s.x;
    s.py = s.y;
    if (s.barricade) {
      s.ttl -= dt;
      if (s.ttl <= 0 && !s.dead) killSoldier(b, s);
      if (s.dead) continue;
      if (s.hp <= 0) killSoldier(b, s);
      continue;
    }
    if (s.dead) continue;
    if (s.hp <= 0) {
      killSoldier(b, s);
      continue;
    }
    // walk to rally point
    b.board.path.sample(s.d, tmp);
    const idx = s.id % 3;
    const ox = (idx - 1) * 0.12;
    const gx = tmp.x - tmp.ty * ox, gy = tmp.y + tmp.tx * ox;
    const dx = gx - s.x, dy = gy - s.y;
    const dd = Math.hypot(dx, dy);
    if (dd > 0.05) {
      const st = Math.min(dd, 2.5 * dt);
      s.x += (dx / dd) * st;
      s.y += (dy / dd) * st;
    }
    s.cd -= dt;
    if (s.cd <= 0) {
      let target: Enemy | undefined;
      for (const id of s.blocking) {
        target = b.enemyById.get(id);
        if (target && !target.dead) break;
      }
      if (!target) target = findTarget(b, s.x, s.y, 'ground', 0.75, 0, 'closest') ?? undefined;
      if (target) {
        s.cd = 60 / s.apm;
        b.damage(target, s.dmg, { cls: 'swift', towerId: s.towerId });
      }
    }
  }
}

// ───────────────────────── hero ─────────────────────────
export function heroDamage(b: Battle): number {
  const h = b.hero!;
  return h.def.dmg * RARITY_MULT[h.rarity] * levelMult(h.level) * (1 + 0.1 * (h.runLevel - 1)) * (1 + 0.04 * (b.cfg.workshop['dmg_' + h.def.cls] ?? 0));
}

export function updateHero(b: Battle, dt: number): void {
  const h = b.hero;
  if (!h) return;
  if (h.fireFx > 0) h.fireFx = Math.max(0, h.fireFx - dt * 4);
  if (h.stunT > 0) {
    h.stunT -= dt;
    return;
  }
  const dmg = heroDamage(b);
  // ongoing specials
  if (h.specialT > 0) {
    h.specialT -= dt;
    if (h.def.id === 'sol') {
      h.dashT -= dt;
      if (h.dashT <= 0) {
        h.dashT = 0.3;
        const list = enemiesWithin(b, h.x, h.y, 3.5);
        if (list.length) {
          const e = list[Math.floor(b.rng.next() * list.length)];
          b.damage(e, dmg * 3, { cls: 'elemental', hero: true });
          if (!e.dead) e.shockT = 3;
          b.emit({ e: 'chain', pts: [e.x, e.y - 0.01, e.x, e.y], cls: 'elemental' });
          b.emit({ e: 'boom', x: e.x, y: e.y, r: 0.5, kind: 'zap', cls: 'elemental' });
        }
      }
    }
  }
  if (h.def.id === 'kira' && h.dashTargets.length) {
    h.dashT -= dt;
    if (h.dashT <= 0) {
      h.dashT = 0.14;
      const id = h.dashTargets.shift()!;
      const e = b.enemyById.get(id);
      if (e && !e.dead) {
        b.damage(e, dmg * 8, { cls: 'swift', hero: true, crit: 0.3, critDmg: 2 });
        b.emit({ e: 'boom', x: e.x, y: e.y, r: 0.4, kind: 'slash', cls: 'swift' });
      }
    }
    return;
  }
  h.cd -= dt;
  if (h.cd > 0) return;
  const range = h.def.range;
  const e = findTarget(b, h.x, h.y, h.def.targets, range, 0, 'first');
  if (!e) return;
  h.aim = Math.atan2(e.y - h.y, e.x - h.x);
  h.cd = 60 / h.def.apm;
  h.fireFx = 1;
  const siege = h.def.id === 'vex' && h.specialT > 0;
  switch (h.def.id) {
    case 'vex': {
      const r = siege ? 1.0 : h.def.aoe;
      explode(b, e.x, e.y, r, dmg * (siege ? 3 : 1), 'vanguard', 0, null, 0.1, 2, 0);
      if (b.hero) b.hero.dmgDealt += 0;
      b.emit({ e: 'shot', tower: h.id, kind: siege ? 'siege' : 'hero', x: h.x, y: h.y, tx: e.x, ty: e.y, cls: 'vanguard' });
      b.emit({ e: 'boom', x: e.x, y: e.y, r, kind: siege ? 'big' : 'shell', cls: 'vanguard' });
      break;
    }
    case 'kira':
      b.damage(e, dmg, { cls: 'swift', hero: true, crit: 0.25, critDmg: 2 });
      b.emit({ e: 'boom', x: e.x, y: e.y, r: 0.3, kind: 'slash', cls: 'swift' });
      break;
    case 'sol': {
      const pts = [h.x, h.y];
      const seen = new Set<number>();
      let cur: Enemy | null = e;
      for (let j = 0; cur && j < 3; j++) {
        seen.add(cur.id);
        pts.push(cur.x, cur.y);
        b.damage(cur, dmg * (1 - 0.2 * j), { cls: 'elemental', hero: true });
        cur = findTarget(b, cur.x, cur.y, 'both', 1.6, 0, 'closest', seen);
      }
      b.emit({ e: 'chain', pts, cls: 'elemental' });
      break;
    }
    case 'bolt':
      b.damage(e, dmg, { cls: 'utility', hero: true, crit: 0.1, critDmg: 2 });
      b.emit({ e: 'shot', tower: h.id, kind: 'bullet', x: h.x, y: h.y, tx: e.x, ty: e.y, cls: 'utility' });
      break;
  }
}

export function heroSpecial(b: Battle): boolean {
  const h = b.hero;
  if (!h || h.charge < h.def.charge || h.specialT > 0 || b.frozen) return false;
  h.charge = 0;
  b.emit({ e: 'heroSpecial', id: h.def.id });
  switch (h.def.id) {
    case 'vex':
      h.specialT = 8;
      break;
    case 'kira': {
      const list = findTargets(b, h.x, h.y, 'ground', 4.5, 0, 'strongest', 8);
      h.dashTargets = list.map((e) => e.id);
      h.dashT = 0;
      break;
    }
    case 'sol':
      h.specialT = 6;
      h.dashT = 0;
      break;
    case 'bolt': {
      const e = findTarget(b, h.x, h.y, 'both', h.def.range + 2, 0, 'strongest');
      if (e) {
        e.lockT = 4;
        b.emit({ e: 'hook', x: h.x, y: h.y, tx: e.x, ty: e.y });
      }
      break;
    }
  }
  return true;
}

// ───────────────────────── skills ─────────────────────────
export function skillPower(b: Battle, id: string): number {
  const s = b.skills.find((x) => x.id === id);
  if (!s) return 1;
  return RARITY_MULT[s.rarity] * levelMult(s.mlevel) * (1 + 0.25 * (s.level - 1)) * (1 + 0.04 * (b.cfg.workshop.skillDmg ?? 0));
}

export function skillCooldown(b: Battle, id: string): number {
  const s = b.skills.find((x) => x.id === id);
  const def = SKILL_MAP[id];
  return def.cooldown * (1 - 0.08 * ((s?.level ?? 1) - 1));
}

export function castSkill(b: Battle, id: string, x: number, y: number): boolean {
  const s = b.skills.find((k) => k.id === id);
  const def = SKILL_MAP[id];
  if (!s || !def || s.level <= 0 || s.cd > 0 || b.frozen) return false;
  const pw = skillPower(b, id);
  const roadPoint = () => {
    const n = b.board.path.nearest(x, y);
    return n.d;
  };
  switch (id) {
    case 'orbital':
      addZone(b, { kind: 'orbital', x, y, radius: def.radius, dps: 420 * pw, delay: 1.0, dur: 1.5, cls: 'vanguard' });
      break;
    case 'carpet': {
      const d0 = roadPoint();
      for (let i = 0; i < 7; i++) {
        const d = Math.max(0.3, Math.min(b.board.path.length, d0 - 1.8 + i * 0.6));
        b.board.path.sample(d, tmp);
        addZone(b, { kind: 'orbital', x: tmp.x, y: tmp.y, radius: def.radius, dps: 150 * pw, delay: 0.25 + i * 0.12, dur: 2, cls: 'vanguard' });
      }
      break;
    }
    case 'blizzard':
      addZone(b, { kind: 'blizzard', x, y, radius: def.radius, dps: 16 * pw, slow: 0.5, dur: 6, cls: 'elemental' });
      break;
    case 'storm': {
      const list = [...b.enemies].filter((e) => !e.dead && e.burrowT <= 0).sort((p, q) => q.hp - p.hp || p.id - q.id).slice(0, 5);
      for (const e of list) {
        b.damage(e, 240 * pw, { cls: 'elemental' });
        if (!e.dead) e.shockT = 4;
        b.emit({ e: 'chain', pts: [e.x + 0.2, e.y - 3, e.x, e.y], cls: 'elemental' });
        b.emit({ e: 'boom', x: e.x, y: e.y, r: 0.6, kind: 'zap', cls: 'elemental' });
      }
      break;
    }
    case 'caltrops': {
      const d0 = roadPoint();
      for (let i = 0; i < 5; i++) {
        const d = Math.max(0.5, Math.min(b.board.path.length, d0 - 1.6 + i * 0.8));
        b.board.path.sample(d, tmp);
        addZone(b, { kind: 'crater', x: tmp.x, y: tmp.y, radius: 0.5, dps: 45 * pw, slow: 0.3, dur: 12, air: false, cls: 'swift' });
      }
      break;
    }
    case 'rally':
      b.rallyT = 8 + s.level;
      break;
    case 'barricade': {
      const d = Math.max(0.8, roadPoint());
      b.board.path.sample(d, tmp);
      const so: Soldier = {
        id: b.id(), towerId: 0, d, x: tmp.x, y: tmp.y, px: tmp.x, py: tmp.y, hp: 700 * pw, maxHp: 700 * pw, dmg: 0, apm: 1, cd: 99,
        blockCount: 99, blocking: [], respawnT: 0, dead: false, barricade: true, ttl: 14,
      };
      b.soldiers.push(so);
      b.soldierById.set(so.id, so);
      break;
    }
    case 'repair':
      b.repairT = 6;
      break;
  }
  s.cd = skillCooldown(b, id);
  b.emit({ e: 'skill', id, x, y });
  return true;
}
