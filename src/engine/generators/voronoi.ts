// Generator 06: animated Voronoi / cellular (cracked glass, stained glass).
import { generatePalette } from '../palettes.ts';
import type { Generator, Params, Rng } from '../types.ts';

const FRAG = `
in vec2 v_uv;
out vec4 outColor;
uniform float u_scale;
uniform float u_cells;
uniform float u_distort;
uniform float u_roughness;
uniform vec3 u_dark;
uniform vec3 u_a;
uniform vec3 u_b;

vec3 dark, a, b;

const float TAU = 6.28318530718;

float hash2(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
}

vec2 cellCenter(vec2 p, int c) {
  float t = hash2(p * vec2(0.5 + float(c), 1.0));
  return vec2(t, hash2(p * vec2(1.0 + float(c), 2.0)));
}

void main() {
  dark = u_dark;
  a = u_a;
  b = u_b;

  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
  vec2 p = (v_uv - 0.5) * aspect * u_scale;

  // Integer-cycle motion: phase -> unit circle.
  float a1 = TAU * u_phase;
  float a2 = 2.0 * a1;

  vec2 g = floor(p * u_scale * 0.7);
  vec2 f = fract(p * u_scale * 0.7);
  f = f * f * (3.0 - 2.0 * f);

  float d = 99.0;
  float ci = -1.0;
  for (int x = -2; x <= 2; x++) {
    for (int y = -2; y <= 2; y++) {
      vec2 q = vec2(float(x), float(y));
      vec2 c = cellCenter(g + q, int(mod(q.x * 3.0 + q.y * 7.0, 13.0)));
      vec2 o = u_distort * vec2(sin(c.x * 12.0 + a1), cos(c.y * 12.0 + a2));
      float len = length(q + o + f - c);
      if (len < d) {
        d = len;
        ci = float(q.x * 5.0 + q.y * 3.0);
      }
    }
  }

  float edge = 1.0 - smoothstep(0.0, 0.25, d) * u_roughness;
  float fcol = ci / 12.0;
  float hue = 0.6 + 0.25 * sin(fcol * 8.0 + a1);
  float l = 0.25 + 0.15 * sin(fcol * 6.0 + a2);
  vec3 col = vec3(hue, 0.5, l);
  col = mix(dark, col, smoothstep(0.2, 0.8, edge));
  col = mix(col, a, smoothstep(0.3, 0.9, edge) * 0.7);
  col = mix(col, b, smoothstep(0.5, 0.98, edge) * 0.85);

  outColor = vec4(col, 1.0);
}
`;

function rnd(v: number): number {
  return Math.round(v * 100) / 100;
}

export const voronoi: Generator = {
  id: 'voronoi',
  name: 'Cellular (Voronoi)',
  fragmentShader: FRAG,
  paramSchema: [
    { kind: 'number', key: 'scale', label: 'Scale', min: 1.0, max: 4.0, step: 0.05, defaultValue: 2.2 },
    { kind: 'number', key: 'cells', label: 'Cell size', min: 1.0, max: 4.0, step: 0.05, defaultValue: 2.4 },
    { kind: 'number', key: 'distort', label: 'Wobble', min: 0, max: 2.0, step: 0.05, defaultValue: 0.7 },
    { kind: 'number', key: 'roughness', label: 'Roughness', min: 0.2, max: 2.0, step: 0.05, defaultValue: 0.8 },
    { kind: 'color', key: 'dark', label: 'Dark', defaultValue: '#0b1026' },
    { kind: 'color', key: 'a', label: 'A', defaultValue: '#1b2a6b' },
    { kind: 'color', key: 'b', label: 'B', defaultValue: '#3a86ff' },
  ],
  defaultParams: {
    scale: 2.2,
    cells: 2.4,
    distort: 0.7,
    roughness: 0.8,
    dark: '#0b1026',
    a: '#1b2a6b',
    b: '#3a86ff',
  },
  randomize(rng: Rng): Params {
    const pal = generatePalette(rng, rng.next() < 0.5 ? 'monochrome' : 'triadic');
    const c = pal.colors;
    return {
      scale: rnd(rng.range(1.6, 3.2)),
      cells: rnd(rng.range(1.6, 3.4)),
      distort: rnd(rng.range(0.3, 1.4)),
      roughness: rnd(rng.range(0.4, 1.6)),
      dark: c[0] ?? '#0b1026',
      a: c[1] ?? '#1b2a6b',
      b: c[2] ?? '#3a86ff',
    };
  },
};
