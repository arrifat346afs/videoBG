// Generator 05: metaballs / lava lamp via smooth-min blending.
import { generatePalette } from '../palettes.ts';
import type { Generator, Params, Rng } from '../types.ts';

const FRAG = `
in vec2 v_uv;
out vec4 outColor;
uniform float u_scale;
uniform float u_radius;
uniform float u_blend;
uniform vec3 u_dark;
uniform vec3 u_a;
uniform vec3 u_b;

vec3 dark, a, b;

const float TAU = 6.28318530718;

void main() {
  dark = u_dark;
  a = u_a;
  b = u_b;

  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
  vec2 p = (v_uv - 0.5) * aspect * u_scale;

  // Integer-cycle motion: phase -> unit circle.
  float a1 = TAU * u_phase;
  float a2 = 2.0 * a1;

  float k = u_blend * 0.7;
  float d = 99.0;
  for (int i = 0; i < 6; i++) {
    vec2 qi = vec2(float(i * 17), float(i * 31));
    float r = 0.15 + 0.06 * sin(qi.x + a1 + float(i) * 1.3);
    vec2 pos = 0.5 + 0.35 * vec2(cos(qi.x + a1), sin(qi.y + a2));
    float len = length((p - pos) * aspect) / u_radius;
    d = min(d, smin(len - r, 1.0, k));
  }

  float f = smoothstep(0.4, 0.0, d);
  vec3 col = mix(dark, a, smoothstep(0.0, 0.6, f));
  col = mix(col, b, smoothstep(0.3, 0.85, f) * 0.9);
  col = col * (0.9 + 0.1 * sin(a1 + f * 5.0));

  outColor = vec4(col, 1.0);
}
`;

function rnd(v: number): number {
  return Math.round(v * 100) / 100;
}

export const metaballs: Generator = {
  id: 'metaballs',
  name: 'Lava Lamp (Metaballs)',
  fragmentShader: FRAG,
  paramSchema: [
    { kind: 'number', key: 'scale', label: 'Scale', min: 1.0, max: 3.0, step: 0.05, defaultValue: 1.8 },
    { kind: 'number', key: 'radius', label: 'Radius', min: 0.5, max: 2.5, step: 0.05, defaultValue: 1.2 },
    { kind: 'number', key: 'blend', label: 'Blend', min: 0.1, max: 3.0, step: 0.05, defaultValue: 1.0 },
    { kind: 'color', key: 'dark', label: 'Dark', defaultValue: '#0b1026' },
    { kind: 'color', key: 'a', label: 'A', defaultValue: '#1b2a6b' },
    { kind: 'color', key: 'b', label: 'B', defaultValue: '#3a86ff' },
  ],
  defaultParams: {
    scale: 1.8,
    radius: 1.2,
    blend: 1.0,
    dark: '#0b1026',
    a: '#1b2a6b',
    b: '#3a86ff',
  },
  randomize(rng: Rng): Params {
    const pal = generatePalette(rng);
    const c = pal.colors;
    return {
      scale: rnd(rng.range(1.3, 2.4)),
      radius: rnd(rng.range(0.8, 1.8)),
      blend: rnd(rng.range(0.5, 2.0)),
      dark: c[0] ?? '#0b1026',
      a: c[1] ?? '#1b2a6b',
      b: c[2] ?? '#3a86ff',
    };
  },
};
