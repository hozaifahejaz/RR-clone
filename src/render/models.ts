import * as THREE from 'three';
import { Kit } from './kit';
import { CLASS_COLORS } from './materials';
import { TOWER_MAP } from '../data/towers';

const STEEL = 0x66708a;
const DARK = 0x363c52;
const SLATE = 0x4a5068;
const LIGHT = 0xd8dce8;
const GOLD = 0xffc23d;
const WOOD = 0x9a6a42;

export interface TowerModel {
  base: THREE.BufferGeometry;
  baseGlow: THREE.BufferGeometry | null;
  turret: THREE.BufferGeometry;
  turretGlow: THREE.BufferGeometry | null;
  spinner: THREE.BufferGeometry | null;
  muzzle: number; // muzzle height
  turretY: number;
  spinAxis: 'x' | 'y';
}

function baseKit(cls: string, tier: number, onRoad = false): Kit {
  const k = new Kit();
  const accent = CLASS_COLORS[cls];
  if (onRoad) {
    k.box(0.86, 0.06, 0.86, DARK, { p: [0, 0.03, 0] });
    return k;
  }
  k.cyl(0.4, 0.46, 0.16, 6, SLATE, { p: [0, 0.08, 0] });
  k.cyl(0.43, 0.43, 0.05, 6, accent, { p: [0, 0.17, 0] });
  k.cyl(0.34, 0.38, 0.08, 6, DARK, { p: [0, 0.23, 0] });
  if (tier >= 2) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      k.box(0.1, 0.22, 0.1, STEEL, { p: [Math.cos(a) * 0.38, 0.2, Math.sin(a) * 0.38] });
      k.glow(new THREE.OctahedronGeometry(0.05), accent, { p: [Math.cos(a) * 0.38, 0.36, Math.sin(a) * 0.38] });
    }
  }
  if (tier >= 3) {
    k.cyl(0.47, 0.5, 0.05, 6, GOLD, { p: [0, 0.02, 0] });
    k.glow(new THREE.TorusGeometry(0.42, 0.018, 4, 24), accent, { p: [0, 0.2, 0], r: [Math.PI / 2, 0, 0] });
  }
  return k;
}

/** Build a tower model. tier: 1 (★1-2), 2 (★3-5), 3 (★6). Turret faces +X. */
export function towerModel(id: string, tier: number): TowerModel {
  const def = TOWER_MAP[id];
  const cls = def.cls;
  const accent = CLASS_COLORS[cls];
  const b = baseKit(cls, tier, def.onRoad);
  const t = new Kit();
  let spin: Kit | null = null;
  let muzzle = 0.55;
  let turretY = 0.27;
  let spinAxis: 'x' | 'y' = 'x';
  const R = Math.PI / 2;
  switch (id) {
    case 'cannon': {
      t.ball(0.22, STEEL, { p: [0, 0.16, 0] });
      t.cyl(0.24, 0.26, 0.1, 8, DARK, { p: [0, 0.04, 0] });
      const barrels = tier >= 3 ? [-0.08, 0.08] : [0];
      for (const z of barrels) {
        t.cyl(0.065, 0.08, 0.48, 8, DARK, { p: [0.28, 0.2, z], r: [0, 0, R] });
        t.cyl(0.085, 0.085, 0.06, 8, accent, { p: [0.5, 0.2, z], r: [0, 0, R] });
      }
      if (tier >= 2) t.box(0.18, 0.12, 0.3, accent, { p: [-0.12, 0.26, 0] });
      muzzle = 0.47;
      break;
    }
    case 'skyguard': {
      t.cyl(0.18, 0.22, 0.14, 8, DARK, { p: [0, 0.07, 0] });
      t.box(0.32, 0.26, 0.42, STEEL, { p: [0.02, 0.3, 0], r: [0, 0, 0.55] });
      const n = tier >= 2 ? 3 : 2;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < 2; j++) t.cyl(0.05, 0.05, 0.3, 6, accent, { p: [0.12, 0.33 + j * 0.0, -0.12 + (i * 0.24) / (n - 1)], r: [0, 0, 0.55 - R + j * 0.0] });
      t.cyl(0.02, 0.02, 0.3, 4, DARK, { p: [-0.18, 0.4, 0] });
      t.add(new THREE.SphereGeometry(0.12, 8, 4, 0, Math.PI * 2, 0, 1.2), LIGHT, { p: [-0.18, 0.55, 0], r: [0, 0, -0.6] });
      if (tier >= 3) t.glow(new THREE.SphereGeometry(0.04, 6, 4), 0xff5040, { p: [-0.18, 0.6, 0] });
      muzzle = 0.6;
      break;
    }
    case 'railgun': {
      t.box(0.3, 0.16, 0.26, DARK, { p: [-0.02, 0.1, 0] });
      t.box(0.75, 0.05, 0.06, STEEL, { p: [0.3, 0.2, 0.07] });
      t.box(0.75, 0.05, 0.06, STEEL, { p: [0.3, 0.2, -0.07] });
      const rings = tier >= 2 ? 4 : 3;
      for (let i = 0; i < rings; i++) t.glow(new THREE.TorusGeometry(0.1, 0.02, 4, 10), accent, { p: [0.1 + i * 0.16, 0.2, 0], r: [0, R, 0] });
      if (tier >= 3) t.box(0.2, 0.18, 0.34, GOLD, { p: [-0.18, 0.18, 0] });
      muzzle = 0.2;
      break;
    }
    case 'mortar': {
      t.cyl(0.24, 0.28, 0.12, 8, WOOD, { p: [0, 0.06, 0] });
      t.cyl(0.13, 0.16, 0.42, 8, DARK, { p: [0.06, 0.28, 0], r: [0, 0, -0.6] });
      t.cyl(0.15, 0.15, 0.05, 8, accent, { p: [0.17, 0.44, 0], r: [0, 0, -0.6] });
      if (tier >= 3) for (const z of [-0.2, 0.2]) t.cyl(0.08, 0.1, 0.3, 8, DARK, { p: [0.02, 0.2, z], r: [0, 0, -0.6] });
      for (let i = 0; i < 5; i++) b.ball(0.08, 0xc9b27a, { p: [Math.cos(i * 1.25) * 0.36, 0.3, Math.sin(i * 1.25) * 0.36], s: [1.3, 0.7, 1] });
      muzzle = 0.5;
      break;
    }
    case 'gatling': {
      t.box(0.28, 0.2, 0.3, accent, { p: [-0.04, 0.14, 0] });
      t.box(0.14, 0.1, 0.34, DARK, { p: [-0.2, 0.18, 0] });
      spin = new Kit();
      const nb = tier >= 3 ? 8 : 6;
      for (let i = 0; i < nb; i++) {
        const a = (i / nb) * Math.PI * 2;
        spin.cyl(0.025, 0.025, 0.5, 5, DARK, { p: [0.25, Math.cos(a) * 0.07, Math.sin(a) * 0.07], r: [0, 0, R] });
      }
      spin.cyl(0.1, 0.1, 0.05, 8, STEEL, { p: [0.45, 0, 0], r: [0, 0, R] });
      if (tier >= 3) t.box(0.28, 0.2, 0.3, accent, { p: [-0.04, 0.14, 0.26] });
      muzzle = 0.18;
      break;
    }
    case 'barracks': {
      t.box(0.56, 0.28, 0.5, 0xc9b28a, { p: [0, 0.14, 0] });
      t.add(new THREE.ConeGeometry(0.45, 0.28, 4), accent, { p: [0, 0.42, 0], r: [0, Math.PI / 4, 0] });
      t.box(0.14, 0.18, 0.02, WOOD, { p: [0.0, 0.09, 0.26] });
      t.cyl(0.015, 0.015, 0.4, 4, DARK, { p: [0.22, 0.6, 0.18] });
      t.box(0.16, 0.1, 0.01, tier >= 3 ? GOLD : accent, { p: [0.3, 0.74, 0.18] });
      if (tier >= 2) t.box(0.2, 0.2, 0.2, 0xb59a70, { p: [-0.3, 0.1, -0.2] });
      muzzle = 0.4;
      break;
    }
    case 'boomerang': {
      t.cyl(0.08, 0.1, 0.3, 6, DARK, { p: [0, 0.15, 0] });
      spin = new Kit();
      spin.add(new THREE.TorusGeometry(0.2, 0.04, 4, 10, Math.PI * 1.1), accent, { r: [R, 0, 0] });
      if (tier >= 3) spin.add(new THREE.TorusGeometry(0.2, 0.04, 4, 10, Math.PI * 1.1), GOLD, { r: [R, 0, Math.PI] });
      spinAxis = 'y';
      muzzle = 0.36;
      turretY = 0.27;
      break;
    }
    case 'spike': {
      const n = tier >= 2 ? 4 : 3;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++)
          t.cone(0.05, 0.16, 4, i % 2 ? STEEL : LIGHT, { p: [-0.3 + (i * 0.6) / (n - 1), 0.08, -0.3 + (j * 0.6) / (n - 1)] });
      if (tier >= 3) t.box(0.8, 0.02, 0.06, accent, { p: [0, 0.01, 0] });
      turretY = 0.04;
      muzzle = 0.1;
      break;
    }
    case 'tesla': {
      t.cyl(0.12, 0.18, 0.5, 8, STEEL, { p: [0, 0.25, 0] });
      const rings = tier >= 2 ? 4 : 3;
      for (let i = 0; i < rings; i++) t.torus(0.17 - i * 0.02, 0.03, 0xc7884a, { p: [0, 0.12 + i * 0.12, 0], r: [R, 0, 0] });
      t.glow(new THREE.IcosahedronGeometry(tier >= 3 ? 0.17 : 0.13, 1), accent, { p: [0, 0.65, 0] });
      if (tier >= 3) for (let i = 0; i < 3; i++) t.cyl(0.02, 0.02, 0.3, 4, GOLD, { p: [Math.cos(i * 2.1) * 0.18, 0.55, Math.sin(i * 2.1) * 0.18], r: [Math.sin(i * 2.1) * 0.4, 0, -Math.cos(i * 2.1) * 0.4] });
      muzzle = 0.65;
      break;
    }
    case 'frost': {
      t.cyl(0.2, 0.24, 0.14, 8, LIGHT, { p: [0, 0.07, 0] });
      t.box(0.3, 0.16, 0.22, 0x9fc6e8, { p: [0.04, 0.2, 0] });
      t.cyl(0.06, 0.08, 0.3, 6, DARK, { p: [0.3, 0.2, 0], r: [0, 0, R] });
      t.glow(new THREE.OctahedronGeometry(tier >= 3 ? 0.17 : 0.12), 0x9fe6ff, { p: [-0.08, 0.42, 0], s: [0.8, 1.4, 0.8] });
      if (tier >= 2) t.glow(new THREE.OctahedronGeometry(0.06), 0x9fe6ff, { p: [0.08, 0.36, 0.12], s: [0.8, 1.4, 0.8] });
      muzzle = 0.2;
      break;
    }
    case 'laser': {
      t.cyl(0.12, 0.2, 0.3, 6, DARK, { p: [0, 0.15, 0] });
      t.glow(new THREE.OctahedronGeometry(0.18), accent, { p: [0, 0.48, 0], s: [1, 1.3, 1] });
      t.torus(0.24, 0.025, GOLD, { p: [0, 0.48, 0], r: [R, 0, 0] });
      if (tier >= 2) t.torus(0.28, 0.02, STEEL, { p: [0, 0.48, 0], r: [0.4, 0, 0] });
      if (tier >= 3) t.glow(new THREE.OctahedronGeometry(0.07), 0xffffff, { p: [0.3, 0.48, 0] });
      muzzle = 0.48;
      break;
    }
    case 'flame': {
      t.sph(0.2, 0xb0453a, { p: [-0.06, 0.2, 0] });
      t.cyl(0.06, 0.09, 0.36, 6, DARK, { p: [0.22, 0.2, 0], r: [0, 0, R] });
      t.glow(new THREE.SphereGeometry(0.05, 6, 4), 0xff8a3d, { p: [0.42, 0.2, 0] });
      if (tier >= 2) t.sph(0.14, 0xb0453a, { p: [-0.14, 0.22, 0.2] });
      if (tier >= 3) t.cyl(0.04, 0.06, 0.3, 6, DARK, { p: [0.22, 0.2, 0.14], r: [0, 0, R] });
      muzzle = 0.2;
      break;
    }
    case 'gust': {
      t.cyl(0.05, 0.08, 0.3, 6, DARK, { p: [0, 0.15, 0] });
      t.torus(0.24, 0.035, accent, { p: [0.05, 0.36, 0], r: [0, R, 0] });
      spin = new Kit();
      const nb = tier >= 3 ? 6 : 4;
      for (let i = 0; i < nb; i++) spin.box(0.02, 0.36, 0.09, LIGHT, { r: [(i / nb) * Math.PI * 2, 0, 0], p: [0, 0, 0] });
      spin.sph(0.05, DARK);
      muzzle = 0.36;
      break;
    }
    case 'grapple': {
      t.box(0.24, 0.16, 0.24, STEEL, { p: [0, 0.08, 0] });
      t.box(0.5, 0.06, 0.06, accent, { p: [0.2, 0.32, 0], r: [0, 0, 0.35] });
      t.cyl(0.015, 0.015, 0.22, 4, DARK, { p: [0.42, 0.3, 0] });
      t.torus(0.06, 0.018, LIGHT, { p: [0.42, 0.18, 0], r: [0, 0, 0] }, 4, 8, Math.PI * 1.4);
      if (tier >= 3) t.box(0.5, 0.06, 0.06, GOLD, { p: [0.2, 0.32, 0.12], r: [0, 0, 0.35] });
      muzzle = 0.25;
      break;
    }
    case 'bowler': {
      t.box(0.5, 0.06, 0.24, WOOD, { p: [0.05, 0.12, 0], r: [0, 0, -0.25] });
      t.ball(tier >= 3 ? 0.17 : 0.14, 0x6a3fa0, { p: [-0.12, 0.3, 0] }, 1);
      if (tier >= 2) for (let i = 0; i < 3; i++) t.cyl(0.03, 0.04, 0.16, 6, LIGHT, { p: [-0.25, 0.08, -0.1 + i * 0.1] });
      muzzle = 0.3;
      break;
    }
    case 'disco': {
      t.cyl(0.03, 0.05, 0.5, 6, DARK, { p: [0, 0.25, 0] });
      spin = new Kit();
      spin.ball(tier >= 3 ? 0.22 : 0.18, 0xd8e0ff, {}, 1);
      spin.glow(new THREE.IcosahedronGeometry(0.19, 1), 0xff7cf0, { s: 0.5 });
      spinAxis = 'y';
      muzzle = 0.7;
      turretY = 0.27;
      break;
    }
    case 'amp': {
      t.cyl(0.05, 0.12, 0.6, 6, STEEL, { p: [0, 0.3, 0] });
      const rings = tier >= 2 ? 3 : 2;
      for (let i = 0; i < rings; i++) t.glow(new THREE.TorusGeometry(0.16 - i * 0.03, 0.02, 4, 16), accent, { p: [0, 0.3 + i * 0.15, 0], r: [R, 0, 0] });
      t.glow(new THREE.OctahedronGeometry(0.07), accent, { p: [0, 0.7, 0] });
      muzzle = 0.7;
      break;
    }
  }
  const bb = b.build();
  const tb = t.build();
  const sb = spin ? spin.build() : null;
  // spinner glow is merged into the spinner body for simplicity
  let spinner: THREE.BufferGeometry | null = null;
  if (sb) {
    spinner = sb.body;
    if (sb.glow) {
      // keep glow parts bright by scaling their colors
      const c = sb.glow.getAttribute('color') as THREE.BufferAttribute;
      for (let i = 0; i < c.count * 3; i++) (c.array as Float32Array)[i] = Math.min(1, (c.array as Float32Array)[i] * 1.2);
    }
  }
  return {
    base: bb.body, baseGlow: bb.glow, turret: tb.body, turretGlow: tb.glow, spinner,
    muzzle, turretY, spinAxis,
  };
}

// ─────────────────────────── enemies ───────────────────────────
export interface EnemyModel {
  body: THREE.BufferGeometry;
  glow: THREE.BufferGeometry | null;
}

export function enemyModel(id: string, color: number): EnemyModel {
  const k = new Kit();
  const eye = 0xfff2a8;
  const R = Math.PI / 2;
  switch (id) {
    case 'scrapper':
      k.box(0.36, 0.32, 0.3, color, { p: [0, 0.34, 0] });
      k.box(0.24, 0.2, 0.24, LIGHT, { p: [0.04, 0.6, 0] });
      k.box(0.06, 0.05, 0.16, 0xff5040, { p: [0.17, 0.62, 0] });
      k.box(0.12, 0.2, 0.1, DARK, { p: [0, 0.1, 0.1] });
      k.box(0.12, 0.2, 0.1, DARK, { p: [0, 0.1, -0.1] });
      break;
    case 'dasher':
      k.box(0.42, 0.18, 0.2, color, { p: [0, 0.32, 0], r: [0, 0, -0.3] });
      k.cyl(0.14, 0.14, 0.08, 10, DARK, { p: [-0.02, 0.15, 0], r: [R, 0, 0] });
      k.box(0.12, 0.1, 0.14, eye, { p: [0.22, 0.42, 0] });
      k.box(0.3, 0.03, 0.03, 0xffffff, { p: [-0.2, 0.36, 0.09] });
      break;
    case 'brute':
      k.box(0.6, 0.5, 0.56, color, { p: [0, 0.48, 0] });
      k.box(0.3, 0.26, 0.3, DARK, { p: [0.18, 0.82, 0] });
      k.ball(0.17, color, { p: [0, 0.68, 0.36] });
      k.ball(0.17, color, { p: [0, 0.68, -0.36] });
      k.box(0.06, 0.06, 0.2, eye, { p: [0.34, 0.85, 0] });
      k.box(0.2, 0.24, 0.18, DARK, { p: [0, 0.12, 0.15] });
      k.box(0.2, 0.24, 0.18, DARK, { p: [0, 0.12, -0.15] });
      break;
    case 'shellback':
      k.add(new THREE.SphereGeometry(0.34, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), color, { p: [0, 0.2, 0] });
      k.box(0.44, 0.12, 0.44, DARK, { p: [0, 0.14, 0] });
      k.box(0.06, 0.5, 0.56, 0x8fc1ff, { p: [0.36, 0.38, 0] });
      k.ball(0.11, LIGHT, { p: [0.26, 0.42, 0] });
      break;
    case 'juggernaut':
      k.box(0.8, 0.4, 0.62, color, { p: [0, 0.4, 0] });
      k.box(0.86, 0.2, 0.18, DARK, { p: [0, 0.12, 0.3] });
      k.box(0.86, 0.2, 0.18, DARK, { p: [0, 0.12, -0.3] });
      k.box(0.36, 0.26, 0.4, STEEL, { p: [-0.05, 0.72, 0] });
      k.cyl(0.07, 0.07, 0.5, 6, DARK, { p: [0.3, 0.74, 0], r: [0, 0, R] });
      k.box(0.08, 0.08, 0.3, eye, { p: [0.42, 0.45, 0] });
      break;
    case 'medic':
      k.cyl(0.18, 0.22, 0.42, 8, LIGHT, { p: [0, 0.3, 0] });
      k.ball(0.15, LIGHT, { p: [0, 0.62, 0] });
      k.box(0.03, 0.2, 0.06, 0xff3b4e, { p: [0.21, 0.34, 0] });
      k.box(0.03, 0.06, 0.2, 0xff3b4e, { p: [0.21, 0.34, 0] });
      k.glow(new THREE.TorusGeometry(0.2, 0.02, 4, 12), 0x5cff9d, { p: [0, 0.82, 0], r: [R, 0, 0] });
      break;
    case 'warden':
      k.box(0.34, 0.5, 0.32, color, { p: [0, 0.35, 0] });
      k.ball(0.14, LIGHT, { p: [0, 0.72, 0] });
      k.cyl(0.02, 0.02, 0.8, 4, DARK, { p: [-0.18, 0.5, 0.18] });
      k.box(0.02, 0.24, 0.2, color, { p: [-0.18, 0.78, 0.3] });
      k.glow(new THREE.OctahedronGeometry(0.08), 0x7ad6ff, { p: [0.18, 0.42, 0] });
      break;
    case 'splitter':
      k.ball(0.22, color, { p: [0, 0.32, 0] }, 1);
      k.ball(0.15, color, { p: [-0.12, 0.25, 0.18] }, 1);
      k.ball(0.15, color, { p: [-0.12, 0.25, -0.18] }, 1);
      k.box(0.06, 0.06, 0.18, eye, { p: [0.2, 0.38, 0] });
      break;
    case 'mini':
      k.ball(0.15, color, { p: [0, 0.18, 0] }, 1);
      k.box(0.04, 0.04, 0.1, eye, { p: [0.13, 0.22, 0] });
      break;
    case 'burrower':
      k.sph(0.24, color, { p: [-0.04, 0.24, 0], s: [1.3, 0.9, 1] });
      k.cone(0.14, 0.3, 6, STEEL, { p: [0.32, 0.24, 0], r: [0, 0, -R] });
      k.box(0.05, 0.05, 0.16, eye, { p: [0.16, 0.36, 0] });
      break;
    case 'phase':
      k.add(new THREE.OctahedronGeometry(0.22), color, { p: [0, 0.45, 0], s: [0.8, 1.5, 0.8] });
      k.add(new THREE.OctahedronGeometry(0.1), LIGHT, { p: [0, 0.12, 0] });
      k.glow(new THREE.OctahedronGeometry(0.07), 0xffffff, { p: [0.12, 0.52, 0] });
      break;
    case 'rocketeer':
      k.box(0.3, 0.4, 0.3, color, { p: [0, 0.34, 0] });
      k.ball(0.13, LIGHT, { p: [0.02, 0.64, 0] });
      k.cyl(0.08, 0.08, 0.44, 6, DARK, { p: [0, 0.62, -0.2], r: [0, 0, R + 0.2] });
      k.cone(0.06, 0.1, 6, 0xff5040, { p: [0.24, 0.66, -0.2], r: [0, 0, -R] });
      break;
    case 'frostblade':
      k.box(0.32, 0.46, 0.3, color, { p: [0, 0.34, 0] });
      k.ball(0.14, LIGHT, { p: [0, 0.7, 0] });
      k.glow(new THREE.ConeGeometry(0.05, 0.6, 4), 0x9fe6ff, { p: [0.24, 0.45, 0.2], r: [0, 0, -R + 0.4] });
      k.box(0.3, 0.1, 0.36, 0x9fe6ff, { p: [0, 0.55, 0] });
      break;
    case 'swarm':
      k.sph(0.12, color, { p: [0, 0.12, 0], s: [1.4, 0.8, 1] });
      k.box(0.03, 0.03, 0.06, eye, { p: [0.14, 0.15, 0] });
      for (const z of [-0.08, 0.08]) k.box(0.2, 0.02, 0.02, DARK, { p: [0, 0.06, z] });
      break;
    case 'buzzer':
      k.sph(0.16, color, { s: [1.3, 0.8, 1] });
      for (const [x, z] of [[0.18, 0.18], [0.18, -0.18], [-0.18, 0.18], [-0.18, -0.18]])
        k.cyl(0.11, 0.11, 0.015, 10, LIGHT, { p: [x, 0.09, z] });
      k.box(0.05, 0.05, 0.1, 0xff5040, { p: [0.2, 0, 0] });
      break;
    case 'bomber':
      k.sph(0.24, color, { s: [1.8, 0.9, 1] });
      k.box(0.24, 0.04, 0.9, DARK, { p: [0, 0.02, 0] });
      k.box(0.12, 0.2, 0.04, DARK, { p: [-0.38, 0.12, 0] });
      k.sph(0.1, DARK, { p: [0.05, -0.2, 0] });
      k.glow(new THREE.SphereGeometry(0.06, 6, 4), 0xff8a3d, { p: [-0.48, 0, 0] });
      break;
    case 'emp':
      k.ball(0.2, color, {}, 1);
      for (let i = 0; i < 4; i++) k.cyl(0.015, 0.015, 0.32, 4, DARK, { r: [i * 0.8, 0, i * 1.2] });
      k.glow(new THREE.IcosahedronGeometry(0.1, 0), 0x6af0ff, { p: [0, 0, 0] });
      break;
    // ── bosses ──
    case 'colossus':
      k.box(0.8, 0.7, 0.7, color, { p: [0, 1.0, 0] });
      k.box(0.4, 0.3, 0.4, DARK, { p: [0.2, 1.5, 0] });
      k.box(0.25, 0.7, 0.25, STEEL, { p: [0, 0.35, 0.25] });
      k.box(0.25, 0.7, 0.25, STEEL, { p: [0, 0.35, -0.25] });
      k.box(0.3, 0.8, 0.3, STEEL, { p: [0.1, 0.85, 0.6] });
      k.box(0.3, 0.8, 0.3, STEEL, { p: [0.1, 0.85, -0.6] });
      k.glow(new THREE.BoxGeometry(0.08, 0.08, 0.3), 0xff4020, { p: [0.41, 1.52, 0] });
      k.glow(new THREE.IcosahedronGeometry(0.14), 0xff8a3d, { p: [0.4, 1.05, 0] });
      break;
    case 'leviathan':
      k.sph(0.5, color, { s: [2.0, 0.9, 1] });
      k.cone(0.3, 0.6, 5, color, { p: [-1.1, 0.1, 0], r: [0, 0, R] });
      k.box(0.4, 0.04, 1.4, DARK, { p: [0, 0, 0] });
      k.box(0.3, 0.3, 0.05, DARK, { p: [-0.5, 0.45, 0] });
      k.glow(new THREE.SphereGeometry(0.08, 6, 4), 0xfff2a8, { p: [0.9, 0.12, 0.2] });
      k.glow(new THREE.SphereGeometry(0.08, 6, 4), 0xfff2a8, { p: [0.9, 0.12, -0.2] });
      break;
    case 'wyrm':
      for (let i = 0; i < 6; i++) k.sph(0.28 - i * 0.03, i % 2 ? color : LIGHT, { p: [0.3 - i * 0.3, Math.sin(i) * 0.12, 0] });
      k.cone(0.15, 0.4, 4, LIGHT, { p: [0.6, 0, 0], r: [0, 0, -R] });
      k.add(new THREE.ConeGeometry(0.5, 0.05, 3), 0x9fe6ff, { p: [0, 0.15, 0.55], r: [R, 0, 0.3] });
      k.add(new THREE.ConeGeometry(0.5, 0.05, 3), 0x9fe6ff, { p: [0, 0.15, -0.55], r: [-R, 0, 0.3] });
      k.glow(new THREE.OctahedronGeometry(0.06), 0x9fe6ff, { p: [0.5, 0.1, 0.12] });
      break;
    case 'phantom':
      k.cone(0.45, 1.3, 7, color, { p: [0, 0.65, 0] });
      k.sph(0.24, DARK, { p: [0.05, 1.25, 0] });
      k.glow(new THREE.SphereGeometry(0.05, 6, 4), 0xffffff, { p: [0.24, 1.28, 0.08] });
      k.glow(new THREE.SphereGeometry(0.05, 6, 4), 0xffffff, { p: [0.24, 1.28, -0.08] });
      k.glow(new THREE.TorusGeometry(0.5, 0.02, 4, 18), 0xff4fd8, { p: [0, 0.2, 0], r: [R, 0, 0] });
      break;
    case 'titan':
      k.ball(0.6, 0x3a2a2a, { p: [0, 1.0, 0] }, 0);
      k.ball(0.32, 0x3a2a2a, { p: [0, 1.6, 0] }, 0);
      k.ball(0.3, 0x4a3030, { p: [0.1, 0.85, 0.7] }, 0);
      k.ball(0.3, 0x4a3030, { p: [0.1, 0.85, -0.7] }, 0);
      k.ball(0.25, 0x3a2a2a, { p: [0, 0.3, 0.25] }, 0);
      k.ball(0.25, 0x3a2a2a, { p: [0, 0.3, -0.25] }, 0);
      k.glow(new THREE.IcosahedronGeometry(0.3, 0), 0xff6a2a, { p: [0.35, 1.0, 0] });
      k.glow(new THREE.BoxGeometry(0.06, 0.06, 0.26), 0xffb02a, { p: [0.3, 1.66, 0] });
      break;
    case 'sovereign':
      k.add(new THREE.OctahedronGeometry(0.5), color, { p: [0, 1.2, 0], s: [0.8, 1.4, 0.8] });
      k.add(new THREE.ConeGeometry(0.5, 0.5, 6), DARK, { p: [0, 0.3, 0] });
      for (let i = 0; i < 4; i++) k.add(new THREE.OctahedronGeometry(0.15), LIGHT, { p: [Math.cos(i * R) * 0.7, 1.2, Math.sin(i * R) * 0.7] });
      k.glow(new THREE.OctahedronGeometry(0.2), 0xd0a0ff, { p: [0, 1.2, 0] });
      k.glow(new THREE.TorusGeometry(0.4, 0.03, 4, 6), GOLD, { p: [0, 1.95, 0], r: [R, 0, 0] });
      break;
    default:
      k.box(0.3, 0.3, 0.3, color, { p: [0, 0.3, 0] });
  }
  const r = k.build();
  return { body: r.body, glow: r.glow };
}

// ─────────────────────────── heroes ───────────────────────────
export function heroModel(id: string): { body: THREE.BufferGeometry; glow: THREE.BufferGeometry | null } {
  const k = new Kit();
  const R = Math.PI / 2;
  const skin = 0xf2c9a0;
  switch (id) {
    case 'vex':
      k.box(0.16, 0.3, 0.14, DARK, { p: [0, 0.15, 0.13] });
      k.box(0.16, 0.3, 0.14, DARK, { p: [0, 0.15, -0.13] });
      k.box(0.4, 0.3, 0.46, 0xff8a3d, { p: [0, 0.45, 0] });
      k.box(0.2, 0.16, 0.24, LIGHT, { p: [0.08, 0.68, 0] });
      k.glow(new THREE.BoxGeometry(0.04, 0.06, 0.18), 0x7af0ff, { p: [0.19, 0.69, 0] });
      k.cyl(0.07, 0.08, 0.5, 6, STEEL, { p: [0.25, 0.48, 0.3], r: [0, 0, R] });
      k.box(0.2, 0.1, 0.24, DARK, { p: [-0.18, 0.6, 0] });
      break;
    case 'kira':
      k.box(0.08, 0.28, 0.08, DARK, { p: [0, 0.14, 0.07] });
      k.box(0.08, 0.28, 0.08, DARK, { p: [0, 0.14, -0.07] });
      k.box(0.18, 0.28, 0.22, 0x2e9a63, { p: [0, 0.42, 0] });
      k.ball(0.11, skin, { p: [0, 0.65, 0] });
      k.box(0.2, 0.08, 0.24, 0x1d1d2a, { p: [-0.02, 0.73, 0] });
      k.glow(new THREE.BoxGeometry(0.6, 0.03, 0.05), 0x5cff9d, { p: [0.25, 0.45, 0.18], r: [0, 0, 0.3] });
      break;
    case 'sol':
      k.cone(0.24, 0.6, 8, 0x4a54c8, { p: [0, 0.3, 0] });
      k.ball(0.11, skin, { p: [0, 0.68, 0] });
      k.cone(0.15, 0.25, 8, 0x2a2f7a, { p: [0, 0.85, 0] });
      k.glow(new THREE.IcosahedronGeometry(0.1, 1), 0x7a8cff, { p: [0.25, 0.8, 0] });
      k.cyl(0.015, 0.015, 0.8, 4, WOOD, { p: [0.2, 0.4, 0.12] });
      break;
    case 'bolt':
      k.box(0.08, 0.26, 0.08, DARK, { p: [0, 0.13, 0.07] });
      k.box(0.08, 0.26, 0.08, DARK, { p: [0, 0.13, -0.07] });
      k.box(0.2, 0.28, 0.24, 0xe0a030, { p: [0, 0.4, 0] });
      k.ball(0.11, skin, { p: [0, 0.63, 0] });
      k.cyl(0.12, 0.12, 0.06, 8, 0xffd45c, { p: [0, 0.72, 0] });
      k.box(0.3, 0.04, 0.04, STEEL, { p: [0.18, 0.42, 0.16], r: [0, 0, 0.5] });
      // Byte the robot dog
      k.box(0.24, 0.12, 0.12, STEEL, { p: [0.12, 0.14, -0.3] });
      k.box(0.1, 0.1, 0.1, STEEL, { p: [0.26, 0.22, -0.3] });
      k.glow(new THREE.BoxGeometry(0.02, 0.03, 0.06), 0xffd45c, { p: [0.31, 0.24, -0.3] });
      for (const [x, z] of [[0.04, -0.25], [0.04, -0.35], [0.2, -0.25], [0.2, -0.35]]) k.box(0.03, 0.1, 0.03, DARK, { p: [x, 0.05, z] });
      break;
  }
  const r = k.build();
  return { body: r.body, glow: r.glow };
}

// ─────────────────────────── soldier ───────────────────────────
export function soldierModel(): THREE.BufferGeometry {
  const k = new Kit();
  k.box(0.07, 0.14, 0.06, DARK, { p: [0, 0.07, 0.05] });
  k.box(0.07, 0.14, 0.06, DARK, { p: [0, 0.07, -0.05] });
  k.box(0.14, 0.16, 0.18, 0x44e08a, { p: [0, 0.22, 0] });
  k.ball(0.07, 0xf2c9a0, { p: [0, 0.36, 0] });
  k.box(0.04, 0.2, 0.16, LIGHT, { p: [0.1, 0.22, 0] });
  k.cyl(0.08, 0.08, 0.04, 6, STEEL, { p: [0, 0.42, 0] });
  return k.build().body;
}

export function barricadeModel(): THREE.BufferGeometry {
  const k = new Kit();
  for (let i = -1; i <= 1; i++) k.box(0.18, 0.4, 0.7, WOOD, { p: [i * 0.12, 0.2, 0], r: [0, 0, i * 0.15] });
  k.box(0.08, 0.08, 0.8, STEEL, { p: [0, 0.35, 0] });
  return k.build().body;
}

// ─────────────────────────── fortress & gate ───────────────────────────
export function fortressModel(): { body: THREE.BufferGeometry; glow: THREE.BufferGeometry | null } {
  const k = new Kit();
  k.cyl(0.62, 0.7, 0.3, 8, 0x8a8fa8, { p: [0, 0.15, 0] });
  k.cyl(0.66, 0.66, 0.05, 8, 0x5ce1ff, { p: [0, 0.31, 0] });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    k.box(0.14, 0.14, 0.14, 0x9aa0bb, { p: [Math.cos(a) * 0.6, 0.4, Math.sin(a) * 0.6] });
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    k.cyl(0.13, 0.15, 0.75, 6, 0xb0b6cc, { p: [Math.cos(a) * 0.5, 0.45, Math.sin(a) * 0.5] });
    k.cone(0.17, 0.3, 6, 0x3a6fd8, { p: [Math.cos(a) * 0.5, 0.97, Math.sin(a) * 0.5] });
  }
  k.cyl(0.28, 0.34, 1.0, 8, 0xc8cde0, { p: [0, 0.6, 0] });
  k.cyl(0.32, 0.32, 0.06, 8, 0x3a6fd8, { p: [0, 1.1, 0] });
  k.cyl(0.04, 0.04, 0.5, 4, DARK, { p: [0, 1.5, 0] });
  k.box(0.02, 0.16, 0.26, 0x5ce1ff, { p: [0, 1.65, 0.14] });
  k.glow(new THREE.OctahedronGeometry(0.2), 0x5ce1ff, { p: [0, 1.35, 0], s: [1, 1.4, 1] });
  return k.build();
}

export function gateModel(): { body: THREE.BufferGeometry; glow: THREE.BufferGeometry | null } {
  const k = new Kit();
  k.box(0.18, 1.0, 0.18, 0x3a2f4a, { p: [0, 0.5, 0.44] });
  k.box(0.18, 1.0, 0.18, 0x3a2f4a, { p: [0, 0.5, -0.44] });
  k.box(0.22, 0.18, 1.1, 0x4a3a5e, { p: [0, 1.05, 0] });
  k.cone(0.12, 0.2, 4, 0xff4fd8, { p: [0, 1.25, 0.44] });
  k.cone(0.12, 0.2, 4, 0xff4fd8, { p: [0, 1.25, -0.44] });
  k.glow(new THREE.BoxGeometry(0.05, 0.05, 0.9), 0xff4fd8, { p: [0.12, 1.05, 0] });
  return k.build();
}

// ─────────────────────────── props ───────────────────────────
export function treeModel(variant: number, palette: { leaf: number; leaf2: number; trunk: number }): THREE.BufferGeometry {
  const k = new Kit();
  if (variant === 0) {
    k.cyl(0.05, 0.07, 0.25, 5, palette.trunk, { p: [0, 0.12, 0] });
    k.cone(0.3, 0.45, 6, palette.leaf, { p: [0, 0.42, 0] });
    k.cone(0.22, 0.35, 6, palette.leaf2, { p: [0, 0.68, 0] });
  } else if (variant === 1) {
    k.cyl(0.05, 0.07, 0.3, 5, palette.trunk, { p: [0, 0.15, 0] });
    k.ball(0.26, palette.leaf, { p: [0, 0.48, 0] });
    k.ball(0.16, palette.leaf2, { p: [0.14, 0.62, 0.06] });
  } else {
    k.ball(0.22, 0x8c8f9e, { p: [0, 0.12, 0], s: [1.3, 0.8, 1.1] });
    k.ball(0.14, 0x9ea2b2, { p: [0.18, 0.1, 0.1] });
  }
  return k.build().body;
}

export function cactusModel(): THREE.BufferGeometry {
  const k = new Kit();
  k.cyl(0.08, 0.1, 0.5, 6, 0x5a9a4a, { p: [0, 0.25, 0] });
  k.cyl(0.05, 0.05, 0.2, 6, 0x5a9a4a, { p: [0.1, 0.3, 0], r: [0, 0, -0.9] });
  k.cyl(0.05, 0.05, 0.16, 6, 0x5a9a4a, { p: [-0.09, 0.36, 0], r: [0, 0, 0.9] });
  return k.build().body;
}

export function palmModel(): THREE.BufferGeometry {
  const k = new Kit();
  k.cyl(0.04, 0.06, 0.6, 5, 0x9a6a42, { p: [0.04, 0.3, 0], r: [0, 0, -0.15] });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    k.box(0.36, 0.02, 0.1, 0x3fa85a, { p: [0.1 + Math.cos(a) * 0.16, 0.6, Math.sin(a) * 0.16], r: [0, -a, -0.35] });
  }
  return k.build().body;
}
