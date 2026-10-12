// Generator 11: Julia / Mandelbrot-style fractal zoom with smooth coloring.
import { generatePalette } from '../palettes.ts';
import type { Generator, Params, Rng } from '../types.ts';

const FRAG = `
in vec2 v_uv;
out vec4 outColor;
uniform float u_scale;
uniform float u_zoom;
uniform float u_julia;
uniform vec3 u_dark;
uniform vec3 u_a;
uniform vec3 u_b;
uniform vec3 u_c;

vec3 dark, a, b, c;

vec2 julia(vec2 z, vec2 c, int iters) {
  float zr = z.x;
  float zi = z.y;
  for (int i = 0; i < iters; i++) {
    float x = zr * zr - zi * zi + c.x;
    float y = 2.0 * zr * zi + c.y;
    zr = x;
    zi = y;
    if (zr * zr + zi * zi > 4.0) break;
  }
  return vec2(zr, zi);
}

float smoothVal(vec2 z, int iters) {
  float zr = z.x;
  float zi = z.y;
  float sn = 0.0;
  for (int i = 0; i < 100; i++) {
    if (i >= iters) break;
    if (zr * zr + zi * zi > 4.0) {
      sn = float(i) + 2.0 - log2(log2(zr * zr + zi * zi));
      break;
    }
    float x = zr * zr - zi * zi + 0.0;
    float y = 2.0 * zr * zi + 0.0;
    zr = x;
    zi = y;
    sn = float(i);
  }
  return sn;
}

void main() {
  dark = u_dark;
  a = u_a;
  b = u_b;
  c = u_c;
  float t = u_time;

  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
  vec2 p = (v_uv - 0.5) * aspect * u_scale * u_zoom;

  vec2 jc = vec2(cos(t * 0.13) * 0.78 + 0.15, sin(t * 0.17) * 0.78 + 0.15);
  float iters = 12.0 + 12.0 * u_julia;
  vec2 z = julia(p * 0.5, jc, int(iters));
  float sn = smoothVal(p * 0.5, int(iters));

  vec3 col = dark;
  col = mix(col, a, smoothstep(0.0, 60.0, sn) * 0.5 + 0.5);
  col = mix(col, b, smoothstep(20.0, 80.0, sn) * 0.5 + 0.3);
  col = mix(col, c, smoothstep(50.0, 100.0, sn) * 0.5);

  float edge = pow(1.0 - smoothstep(0.0, 30.0, sn), 2.0);
  col += b * edge * 0.6;

  float spiral = sin(sn * 2.0 + atan(p.y, p.x) * 8.0);
  col *= 0.9 + 0.2 * spiral * sin(t);

  col = pow(col, vec3(1.0 / 2.2));
  outColor = vec4(col, 1.0);
}
`;

function rnd(v: number): number {
  return Math.round(v * 100) / 100;
}

export const julia: Generator = {
  id: 'julia',
  name: 'Julia Fractal',
  fragmentShader: FRAG,
  paramSchema: [
    { kind: 'number', key: 'scale', label: 'Scale', min: 1.0, max: 3.0, step: 0.05, defaultValue: 1.8 },
    { kind: 'number', key: 'zoom', label: 'Zoom', min: 1.0, max: 5.0, step: 0.05, defaultValue: 2.0 },
    { kind: 'number', key: 'julia', label: 'Jitter', min: 0, max: 1.0, step: 0.01, defaultValue: 0.4 },
    { kind: 'color', key: 'dark', label: 'Dark', defaultValue: '#0b1026' },
    { kind: 'color', key: 'a', label: 'A', defaultValue: '#1b2a6b' },
    { kind: 'color', key: 'b', label: 'B', defaultValue: '#3a86ff' },
    { kind: 'color', key: 'c', label: 'Highlight', defaultValue: '#83c5be' },
  ],
  defaultParams: {
    scale: 1.8,
    zoom: 2.0,
    julia: 0.4,
    dark: '#0b1026',
    a: '#1b2a6b',
    b: '#3a86ff',
    c: '#83c5be',
  },
  randomize(rng: Rng): Params {
    const pal = generatePalette(rng);
    const c = pal.colors;
    return {
      scale: rnd(rng.range(1.3, 2.4)),
      zoom: rnd(rng.range(1.6, 3.6)),
      julia: rnd(rng.range(0.2, 0.7)),
      dark: c[0] ?? '#0b1026',
      a: c[1] ?? '#1b2a6b',
      b: c[2] ?? '#3a86ff',
      c: c[4] ?? '#83c5be',
    };
  },
};
