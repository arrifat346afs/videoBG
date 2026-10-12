// Generator 04: flow field / curl-noise streamlines with glowing trails.
import { generatePalette } from '../palettes.ts';
import type { Generator, Params, Rng } from '../types.ts';

const FRAG = `
in vec2 v_uv;
out vec4 outColor;
uniform float u_scale;
uniform float u_flow;
uniform float u_thickness;
uniform vec3 u_dark;
uniform vec3 u_a;
uniform vec3 u_b;

vec3 dark, a, b;

float hash2(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
}

vec2 curl(vec2 p, float t) {
  float v1 = gnoise(vec3(p * 1.7 + vec2(0.0, t * 0.3), 1.0));
  float v2 = gnoise(vec3(p * 1.7 + vec2(1.0, t * 0.3), 2.0));
  return normalize(vec2(v1 - v2, v2 - hash2(p)));
}

void main() {
  dark = u_dark;
  a = u_a;
  b = u_b;
  float t = u_time;

  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
  vec2 p = (v_uv - 0.5) * aspect * u_scale;

  vec2 dir = curl(p * u_scale * 0.3, t * 0.25);
  float accum = 0.0;
  float d = 0.0;
  vec2 q = p;
  for (int i = 0; i < 64; i++) {
    dir = curl(q * u_scale * 0.3, t * 0.25 + float(i) * 0.5);
    q += dir * (0.02 + 0.01 * sin(t));
    accum += gnoise(q * 2.5 + vec2(sin(t), cos(t))) * 0.35;
    d += length(dir);
  }

  accum = smoothstep(0.0, 0.4, accum);
  d *= smoothstep(0.0, 0.9, accum);
  float trail = 0.5 + 0.5 * sin(d * 12.0 + t * 2.0);
  vec3 col = mix(dark, a, trail);
  col = mix(col, b, accum * 0.9);
  float glow = pow(accum, u_thickness) * 2.5;
  col += b * pow(accum, u_thickness) * 1.5;

  col = pow(col, vec3(1.0 / 2.2));
  outColor = vec4(col, 1.0);
}
`;

function rnd(v: number): number {
  return Math.round(v * 100) / 100;
}

export const flowField: Generator = {
  id: 'flow-field',
  name: 'Curl Streamlines',
  fragmentShader: FRAG,
  paramSchema: [
    { kind: 'number', key: 'scale', label: 'Scale', min: 1.0, max: 3.5, step: 0.05, defaultValue: 1.8 },
    { kind: 'number', key: 'flow', label: 'Flow intensity', min: 0.5, max: 3.0, step: 0.05, defaultValue: 1.4 },
    { kind: 'number', key: 'thickness', label: 'Glow thickness', min: 0.5, max: 3.0, step: 0.05, defaultValue: 1.2 },
    { kind: 'color', key: 'dark', label: 'Dark', defaultValue: '#0b1026' },
    { kind: 'color', key: 'a', label: 'A', defaultValue: '#1b2a6b' },
    { kind: 'color', key: 'b', label: 'B', defaultValue: '#3a86ff' },
  ],
  defaultParams: {
    scale: 1.8,
    flow: 1.4,
    thickness: 1.2,
    dark: '#0b1026',
    a: '#1b2a6b',
    b: '#3a86ff',
  },
  randomize(rng: Rng): Params {
    const pal = generatePalette(rng, rng.next() < 0.5 ? 'triadic' : 'analogous');
    const c = pal.colors;
    return {
      scale: rnd(rng.range(1.3, 2.6)),
      flow: rnd(rng.range(0.9, 2.2)),
      thickness: rnd(rng.range(0.8, 2.0)),
      dark: c[0] ?? '#0b1026',
      a: c[1] ?? '#1b2a6b',
      b: c[2] ?? '#3a86ff',
    };
  },
};
