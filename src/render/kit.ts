import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface Xf {
  p?: [number, number, number];
  r?: [number, number, number];
  s?: [number, number, number] | number;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();

export function prep(g: THREE.BufferGeometry, color: number | THREE.Color, xf: Xf = {}, jitter = 0): THREE.BufferGeometry {
  let geo = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(geo.attributes)) if (k !== 'position') geo.deleteAttribute(k);
  const c = new THREE.Color(color);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 3) {
    const j = jitter ? 1 + (Math.sin(i * 12.9898) * 43758.5453 % 1) * jitter : 1;
    for (let k = 0; k < 3 && i + k < n; k++) {
      arr[(i + k) * 3] = c.r * j;
      arr[(i + k) * 3 + 1] = c.g * j;
      arr[(i + k) * 3 + 2] = c.b * j;
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  const p = xf.p ?? [0, 0, 0];
  const r = xf.r ?? [0, 0, 0];
  const s = typeof xf.s === 'number' ? [xf.s, xf.s, xf.s] : xf.s ?? [1, 1, 1];
  _e.set(r[0], r[1], r[2]);
  _q.setFromEuler(_e);
  _m.compose(_v.set(p[0], p[1], p[2]), _q, _s.set(s[0], s[1], s[2]));
  geo.applyMatrix4(_m);
  geo.computeVertexNormals();
  return geo;
}

/** Collects colored primitive parts and merges them into one geometry. */
export class Kit {
  parts: THREE.BufferGeometry[] = [];
  glows: THREE.BufferGeometry[] = [];
  add(g: THREE.BufferGeometry, color: number, xf: Xf = {}, jitter = 0): this {
    this.parts.push(prep(g, color, xf, jitter));
    return this;
  }
  glow(g: THREE.BufferGeometry, color: number, xf: Xf = {}): this {
    this.glows.push(prep(g, color, xf));
    return this;
  }
  box(w: number, h: number, d: number, color: number, xf: Xf = {}): this {
    return this.add(new THREE.BoxGeometry(w, h, d), color, xf);
  }
  cyl(rt: number, rb: number, h: number, seg: number, color: number, xf: Xf = {}): this {
    return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), color, xf);
  }
  cone(r: number, h: number, seg: number, color: number, xf: Xf = {}): this {
    return this.add(new THREE.ConeGeometry(r, h, seg), color, xf);
  }
  ball(r: number, color: number, xf: Xf = {}, detail = 0): this {
    return this.add(new THREE.IcosahedronGeometry(r, detail), color, xf);
  }
  sph(r: number, color: number, xf: Xf = {}, w = 8, h = 6): this {
    return this.add(new THREE.SphereGeometry(r, w, h), color, xf);
  }
  torus(r: number, t: number, color: number, xf: Xf = {}, rs = 6, ts = 12, arc = Math.PI * 2): this {
    return this.add(new THREE.TorusGeometry(r, t, rs, ts, arc), color, xf);
  }
  build(): { body: THREE.BufferGeometry; glow: THREE.BufferGeometry | null } {
    const body = this.parts.length ? mergeGeometries(this.parts)! : new THREE.BufferGeometry();
    const glow = this.glows.length ? mergeGeometries(this.glows)! : null;
    body.computeBoundingSphere();
    return { body, glow };
  }
}
