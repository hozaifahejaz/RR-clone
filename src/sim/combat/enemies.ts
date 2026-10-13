import type { Battle } from '../battle';
import type { Enemy } from '../entities/entities';
import type { ClassId } from '../types';

const SPEED_CAP = 2.2;
const SOV_CLASSES: ClassId[] = ['utility', 'vanguard', 'elemental', 'swift'];

export function updateEnemies(b: Battle, dt: number): void {
  const list = b.enemies;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (e.dead) continue;
    e.px = e.x;
    e.py = e.y;
    timers(e, dt);
    // DoT
    if (e.burnT > 0 && e.burn > 0) {
      b.damage(e, e.burn * dt, { cls: 'elemental', towerId: e.burnSrc || undefined, dot: true });
      if (e.dead) continue;
    }
    if (e.affix === 'regen') e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.01 * dt);
    abilities(b, e, dt);
    if (e.dead) continue;
    move(b, e, dt);
  }
}

function timers(e: Enemy, dt: number): void {
  if (e.slowT > 0 && (e.slowT -= dt) <= 0) e.slow = 0;
  if (e.stunT > 0) e.stunT -= dt;
  if (e.freezeT > 0) e.freezeT -= dt;
  if (e.freezeImm > 0) e.freezeImm -= dt;
  if (e.chillT > 0 && (e.chillT -= dt) <= 0) e.chill = 0;
  if (e.burnT > 0) e.burnT -= dt;
  if (e.shockT > 0) e.shockT -= dt;
  if (e.danceT > 0) e.danceT -= dt;
  if (e.vulnT > 0 && (e.vulnT -= dt) <= 0) e.vuln = 0;
  if (e.lockT > 0) e.lockT -= dt;
  if (e.sprintT > 0 && (e.sprintT -= dt) <= 0) e.sprintT = 0;
  if (e.burrowT > 0) e.burrowT -= dt;
  if (e.flash > 0) e.flash = Math.max(0, e.flash - dt * 8);
  e.dispT += dt;
  if (e.dispT > 3) {
    e.dispT = 0;
    e.disp = 0;
  }
}

function nearbyAllies(b: Battle, e: Enemy, r: number): Enemy[] {
  const out: Enemy[] = [];
  for (const o of b.enemies) if (o !== e && !o.dead && Math.hypot(o.x - e.x, o.y - e.y) <= r) out.push(o);
  return out;
}

function abilities(b: Battle, e: Enemy, dt: number): void {
  const d = e.def;
  if (d.boss && !e.decoy) {
    bossAbilities(b, e, dt);
    return;
  }
  if (e.decoy) return;
  if (d.heal) {
    e.abilT -= dt;
    if (e.abilT <= 0) {
      e.abilT = 1;
      let any = false;
      for (const o of nearbyAllies(b, e, d.healRadius ?? 1.5)) {
        if (o.hp < o.maxHp) {
          o.hp = Math.min(o.maxHp, o.hp + o.maxHp * d.heal);
          any = true;
        }
      }
      if (any) b.emit({ e: 'heal', x: e.x, y: e.y });
    }
  }
  if (d.shieldAura) {
    e.abilT -= dt;
    if (e.abilT <= 0) {
      e.abilT = 6;
      for (const o of nearbyAllies(b, e, 1.6)) {
        const sh = o.maxHp * 0.25;
        if (o.shield < sh) {
          o.shield = sh;
          o.maxShield = Math.max(o.maxShield, sh);
        }
      }
      b.emit({ e: 'heal', x: e.x, y: e.y });
    }
  }
  if (d.burrow) {
    e.burrowCd -= dt;
    if (e.burrowCd <= 0) {
      e.burrowCd = 6;
      e.burrowT = 2;
    }
  }
  if (d.blink && !e.blinked && e.hp < e.maxHp * 0.5) {
    e.blinked = true;
    e.r = Math.max(0.6, e.r - 2);
    if (e.blockedBy) b.unblock(e);
    b.positionEnemy(e);
    b.emit({ e: 'blink', id: e.id, x: e.x, y: e.y });
  }
  if (d.rocket) {
    e.abilT -= dt;
    if (e.abilT <= 0) {
      e.abilT = 3.2;
      let best = null as null | (typeof b.towers)[number];
      let bd = 2.6;
      for (const t of b.towers) {
        if (t.koT > 0 || t.def.onRoad) continue;
        const dd = Math.hypot(t.x - e.x, t.y - e.y);
        if (dd < bd) {
          bd = dd;
          best = t;
        }
      }
      if (best) {
        b.emit({ e: 'rocket', x: e.x, y: e.y, tx: best.x, ty: best.y });
        b.damageTower(best, 34);
      }
    }
  }
  if (d.frost) {
    e.abilT -= dt;
    if (e.abilT <= 0) {
      e.abilT = 3;
      let any = false;
      for (const t of b.towers) if (Math.hypot(t.x - e.x, t.y - e.y) < 1.3) { b.stunTower(t, 1.2); any = true; }
      for (const s of b.soldiers) if (!s.dead && Math.hypot(s.x - e.x, s.y - e.y) < 0.9) { s.hp -= e.melee * 2; any = true; }
      if (any) b.emit({ e: 'stomp', x: e.x, y: e.y, r: 1.3 });
    }
  }
}

function bossAbilities(b: Battle, e: Enemy, dt: number): void {
  const frac = e.hp / e.maxHp;
  const newPhase = frac < 0.33 ? 2 : frac < 0.66 ? 1 : 0;
  const phaseUp = newPhase > e.bossPhase;
  if (phaseUp) {
    e.bossPhase = newPhase;
    b.emit({ e: 'bossPhase', id: e.id });
  }
  const fast = e.bossPhase >= 1 ? 0.7 : 1;
  e.abilT -= dt;
  e.abilT2 -= dt;
  switch (e.def.id) {
    case 'colossus':
      if (e.abilT <= 0) {
        e.abilT = 7 * fast;
        b.emit({ e: 'stomp', x: e.x, y: e.y, r: 1.8 });
        for (const t of b.towers) if (Math.hypot(t.x - e.x, t.y - e.y) < 1.8) b.stunTower(t, 3);
        for (const s of b.soldiers) if (!s.dead && Math.hypot(s.x - e.x, s.y - e.y) < 1.8) s.hp -= s.maxHp * 0.5;
      }
      if (e.abilT2 <= 0) {
        e.abilT2 = 9 * fast;
        for (let i = 0; i < 3; i++) b.spawnEnemy('scrapper', e.wave, { at: { r: e.r + 0.3 + i * 0.3 } });
      }
      break;
    case 'leviathan':
      if (e.abilT <= 0) {
        e.abilT = 5 * fast;
        for (let i = 0; i < 3; i++) b.spawnEnemy('buzzer', e.wave, { at: { x: e.x + (i - 1) * 0.3, y: e.y } });
      }
      break;
    case 'wyrm':
      if (e.abilT <= 0) {
        e.abilT = 8 * fast;
        b.emit({ e: 'freezeCol', x: e.x });
        for (const t of b.towers) if (Math.abs(t.x - e.x) < 0.9) b.stunTower(t, 3);
      }
      if (e.abilT2 <= 0) {
        e.abilT2 = 12;
        e.burrowT = 1.5;
      }
      break;
    case 'phantom':
      if (e.abilT <= 0) {
        e.abilT = 6 * fast;
        e.r = Math.max(1, e.r - 1.5);
        if (e.blockedBy) b.unblock(e);
        b.positionEnemy(e);
        b.emit({ e: 'blink', id: e.id, x: e.x, y: e.y });
      }
      if (phaseUp) {
        for (let i = 0; i < 2; i++)
          b.spawnEnemy('phantom', e.wave, { at: { r: e.r + (i ? 0.6 : -0.4) }, hpMul: 0.12, decoy: true });
      }
      break;
    case 'titan':
      e.burnT = 0;
      if (e.abilT <= 0) {
        e.abilT = 1;
        for (const o of nearbyAllies(b, e, 2)) o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.02);
      }
      if (phaseUp) for (let i = 0; i < 3; i++) b.spawnEnemy('splitter', e.wave, { at: { r: e.r + 0.4 * i } });
      break;
    case 'sovereign':
      if (phaseUp) {
        e.cls = SOV_CLASSES[e.bossPhase % SOV_CLASSES.length];
        e.maxShield = e.shield = e.maxHp * 0.2;
      }
      if (e.abilT <= 0) {
        e.abilT = 10;
        e.cls = SOV_CLASSES[(SOV_CLASSES.indexOf(e.cls) + 1) % SOV_CLASSES.length];
      }
      break;
  }
}

function move(b: Battle, e: Enemy, dt: number): void {
  // blocked?
  if (e.blockedBy) {
    const s = b.soldierById.get(e.blockedBy);
    if (!s || s.dead) {
      e.blockedBy = 0;
    } else {
      if (e.stunT > 0 || e.freezeT > 0 || e.danceT > 0 || e.lockT > 0) return;
      e.atkCd -= dt;
      if (e.atkCd <= 0) {
        e.atkCd = 1;
        s.hp -= e.melee * (e.def.boss ? 4 : 1);
        if (s.hp <= 0) killSoldier(b, s);
      }
      return;
    }
  }
  if (e.stunT > 0 || e.freezeT > 0 || e.danceT > 0 || e.lockT > 0) {
    b.positionEnemy(e);
    return;
  }
  let v = e.speed * (1 - e.slow);
  if (e.sprintT > 0) v *= 1.6;
  if (e.burrowT > 0) v *= 1.2;
  v = Math.min(v, SPEED_CAP);
  let nr = e.r - v * dt;
  if (!e.air && !(e.sprintT > 0 && e.def.sprint)) {
    for (const s of b.soldiers) {
      if (s.dead || s.blocking.length >= s.blockCount) continue;
      if (e.r >= s.d - 0.05 && nr <= s.d + 0.35) {
        nr = Math.max(nr, s.d + 0.3);
        e.blockedBy = s.id;
        e.atkCd = 0.5;
        s.blocking.push(e.id);
        break;
      }
    }
  }
  e.r = nr;
  if (e.r <= 0.35) {
    b.leak(e);
    return;
  }
  b.positionEnemy(e);
}

export function killSoldier(b: Battle, s: import('../entities/entities').Soldier): void {
  s.dead = true;
  s.hp = 0;
  for (const id of s.blocking) {
    const e = b.enemyById.get(id);
    if (e) e.blockedBy = 0;
  }
  s.blocking = [];
  const t = b.towerById.get(s.towerId);
  s.respawnT = t ? t.stats.rearm : 0;
  b.emit({ e: 'soldierDie', x: s.x, y: s.y });
}
