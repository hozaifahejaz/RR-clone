import * as THREE from 'three';
import type { Battle } from '../sim/battle';
import type { Tower } from '../sim/entities/entities';
import { ENEMIES, BOSSES } from '../data/enemies';
import { barricadeModel, enemyModel, heroModel, soldierModel, towerModel } from './models';
import type { TowerModel } from './models';
import { CLASS_COLORS, glow, glowVC, outlineMat, toonVC } from './materials';
import { wx, wz } from './world';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

interface EnemyBatch {
  body: THREE.InstancedMesh;
  outline: THREE.InstancedMesh;
  glow: THREE.InstancedMesh | null;
  flash: Float32Array;
  flashAttr: THREE.InstancedBufferAttribute;
  cap: number;
}

interface Dying {
  type: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  t: number;
  size: number;
  air: boolean;
}

export interface TowerView {
  id: number;
  group: THREE.Group;
  turret: THREE.Group;
  spinner: THREE.Mesh | null;
  tier: number;
  model: TowerModel;
  pips: THREE.Group;
  stars: number;
  drop: number;
  spinSpeed: number;
  ko: THREE.Mesh;
  defId: string;
  beam: THREE.Mesh[];
}

const BEAM_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const BEAM_FRAG = /* glsl */ `
uniform float uTime; uniform vec3 uColor; uniform float uStage;
varying vec2 vUv;
void main() {
  float core = 1.0 - abs(vUv.x - 0.5) * 2.0;
  float n = sin(vUv.y * 40.0 - uTime * 30.0) * 0.5 + 0.5;
  float a = pow(core, 1.5) * (0.6 + 0.4 * n);
  vec3 c = mix(uColor, vec3(1.0), pow(core, 6.0)) * (1.5 + uStage);
  gl_FragColor = vec4(c * a, a);
}`;

export class UnitsView {
  group = new THREE.Group();
  private batches = new Map<string, EnemyBatch>();
  private dying: Dying[] = [];
  towers = new Map<number, TowerView>();
  private modelCache = new Map<string, TowerModel>();
  private towerMat = toonVC();
  private towerGlowMat = glowVC(2.6);
  private outline = outlineMat(0.03);
  private enemyOutline = outlineMat(0.028);
  private hp: THREE.InstancedMesh;
  private hpAttr: THREE.InstancedBufferAttribute;
  private hpData: Float32Array;
  private shadows: THREE.InstancedMesh;
  private soldiers: THREE.InstancedMesh;
  private barricades: THREE.InstancedMesh;
  private eliteRings: THREE.InstancedMesh;
  private proj = new Map<string, THREE.InstancedMesh>();
  hero: THREE.Group | null = null;
  private heroRing: THREE.Mesh | null = null;
  private heroDrop = 0;
  private beamMat: THREE.ShaderMaterial;
  private camQuat = new THREE.Quaternion();
  private koMat = glow(0x8899ff, 1.2, { additive: true, opacity: 0.5 });
  starMat = glow(0xffd45c, 2.4);

  constructor() {
    // enemy batches
    for (const d of [...ENEMIES, ...BOSSES]) {
      const m = enemyModel(d.id, d.color);
      const cap = d.boss ? 8 : d.id === 'swarm' || d.id === 'mini' || d.id === 'buzzer' ? 400 : 220;
      const flash = new Float32Array(cap);
      const flashAttr = new THREE.InstancedBufferAttribute(flash, 1).setUsage(THREE.DynamicDrawUsage);
      m.body.setAttribute('aFlash', flashAttr);
      const body = new THREE.InstancedMesh(m.body, toonVC({ flash: true }), cap);
      body.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
      body.count = 0;
      body.frustumCulled = false;
      body.castShadow = !!d.boss;
      const outline = new THREE.InstancedMesh(m.body, this.enemyOutline, cap);
      outline.count = 0;
      outline.frustumCulled = false;
      let g: THREE.InstancedMesh | null = null;
      if (m.glow) {
        g = new THREE.InstancedMesh(m.glow, glowVC(2.8), cap);
        g.count = 0;
        g.frustumCulled = false;
        this.group.add(g);
      }
      this.group.add(body, outline);
      this.batches.set(d.id, { body, outline, glow: g, flash, flashAttr, cap });
    }
    // hp bars (billboard quads with fill in shader)
    const hpGeo = new THREE.PlaneGeometry(1, 0.11);
    this.hpData = new Float32Array(1200 * 3);
    this.hpAttr = new THREE.InstancedBufferAttribute(this.hpData, 3).setUsage(THREE.DynamicDrawUsage);
    hpGeo.setAttribute('aHp', this.hpAttr);
    const hpMat = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      toneMapped: false,
      vertexShader: `attribute vec3 aHp; varying vec3 vHp; varying vec2 vUv;
        void main(){ vHp = aHp; vUv = uv;
          vec4 c = instanceMatrix * vec4(0.0,0.0,0.0,1.0);
          vec3 sc = vec3(length(instanceMatrix[0].xyz), 1.0, 1.0);
          vec4 mv = viewMatrix * modelMatrix * c;
          mv.xy += position.xy * sc.xy;
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vHp; varying vec2 vUv;
        void main(){
          vec2 uv = vUv;
          float edge = step(0.06, uv.x) * step(uv.x, 0.94) * step(0.2, uv.y) * step(uv.y, 0.8);
          vec3 bg = vec3(0.08,0.06,0.14);
          float hx = (uv.x - 0.06) / 0.88;
          vec3 col = bg;
          if (edge > 0.5) {
            vec3 hc = vHp.z > 0.5 ? vec3(1.0,0.35,0.85) : mix(vec3(1.0,0.25,0.2), vec3(0.35,1.0,0.4), smoothstep(0.2,0.7,vHp.x));
            if (hx < vHp.x) col = hc * 1.3;
            if (vHp.y > 0.0 && hx < vHp.y && uv.y > 0.55) col = vec3(0.5,0.8,1.6);
          }
          gl_FragColor = vec4(col, 0.95);
        }`,
    });
    this.hp = new THREE.InstancedMesh(hpGeo, hpMat, 1200);
    this.hp.count = 0;
    this.hp.frustumCulled = false;
    this.hp.renderOrder = 40;
    this.group.add(this.hp);
    // blob shadows
    const sg = new THREE.CircleGeometry(0.5, 12);
    sg.rotateX(-Math.PI / 2);
    this.shadows = new THREE.InstancedMesh(sg, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }), 1500);
    this.shadows.count = 0;
    this.shadows.frustumCulled = false;
    this.shadows.renderOrder = 3;
    this.group.add(this.shadows);
    // elite rings
    const er = new THREE.RingGeometry(0.42, 0.5, 20);
    er.rotateX(-Math.PI / 2);
    this.eliteRings = new THREE.InstancedMesh(er, glow(0xff4fd8, 2.2, { additive: true, opacity: 0.9 }), 300);
    this.eliteRings.count = 0;
    this.eliteRings.frustumCulled = false;
    this.group.add(this.eliteRings);
    // soldiers
    this.soldiers = new THREE.InstancedMesh(soldierModel(), toonVC(), 200);
    this.soldiers.count = 0;
    this.soldiers.castShadow = true;
    this.soldiers.frustumCulled = false;
    this.group.add(this.soldiers);
    this.barricades = new THREE.InstancedMesh(barricadeModel(), toonVC(), 10);
    this.barricades.count = 0;
    this.barricades.castShadow = true;
    this.group.add(this.barricades);
    // projectiles
    const mk = (key: string, geo: THREE.BufferGeometry, mat: THREE.Material, cap = 300) => {
      const m = new THREE.InstancedMesh(geo, mat, cap);
      m.count = 0;
      m.frustumCulled = false;
      this.proj.set(key, m);
      this.group.add(m);
    };
    mk('shell', new THREE.IcosahedronGeometry(0.09, 0), new THREE.MeshToonMaterial({ color: 0x2a2a35 }));
    mk('missile', new THREE.ConeGeometry(0.045, 0.2, 5).rotateZ(-Math.PI / 2), glow(0xffa860, 2.5));
    mk('frost', new THREE.OctahedronGeometry(0.08), glow(0x9fe6ff, 2.8));
    mk('blade', new THREE.TorusGeometry(0.14, 0.035, 3, 8, Math.PI * 1.2).rotateX(Math.PI / 2), glow(0x7dffb0, 2.2));
    mk('ball', new THREE.IcosahedronGeometry(0.17, 1), new THREE.MeshToonMaterial({ color: 0x6a3fa0 }), 40);
    this.beamMat = new THREE.ShaderMaterial({
      vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide, toneMapped: false,
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0xb48cff) }, uStage: { value: 0 } },
    });
  }

  private getModel(id: string, tier: number): TowerModel {
    const k = id + ':' + tier;
    let m = this.modelCache.get(k);
    if (!m) {
      m = towerModel(id, tier);
      this.modelCache.set(k, m);
    }
    return m;
  }

  private buildTowerView(tv: Partial<TowerView> & { id: number; defId: string }, tier: number): TowerView {
    const model = this.getModel(tv.defId, tier);
    const group = tv.group ?? new THREE.Group();
    group.clear();
    const base = new THREE.Mesh(model.base, this.towerMat);
    base.castShadow = true;
    base.receiveShadow = true;
    const bo = new THREE.Mesh(model.base, this.outline);
    group.add(base, bo);
    if (model.baseGlow) group.add(new THREE.Mesh(model.baseGlow, this.towerGlowMat));
    const turret = new THREE.Group();
    turret.position.y = model.turretY;
    const tm = new THREE.Mesh(model.turret, this.towerMat);
    tm.castShadow = true;
    turret.add(tm, new THREE.Mesh(model.turret, this.outline));
    if (model.turretGlow) turret.add(new THREE.Mesh(model.turretGlow, this.towerGlowMat));
    let spinner: THREE.Mesh | null = null;
    if (model.spinner) {
      spinner = new THREE.Mesh(model.spinner, this.towerMat);
      spinner.castShadow = true;
      spinner.position.set(model.spinAxis === 'x' ? 0.0 : 0, model.muzzle, 0);
      turret.add(spinner);
    }
    group.add(turret);
    const pips = new THREE.Group();
    group.add(pips);
    const ko = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), this.koMat);
    ko.position.y = 0.4;
    ko.visible = false;
    group.add(ko);
    return {
      id: tv.id, group, turret, spinner, tier, model, pips, stars: -1, drop: tv.drop ?? 0, spinSpeed: 0, ko, defId: tv.defId,
      beam: tv.beam ?? [],
    };
  }

  addTower(t: { id: number; def: { id: string }; x: number; y: number }): TowerView {
    const tv = this.buildTowerView({ id: t.id, defId: t.def.id }, 1);
    tv.group.position.set(wx(t.x), 0, wz(t.y));
    tv.drop = 0;
    this.group.add(tv.group);
    this.towers.set(t.id, tv);
    return tv;
  }

  addHero(id: string, x: number, y: number): void {
    const m = heroModel(id);
    const g = new THREE.Group();
    const body = new THREE.Mesh(m.body, this.towerMat);
    body.castShadow = true;
    g.add(body, new THREE.Mesh(m.body, this.outline));
    if (m.glow) g.add(new THREE.Mesh(m.glow, this.towerGlowMat));
    g.scale.setScalar(1.25);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.44, 32).rotateX(-Math.PI / 2), glow(0xffffff, 2, { additive: true, opacity: 0.8 }));
    ring.position.y = 0.03;
    g.add(ring);
    this.heroRing = ring;
    g.position.set(wx(x), 0, wz(y));
    this.hero = g;
    this.heroDrop = 0;
    this.group.add(g);
  }

  removeHero(): void {
    if (this.hero) this.group.remove(this.hero);
    this.hero = null;
  }

  update(b: Battle, alpha: number, dt: number, time: number, camera: THREE.Camera): void {
    camera.getWorldQuaternion(this.camQuat);
    this.beamMat.uniforms.uTime.value = time;
    this.updateEnemies(b, alpha, dt, time);
    this.updateTowers(b, dt, time);
    this.updateHero(b, dt, time);
    this.updateSoldiers(b, alpha, time);
    this.updateProjectiles(b, alpha, time);
  }

  killEnemy(e: { type: string; x: number; y: number; air: boolean }, size: number, yaw: number): void {
    this.dying.push({ type: e.type, x: e.x, y: e.y, z: e.air ? 1.0 : 0, yaw, t: 0, size, air: e.air });
  }

  private updateEnemies(b: Battle, alpha: number, dt: number, time: number): void {
    for (const bt of this.batches.values()) {
      bt.body.count = 0;
      bt.outline.count = 0;
      if (bt.glow) bt.glow.count = 0;
    }
    let hpN = 0, shN = 0, elN = 0;
    const hpm = this.hp;
    const place = (e: { type: string; x: number; y: number; z: number; yaw: number; scale: number; flash: number; tint: THREE.Color; spin?: number }) => {
      const bt = this.batches.get(e.type);
      if (!bt || bt.body.count >= bt.cap) return;
      const i = bt.body.count;
      _q.setFromAxisAngle(UP, e.yaw + (e.spin ?? 0));
      _m.compose(_p.set(e.x, e.z, e.y), _q, _s.setScalar(e.scale));
      bt.body.setMatrixAt(i, _m);
      bt.outline.setMatrixAt(i, _m);
      if (bt.glow) bt.glow.setMatrixAt(i, _m);
      bt.body.setColorAt(i, e.tint);
      bt.flash[i] = e.flash;
      bt.body.count = i + 1;
      bt.outline.count = i + 1;
      if (bt.glow) bt.glow.count = i + 1;
    };
    const tint = new THREE.Color();
    for (const e of b.enemies) {
      if (e.dead) continue;
      const x = wx(e.px + (e.x - e.px) * alpha);
      const y = wz(e.py + (e.y - e.py) * alpha);
      const moving = e.stunT <= 0 && e.freezeT <= 0 && e.danceT <= 0 && !e.blockedBy;
      const bobSpeed = 10 * e.speed;
      let z = e.air ? 1.0 + Math.sin(time * 3 + e.id) * 0.08 : moving ? Math.abs(Math.sin(time * bobSpeed + e.id)) * 0.06 : 0;
      const yaw = -Math.atan2(e.dirY, e.dirX);
      let spin = 0;
      if (e.danceT > 0) spin = time * 10;
      tint.setRGB(1, 1, 1);
      if (e.freezeT > 0) tint.setRGB(0.55, 0.85, 1.6);
      else if (e.slowT > 0 && e.slow > 0) tint.setRGB(0.8, 0.95, 1.25);
      if (e.burnT > 0) tint.multiply(_c.setRGB(1.4, 0.85, 0.6));
      if (e.shockT > 0 && Math.sin(time * 40) > 0) tint.multiply(_c.setRGB(1.3, 1.3, 0.7));
      if (e.danceT > 0) tint.setHSL((time * 2 + e.id * 0.1) % 1, 0.8, 0.65);
      if (e.lockT > 0) tint.multiply(_c.setRGB(1.5, 1.3, 0.6));
      let scale = e.def.size / 0.4 * (e.elite ? 1.18 : 1);
      if (e.def.boss) scale = e.def.size * 1.6;
      if (e.burrowT > 0) {
        z = -0.25;
        scale *= 0.6;
      }
      if (e.def.id === 'wyrm' || e.def.id === 'leviathan') z += 0.6;
      if (e.decoy) tint.multiplyScalar(0.8);
      // spawn pop
      place({ type: e.def.id, x, y, z, yaw, scale, flash: e.flash, tint, spin });
      // shadow
      if (shN < 1500) {
        const ss = e.def.size * (e.def.boss ? 2.2 : 1.6) * (e.air ? 0.8 : 1);
        _m.compose(_p.set(x, 0.03, y), _q.identity(), _s.set(ss, 1, ss));
        this.shadows.setMatrixAt(shN++, _m);
      }
      if (e.elite && elN < 300) {
        _q.setFromAxisAngle(UP, time * 2);
        _m.compose(_p.set(x, 0.05 + (e.air ? 0.4 : 0), y), _q, _s.setScalar(scale * 0.9));
        this.eliteRings.setMatrixAt(elN++, _m);
      }
      // hp bar
      const dmg = e.hp < e.maxHp - 0.5 || e.shield > 0 || e.def.boss || e.elite;
      if (dmg && hpN < 1200) {
        const top = (e.def.boss ? 2.2 : 0.9) * (e.def.boss ? 1 : scale * 0.6) + z + (e.air ? 0.2 : 0);
        const w = e.def.boss ? 1.6 : 0.45 + (e.elite ? 0.15 : 0);
        _m.compose(_p.set(x, top, y), _q.identity(), _s.set(w, 1, 1));
        hpm.setMatrixAt(hpN, _m);
        this.hpData[hpN * 3] = Math.max(0, e.hp / e.maxHp);
        this.hpData[hpN * 3 + 1] = e.maxShield > 0 ? e.shield / Math.max(1, e.maxHp) : 0;
        this.hpData[hpN * 3 + 2] = e.def.boss ? 1 : 0;
        hpN++;
      }
    }
    // dying
    for (const d of this.dying) {
      d.t += dt;
      const k = d.t / 0.32;
      if (k >= 1) continue;
      const s = d.size * (1 + k * 0.4) * (1 - k);
      tint.setRGB(1 + k * 2, 1 + k * 2, 1 + k * 2);
      place({ type: d.type, x: d.x, y: d.y, z: d.z + k * 0.3, yaw: d.yaw + k * 3, scale: Math.max(0.01, s), flash: 1 - k * 0.5, tint });
    }
    this.dying = this.dying.filter((d) => d.t < 0.32);
    for (const bt of this.batches.values()) {
      bt.body.instanceMatrix.needsUpdate = true;
      bt.outline.instanceMatrix.needsUpdate = true;
      if (bt.body.instanceColor) bt.body.instanceColor.needsUpdate = true;
      bt.flashAttr.needsUpdate = true;
      if (bt.glow) bt.glow.instanceMatrix.needsUpdate = true;
      bt.body.visible = bt.body.count > 0;
      bt.outline.visible = bt.body.count > 0;
      if (bt.glow) bt.glow.visible = bt.body.count > 0;
    }
    hpm.count = hpN;
    hpm.instanceMatrix.needsUpdate = true;
    this.hpAttr.needsUpdate = true;
    this.shadows.count = shN;
    this.shadows.instanceMatrix.needsUpdate = true;
    this.eliteRings.count = elN;
    this.eliteRings.instanceMatrix.needsUpdate = true;
  }

  private updateTowers(b: Battle, dt: number, time: number): void {
    const alive = new Set<number>();
    for (const t of b.towers) {
      alive.add(t.id);
      let tv = this.towers.get(t.id);
      if (!tv) tv = this.addTower(t);
      const stars = b.stars[t.def.id] ?? 1;
      const tier = stars >= 6 ? 3 : stars >= 3 ? 2 : 1;
      if (tier !== tv.tier) {
        const old = tv;
        tv = this.buildTowerView({ id: t.id, defId: t.def.id, group: old.group, drop: 0.55, beam: old.beam }, tier);
        this.towers.set(t.id, tv);
      }
      if (tv.stars !== stars) this.buildPips(tv, stars, t.def.cls);
      // position (move/switch)
      const tx = wx(t.x), tz = wz(t.y);
      tv.group.position.x += (tx - tv.group.position.x) * Math.min(1, dt * 12);
      tv.group.position.z += (tz - tv.group.position.z) * Math.min(1, dt * 12);
      // drop-in squash
      if (tv.drop < 1) {
        tv.drop = Math.min(1, tv.drop + dt * 2.6);
        const k = tv.drop;
        if (k < 0.45) {
          const f = k / 0.45;
          tv.group.position.y = (1 - f * f) * 3;
          tv.group.scale.set(0.85, 1.25, 0.85);
        } else {
          const f = (k - 0.45) / 0.55;
          const sq = Math.sin(f * Math.PI * 2.5) * (1 - f) * 0.35;
          tv.group.position.y = 0;
          tv.group.scale.set(1 + sq, 1 - sq, 1 + sq);
        }
      } else {
        tv.group.position.y = 0;
        tv.group.scale.set(1, 1, 1);
      }
      // aim
      if (t.def.delivery !== 'aura' && t.def.delivery !== 'buff' && t.def.delivery !== 'summon' && !t.def.onRoad && t.def.id !== 'tesla' && t.def.id !== 'laser') {
        const target = -t.aim;
        let cur = tv.turret.rotation.y;
        let d = target - cur;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        cur += d * Math.min(1, dt * 14);
        tv.turret.rotation.y = cur;
      }
      // recoil
      const rec = t.fireFx;
      tv.turret.position.x = -Math.cos(tv.turret.rotation.y) * rec * 0.06;
      tv.turret.position.z = Math.sin(tv.turret.rotation.y) * rec * 0.06;
      if (t.def.id === 'tesla' || t.def.id === 'amp' || t.def.id === 'laser') tv.turret.position.y = tv.model.turretY + Math.sin(time * 2 + t.id) * 0.02 + rec * 0.04;
      // spinner
      if (tv.spinner) {
        const want = t.def.id === 'gatling' ? t.spin * 40 : t.def.id === 'gust' ? (t.fireFx > 0 ? 30 : 6) : t.def.id === 'disco' ? 3 : 8;
        tv.spinSpeed += (want - tv.spinSpeed) * Math.min(1, dt * 4);
        if (tv.model.spinAxis === 'x') tv.spinner.rotation.x += tv.spinSpeed * dt;
        else tv.spinner.rotation.y += tv.spinSpeed * dt;
      }
      // KO / stun
      tv.ko.visible = t.koT > 0 || t.stunT > 0;
      if (tv.ko.visible) {
        tv.ko.scale.setScalar(0.9 + Math.sin(time * 10) * 0.05);
        (tv.ko.material as THREE.MeshBasicMaterial).color.setHex(t.koT > 0 ? 0xff5040 : 0x8fd8ff).multiplyScalar(1.4);
      }
      tv.pips.rotation.y = time * 0.6;
      // beams
      this.updateBeams(b, t, tv, time);
    }
    for (const [id, tv] of this.towers) {
      if (!alive.has(id)) {
        this.group.remove(tv.group);
        this.towers.delete(id);
      }
    }
  }

  private buildPips(tv: TowerView, stars: number, cls: string): void {
    tv.stars = stars;
    tv.pips.clear();
    const geo = new THREE.OctahedronGeometry(0.045);
    const mat = glow(CLASS_COLORS[cls], 2.6);
    for (let i = 0; i < stars; i++) {
      const a = (i / stars) * Math.PI * 2;
      const m = new THREE.Mesh(geo, i < 6 ? this.starMat : mat);
      m.position.set(Math.cos(a) * 0.32, 0.32, Math.sin(a) * 0.32);
      tv.pips.add(m);
    }
  }

  private updateBeams(b: Battle, t: Tower, tv: TowerView, time: number): void {
    if (t.def.delivery !== 'beam') return;
    while (tv.beam.length < t.beamTargets.length) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.beamMat.clone());
      m.frustumCulled = false;
      m.renderOrder = 26;
      this.group.add(m);
      tv.beam.push(m);
    }
    const s = t.stats;
    const stage = t.rampT < s.rampTime ? 0 : t.rampT < s.rampTime * 2 ? 1 : 2;
    for (let i = 0; i < tv.beam.length; i++) {
      const m = tv.beam[i];
      const id = t.beamTargets[i];
      const e = id ? b.enemyById.get(id) : undefined;
      if (!e || t.koT > 0 || t.stunT > 0) {
        m.visible = false;
        continue;
      }
      m.visible = true;
      const a = new THREE.Vector3(wx(t.x), tv.model.muzzle + tv.model.turretY, wz(t.y));
      const bpt = new THREE.Vector3(wx(e.x), e.air ? 1.0 : 0.35, wz(e.y));
      const mid = a.clone().add(bpt).multiplyScalar(0.5);
      const len = a.distanceTo(bpt);
      m.position.copy(mid);
      // orient plane: y along beam, face camera
      const dir = bpt.clone().sub(a).normalize();
      const camDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camQuat);
      const side = dir.clone().cross(camDir).normalize();
      const normal = side.clone().cross(dir).normalize();
      const basis = new THREE.Matrix4().makeBasis(side, dir, normal);
      m.quaternion.setFromRotationMatrix(basis);
      const w = 0.09 + stage * 0.06 + Math.sin(time * 40) * 0.01;
      m.scale.set(w, len, 1);
      const mat = m.material as THREE.ShaderMaterial;
      mat.uniforms.uTime.value = time;
      mat.uniforms.uStage.value = stage;
      mat.uniforms.uColor.value.setHex(stage === 0 ? 0xb48cff : stage === 1 ? 0xff7cf0 : 0xffffff);
    }
  }

  private updateHero(b: Battle, dt: number, time: number): void {
    const h = b.hero;
    if (!h) {
      if (this.hero) this.removeHero();
      return;
    }
    if (!this.hero) this.addHero(h.def.id, h.x, h.y);
    const g = this.hero!;
    g.position.x += (wx(h.x) - g.position.x) * Math.min(1, dt * 12);
    g.position.z += (wz(h.y) - g.position.z) * Math.min(1, dt * 12);
    if (this.heroDrop < 1) {
      this.heroDrop = Math.min(1, this.heroDrop + dt * 2);
      g.position.y = (1 - this.heroDrop) * (1 - this.heroDrop) * 3;
    } else g.position.y = Math.abs(Math.sin(time * 2)) * 0.03;
    const target = -h.aim;
    let d = target - g.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    g.rotation.y += d * Math.min(1, dt * 10);
    const sc = 1.25 * (1 + h.fireFx * 0.06) * (h.specialT > 0 && h.def.id === 'vex' ? 1.25 : 1);
    g.scale.setScalar(sc);
    if (this.heroRing) {
      const full = h.charge >= h.def.charge;
      const m = this.heroRing.material as THREE.MeshBasicMaterial;
      m.color.setHex(CLASS_COLORS[h.def.cls]).multiplyScalar(full ? 2 + Math.sin(time * 8) : 1);
      this.heroRing.rotation.y = -g.rotation.y;
      this.heroRing.scale.setScalar(full ? 1.15 + Math.sin(time * 8) * 0.08 : 1);
    }
  }

  private updateSoldiers(b: Battle, alpha: number, time: number): void {
    let n = 0, nb = 0;
    for (const s of b.soldiers) {
      if (s.dead) continue;
      const x = wx(s.px + (s.x - s.px) * alpha), z = wz(s.py + (s.y - s.py) * alpha);
      if (s.barricade) {
        const path = b.board.path;
        const tmp = { x: 0, y: 0, tx: 0, ty: 0 };
        path.sample(s.d, tmp);
        _q.setFromAxisAngle(UP, -Math.atan2(tmp.ty, tmp.tx));
        _m.compose(_p.set(x, 0, z), _q, _s.setScalar(1));
        this.barricades.setMatrixAt(nb++, _m);
        continue;
      }
      const fighting = s.blocking.length > 0;
      _q.setFromAxisAngle(UP, fighting ? Math.sin(time * 12 + s.id) * 0.4 : s.id);
      _m.compose(_p.set(x, fighting ? Math.abs(Math.sin(time * 12 + s.id)) * 0.05 : 0, z), _q, _s.setScalar(1));
      this.soldiers.setMatrixAt(n++, _m);
    }
    this.soldiers.count = n;
    this.soldiers.instanceMatrix.needsUpdate = true;
    this.barricades.count = nb;
    this.barricades.instanceMatrix.needsUpdate = true;
  }

  private updateProjectiles(b: Battle, alpha: number, time: number): void {
    const counts = new Map<string, number>();
    for (const m of this.proj.values()) m.count = 0;
    for (const p of b.projectiles) {
      if (p.dead) continue;
      if (p.kind === 'ball' && p.t < 0) continue;
      const m = this.proj.get(p.kind);
      if (!m) continue;
      const i = counts.get(p.kind) ?? 0;
      if (i >= m.instanceMatrix.count) continue;
      const x = wx(p.px + (p.x - p.px) * alpha), y = wz(p.py + (p.y - p.py) * alpha);
      const z = p.pz + (p.z - p.pz) * alpha;
      const yaw = -Math.atan2(p.y - p.py, p.x - p.px);
      if (p.kind === 'blade') _q.setFromAxisAngle(UP, time * 25);
      else if (p.kind === 'ball') _q.setFromAxisAngle(new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), time * 12);
      else _q.setFromAxisAngle(UP, yaw);
      _m.compose(_p.set(x, z, y), _q, _s.setScalar(p.kind === 'ball' ? (b.towerById.get(p.towerId)?.stats.dmg ?? 0) > 80 ? 1.3 : 1 : 1));
      m.setMatrixAt(i, _m);
      counts.set(p.kind, i + 1);
    }
    for (const [k, m] of this.proj) {
      m.count = counts.get(k) ?? 0;
      m.instanceMatrix.needsUpdate = true;
    }
  }

  dispose(): void {
    this.group.clear();
  }
}
