// Generator 14: Raymarched SDF abstract shapes.
import { generatePalette } from '../palettes.ts';
import type { Generator, Params, Rng } from '../types.ts';

const FRAG = `
in vec2 v_uv;
out vec4 outColor;
uniform float u_scale;
uniform float u_soft;
uniform float u_detail;
uniform vec3 u_dark;
uniform vec3 u_a;
uniform vec3 u_b;
uniform vec3 u_c;

vec3 dark, a, b, c;

const float TAU = 6.28318530718;

float smin3(float a, float b, float c, float k) {
  float h = clamp(0.5 + 0.5 * (min(a, b) - c) / k, 0.0, 1.0);
  return mix(min(a, b), c, h) - k * h * (1.0 - h);
}

float map(vec3 p) {
  // Integer-cycle motion: phase -> unit circle, so the field is seamless.
  float t = TAU * u_phase;
  vec3 q = p;
  q.xz = mat2(cos(t), -sin(t), sin(t), cos(t)) * p.xz;
  float d = length(q);
  float n = snoise(q * 1.2 + vec3(cos(t), sin(t), 0.0) * 0.5);
  float r = 0.75 + 0.25 * sin(t + d * 2.0);
  return d - r - n * 0.08 * (1.0 + 0.5 * u_detail);
}

vec3 calcNormal(vec3 p) {
  float d = map(p);
  vec2 e = vec2(0.005, 0.0);
  return normalize(vec3(map(p + e.xyy) - map(p - e.xyy),
                        map(p + e.yxy) - map(p - e.yxy),
                        map(p + e.yyx) - map(p - e.yyx)));
}

void main() {
  dark = u_dark;
  a = u_a;
  b = u_b;
  c = u_c;
  float t = TAU * u_phase;

  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
  vec2 uv = (v_uv - 0.5) * vec2(aspect.x * u_scale, aspect.y * u_scale);

  vec3 ro = vec3(0.0, 0.0, -3.0);
  vec3 rd = normalize(vec3(uv, 1.2));
  float d = 0.0;
  for (int i = 0; i < 64; i++) {
    vec3 p = ro + rd * d;
    float dt = map(p);
    d += dt;
    if (d > 50.0) break;
    if (dt < 0.002) break;
  }

  vec3 col = dark;
  if (d < 50.0) {
    vec3 p = ro + rd * d;
    vec3 n = calcNormal(p);
    vec3 l = normalize(vec3(0.5, 0.8, 1.0) + sin(t) * 0.3);
    float dif = max(0.0, dot(n, l));
    float rim = pow(1.0 - max(0.0, dot(-l, n)), 3.0);
    col = mix(a, b, smoothstep(0.1, 0.6, dif));
    col = mix(col, c, smoothstep(0.5, 0.9, dif));
    col *= 0.4 + 0.6 * dif;
    col += a * rim * 0.8 * (0.5 + 0.5 * sin(t));
    col += b * pow(dif, 3.0) * 0.6;
  }

  outColor = vec4(col, 1.0);
}
`;

function rnd(v: number): number {
  return Math.round(v * 100) / 100;
}

export const raymarched: Generator = {
  id: 'raymarched',
  name: 'Raymarched SDF',
  fragmentShader: FRAG,
  paramSchema: [
    { kind: 'number', key: 'scale', label: 'Scale', min: 1.0, max: 3.0, step: 0.05, defaultValue: 1.8 },
    { kind: 'number', key: 'soft', label: 'Smooth', min: 0.5, max: 3.0, step: 0.1, defaultValue: 1.2 },
    { kind: 'number', key: 'detail', label: 'Detail', min: 0, max: 2.0, step: 0.1, defaultValue: 0.8 },
    { kind: 'color', key: 'dark', label: 'Dark', defaultValue: '#0b1026' },
    { kind: 'color', key: 'a', label: 'A', defaultValue: '#1b2a6b' },
    { kind: 'color', key: 'b', label: 'B', defaultValue: '#3a86ff' },
    { kind: 'color', key: 'c', label: 'Highlight', defaultValue: '#83c5be' },
  ],
  defaultParams: {
    scale: 1.8,
    soft: 1.2,
    detail: 0.8,
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
      detail: rnd(rng.range(0.3, 1.6)),
      dark: c[0] ?? '#0b1026',
      a: c[1] ?? '#1b2a6b',
      b: c[2] ?? '#3a86ff',
      c: c[4] ?? '#83c5be',
    };
  },
};
