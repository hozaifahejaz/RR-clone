import * as THREE from 'three';
import {
  BloomEffect,
  EffectComposer,
  EffectPass,
  KernelSize,
  RenderPass,
  SMAAEffect,
  TiltShiftEffect,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing';
import { H, W } from '../sim/board/board';

export type Quality = 'low' | 'medium' | 'high';

export interface Biome {
  id: string;
  skyTop: number;
  skyBottom: number;
  grass: number;
  grass2: number;
  dirt: number;
  dirtDark: number;
  road: number;
  roadEdge: number;
  sun: number;
  hemiSky: number;
  hemiGround: number;
  water: number;
  leaf: number;
  leaf2: number;
  trunk: number;
  cloud: number;
  void: number;
}

export const BIOMES: Record<string, Biome> = {
  plains: {
    id: 'plains', skyTop: 0x3d7fd9, skyBottom: 0xbfe6ff, grass: 0x86d25e, grass2: 0x74c24f, dirt: 0x9a7350, dirtDark: 0x5e4433,
    road: 0xe2c48e, roadEdge: 0xb08a5a, sun: 0xfff0d8, hemiSky: 0xcfe6ff, hemiGround: 0x6a5a48, water: 0x3fb6e8,
    leaf: 0x3fa85a, leaf2: 0x5cc46a, trunk: 0x8a5a3a, cloud: 0xffffff, void: 0x15306e,
  },
  islands: {
    id: 'islands', skyTop: 0x2a6fb8, skyBottom: 0xffd9b0, grass: 0x9ad86a, grass2: 0x84c858, dirt: 0xc79a62, dirtDark: 0x8a6440,
    road: 0xf3e2b0, roadEdge: 0xcaa874, sun: 0xffe2c0, hemiSky: 0xffe6cc, hemiGround: 0x6a5a48, water: 0x2fd0d8,
    leaf: 0x2f9a5a, leaf2: 0x4fc070, trunk: 0x9a6a42, cloud: 0xfff4ea, void: 0x0e3a5e,
  },
  canyon: {
    id: 'canyon', skyTop: 0x4a6cc8, skyBottom: 0xffc896, grass: 0xe2b26e, grass2: 0xd6a460, dirt: 0xb86a3e, dirtDark: 0x7a3e26,
    road: 0xc9905c, roadEdge: 0x9a643c, sun: 0xffe0b0, hemiSky: 0xffe0c0, hemiGround: 0x7a4a30, water: 0x3fa8d8,
    leaf: 0x7aa04a, leaf2: 0x8ab85a, trunk: 0x8a5a3a, cloud: 0xfff0e0, void: 0x3a2560,
  },
};

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const SKY_FRAG = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uBottom;
uniform vec3 uVoid;
uniform vec3 uStorm;
uniform float uStormK;
uniform float uTime;
varying vec3 vDir;
void main() {
  float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 col = mix(uBottom, uTop, smoothstep(0.35, 0.9, h));
  col = mix(col, uVoid, smoothstep(0.5, 0.15, h));
  float band = sin(vDir.x * 6.0 + uTime * 0.05) * sin(vDir.z * 5.0 - uTime * 0.04);
  col += vec3(0.04) * band * (1.0 - h);
  col = mix(col, uStorm * (0.6 + 0.4 * h), uStormK);
  gl_FragColor = vec4(col, 1.0);
}`;

export class World {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  composer: EffectComposer | null = null;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  sky: THREE.Mesh;
  skyMat: THREE.ShaderMaterial;
  quality: Quality = 'medium';
  biome: Biome = BIOMES.plains;
  // camera rig
  target = new THREE.Vector3(0, 0, 0.6);
  zoom = 1;
  baseDist = 30;
  pitch = THREE.MathUtils.degToRad(56);
  shakeAmp = 0;
  private shakeT = 0;
  private bloom: BloomEffect | null = null;
  private tilt: TiltShiftEffect | null = null;
  floaters: THREE.Group = new THREE.Group();
  stormK = 0;
  stormTarget = 0;
  cinematic = 0; // 0..1 dolly toward cinematicTarget
  cinematicTarget = new THREE.Vector3();
  reduceShake = false;
  manualT = 0; // seconds since manual camera input suppression
  autoZoom = 1;
  autoTarget = new THREE.Vector3(0, 0, 0.6);

  constructor(public canvas: HTMLCanvasElement, quality: Quality) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, depth: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.5, 300);
    this.scene.background = new THREE.Color(0x0e1026);

    this.hemi = new THREE.HemisphereLight(0xcfe6ff, 0x6a5a48, 1.25);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff0d8, 2.4);
    this.sun.position.set(-9, 18, 7);
    this.sun.target.position.set(0, 0, 0);
    this.sun.shadow.camera.left = -10;
    this.sun.shadow.camera.right = 10;
    this.sun.shadow.camera.top = 14;
    this.sun.shadow.camera.bottom = -14;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 50;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target);

    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTop: { value: new THREE.Color() },
        uBottom: { value: new THREE.Color() },
        uVoid: { value: new THREE.Color() },
        uStorm: { value: new THREE.Color(0x2a1f4a) },
        uStormK: { value: 0 },
        uTime: { value: 0 },
      },
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(150, 32, 16), this.skyMat);
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);
    this.scene.add(this.floaters);
    this.setQuality(quality);
    this.setBiome('plains');
  }

  setBiome(id: string): void {
    const b = BIOMES[id] ?? BIOMES.plains;
    this.biome = b;
    this.skyMat.uniforms.uTop.value.setHex(b.skyTop);
    this.skyMat.uniforms.uBottom.value.setHex(b.skyBottom);
    this.skyMat.uniforms.uVoid.value.setHex(b.void);
    this.sun.color.setHex(b.sun);
    this.hemi.color.setHex(b.hemiSky);
    this.hemi.groundColor.setHex(b.hemiGround);
    this.scene.fog = new THREE.Fog(b.void, 40, 110);
    this.buildFloaters();
  }

  private buildFloaters(): void {
    this.floaters.clear();
    const b = this.biome;
    const rockMat = new THREE.MeshToonMaterial({ color: b.dirt });
    const topMat = new THREE.MeshToonMaterial({ color: b.grass });
    const cloudMat = new THREE.MeshToonMaterial({ color: b.cloud, transparent: true, opacity: 0.55, depthWrite: false, emissive: new THREE.Color(b.skyBottom).multiplyScalar(0.45) });
    const rnd = mulberry(77);
    for (let i = 0; i < 14; i++) {
      const g = new THREE.Group();
      const s = 0.8 + rnd() * 2.2;
      const rock = new THREE.Mesh(new THREE.ConeGeometry(1, 1.8, 6), rockMat);
      rock.rotation.x = Math.PI;
      rock.position.y = -0.9;
      const top = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.25, 6), topMat);
      g.add(rock, top);
      g.scale.setScalar(s);
      const a = rnd() * Math.PI * 2;
      const r = 18 + rnd() * 26;
      g.position.set(Math.cos(a) * r, -6 + rnd() * 10 - (Math.sin(a) > 0 ? 4 : 0), Math.sin(a) * r - 8);
      g.userData.bob = rnd() * 10;
      this.floaters.add(g);
    }
    // cloud sea below
    for (let i = 0; i < 26; i++) {
      const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), cloudMat);
      const s = 1.2 + rnd() * 2.2;
      c.scale.set(s * 1.6, s * 0.4, s);
      c.position.set((rnd() - 0.5) * 60, -12 - rnd() * 8, (rnd() - 0.5) * 60 - 6);
      c.userData.drift = 0.2 + rnd() * 0.4;
      this.floaters.add(c);
    }
  }

  setQuality(q: Quality): void {
    this.quality = q;
    const dpr = Math.min(window.devicePixelRatio || 1, q === 'high' ? 2 : q === 'medium' ? 1.5 : 1);
    this.renderer.setPixelRatio(dpr);
    this.renderer.shadowMap.enabled = q !== 'low';
    this.sun.castShadow = q !== 'low';
    const size = q === 'high' ? 2048 : 1024;
    this.sun.shadow.mapSize.set(size, size);
    if (this.sun.shadow.map) {
      this.sun.shadow.map.dispose();
      (this.sun.shadow as unknown as { map: null }).map = null;
    }
    this.composer?.dispose();
    this.composer = null;
    this.bloom = null;
    this.tilt = null;
    if (q === 'low') {
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.0;
    } else {
      this.renderer.toneMapping = THREE.NoToneMapping;
      const composer = new EffectComposer(this.renderer, { frameBufferType: THREE.HalfFloatType, multisampling: q === 'high' ? 4 : 0 });
      composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new BloomEffect({ luminanceThreshold: 1.0, luminanceSmoothing: 0.25, intensity: 1.15, mipmapBlur: true, radius: 0.72 });
      const effects: import('postprocessing').Effect[] = [this.bloom];
      if (q === 'high') {
        this.tilt = new TiltShiftEffect({ offset: 0.04, rotation: 0, focusArea: 0.62, feather: 0.32, kernelSize: KernelSize.SMALL });
        effects.push(this.tilt);
      }
      effects.push(new VignetteEffect({ darkness: 0.42, offset: 0.32 }));
      effects.push(new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }));
      if (q !== 'high') effects.push(new SMAAEffect());
      composer.addPass(new EffectPass(this.camera, ...effects));
      this.composer = composer;
    }
    this.resize();
  }

  resize(): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h);
    this.camera.aspect = w / h;
    // fit board width and depth
    const vf = THREE.MathUtils.degToRad(this.camera.fov);
    const t = Math.tan(vf / 2);
    const needW = (W + 1.2) / (2 * t * this.camera.aspect);
    const needD = ((H + 1) * Math.sin(this.pitch) * 0.98) / (2 * t);
    this.baseDist = Math.max(needW, needD) * 1.02;
    this.camera.updateProjectionMatrix();
  }

  shake(amount: number): void {
    if (this.reduceShake) amount *= 0.25;
    this.shakeAmp = Math.min(0.6, this.shakeAmp + amount);
  }

  /** Frame a board-space rect (tile coords). Smoothly applied in update() unless the player moved the camera. */
  frame(minX: number, maxX: number, minY: number, maxY: number): void {
    const w = maxX - minX + 3.2, d = maxY - minY + 3.6;
    this.autoZoom = THREE.MathUtils.clamp(Math.max(w / (W + 1.2), d / (H + 1)), 0.5, 1);
    const cx = (minX + maxX) / 2 - W / 2, cz = (minY + maxY) / 2 - H / 2 + 0.4;
    this.autoTarget.set(cx, 0, cz);
  }

  manual(): void {
    this.manualT = 6;
  }

  clampTarget(): void {
    const slack = (1 - this.zoom) * 1.0;
    const mx = Math.max(0, slack * 7.5);
    const mz = Math.max(0, slack * 11);
    this.target.x = THREE.MathUtils.clamp(this.target.x, -mx, mx);
    this.target.z = THREE.MathUtils.clamp(this.target.z, 0.6 - mz, 0.6 + mz);
  }

  update(dt: number, time: number): void {
    this.skyMat.uniforms.uTime.value = time;
    this.stormK += (this.stormTarget - this.stormK) * Math.min(1, dt * 0.8);
    this.skyMat.uniforms.uStormK.value = this.stormK;
    this.hemi.intensity = 1.25 * (1 - this.stormK * 0.35);
    this.sun.intensity = 2.4 * (1 - this.stormK * 0.3);
    for (const f of this.floaters.children) {
      if (f.userData.bob !== undefined) f.position.y += Math.sin(time * 0.4 + f.userData.bob) * 0.003;
      if (f.userData.drift) {
        f.position.x += f.userData.drift * dt;
        if (f.position.x > 40) f.position.x = -40;
      }
    }
    // camera
    if (this.manualT > 0) this.manualT -= dt;
    else {
      const k = Math.min(1, dt * 1.6);
      this.zoom += (this.autoZoom - this.zoom) * k;
      this.target.lerp(this.autoTarget, k);
    }
    const dist = this.baseDist * this.zoom;
    const tgt = this.target.clone();
    let d = dist;
    if (this.cinematic > 0) {
      tgt.lerp(this.cinematicTarget, this.cinematic);
      d = THREE.MathUtils.lerp(dist, dist * 0.55, this.cinematic);
    }
    this.camera.position.set(tgt.x, tgt.y + Math.sin(this.pitch) * d, tgt.z + Math.cos(this.pitch) * d);
    if (this.shakeAmp > 0.001) {
      this.shakeT += dt * 60;
      const a = this.shakeAmp;
      this.camera.position.x += (Math.sin(this.shakeT * 1.7) + Math.sin(this.shakeT * 3.1)) * a * 0.15;
      this.camera.position.y += Math.sin(this.shakeT * 2.3) * a * 0.12;
      this.camera.position.z += Math.cos(this.shakeT * 1.9) * a * 0.1;
      this.shakeAmp *= Math.pow(0.02, dt);
    }
    this.camera.lookAt(tgt);
  }

  render(): void {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  /** Screen point → board tile coords (float). */
  pickGround(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((clientY - rect.top) / rect.height) * 2 + 1;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(nx, ny), this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    return { x: hit.x + W / 2, y: hit.z + H / 2 };
  }

  project(x: number, y: number, z: number): { x: number; y: number; visible: boolean } {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    const rect = this.canvas.getBoundingClientRect();
    return { x: ((v.x + 1) / 2) * rect.width, y: ((1 - v.y) / 2) * rect.height, visible: v.z < 1 };
  }
}

export function mulberry(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    let t = (s = (s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** sim tile-space → world */
export function wx(x: number): number {
  return x - W / 2;
}
export function wz(y: number): number {
  return y - H / 2;
}
