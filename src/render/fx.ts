import * as THREE from 'three';

// ─────────────────────────── particles ───────────────────────────
interface P {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; max: number;
  s0: number; s1: number;
  r: number; g: number; b: number; a: number;
  grav: number; drag: number;
  alive: boolean;
}

const VERT = /* glsl */ `
attribute vec3 iPos;
attribute float iSize;
attribute vec4 iColor;
varying vec4 vColor;
varying vec2 vUv;
void main() {
  vColor = iColor;
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
  mv.xy += position.xy * iSize;
  gl_Position = projectionMatrix * mv;
}`;

const FRAG_SOFT = /* glsl */ `
varying vec4 vColor;
varying vec2 vUv;
uniform float uHard;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float a = uHard > 0.5 ? step(d, 0.85) : smoothstep(1.0, 0.0, d);
  a *= vColor.a;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor.rgb, a);
}`;

export class Particles {
  readonly mesh: THREE.Mesh;
  private ps: P[] = [];
  private free: number[] = [];
  private pos: Float32Array;
  private size: Float32Array;
  private col: Float32Array;
  private geo: THREE.InstancedBufferGeometry;
  constructor(public max: number, additive: boolean, hard = false) {
    const base = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute('position', base.getAttribute('position'));
    geo.setAttribute('uv', base.getAttribute('uv'));
    this.pos = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.col = new Float32Array(max * 4);
    geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('iSize', new THREE.InstancedBufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('iColor', new THREE.InstancedBufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    geo.instanceCount = 0;
    this.geo = geo;
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG_SOFT,
      uniforms: { uHard: { value: hard ? 1 : 0 } },
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      toneMapped: false,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 20 : 10;
    for (let i = 0; i < max; i++) {
      this.ps.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, s0: 0, s1: 0, r: 1, g: 1, b: 1, a: 1, grav: 0, drag: 0, alive: false });
      this.free.push(max - 1 - i);
    }
  }
  emit(o: {
    x: number; y: number; z: number; vx?: number; vy?: number; vz?: number; life: number;
    s0: number; s1?: number; color: THREE.Color | number; a?: number; grav?: number; drag?: number; bright?: number;
  }): void {
    const i = this.free.pop();
    if (i === undefined) return;
    const p = this.ps[i];
    const c = typeof o.color === 'number' ? _c.setHex(o.color) : o.color;
    const k = o.bright ?? 1;
    p.x = o.x; p.y = o.y; p.z = o.z;
    p.vx = o.vx ?? 0; p.vy = o.vy ?? 0; p.vz = o.vz ?? 0;
    p.life = 0; p.max = o.life; p.s0 = o.s0; p.s1 = o.s1 ?? o.s0;
    p.r = c.r * k; p.g = c.g * k; p.b = c.b * k; p.a = o.a ?? 1;
    p.grav = o.grav ?? 0; p.drag = o.drag ?? 0; p.alive = true;
  }
  update(dt: number): void {
    let n = 0;
    const ps = this.ps;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (!p.alive) continue;
      p.life += dt;
      if (p.life >= p.max) {
        p.alive = false;
        this.free.push(i);
        continue;
      }
      const dr = Math.max(0, 1 - p.drag * dt);
      p.vx *= dr; p.vy *= dr; p.vz *= dr;
      p.vy -= p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.grav > 0 && p.y < 0.02) {
        p.y = 0.02;
        p.vy *= -0.3;
        p.vx *= 0.6;
        p.vz *= 0.6;
      }
      const t = p.life / p.max;
      this.pos[n * 3] = p.x; this.pos[n * 3 + 1] = p.y; this.pos[n * 3 + 2] = p.z;
      this.size[n] = p.s0 + (p.s1 - p.s0) * t;
      this.col[n * 4] = p.r; this.col[n * 4 + 1] = p.g; this.col[n * 4 + 2] = p.b;
      this.col[n * 4 + 3] = p.a * (1 - t * t);
      n++;
    }
    this.geo.instanceCount = n;
    (this.geo.getAttribute('iPos') as THREE.InstancedBufferAttribute).needsUpdate = true;
    (this.geo.getAttribute('iSize') as THREE.InstancedBufferAttribute).needsUpdate = true;
    (this.geo.getAttribute('iColor') as THREE.InstancedBufferAttribute).needsUpdate = true;
  }
  clear(): void {
    for (let i = 0; i < this.ps.length; i++) if (this.ps[i].alive) { this.ps[i].alive = false; this.free.push(i); }
    this.geo.instanceCount = 0;
  }
}
const _c = new THREE.Color();

// ─────────────────────────── rings ───────────────────────────
interface Ring { mesh: THREE.Mesh; t: number; dur: number; r0: number; r1: number; alive: boolean; a: number }
export class Rings {
  readonly group = new THREE.Group();
  private pool: Ring[] = [];
  constructor(n = 48) {
    const geo = new THREE.RingGeometry(0.82, 1, 40);
    geo.rotateX(-Math.PI / 2);
    for (let i = 0; i < n; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      m.renderOrder = 15;
      this.group.add(m);
      this.pool.push({ mesh: m, t: 0, dur: 1, r0: 0, r1: 1, alive: false, a: 1 });
    }
  }
  spawn(x: number, y: number, z: number, r0: number, r1: number, dur: number, color: number, bright = 2, a = 1): void {
    const r = this.pool.find((p) => !p.alive);
    if (!r) return;
    r.alive = true; r.t = 0; r.dur = dur; r.r0 = r0; r.r1 = r1; r.a = a;
    r.mesh.position.set(x, y, z);
    (r.mesh.material as THREE.MeshBasicMaterial).color.setHex(color).multiplyScalar(bright);
    r.mesh.visible = true;
  }
  update(dt: number): void {
    for (const r of this.pool) {
      if (!r.alive) continue;
      r.t += dt;
      const k = r.t / r.dur;
      if (k >= 1) {
        r.alive = false;
        r.mesh.visible = false;
        continue;
      }
      const e = 1 - Math.pow(1 - k, 3);
      const s = r.r0 + (r.r1 - r.r0) * e;
      r.mesh.scale.set(s, 1, s);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - k) * r.a;
    }
  }
}

// ─────────────────────────── ribbons (lightning, tracers, chains) ───────────────────────────
interface Ribbon {
  mesh: THREE.Mesh;
  pts: number[]; // x,y,z triples
  t: number;
  dur: number;
  width: number;
  jag: number;
  alive: boolean;
  seed: number;
}
const MAX_SEG = 40;
export class Ribbons {
  readonly group = new THREE.Group();
  private pool: Ribbon[] = [];
  constructor(n = 64) {
    for (let i = 0; i < n; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_SEG * 6 * 3), 3).setUsage(THREE.DynamicDrawUsage));
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
      const m = new THREE.Mesh(geo, mat);
      m.frustumCulled = false;
      m.visible = false;
      m.renderOrder = 25;
      this.group.add(m);
      this.pool.push({ mesh: m, pts: [], t: 0, dur: 0.1, width: 0.05, jag: 0, alive: false, seed: 0 });
    }
  }
  spawn(pts: number[], color: number, opts: { dur?: number; width?: number; jag?: number; bright?: number } = {}): void {
    const r = this.pool.find((p) => !p.alive);
    if (!r) return;
    r.alive = true;
    r.pts = pts;
    r.t = 0;
    r.dur = opts.dur ?? 0.12;
    r.width = opts.width ?? 0.06;
    r.jag = opts.jag ?? 0;
    r.seed = Math.random() * 1000;
    (r.mesh.material as THREE.MeshBasicMaterial).color.setHex(color).multiplyScalar(opts.bright ?? 3);
    r.mesh.visible = true;
  }
  update(dt: number, camDir: THREE.Vector3): void {
    for (const r of this.pool) {
      if (!r.alive) continue;
      r.t += dt;
      if (r.t >= r.dur) {
        r.alive = false;
        r.mesh.visible = false;
        continue;
      }
      // build a jagged polyline through pts
      const line: THREE.Vector3[] = [];
      const np = r.pts.length / 3;
      for (let i = 0; i < np - 1; i++) {
        const a = new THREE.Vector3(r.pts[i * 3], r.pts[i * 3 + 1], r.pts[i * 3 + 2]);
        const b = new THREE.Vector3(r.pts[i * 3 + 3], r.pts[i * 3 + 4], r.pts[i * 3 + 5]);
        const segs = r.jag > 0 ? Math.max(2, Math.min(10, Math.round(a.distanceTo(b) * 5))) : 1;
        for (let s = 0; s < segs; s++) {
          const p = a.clone().lerp(b, s / segs);
          if (r.jag > 0 && s > 0) {
            p.x += (Math.random() - 0.5) * r.jag;
            p.y += (Math.random() - 0.5) * r.jag * 0.5;
            p.z += (Math.random() - 0.5) * r.jag;
          }
          line.push(p);
        }
      }
      if (np > 0) line.push(new THREE.Vector3(r.pts[np * 3 - 3], r.pts[np * 3 - 2], r.pts[np * 3 - 1]));
      const attr = r.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      const k = 1 - r.t / r.dur;
      const w = r.width * (0.5 + 0.5 * k);
      let n = 0;
      for (let i = 0; i < line.length - 1 && i < MAX_SEG; i++) {
        const a = line[i], b = line[i + 1];
        const d = b.clone().sub(a);
        const side = d.clone().cross(camDir).normalize().multiplyScalar(w);
        const v = [
          a.x - side.x, a.y - side.y, a.z - side.z,
          a.x + side.x, a.y + side.y, a.z + side.z,
          b.x + side.x, b.y + side.y, b.z + side.z,
          a.x - side.x, a.y - side.y, a.z - side.z,
          b.x + side.x, b.y + side.y, b.z + side.z,
          b.x - side.x, b.y - side.y, b.z - side.z,
        ];
        arr.set(v, n * 18);
        n++;
      }
      r.mesh.geometry.setDrawRange(0, n * 6);
      attr.needsUpdate = true;
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(1, k * 1.5);
    }
  }
}

// ─────────────────────────── decals ───────────────────────────
export class Decals {
  readonly group = new THREE.Group();
  private pool: { m: THREE.Mesh; t: number; dur: number; alive: boolean }[] = [];
  constructor(n = 40) {
    const geo = new THREE.CircleGeometry(1, 14);
    geo.rotateX(-Math.PI / 2);
    for (let i = 0; i < n; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x1a1210, transparent: true, opacity: 0.5, depthWrite: false });
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      m.renderOrder = 2;
      this.group.add(m);
      this.pool.push({ m, t: 0, dur: 4, alive: false });
    }
  }
  spawn(x: number, z: number, r: number, color = 0x1a1210, dur = 4): void {
    const d = this.pool.find((p) => !p.alive) ?? this.pool[0];
    d.alive = true;
    d.t = 0;
    d.dur = dur;
    d.m.position.set(x, 0.015 + Math.random() * 0.005, z);
    d.m.scale.setScalar(r);
    (d.m.material as THREE.MeshBasicMaterial).color.setHex(color);
    d.m.visible = true;
  }
  update(dt: number): void {
    for (const d of this.pool) {
      if (!d.alive) continue;
      d.t += dt;
      if (d.t >= d.dur) {
        d.alive = false;
        d.m.visible = false;
        continue;
      }
      (d.m.material as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - d.t / d.dur);
    }
  }
}
