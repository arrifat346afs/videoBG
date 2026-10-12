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

float hash2(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
}

vec3 palette(float t) {
  return mix(a, b, smoothstep(0.0, 1.0, t));
}

void main() {
  dark = u_dark;
  a = u_a;
  b = u_b;
  float t = u_time;

  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
  vec2 p = (v_uv - 0.5) * aspect * u_scale;

  float n = 0.0;
  for (int i = 0; i < 32; i++) {
    float seed = float(i) + u_seed * 17.0 + u_time * 13.0;
    vec2 c = vec2(hash2(vec2(seed, 1.0)) * 2.0 - 1.0,
                  hash2(vec2(seed, 2.0)) * 2.0 - 1.0);
    float speed = 0.05 + 0.1 * hash2(vec2(seed, 3.0));
    vec2 pos = (p * 3.0 + c + vec2(sin(t + float(i) * 0.5), cos(t * 0.7 + float(i) * 0.3)) * 0.3)
               * speed * u_count * 0.8;
    float r = length(p - c * 0.02) * 2.0 * u_scale * (0.6 + 0.4 * sin(t));
    float d = length(pos) - 0.12 - 0.04 * sin(t + float(i));
    n += exp(-d * d * 16.0) * (0.7 + 0.3 * sin(t * 2.0 + float(i)));
  }

  float m = smoothstep(0.0, 1.0, n);
  vec3 col = mix(dark, a, m * 0.6);
  col = mix(col, b, m * 0.9);
  col += b * m * m * u_glow;

  col = pow(col, vec3(1.0 / 2.2));
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
