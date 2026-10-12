// Generator 10: topographic contour lines (iso-lines of animated noise).
import { generatePalette } from '../palettes.ts';
import type { Generator, Params, Rng } from '../types.ts';

const FRAG = `
in vec2 v_uv;
out vec4 outColor;
uniform float u_scale;
uniform float u_steps;
uniform float u_smooth;
uniform vec3 u_dark;
uniform vec3 u_a;
uniform vec3 u_b;
uniform vec3 u_c;

vec3 dark, a, b, c;

const float TAU = 6.28318530718;

float fbm(vec2 p) {
  float v = 0.0;
  float w = 0.5;
  for (int i = 0; i < 4; i++) {
    v += w * gnoise(p);
    p = mat2(1.4, 1.1, -1.1, 1.4) * p;
    w *= 0.5;
  }
  return v;
}

void main() {
  dark = u_dark;
  a = u_a;
  b = u_b;
  c = u_c;

  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
  vec2 p = (v_uv - 0.5) * aspect * u_scale;

  // Integer-cycle motion: phase -> unit circle.
  float a1 = TAU * u_phase;
  float ca = cos(a1);
  float sa = sin(a1);

  float f = fbm(p * 1.4 + vec2(ca, sa) * 1.5);
  f += 0.5 * fbm(p * 2.8 - vec2(sa, ca) * 1.5);

  // Contour lines at integer levels of f * steps. The fraction measures the
  // distance to the nearest line center (0 on a line, 1 midway between lines);
  // a product over discrete levels is identically zero and showed nothing.
  float lineDist = abs(fract(f * u_steps) - 0.5) * 2.0;
  float contour = 1.0 - smoothstep(0.0, clamp(u_smooth, 0.02, 0.9), lineDist);

  float m1 = smoothstep(0.2, 0.6, contour);
  float m2 = smoothstep(0.5, 0.9, contour);
  vec3 col = mix(dark, a, m1);
  col = mix(col, b, m2);
  col = mix(col, c, contour * 0.9);
  float glow = pow(contour, u_smooth * 2.0) * 0.6;
  col += c * glow * 0.5;

  outColor = vec4(col, 1.0);
}
`;

function rnd(v: number): number {
  return Math.round(v * 100) / 100;
}

export const topographic: Generator = {
  id: 'topographic',
  name: 'Topographic Contours',
  fragmentShader: FRAG,
  paramSchema: [
    { kind: 'number', key: 'scale', label: 'Scale', min: 1.0, max: 4.0, step: 0.05, defaultValue: 2.0 },
    { kind: 'number', key: 'steps', label: 'Contour lines', min: 2, max: 10, step: 1, defaultValue: 5 },
    { kind: 'number', key: 'smooth', label: 'Smoothness', min: 0.05, max: 0.5, step: 0.01, defaultValue: 0.18 },
    { kind: 'color', key: 'dark', label: 'Dark', defaultValue: '#0b1026' },
    { kind: 'color', key: 'a', label: 'A', defaultValue: '#1b2a6b' },
    { kind: 'color', key: 'b', label: 'B', defaultValue: '#3a86ff' },
    { kind: 'color', key: 'c', label: 'Highlight', defaultValue: '#83c5be' },
  ],
  defaultParams: {
    scale: 2.0,
    steps: 5,
    smooth: 0.18,
    dark: '#0b1026',
    a: '#1b2a6b',
    b: '#3a86ff',
    c: '#83c5be',
  },
  randomize(rng: Rng): Params {
    const pal = generatePalette(rng);
    const c = pal.colors;
    return {
      scale: rnd(rng.range(1.4, 3.0)),
      steps: rng.int(3, 7),
      smooth: rnd(rng.range(0.08, 0.3)),
      dark: c[0] ?? '#0b1026',
      a: c[1] ?? '#1b2a6b',
      b: c[2] ?? '#3a86ff',
      c: c[4] ?? '#83c5be',
    };
  },
};
