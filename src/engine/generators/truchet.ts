// Generator 09: Truchet tiles / geometric grids that morph.
import { generatePalette } from '../palettes.ts';
import type { Generator, Params, Rng } from '../types.ts';

const FRAG = `
in vec2 v_uv;
out vec4 outColor;
uniform float u_scale;
uniform float u_round;
uniform vec3 u_dark;
uniform vec3 u_a;
uniform vec3 u_b;

vec3 dark, a, b;

const float TAU = 6.28318530718;

// a1 is the integer-cycle phase angle; off is a constant per-call offset.
float truchet(vec2 p, float a1, float off) {
  float tt = a1 + off;
  vec2 g = floor(p);
  vec2 f = fract(p);
  float s = fract(g.x * 0.31 + g.y * 0.53 + 0.35 * sin(tt) + u_seed);
  float h = fract(g.y * 0.5 + g.x * 0.41 + 0.30 * cos(tt));
  float edge = 0.18 + 0.08 * sin(tt);
  float d = 0.0;
  if (s < 0.5) {
    d = min(length(vec2(f.x, 1.0 - f.y)), length(vec2(1.0 - f.x, f.y)));
  } else {
    d = min(length(f), length(vec2(1.0 - f.x, 1.0 - f.y)));
  }
  float line = smoothstep(edge, 0.0, d);
  line *= 1.0 - abs(cos(3.14159265359 * f.x) * cos(3.14159265359 * f.y) * 2.0);
  return line + h * 0.02 * sin(3.0 * a1 + off);
}

void main() {
  dark = u_dark;
  a = u_a;
  b = u_b;

  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
  vec2 p = (v_uv - 0.5) * aspect * u_scale;

  float a1 = TAU * u_phase;

  vec2 g = floor(p * 3.0 + 0.5);
  vec2 f = fract(p * 3.0 + 0.5);

  float t1 = truchet(p * 3.0, a1, 0.0);
  float t2 = truchet(vec2(fract(g.x + 0.5), g.y) * 3.0 - f, a1, 0.0);
  float t3 = truchet(p * 3.0 + vec2(1.0, -1.0), a1, 0.5);
  float t4 = truchet(p * 3.0 + vec2(-1.0, 1.0), a1, 1.0);

  float grid = smoothstep(0.0, 0.5, max(max(t1, t2), max(t3, t4)));
  float d0 = length(f);
  float d1 = length(vec2(1.0 - f.x, f.y));
  float d2 = length(vec2(f.x, 1.0 - f.y));
  float d3 = length(vec2(1.0 - f.x, 1.0 - f.y));
  float corners = smoothstep(0.3, 0.0, min(min(d0, d1), min(d2, d3)));

  float m1 = smoothstep(0.15, 0.55, grid + corners * 0.4);
  float m2 = smoothstep(0.45, 0.85, grid + corners * 0.5);
  vec3 col = mix(dark, a, m1);
  col = mix(col, b, m2);
  float rim = pow(1.0 - smoothstep(0.0, 1.0, corners), u_round) * 0.5;
  col += b * rim * 0.4;

  outColor = vec4(col, 1.0);
}
`;

function rnd(v: number): number {
  return Math.round(v * 100) / 100;
}

export const truchet: Generator = {
  id: 'truchet',
  name: 'Truchet Tiles',
  fragmentShader: FRAG,
  paramSchema: [
    { kind: 'number', key: 'scale', label: 'Scale', min: 1.0, max: 5.0, step: 0.05, defaultValue: 2.4 },
    { kind: 'number', key: 'round', label: 'Corner round', min: 1.0, max: 6.0, step: 0.1, defaultValue: 3.0 },
    { kind: 'color', key: 'dark', label: 'Dark', defaultValue: '#0b1026' },
    { kind: 'color', key: 'a', label: 'A', defaultValue: '#1b2a6b' },
    { kind: 'color', key: 'b', label: 'B', defaultValue: '#3a86ff' },
  ],
  defaultParams: {
    scale: 2.4,
    round: 3.0,
    dark: '#0b1026',
    a: '#1b2a6b',
    b: '#3a86ff',
  },
  randomize(rng: Rng): Params {
    const pal = generatePalette(rng);
    const c = pal.colors;
    return {
      scale: rnd(rng.range(1.8, 3.6)),
      round: rnd(rng.range(2.0, 4.5)),
      dark: c[0] ?? '#0b1026',
      a: c[1] ?? '#1b2a6b',
      b: c[2] ?? '#3a86ff',
    };
  },
};
