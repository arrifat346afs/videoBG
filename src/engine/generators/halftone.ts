// Generator 13: Halftone / dot matrix scanline glitch.
import { generatePalette } from '../palettes.ts';
import type { Generator, Params, Rng } from '../types.ts';

const FRAG = `
in vec2 v_uv;
out vec4 outColor;
uniform float u_scale;
uniform float u_dot;
uniform float u_glitch;
uniform vec3 u_dark;
uniform vec3 u_a;
uniform vec3 u_b;

vec3 dark, a, b;

float hash2(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
}

void main() {
  dark = u_dark;
  a = u_a;
  b = u_b;
  float t = u_time;

  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
  vec2 p = (v_uv - 0.5) * aspect * u_scale;

  vec2 g = floor(p * 16.0);
  vec2 f = fract(p * 16.0) - 0.5;
  float dist = length(f) * 2.0;

  vec2 cell = fract(g * 0.1 + t * 0.05 + u_seed * 0.01);
  float r = hash2(g + vec2(sin(t), cos(t)));
  float size = (1.0 - r) * (0.35 + 0.5 * u_dot);

  float dotVal = 1.0 - smoothstep(0.0, size, dist);
  float scan = 1.0 - 0.4 * sin(g.y * 0.5 + t * 3.0);
  float noise = (hash2(g + vec2(sin(t), cos(t))) - 0.5) * 0.02 * u_glitch;

  float v = smoothstep(0.1, 0.9, dotVal * scan + noise);
  float m1 = smoothstep(0.15, 0.55, v);
  float m2 = smoothstep(0.45, 0.85, v);
  vec3 col = mix(dark, a, m1);
  col = mix(col, b, m2);
  col += (vec3(noise) + 0.5) * u_glitch * 0.3;
  col = pow(col, vec3(1.0 / 2.2));
  outColor = vec4(col, 1.0);
}
`;

function rnd(v: number): number {
  return Math.round(v * 100) / 100;
}

export const halftone: Generator = {
  id: 'halftone',
  name: 'Halftone Glitch',
  fragmentShader: FRAG,
  paramSchema: [
    { kind: 'number', key: 'scale', label: 'Scale', min: 1.0, max: 4.0, step: 0.05, defaultValue: 2.0 },
    { kind: 'number', key: 'dot', label: 'Dot size', min: 0.3, max: 1.0, step: 0.05, defaultValue: 0.6 },
    { kind: 'number', key: 'glitch', label: 'Glitch', min: 0, max: 3.0, step: 0.1, defaultValue: 0.5 },
    { kind: 'color', key: 'dark', label: 'Dark', defaultValue: '#0b1026' },
    { kind: 'color', key: 'a', label: 'A', defaultValue: '#1b2a6b' },
    { kind: 'color', key: 'b', label: 'B', defaultValue: '#3a86ff' },
  ],
  defaultParams: {
    scale: 2.0,
    dot: 0.6,
    glitch: 0.5,
    dark: '#0b1026',
    a: '#1b2a6b',
    b: '#3a86ff',
  },
  randomize(rng: Rng): Params {
    const pal = generatePalette(rng);
    const c = pal.colors;
    return {
      scale: rnd(rng.range(1.4, 2.8)),
      dot: rnd(rng.range(0.4, 0.8)),
      glitch: rnd(rng.range(0.2, 1.5)),
      dark: c[0] ?? '#0b1026',
      a: c[1] ?? '#1b2a6b',
      b: c[2] ?? '#3a86ff',
    };
  },
};
