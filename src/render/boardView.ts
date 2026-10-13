import * as THREE from 'three';
import { Board, FORT, H, T, W } from '../sim/board/board';
import type { Vec2 } from '../sim/types';
import { prep } from './kit';
import { glow, toonVC } from './materials';
import { cactusModel, palmModel, treeModel, fortressModel, gateModel } from './models';
import type { Biome } from './world';
import { mulberry, wx, wz } from './world';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const N = W * H;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

function blockGeo(b: Biome): THREE.BufferGeometry {
  // top grass slab + earth column (top at y=0)
  const top = prep(new THREE.BoxGeometry(1, 0.14, 1), b.grass, { p: [0, -0.07, 0] });
  const lip = prep(new THREE.BoxGeometry(1.02, 0.06, 1.02), b.grass2, { p: [0, -0.15, 0] });
  const col = prep(new THREE.BoxGeometry(0.98, 0.9, 0.98), b.dirt, { p: [0, -0.62, 0] });
  const bot = prep(new THREE.CylinderGeometry(0.42, 0.12, 0.7, 5), b.dirtDark, { p: [0, -1.4, 0] });
  return mergeGeometries([top, lip, col, bot])!;
}

const WATER_VERT = /* glsl */ `
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const WATER_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
varying vec3 vW;
void main() {
  float w = sin(vW.x * 4.0 + uTime * 1.6) * sin(vW.z * 3.3 - uTime * 1.2);
  float c = smoothstep(0.55, 0.95, w);
  vec3 col = uColor * (0.85 + 0.15 * w) + vec3(0.6, 0.9, 1.0) * c * 0.5;
  gl_FragColor = vec4(col, 0.92);
}`;

interface TileAnim {
  t: number; // 0..1 progress of rise
  delay: number;
}

export class BoardView {
  group = new THREE.Group();
  private blocks: THREE.InstancedMesh;
  private water: THREE.InstancedMesh;
  private waterMat: THREE.ShaderMaterial;
  private fog: THREE.InstancedMesh;
  private ghostSlabs: THREE.InstancedMesh;
  bounds = { minX: 0, maxX: 12, minY: 0, maxY: 20 };
  private props: THREE.InstancedMesh[] = [];
  private tufts: THREE.InstancedMesh;
  private power: THREE.InstancedMesh;
  private crack: THREE.InstancedMesh;
  private roadMesh: THREE.Mesh | null = null;
  private roadEdge: THREE.Mesh | null = null;
  private roadMat: THREE.MeshToonMaterial;
  private roadEdgeMat: THREE.MeshToonMaterial;
  fortress: THREE.Group;
  gate: THREE.Group;
  private gatePortal: THREE.Mesh;
  private gateBeam: THREE.Mesh;
  private fortCrystal: THREE.Mesh | null = null;
  private rise: TileAnim[] = [];
  private fogLevel = new Float32Array(N); // 1 = fog visible
  private propKind = new Int8Array(N);
  private prevRevealed = new Uint8Array(N);
  private prevTerrain = new Uint8Array(N);
  private fall = new Float32Array(N); // collapse fall anim
  private blockIdx = new Int32Array(N);
  private gateAnim = 1;
  private gatePos = new THREE.Vector3();
  private gateFrom = new THREE.Vector3();
  // ghosts
  ghostTiles: THREE.InstancedMesh;
  ghostRoad: THREE.InstancedMesh;
  rangeRing: THREE.Mesh;
  private rangeRingMin: THREE.Mesh;
  hover: THREE.Mesh;

  constructor(private board: Board, private biome: Biome, seed: number) {
    const b = biome;
    this.blocks = new THREE.InstancedMesh(blockGeo(b), toonVC(), N);
    this.blocks.receiveShadow = true;
    this.blocks.castShadow = false;
    this.blocks.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
    this.group.add(this.blocks);

    this.waterMat = new THREE.ShaderMaterial({
      vertexShader: WATER_VERT, fragmentShader: WATER_FRAG, transparent: true,
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(b.water) } },
    });
    const wgeo = new THREE.PlaneGeometry(1, 1);
    wgeo.rotateX(-Math.PI / 2);
    this.water = new THREE.InstancedMesh(wgeo, this.waterMat, N);
    this.water.count = 0;
    this.group.add(this.water);

    // fog clouds
    const puff = mergeGeometries([
      prep(new THREE.IcosahedronGeometry(0.42, 1), 0xffffff, { p: [0, 0, 0] }),
      prep(new THREE.IcosahedronGeometry(0.3, 1), 0xf1f0ff, { p: [0.3, 0.05, 0.2] }),
      prep(new THREE.IcosahedronGeometry(0.28, 1), 0xe8e8ff, { p: [-0.28, -0.02, -0.18] }),
    ])!;
    const fogMat = toonVC({ transparent: true, opacity: 0.82 });
    fogMat.emissive = new THREE.Color(0x8a8aa6);
    fogMat.depthWrite = false;
    this.fog = new THREE.InstancedMesh(puff, fogMat, N);
    this.fog.renderOrder = 8;
    const ghostGeo = new THREE.BoxGeometry(0.94, 0.06, 0.94);
    this.ghostSlabs = new THREE.InstancedMesh(ghostGeo, new THREE.MeshBasicMaterial({ color: 0xbfd0ff, transparent: true, opacity: 0.09, depthWrite: false }), N);
    this.ghostSlabs.renderOrder = 1;
    this.group.add(this.ghostSlabs);
    this.fog.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
    this.group.add(this.fog);

    // props
    const rnd = mulberry(seed ^ 0xabc);
    const pal = { leaf: b.leaf, leaf2: b.leaf2, trunk: b.trunk };
    const propGeos = [treeModel(0, pal), treeModel(1, pal), treeModel(2, pal), b.id === 'canyon' ? cactusModel() : b.id === 'islands' ? palmModel() : treeModel(0, pal)];
    for (const g of propGeos) {
      const m = new THREE.InstancedMesh(g, toonVC(), N);
      m.castShadow = true;
      m.count = 0;
      this.props.push(m);
      this.group.add(m);
    }
    for (let i = 0; i < N; i++) this.propKind[i] = Math.floor(rnd() * 4);

    // grass tufts
    const tuft = mergeGeometries([
      prep(new THREE.ConeGeometry(0.05, 0.16, 3), b.grass2, { p: [0, 0.08, 0] }),
      prep(new THREE.ConeGeometry(0.04, 0.12, 3), b.leaf2, { p: [0.06, 0.06, 0.03] }),
      prep(new THREE.ConeGeometry(0.04, 0.13, 3), b.grass2, { p: [-0.05, 0.065, -0.02] }),
    ])!;
    this.tufts = new THREE.InstancedMesh(tuft, toonVC(), N * 2);
    this.tufts.count = 0;
    this.group.add(this.tufts);

    // power + crack overlays
    const pg = new THREE.RingGeometry(0.22, 0.36, 6);
    pg.rotateX(-Math.PI / 2);
    this.power = new THREE.InstancedMesh(pg, glow(0x5ce1ff, 2.2, { additive: true, opacity: 0.9 }), N);
    this.power.count = 0;
    this.group.add(this.power);
    const cg = new THREE.PlaneGeometry(0.9, 0.9);
    cg.rotateX(-Math.PI / 2);
    this.crack = new THREE.InstancedMesh(cg, glow(0xff4a20, 1.8, { additive: true, opacity: 0.6 }), N);
    this.crack.count = 0;
    this.group.add(this.crack);

    this.roadMat = toonVC();
    this.roadEdgeMat = toonVC();

    // fortress
    const fm = fortressModel();
    this.fortress = new THREE.Group();
    const fb = new THREE.Mesh(fm.body, toonVC());
    fb.castShadow = true;
    this.fortress.add(fb);
    if (fm.glow) {
      this.fortCrystal = new THREE.Mesh(fm.glow, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, color: new THREE.Color(2.6, 2.6, 2.6) }));
      this.fortress.add(this.fortCrystal);
    }
    this.fortress.position.set(wx(FORT.x + 0.5), 0, wz(FORT.y + 0.5));
    this.fortress.scale.setScalar(1.15);
    this.group.add(this.fortress);

    // gate
    const gm = gateModel();
    this.gate = new THREE.Group();
    const gb = new THREE.Mesh(gm.body, toonVC());
    gb.castShadow = true;
    this.gate.add(gb);
    if (gm.glow) this.gate.add(new THREE.Mesh(gm.glow, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, color: new THREE.Color(2.5, 2.5, 2.5) })));
    this.gatePortal = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 24),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
        fragmentShader: `uniform float uTime; varying vec2 vUv;
          void main(){ vec2 p = vUv-0.5; float r = length(p)*2.0; float a = atan(p.y,p.x);
          float sw = sin(a*3.0 + r*10.0 - uTime*5.0)*0.5+0.5;
          vec3 c = mix(vec3(1.6,0.3,1.4), vec3(0.4,0.2,1.8), sw);
          float alpha = smoothstep(1.0,0.2,r) * (0.55 + 0.45*sw);
          gl_FragColor = vec4(c*alpha*1.6, alpha); }`,
      }),
    );
    this.gatePortal.rotation.y = Math.PI / 2;
    this.gatePortal.position.y = 0.5;
    this.gatePortal.scale.set(1, 1.15, 1);
    this.gate.add(this.gatePortal);
    this.gateBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 2.4, 12, 1, true), glow(0xff4fd8, 1.4, { additive: true, opacity: 0.2 }));
    this.gateBeam.position.y = 1.2;
    this.gate.add(this.gateBeam);
    this.group.add(this.gate);

    // ghosts
    const gt = new THREE.PlaneGeometry(0.94, 0.94);
    gt.rotateX(-Math.PI / 2);
    const ghostMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false });
    this.ghostTiles = new THREE.InstancedMesh(gt, ghostMat, N);
    this.ghostTiles.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
    this.ghostTiles.count = 0;
    this.ghostTiles.renderOrder = 30;
    this.group.add(this.ghostTiles);
    const gr = new THREE.BoxGeometry(0.9, 0.08, 0.9);
    this.ghostRoad = new THREE.InstancedMesh(gr, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false }), 16);
    this.ghostRoad.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(16 * 3), 3);
    this.ghostRoad.count = 0;
    this.ghostRoad.renderOrder = 31;
    this.group.add(this.ghostRoad);
    const rg = new THREE.RingGeometry(0.96, 1, 64);
    rg.rotateX(-Math.PI / 2);
    this.rangeRing = new THREE.Mesh(rg, glow(0xffffff, 1.4, { additive: true, opacity: 0.8 }));
    this.rangeRing.visible = false;
    this.rangeRing.renderOrder = 32;
    const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, depthWrite: false }));
    this.rangeRing.add(fill);
    this.rangeRingMin = new THREE.Mesh(rg, glow(0xff5050, 1.4, { additive: true, opacity: 0.6 }));
    this.rangeRing.add(this.rangeRingMin);
    this.group.add(this.rangeRing);
    this.hover = new THREE.Mesh(gt, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, depthWrite: false }));
    this.hover.visible = false;
    this.group.add(this.hover);

    // initial state: everything revealed rises in
    for (let i = 0; i < N; i++) {
      this.rise.push({ t: 1, delay: 0 });
      this.fogLevel[i] = board.revealed[i] ? 0 : 1;
    }
    this.prevRevealed.set(board.revealed);
    this.prevTerrain.set(board.terrain);
    this.rebuildRoad();
    this.rebuildStatic();
    this.placeGate(true);
  }

  intro(): void {
    // stagger rise of the starting island
    for (let i = 0; i < N; i++) {
      if (!this.board.revealed[i]) continue;
      const x = i % W, y = Math.floor(i / W);
      this.rise[i] = { t: 0, delay: Math.hypot(x - FORT.x, y - FORT.y) * 0.06 };
    }
  }

  reveal(cells: Vec2[]): void {
    const cx = cells.reduce((a, c) => a + c.x, 0) / Math.max(1, cells.length);
    const cy = cells.reduce((a, c) => a + c.y, 0) / Math.max(1, cells.length);
    for (const c of cells) {
      const i = Board.idx(c.x, c.y);
      this.rise[i] = { t: 0, delay: Math.hypot(c.x - cx, c.y - cy) * 0.07 };
    }
  }

  rebuildRoad(): void {
    const p = this.board.path;
    if (this.roadMesh) {
      this.group.remove(this.roadMesh, this.roadEdge!);
      this.roadMesh.geometry.dispose();
      this.roadEdge!.geometry.dispose();
    }
    const mk = (width: number, y: number, color: number) => {
      const pos: number[] = [];
      const col: number[] = [];
      const c = new THREE.Color(color);
      const s = { x: 0, y: 0, tx: 0, ty: 0 };
      const L = p.length;
      const step = 0.12;
      let prevL: THREE.Vector3 | null = null, prevR: THREE.Vector3 | null = null;
      for (let d = -0.05; d <= L + 0.4; d += step) {
        p.sample(Math.min(d, L), s);
        let x = s.x, yy = s.y;
        if (d > L) {
          x -= s.tx * (d - L);
          yy -= s.ty * (d - L);
        }
        const nx = -s.ty, ny = s.tx;
        const l = new THREE.Vector3(wx(x + nx * width / 2), y, wz(yy + ny * width / 2));
        const r = new THREE.Vector3(wx(x - nx * width / 2), y, wz(yy - ny * width / 2));
        if (prevL && prevR) {
          pos.push(prevL.x, prevL.y, prevL.z, prevR.x, prevR.y, prevR.z, r.x, r.y, r.z);
          pos.push(prevL.x, prevL.y, prevL.z, r.x, r.y, r.z, l.x, l.y, l.z);
          const k = 0.94 + 0.06 * Math.sin(d * 7);
          for (let i = 0; i < 6; i++) col.push(c.r * k, c.g * k, c.b * k);
        }
        prevL = l;
        prevR = r;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.computeVertexNormals();
      return g;
    };
    this.roadEdge = new THREE.Mesh(mk(0.9, 0.012, this.biome.roadEdge), this.roadEdgeMat);
    this.roadMesh = new THREE.Mesh(mk(0.72, 0.022, this.biome.road), this.roadMat);
    // normals: ensure up-facing
    for (const m of [this.roadEdge, this.roadMesh]) {
      const n = m.geometry.getAttribute('normal') as THREE.BufferAttribute;
      for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
      m.receiveShadow = true;
      (m.material as THREE.Material).side = THREE.DoubleSide;
    }
    this.group.add(this.roadEdge, this.roadMesh);
  }

  placeGate(instant = false): void {
    const g = this.board.gate;
    const n = this.board.road.length;
    const prev = n >= 2 ? this.board.road[n - 2] : FORT;
    const dx = g.x - prev.x, dy = g.y - prev.y;
    const to = new THREE.Vector3(wx(g.x + 0.5), 0, wz(g.y + 0.5));
    this.gateFrom.copy(instant ? to : this.gatePos);
    this.gatePos.copy(to);
    this.gate.rotation.y = -Math.atan2(dy, dx);
    this.gateAnim = instant ? 1 : 0;
  }

  /** Rebuild instanced tile/prop/tuft matrices (call on board changes). */
  rebuildStatic(): void {
    const b = this.board;
    let pc = [0, 0, 0, 0];
    let tc = 0, pw = 0, wc = 0;
    const rnd = mulberry(1234);
    for (let i = 0; i < N; i++) {
      const x = i % W, y = Math.floor(i / W);
      const X = wx(x + 0.5), Z = wz(y + 0.5);
      const revealed = b.revealed[i] === 1;
      const terr = b.terrain[i];
      if (revealed && terr === T.Water) {
        _m.compose(_p.set(X, -0.16, Z), _q.identity(), _s.set(1, 1, 1));
        this.water.setMatrixAt(wc++, _m);
      }
      const isRoad = b.roadIdx[i] >= 0;
      if (revealed && terr === T.Rock) {
        const k = this.propKind[i];
        const rr = rnd();
        _q.setFromAxisAngle(UP, rr * 6.28);
        _m.compose(_p.set(X + (rr - 0.5) * 0.2, 0, Z), _q, _s.setScalar(0.9 + rr * 0.5));
        this.props[k].setMatrixAt(pc[k]++, _m);
        if (rr > 0.5) {
          const k2 = (k + 1) % 4;
          _m.compose(_p.set(X + 0.25, 0, Z - 0.2), _q, _s.setScalar(0.6));
          this.props[k2].setMatrixAt(pc[k2]++, _m);
        }
      }
      if (revealed && terr === T.Land && !isRoad && !b.isFort(x, y)) {
        for (let k = 0; k < 2; k++) {
          const a = rnd(), c = rnd();
          if (a > 0.7) continue;
          _q.setFromAxisAngle(UP, c * 6.28);
          _m.compose(_p.set(X + (a - 0.5) * 0.8, 0, Z + (c - 0.5) * 0.8), _q, _s.setScalar(0.8 + a * 0.6));
          this.tufts.setMatrixAt(tc++, _m);
        }
      }
      if (revealed && b.power[i] && !isRoad) {
        _m.compose(_p.set(X, 0.03, Z), _q.identity(), _s.setScalar(1));
        this.power.setMatrixAt(pw++, _m);
      }
    }
    this.props.forEach((m, k) => {
      m.count = pc[k];
      m.instanceMatrix.needsUpdate = true;
    });
    this.tufts.count = tc;
    this.tufts.instanceMatrix.needsUpdate = true;
    this.power.count = pw;
    this.power.instanceMatrix.needsUpdate = true;
    this.water.count = wc;
    this.water.instanceMatrix.needsUpdate = true;
    pc = [0, 0, 0, 0];
  }

  update(dt: number, time: number, fortFrac: number): void {
    const b = this.board;
    this.waterMat.uniforms.uTime.value = time;
    (this.gatePortal.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
    // detect reveal / collapse changes
    let changed = false;
    for (let i = 0; i < N; i++) {
      if (b.revealed[i] !== this.prevRevealed[i]) {
        changed = true;
        if (this.rise[i].t >= 1) this.rise[i] = { t: 0, delay: 0 };
      }
      if (b.terrain[i] !== this.prevTerrain[i]) {
        changed = true;
        if (b.terrain[i] === T.Chasm) this.fall[i] = 0.0001;
      }
    }
    this.prevRevealed.set(b.revealed);
    this.prevTerrain.set(b.terrain);
    if (changed) this.rebuildStatic();

    // blocks
    let n = 0;
    let fogN = 0;
    let gs = 0;
    let bx0 = 99, bx1 = -1, by0 = 99, by1 = -1;
    for (let i = 0; i < N; i++) {
      const x = i % W, y = Math.floor(i / W);
      const X = wx(x + 0.5), Z = wz(y + 0.5);
      const terr = b.terrain[i];
      const ra = this.rise[i];
      if (ra.t < 1) {
        if (ra.delay > 0) ra.delay -= dt;
        else ra.t = Math.min(1, ra.t + dt * 1.8);
      }
      const revealed = b.revealed[i] === 1;
      // fog fade
      const fogTarget = revealed ? 0 : 1;
      this.fogLevel[i] += (fogTarget - this.fogLevel[i]) * Math.min(1, dt * 4);
      if (revealed) {
        if (x < bx0) bx0 = x;
        if (x > bx1) bx1 = x;
        if (y < by0) by0 = y;
        if (y > by1) by1 = y;
      } else {
        _m.compose(_p.set(X, -0.04 + Math.sin(time * 0.6 + x * 0.9 + y * 0.5) * 0.03, Z), _q.identity(), _s.setScalar(1));
        this.ghostSlabs.setMatrixAt(gs++, _m);
      }
      const puffy = (x * 7 + y * 13 + ((x * y) % 5)) % 3 === 0;
      if (this.fogLevel[i] > 0.02 && puffy) {
        const f = this.fogLevel[i];
        const bob = Math.sin(time * 0.8 + x * 1.3 + y * 0.7) * 0.06;
        _q.setFromAxisAngle(UP, (x * 7 + y * 13) % 6);
        const v = ((x * 7 + y * 11) % 5) / 5;
        _m.compose(_p.set(X, -0.1 + bob + v * 0.1 + (1 - f) * 0.6, Z), _q, _s.set((0.95 + v * 0.25) * f, (0.55 + v * 0.3) * f, (0.95 + v * 0.25) * f));
        this.fog.setMatrixAt(fogN, _m);
        const shade = 0.9 + 0.1 * Math.sin(x * 3.1 + y * 1.7);
        this.fog.setColorAt(fogN, _c.setRGB(shade, shade, shade * 1.04));
        fogN++;
      }
      if (!revealed && ra.t >= 1) continue;
      if (terr === T.Chasm) {
        if (this.fall[i] > 0 && this.fall[i] < 1.5) {
          this.fall[i] += dt;
          const f = this.fall[i];
          _q.setFromAxisAngle(new THREE.Vector3(1, 0, 0.5).normalize(), f * 1.5);
          _m.compose(_p.set(X, -f * f * 6, Z), _q, _s.setScalar(Math.max(0.01, 1 - f * 0.4)));
          this.blocks.setMatrixAt(n, _m);
          this.blocks.setColorAt(n, _c.setRGB(1, 0.7, 0.6));
          this.blockIdx[i] = n++;
        }
        continue;
      }
      if (!revealed) continue;
      const k = ra.t;
      const e = k >= 1 ? 1 : 1 + 2.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2); // easeOutBack
      const yOff = (1 - e) * -2.5;
      const depth = 0.8 + ((x * 31 + y * 17) % 7) / 10;
      const waterDrop = terr === T.Water ? -0.28 : 0;
      _m.compose(_p.set(X, yOff + waterDrop, Z), _q.identity(), _s.set(1, depth, 1));
      this.blocks.setMatrixAt(n, _m);
      const chk = ((x + y) % 2 === 0 ? 1.0 : 0.94) * (terr === T.Water ? 0.8 : 1);
      this.blocks.setColorAt(n, _c.setRGB(chk, chk, chk));
      this.blockIdx[i] = n++;
    }
    this.blocks.count = n;
    this.blocks.instanceMatrix.needsUpdate = true;
    if (this.blocks.instanceColor) this.blocks.instanceColor.needsUpdate = true;
    this.ghostSlabs.count = gs;
    this.ghostSlabs.instanceMatrix.needsUpdate = true;
    if (bx1 >= 0) {
      const g = this.board.gate;
      this.bounds = { minX: Math.min(bx0, g.x), maxX: Math.max(bx1, g.x), minY: Math.min(by0, g.y), maxY: Math.max(by1, g.y) };
    }
    this.fog.count = fogN;
    this.fog.instanceMatrix.needsUpdate = true;
    if (this.fog.instanceColor) this.fog.instanceColor.needsUpdate = true;

    // cracks
    let cc = 0;
    for (let i = 0; i < N; i++) {
      if (b.cracked[i] > 0) {
        const x = i % W, y = Math.floor(i / W);
        const pulse = 0.6 + 0.4 * Math.sin(time * (8 - b.cracked[i] * 0.3));
        _m.compose(_p.set(wx(x + 0.5), 0.02, wz(y + 0.5)), _q.identity(), _s.setScalar(pulse));
        this.crack.setMatrixAt(cc++, _m);
      }
    }
    this.crack.count = cc;
    this.crack.instanceMatrix.needsUpdate = true;
    // power pulse
    (this.power.material as THREE.MeshBasicMaterial).opacity = 0.6 + 0.3 * Math.sin(time * 2.5);

    // gate
    if (this.gateAnim < 1) {
      this.gateAnim = Math.min(1, this.gateAnim + dt * 2.2);
      const e = 1 - Math.pow(1 - this.gateAnim, 3);
      this.gate.position.lerpVectors(this.gateFrom, this.gatePos, e);
      this.gate.position.y = Math.sin(this.gateAnim * Math.PI) * 1.2;
      const s = 0.4 + 0.6 * e;
      this.gate.scale.setScalar(s);
    } else {
      this.gate.position.copy(this.gatePos);
      this.gate.scale.setScalar(1);
    }
    this.gateBeam.scale.set(1 + Math.sin(time * 3) * 0.08, 1, 1 + Math.sin(time * 3) * 0.08);
    (this.gateBeam.material as THREE.MeshBasicMaterial).opacity = 0.12 + 0.06 * Math.sin(time * 2);
    // fortress crystal: cyan → red with damage
    if (this.fortCrystal) {
      const m = this.fortCrystal.material as THREE.MeshBasicMaterial;
      const k = Math.max(0, Math.min(1, fortFrac));
      m.color.setRGB(2.6 - k * 0.6 + (1 - k) * 1.2, 0.6 + k * 2.0, 0.6 + k * 2.0);
      this.fortCrystal.rotation.y = time * 0.8;
      this.fortCrystal.position.y = Math.sin(time * 1.5) * 0.05;
    }
  }

  // ───────── ghosts ─────────
  showTiles(tiles: Vec2[], color: number, opacity = 0.35): void {
    const m = this.ghostTiles;
    (m.material as THREE.MeshBasicMaterial).opacity = opacity;
    let n = 0;
    for (const t of tiles) {
      _m.compose(_p.set(wx(t.x + 0.5), 0.05, wz(t.y + 0.5)), _q.identity(), _s.setScalar(1));
      m.setMatrixAt(n, _m);
      m.setColorAt(n, _c.setHex(color));
      n++;
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }
  showRoadGhost(tiles: Vec2[], ok: boolean, time: number): void {
    const m = this.ghostRoad;
    let n = 0;
    for (const t of tiles) {
      const bob = Math.sin(time * 6 + n) * 0.03;
      _m.compose(_p.set(wx(t.x + 0.5), 0.12 + bob + n * 0.01, wz(t.y + 0.5)), _q.identity(), _s.setScalar(1));
      m.setMatrixAt(n, _m);
      m.setColorAt(n, _c.setHex(ok ? 0xffe9a8 : 0xff5050));
      n++;
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }
  showRange(x: number, y: number, r: number, minR: number, color = 0xffffff): void {
    this.rangeRing.visible = r > 0;
    this.rangeRing.position.set(wx(x), 0.06, wz(y));
    this.rangeRing.scale.set(r, 1, r);
    (this.rangeRing.material as THREE.MeshBasicMaterial).color.setHex(color).multiplyScalar(1.4);
    this.rangeRingMin.visible = minR > 0;
    this.rangeRingMin.scale.setScalar(minR / Math.max(0.01, r));
  }
  clearGhosts(): void {
    this.ghostTiles.count = 0;
    this.ghostRoad.count = 0;
    this.rangeRing.visible = false;
    this.hover.visible = false;
  }
}
