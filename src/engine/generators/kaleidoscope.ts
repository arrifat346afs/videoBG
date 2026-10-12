// Generator 08: kaleidoscope / mandala — polar-coordinate symmetry.
import { generatePalette } from '../palettes.ts';
import type { Generator, Params, Rng } from '../types.ts';

const FRAG = `
in vec2 v_uv;
out vec4 outColor;
uniform float u_scale;
uniform float u_symmetry;
uniform float u_spread;
uniform vec3 u_dark;
uniform vec3 u_a;
uniform vec3 u_b;

vec3 dark, a, b;

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
  float t = u_time * 0.7;

  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
  vec2 p = (v_uv - 0.5) * aspect * u_scale;
  float s = u_resolution.x / u_resolution.y;
  vec2 q = p;

  // Polar coordinate mapping for the mandala.
  float r = length(q);
  float ang = atan(q.y, q.x);
  float sym = u_symmetry + 1.0;
  float k = floor(ang / (3.14159265359 / sym));
  ang = mod(ang, 3.14159265359 / sym);
  float sgn = step(0.0, ang - 3.14159265359 / (2.0 * sym));
  ang = abs(ang - 3.14159265359 / sym);

  float aT = t * 0.5 + k * 0.2;
  vec2 m = vec2(cos(aT) * 0.3 + cos(aT * 0.5) * 0.2,
                sin(aT) * 0.3 + sin(aT * 0.5) * 0.2);
  vec2 base = q * u_spread * 0.4 + m * r * 0.02 + vec2(sin(t), cos(t)) * r * 0.03;
  float f = fbm(base * 2.2 + vec2(cos(aT), sin(aT)) * r * 0.3);

  float m1 = smoothstep(0.15, 0.55, f);
  float m2 = smoothstep(0.45, 0.85, f);
  vec3 col = mix(dark, a, m1);
  col = mix(col, b, m2);
  float rim = pow(1.0 - smoothstep(0.0, 1.0, r * 0.35), 2.0);
  col += b * pow(f, 2.0) * 0.6 * (0.6 + 0.4 * sin(t + r));

  col = pow(col, vec3(1.0 / 2.2));
  outColor = vec4(col, 1.0);
}
`;

function rnd(v: number): number {
  return Math.round(v * 100) / 100;
}

export const kaleidoscope: Generator = {
  id: 'kaleidoscope',
  name: 'Kaleidoscope',
  fragmentShader: FRAG,
  paramSchema: [
    { kind: 'number', key: 'scale', label: 'Scale', min: 1.0, max: 4.0, step: 0.05, defaultValue: 2.0 },
    { kind: 'number', key: 'symmetry', label: 'Symmetry', min: 3, max: 24, step: 1, defaultValue: 8 },
    { kind: 'number', key: 'spread', label: 'Spread', min: 0.5, max: 3.0, step: 0.05, defaultValue: 1.4 },
    { kind: 'color', key: 'dark', label: 'Dark', defaultValue: '#0b1026' },
    { kind: 'color', key: 'a', label: 'A', defaultValue: '#1b2a6b' },
    { kind: 'color', key: 'b', label: 'B', defaultValue: '#3a86ff' },
  ],
  defaultParams: {
    scale: 2.0,
    symmetry: 8,
    spread: 1.4,
    dark: '#0b1026',
    a: '#1b2a6b',
    b: '#3a86ff',
  },
  randomize(rng: Rng): Params {
    const pal = generatePalette(rng, rng.next() < 0.5 ? 'triadic' : 'analogous');
    const c = pal.colors;
    return {
      scale: rnd(rng.range(1.4, 2.8)),
      symmetry: rng.int(5, 16),
      spread: rnd(rng.range(1.0, 2.2)),
      dark: c[0] ?? '#0b1026',
      a: c[1] ?? '#1b2a6b',
      b: c[2] ?? '#3a86ff',
    };
  },
};
