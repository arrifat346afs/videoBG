// Generator 12: GPU particles / starfield / bokeh.
import { generatePalette } from '../palettes.ts';
import type { Generator, Params, Rng } from '../types.ts';

const FRAG = `
in vec2 v_uv;
out vec4 outColor;
uniform float u_scale;
uniform float u_count;
uniform float u_glow;
uniform vec3 u_dark;
uniform vec3 u_a;
uniform vec3 u_b;

vec3 dark, a, b;

const float TAU = 6.28318530718;

float hash2(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
}

void main() {
  dark = u_dark;
  a = u_a;
  b = u_b;

  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
  vec2 p = (v_uv - 0.5) * aspect * u_scale;

  // Integer-cycle motion: phase -> unit circle. The per-particle seed is
  // static (no u_time term, which would re-randomize every frame).
  float a1 = TAU * u_phase;
  float a2 = 2.0 * a1;

  float n = 0.0;
  for (int i = 0; i < 32; i++) {
    float seed = float(i) + u_seed * 17.0;
    // Density control: show a fraction of the stars from u_count.
    float vis = hash2(vec2(seed, 5.0));
    if (vis > clamp(u_count * 0.7, 0.35, 0.98)) continue;

    vec2 c = (vec2(hash2(vec2(seed, 1.0)), hash2(vec2(seed, 2.0))) - 0.5) * 2.0;
    float ph = hash2(vec2(seed, 3.0)) * TAU;
    // Each star drifts on its own small circle so the field loops.
    vec2 off = vec2(cos(a1 + ph), sin(a1 + ph)) * 0.06;
    float d = length(p - (c + off));
    float sz = 0.022 + 0.030 * hash2(vec2(seed, 4.0));
    float tw = 0.5 + 0.5 * sin(a2 + ph * 5.0);
    n += exp(-(d * d) / (sz * sz)) * tw;
  }

  float m = smoothstep(0.0, 0.8, n);
  vec3 col = mix(dark, a, m * 0.45);
  col = mix(col, b, m * 0.9);
  col += b * m * m * u_glow;

  outColor = vec4(col, 1.0);
}
`;

function rnd(v: number): number {
  return Math.round(v * 100) / 100;
}

export const particles: Generator = {
  id: 'particles',
  name: 'Starfield',
  fragmentShader: FRAG,
  paramSchema: [
    { kind: 'number', key: 'scale', label: 'Scale', min: 1.0, max: 4.0, step: 0.05, defaultValue: 2.2 },
    { kind: 'number', key: 'count', label: 'Density', min: 0.5, max: 2.5, step: 0.05, defaultValue: 1.3 },
    { kind: 'number', key: 'glow', label: 'Bloom', min: 0.5, max: 4.0, step: 0.05, defaultValue: 1.8 },
    { kind: 'color', key: 'dark', label: 'Dark', defaultValue: '#0b1026' },
    { kind: 'color', key: 'a', label: 'A', defaultValue: '#1b2a6b' },
    { kind: 'color', key: 'b', label: 'B', defaultValue: '#3a86ff' },
  ],
  defaultParams: {
    scale: 2.2,
    count: 1.3,
    glow: 1.8,
    dark: '#0b1026',
    a: '#1b2a6b',
    b: '#3a86ff',
  },
  randomize(rng: Rng): Params {
    const pal = generatePalette(rng, rng.next() < 0.5 ? 'monochrome' : 'triadic');
    const c = pal.colors;
    return {
      scale: rnd(rng.range(1.6, 3.0)),
      count: rnd(rng.range(0.9, 1.9)),
      glow: rnd(rng.range(1.2, 3.0)),
      dark: c[0] ?? '#0b1026',
      a: c[1] ?? '#1b2a6b',
      b: c[2] ?? '#3a86ff',
    };
  },
};
