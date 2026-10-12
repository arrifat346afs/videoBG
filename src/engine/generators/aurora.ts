// Generator 03: aurora / silk gradient waves — layered sine + noise ribbons.
import { generatePalette } from '../palettes.ts';
import type { Generator, Params, Rng } from '../types.ts';

const FRAG = `
in vec2 v_uv;
out vec4 outColor;
uniform float u_scale;
uniform float u_waves;
uniform float u_noise;
uniform vec3 u_dark;
uniform vec3 u_a;
uniform vec3 u_b;
uniform vec3 u_c;

vec3 dark, a, b, c;

float fbm(vec2 p, float oct) {
  float v = 0.0;
  float w = 0.5;
  int n = int(oct + 0.5);
  for (int i = 0; i < 6; i++) {
    if (i >= n) break;
    v += w * gnoise(p);
    p *= 2.0;
    w *= 0.5;
  }
  return v;
}

float ripple(vec2 p, vec2 c, float d) {
  return smoothstep(d + 0.15, d, abs(length(p - c)) - 0.15);
}

void main() {
  dark = u_dark;
  a = u_a;
  b = u_b;
  c = u_c;
  float t = u_time * 0.6;

  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
  vec2 p = (v_uv - 0.5) * aspect * u_scale;

  float n = fbm(p * 1.3, 2.0 + 0.5 * u_noise);
  float wave = 0.0;
  wave += 0.55 * sin(p.y * u_scale * 0.9 + sin(t) * 1.2 + p.x * 0.6 + u_seed);
  wave += 0.28 * sin(p.y * u_scale * 1.8 - cos(t) * 1.0 + p.x * 1.1 + u_seed * 2.0);
  wave += 0.12 * sin(p.y * u_scale * 3.4 + cos(t * 0.7) * 1.5 + p.x * 0.3 + u_seed * 3.0);

  float band = ripple(p, vec2(0.0, t * 0.25 + 0.5 + u_waves * sin(t * 0.5)),
                      0.18 + 0.12 * sin(t) * u_waves);

  float f = smoothstep(0.0, 1.0, wave * n * 1.8 + band * 1.5);
  vec3 col = mix(dark, a, smoothstep(0.2, 0.8, f));
  col = mix(col, b, smoothstep(0.4, 0.9, f) * 0.85);
  col = mix(col, c, smoothstep(0.6, 0.98, f) * 0.9);

  // subtle shimmer along bands
  float sh = pow(1.0 - smoothstep(0.0, 1.0, band), 4.0);
  col += sh * c * 0.35;

  col = pow(col, vec3(1.0 / 2.2));
  outColor = vec4(col, 1.0);
}
`;

function rnd(v: number): number {
  return Math.round(v * 100) / 100;
}

export const aurora: Generator = {
  id: 'aurora',
  name: 'Aurora Waves',
  fragmentShader: FRAG,
  paramSchema: [
    { kind: 'number', key: 'scale', label: 'Scale', min: 1.0, max: 3.5, step: 0.05, defaultValue: 1.8 },
    { kind: 'number', key: 'waves', label: 'Ribbon waves', min: 0, max: 2.5, step: 0.05, defaultValue: 1.2 },
    { kind: 'number', key: 'noise', label: 'Detail noise', min: 0, max: 2.5, step: 0.1, defaultValue: 1.0 },
    { kind: 'color', key: 'dark', label: 'Dark', defaultValue: '#0b1026' },
    { kind: 'color', key: 'a', label: 'A', defaultValue: '#1b2a6b' },
    { kind: 'color', key: 'b', label: 'B', defaultValue: '#3a86ff' },
    { kind: 'color', key: 'c', label: 'C', defaultValue: '#83c5be' },
  ],
  defaultParams: {
    scale: 1.8,
    waves: 1.2,
    noise: 1.0,
    dark: '#0b1026',
    a: '#1b2a6b',
    b: '#3a86ff',
    c: '#83c5be',
  },
  randomize(rng: Rng): Params {
    const pal = generatePalette(rng, rng.next() < 0.6 ? 'analogous' : 'random');
    const c = pal.colors;
    return {
      scale: rnd(rng.range(1.3, 2.8)),
      waves: rnd(rng.range(0.6, 1.8)),
      noise: rnd(rng.range(0.4, 1.8)),
      dark: c[0] ?? '#0b1026',
      a: c[1] ?? '#1b2a6b',
      b: c[2] ?? '#3a86ff',
      c: c[3] ?? '#83c5be',
    };
  },
};
