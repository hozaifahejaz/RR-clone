import * as THREE from 'three';

let gradientMap: THREE.DataTexture | null = null;
function toonGradient(): THREE.DataTexture {
  if (gradientMap) return gradientMap;
  const data = new Uint8Array([70, 70, 70, 255, 150, 150, 150, 255, 215, 215, 215, 255, 255, 255, 255, 255]);
  gradientMap = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  gradientMap.minFilter = THREE.NearestFilter;
  gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.generateMipmaps = false;
  gradientMap.needsUpdate = true;
  return gradientMap;
}

export const RIM = { color: new THREE.Color(0xbfd8ff), strength: { value: 0.55 } };

function addRim(mat: THREE.Material, flash = false): void {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uRimColor = { value: RIM.color };
    sh.uniforms.uRimStrength = RIM.strength;
    if (flash) {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aFlash;\nvarying float vFlash;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFlash = aFlash;');
    }
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\nuniform vec3 uRimColor;\nuniform float uRimStrength;\n${flash ? 'varying float vFlash;' : ''}`,
      )
      .replace(
        '#include <opaque_fragment>',
        `float rimF = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
        outgoingLight += uRimColor * pow(rimF, 3.0) * uRimStrength;
        ${flash ? 'outgoingLight = mix(outgoingLight, vec3(2.2), vFlash);' : ''}
        #include <opaque_fragment>`,
      );
  };
  mat.customProgramCacheKey = () => (flash ? 'rimflash' : 'rim');
}

/** Toon material that uses baked vertex colors. */
export function toonVC(opts: { flash?: boolean; transparent?: boolean; opacity?: number } = {}): THREE.MeshToonMaterial {
  const m = new THREE.MeshToonMaterial({
    vertexColors: true,
    gradientMap: toonGradient(),
    transparent: !!opts.transparent,
    opacity: opts.opacity ?? 1,
  });
  addRim(m, !!opts.flash);
  return m;
}

export function toon(color: number | THREE.Color): THREE.MeshToonMaterial {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient() });
  addRim(m);
  return m;
}

/** Unlit glowing material: colors above 1 feed the bloom pass. */
export function glowVC(intensity = 2.4): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  m.color.setScalar(intensity);
  return m;
}

export function glow(color: number, intensity = 2.4, opts: { transparent?: boolean; opacity?: number; additive?: boolean } = {}): THREE.MeshBasicMaterial {
  const c = new THREE.Color(color).multiplyScalar(intensity);
  return new THREE.MeshBasicMaterial({
    color: c,
    toneMapped: false,
    transparent: !!opts.transparent || !!opts.additive,
    opacity: opts.opacity ?? 1,
    blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: !opts.additive,
  });
}

/** Inverted-hull outline material. */
export function outlineMat(thickness = 0.035, color = 0x14112a): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uOutline = { value: thickness };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uOutline;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normalize(normal) * uOutline;');
  };
  m.customProgramCacheKey = () => 'outline' + thickness;
  return m;
}

export const CLASS_COLORS: Record<string, number> = {
  vanguard: 0xff8a3d,
  swift: 0x5cff9d,
  elemental: 0x7a8cff,
  utility: 0xffd45c,
};
export const CLASS_CSS: Record<string, string> = {
  vanguard: '#FF8A3D',
  swift: '#5CFF9D',
  elemental: '#7A8CFF',
  utility: '#FFD45C',
};
