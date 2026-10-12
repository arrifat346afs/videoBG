// Generator 07: plasma / moiré / wave interference.
import { generatePalette } from '../palettes.ts';
import type { Generator, Params, Rng } from '../types.ts';

const FRAG = `
in vec2 v_uv;
out vec4 outColor;
uniform float u_scale;
uniform float u_complexity;
uniform float u_phaseOffset;
uniform vec3 u_dark;
uniform vec3 u_a;
uniform vec3 u_b;

vec3 dark, a, b;

float fbm(vec2 p, float oct) {
  float v = 0.0;
  float w = 0.5;
  for (int i = 0; i < 4; i++) {
    if (i >= int(oct + 0.5)) break;
    v += w * gnoise(p);
    p *= 2.0;
    w *= 0.5;
  }
  return v;
}

void main() {
  dark = u_dark;
  a = u_a;
  b = u_b;
  float t = u_time;

  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
  vec2 p = (v_uv - 0.5) * aspect * u_scale;

  float n1 = fbm(p * 1.2 + vec2(t * 0.15, t * 0.22), 2.0 + u_complexity * 0.5);
  float n2 = fbm(p * 1.2 - vec2(t * 0.18, t * 0.13), 2.0 + u_complexity * 0.5);
  float n3 = fbm(vec2(dot(p, vec2(0.6, 0.8)) * 2.5 + t * 0.25,
                      dot(p, vec2(-0.8, 0.6)) * 2.5 - t * 0.21),
                  2.0 + u_complexity * 0.5);

  float f = (n1 + n2) * 0.5 + sin(dot(p * 2.5 + vec2(t * 0.3, -t * 0.4), vec2(1.0, 0.5))
                                  + t * 0.2 + u_phaseOffset) * 0.5 * n3;
  f = smoothstep(-0.6, 0.9, f);

  float m1 = smoothstep(0.15, 0.55, f);
  float m2 = smoothstep(0.45, 0.85, f);
  vec3 col = mix(dark, a, m1);
  col = mix(col, b, m2);

  float edge = pow(1.0 - smoothstep(0.0, 1.0, f), 3.0);
  col += a * edge * 0.4;

  col = pow(col, vec3(1.0 / 2.2));
  outColor = vec4(col, 1.0);
}
`;

function rnd(v: number): number {
  return Math.round(v * 100) / 100;
}

export const plasma: Generator = {
  id: 'plasma',
  name: 'Plasma Interference',
  fragmentShader: FRAG,
  paramSchema: [
    { kind: 'number', key: 'scale', label: 'Scale', min: 1.0, max: 4.0, step: 0.05, defaultValue: 1.9 },
    { kind: 'number', key: 'complexity', label: 'Detail', min: 0, max: 2.5, step: 0.1, defaultValue: 0.8 },
    { kind: 'number', key: 'phaseOffset', label: 'Phase', min: 0, max: 6.28, step: 0.1, defaultValue: 1.5 },
    { kind: 'color', key: 'dark', label: 'Dark', defaultValue: '#0b1026' },
    { kind: 'color', key: 'a', label: 'A', defaultValue: '#1b2a6b' },
    { kind: 'color', key: 'b', label: 'B', defaultValue: '#3a86ff' },
  ],
  defaultParams: {
    scale: 1.9,
    complexity: 0.8,
    phaseOffset: 1.5,
    dark: '#0b1026',
    a: '#1b2a6b',
    b: '#3a86ff',
  },
  randomize(rng: Rng): Params {
    const pal = generatePalette(rng, rng.next() < 0.5 ? 'complementary' : 'triadic');
    const c = pal.colors;
    return {
      scale: rnd(rng.range(1.3, 3.0)),
      complexity: rnd(rng.range(0.3, 1.8)),
      phaseOffset: rnd(rng.range(0.2, 5.5)),
      dark: c[0] ?? '#0b1026',
      a: c[1] ?? '#1b2a6b',
      b: c[2] ?? '#3a86ff',
    };
  },
};
