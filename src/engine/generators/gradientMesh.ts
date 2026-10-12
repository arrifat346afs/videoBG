// Generator 02: animated gradient mesh — soft blobs, "Apple/Stripe style".
import { generatePalette, PRESET_PALETTES } from '../palettes.ts';
import type { Generator, Params, Rng } from '../types.ts';

const FRAG = `
in vec2 v_uv;
out vec4 outColor;
uniform float u_scale;
uniform float u_softness;
uniform vec3 u_dark;
uniform vec3 u_a;
uniform vec3 u_b;
uniform vec3 u_c;

vec3 dark, a, b, c;

float hash2(vec2 p) {
  return fract(sin(dot(p, vec2(7.13, 1.13))) * 521.13 + u_seed * 37.3);
}

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
  float t = u_time;

  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
  vec2 p = (v_uv - 0.5) * aspect * u_scale;

  vec2 c1 = vec2(0.6, 0.4) + 0.22 * vec2(cos(t * 0.29), sin(t * 0.41))
    + fbm(p * 0.15 + t * 0.06);
  vec2 c2 = vec2(0.3, 0.7) + 0.22 * vec2(sin(t * 0.33), cos(t * 0.37))
    + fbm(p * 0.13 - t * 0.05);
  vec2 c3 = vec2(0.75, 0.25) + 0.18 * vec2(cos(t * 0.22), sin(t * 0.39))
    + fbm(p * 0.11 + t * 0.04);

  vec2 q = vec2(
    fbm(p + 1.2 * vec2(c1.x * sin(t), c1.y * cos(t))),
    fbm(p - 0.9 * vec2(cos(t), -sin(t)) + 0.3 * vec2(c2.x, c2.y))
  );
  float f = fbm(p + 0.7 * q + 0.2 * sin(t) + u_seed * 3.0);

  float m = smoothstep(0.3, 0.85, f);
  vec3 col = mix(dark, a, m);
  col = mix(col, b, smoothstep(0.1, 0.6, f) * 0.8);
  col = mix(col, c, smoothstep(0.5, 0.95, f) * 0.9);

  float edge = pow(1.0 - abs(2.0 * m - 1.0), u_softness);
  col += 0.25 * edge * (c - a) * 0.6;

  col = pow(col, vec3(1.0 / 2.2));
  outColor = vec4(col, 1.0);
}
`;

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export const gradientMesh: Generator = {
  id: 'gradient-mesh',
  name: 'Soft Gradient Mesh',
  fragmentShader: FRAG,
  paramSchema: [
    { kind: 'number', key: 'scale', label: 'Scale', min: 1.2, max: 4.0, step: 0.1, defaultValue: 2.0 },
    { kind: 'number', key: 'softness', label: 'Glow softness', min: 1.5, max: 5.0, step: 0.1, defaultValue: 2.8 },
    { kind: 'color', key: 'dark', label: 'Dark', defaultValue: '#0b1026' },
    { kind: 'color', key: 'a', label: 'A', defaultValue: '#1b2a6b' },
    { kind: 'color', key: 'b', label: 'B', defaultValue: '#3a86ff' },
    { kind: 'color', key: 'c', label: 'C', defaultValue: '#83c5be' },
  ],
  defaultParams: {
    scale: 2.0,
    softness: 2.8,
    dark: '#0b1026',
    a: '#1b2a6b',
    b: '#3a86ff',
    c: '#83c5be',
  },
  randomize(rng: Rng): Params {
    const pal = rng.next() < 0.5 ? rng.pick(PRESET_PALETTES) : generatePalette(rng);
    const c = pal.colors;
    return {
      scale: round2(rng.range(1.6, 3.0)),
      softness: round2(rng.range(2.0, 4.2)),
      dark: c[0] ?? '#0b1026',
      a: c[1] ?? '#1b2a6b',
      b: c[2] ?? '#3a86ff',
      c: c[4] ?? '#edf2f4',
    };
  },
};
