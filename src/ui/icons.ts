import * as THREE from 'three';
import { TOWERS } from '../data/towers';
import { HEROES } from '../data/skills';
import { ENEMIES, BOSSES } from '../data/enemies';
import { enemyModel, heroModel, towerModel } from '../render/models';
import { glowVC, outlineMat, toonVC } from '../render/materials';

/** Renders 3D model thumbnails for cards (towers, heroes, enemies) once at boot. */
export const ICONS = new Map<string, string>();

export function renderIcons(): void {
  const size = 160;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  } catch {
    return;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x50404a, 1.6));
  const sun = new THREE.DirectionalLight(0xfff0dd, 2.4);
  sun.position.set(-3, 5, 4);
  scene.add(sun);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  const mat = toonVC();
  const gmat = glowVC(1.6);
  const out = outlineMat(0.025);
  const shot = (key: string, objs: THREE.Object3D[], h: number, dist: number) => {
    const g = new THREE.Group();
    for (const o of objs) g.add(o);
    g.rotation.y = -0.6;
    scene.add(g);
    cam.position.set(0, h + dist * 0.55, dist);
    cam.lookAt(0, h * 0.55, 0);
    renderer.render(scene, cam);
    ICONS.set(key, canvas.toDataURL('image/png'));
    scene.remove(g);
  };
  const meshes = (body: THREE.BufferGeometry, glow: THREE.BufferGeometry | null, y = 0) => {
    const a = new THREE.Mesh(body, mat);
    const b = new THREE.Mesh(body, out);
    a.position.y = b.position.y = y;
    const arr: THREE.Object3D[] = [a, b];
    if (glow) {
      const c = new THREE.Mesh(glow, gmat);
      c.position.y = y;
      arr.push(c);
    }
    return arr;
  };
  for (const t of TOWERS) {
    for (const tier of [1, 3]) {
      const m = towerModel(t.id, tier);
      const objs = meshes(m.base, m.baseGlow);
      const turret = new THREE.Group();
      turret.position.y = m.turretY;
      turret.rotation.y = 0.5;
      for (const o of meshes(m.turret, m.turretGlow)) turret.add(o);
      if (m.spinner) {
        const s = new THREE.Mesh(m.spinner, mat);
        s.position.y = m.muzzle;
        turret.add(s);
      }
      objs.push(turret);
      shot(`tower:${t.id}${tier === 3 ? ':6' : ''}`, objs, 0.5, 2.6);
    }
  }
  for (const h of HEROES) {
    const m = heroModel(h.id);
    shot(`hero:${h.id}`, meshes(m.body, m.glow), 0.6, 2.4);
  }
  for (const e of [...ENEMIES, ...BOSSES]) {
    const m = enemyModel(e.id, e.color);
    const s = e.boss ? 1 / (e.size * 1.2) : 1;
    const objs = meshes(m.body, m.glow, e.air ? 0.4 : 0);
    const g = new THREE.Group();
    for (const o of objs) g.add(o);
    g.scale.setScalar(s * (e.boss ? 0.9 : 1.1));
    shot(`enemy:${e.id}`, [g], e.boss ? 1 : 0.5, e.boss ? 3.4 : 2.2);
  }
  renderer.dispose();
  renderer.forceContextLoss();
}
