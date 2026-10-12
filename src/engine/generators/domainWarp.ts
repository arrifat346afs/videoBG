// Generator 01: domain-warped fBm — liquid marble / smoke / ink.
// Original implementation; standard value-noise + fBm techniques.

import { generatePalette } from '../palettes.ts';
import type { Generator, Params, Rng } from '../types.ts';

const FRAG = `
in vec2 v_uv;
out vec4 outColor;

uniform float u_scale;
uniform float u_warp;
uniform float u_swirl;
uniform float u_octaves;
uniform float u_contrast;
uniform vec3 u_colorDark;
uniform vec3 u_colorA;
uniform vec3 u_colorB;
uniform vec3 u_colorC;
uniform int u_marble;

const float TAU = 6.28318530718;

vec2 dwHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

float dwNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = dot(dwHash(i), vec2(1.0, 0.0));
  float b = dot(dwHash(i + vec2(1.0, 0.0)), vec2(1.0, 0.0));
  float c = dot(dwHash(i + vec2(0.0, 1.0)), vec2(1.0, 0.0));
  float d = dot(dwHash(i + vec2(1.0, 1.0)), vec2(1.0, 0.0));
  // Value noise via smooth interpolation of hashed gradients (cheap).
  float va = fract(a * 7.13) * 2.0 - 1.0;
  float vb = fract(b * 7.13) * 2.0 - 1.0;
  float vc = fract(c * 7.13) * 2.0 - 1.0;
  float vd = fract(d * 7.13) * 2.0 - 1.0;
  float x1 = mix(va, vb, u.x);
  float x2 = mix(vc, vd, u.x);
  return mix(x1, x2, u.y) * 0.5 + 0.5;
}

float dwFbm(vec2 p, float oct) {
  float v = 0.0;
  float a = 0.5;
  int n = int(oct + 0.5);
  for (int i = 0; i < 6; i++) {
    if (i >= n) break;
    v += a * dwNoise(p);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
  vec2 p = (v_uv - 0.5) * aspect * u_scale;
  // Deterministic seed offset.
  p += (u_seed - 0.5) * 9.0;

  // Seamless flow vector: circle in phase + 2nd harmonic, integer cycles.
  float a1 = TAU * u_phase;
  float a2 = TAU * u_phase * 2.0;
  vec2 flow = vec2(cos(a1) + 0.35 * cos(a2), sin(a1) + 0.35 * sin(a2));
  flow *= 0.45 * (0.4 + u_swirl);

  // Slow rotation of the domain, also loop-safe.
  float rot = 0.35 * sin(a1) * u_swirl;
  float cr = cos(rot);
  float sr = sin(rot);
  p = mat2(cr, -sr, sr, cr) * p;

  vec2 q = vec2(
    dwFbm(p + vec2(0.0, 0.0) + flow * 0.6, u_octaves),
    dwFbm(p + vec2(5.2, 1.3) - flow * 0.6, u_octaves)
  );
  vec2 r = vec2(
    dwFbm(p + u_warp * q + vec2(1.7, 9.2) + flow, u_octaves),
    dwFbm(p + u_warp * q + vec2(8.3, 2.8) - flow, u_octaves)
  );
  float f = dwFbm(p + u_warp * r, u_octaves);

  // Vein sharpening for marble mode.
  if (u_marble == 1) {
    f = abs(sin((f + r.x * 0.6) * 7.0));
    f = pow(1.0 - f, 1.5);
  }

  f = clamp((f - 0.5) * u_contrast + 0.5, 0.0, 1.0);
  float m1 = smoothstep(0.15, 0.55, f);
  float m2 = smoothstep(0.45, 0.85, f);
  vec3 col = mix(u_colorDark, u_colorA, m1);
  col = mix(col, u_colorB, m2);
  col = mix(col, u_colorC, smoothstep(0.7, 0.98, f) * 0.85);

  // Subtle loop-safe shimmer.
  col *= 0.96 + 0.08 * sin(a1 + f * 9.0);
  outColor = vec4(col, 1.0);
}
`;

export const domainWarp: Generator = {
  id: 'domain-warp',
  name: 'Liquid Marble',
  fragmentShader: FRAG,
  paramSchema: [
    { kind: 'number', key: 'scale', label: 'Scale', min: 0.8, max: 4.5, step: 0.05, defaultValue: 2.2 },
    { kind: 'number', key: 'warp', label: 'Warp', min: 0, max: 2.5, step: 0.05, defaultValue: 1.1 },
    { kind: 'number', key: 'swirl', label: 'Swirl', min: 0, max: 2, step: 0.05, defaultValue: 0.8 },
    { kind: 'number', key: 'octaves', label: 'Octaves', min: 3, max: 6, step: 1, defaultValue: 4 },
    { kind: 'number', key: 'contrast', label: 'Contrast', min: 0.5, max: 1.8, step: 0.05, defaultValue: 1.05 },
    { kind: 'color', key: 'colorDark', label: 'Dark', defaultValue: '#0b1026' },
    { kind: 'color', key: 'colorA', label: 'Color A', defaultValue: '#1b2a6b' },
    { kind: 'color', key: 'colorB', label: 'Color B', defaultValue: '#3a86ff' },
    { kind: 'color', key: 'colorC', label: 'Color C', defaultValue: '#83c5be' },
    { kind: 'boolean', key: 'marble', label: 'Marble veins', defaultValue: false },
  ],
  defaultParams: {
    scale: 2.2,
    warp: 1.1,
    swirl: 0.8,
    octaves: 4,
    contrast: 1.05,
    colorDark: '#0b1026',
    colorA: '#1b2a6b',
    colorB: '#3a86ff',
    colorC: '#83c5be',
    marble: false,
  },
  randomize(rng: Rng): Params {
    const pal = generatePalette(rng);
    const c = pal.colors;
    return {
      scale: round2(rng.range(1.4, 3.6)),
      warp: round2(rng.range(0.6, 1.9)),
      swirl: round2(rng.range(0.3, 1.4)),
      octaves: rng.int(3, 5),
      contrast: round2(rng.range(0.85, 1.35)),
      colorDark: c[0] ?? '#0b1026',
      colorA: c[1] ?? '#1b2a6b',
      colorB: c[2] ?? '#3a86ff',
      colorC: c[4] ?? '#83c5be',
      marble: rng.next() < 0.35,
    };
  },
};

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
