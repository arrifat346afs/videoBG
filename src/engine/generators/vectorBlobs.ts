// Vector Blobs: flat SDF blobs orbiting on integer-cycle paths.
import type { Generator, Params, Rng } from '../types.ts';
import { r2, vectorGradient } from './vectorShared.ts';

const FRAG = `
in vec2 v_uv;
out vec4 outColor;
uniform float u_count;
uniform float u_radius;
uniform float u_merge;
uniform float u_speed;
uniform float u_grain;
uniform float u_gradAngle;
uniform int u_gradShape;

const float TAU = 6.28318530718;

float rnd1(float x) {
  return fract(sin(x * 127.1 + u_seed * 311.7) * 43758.5453);
}

void main() {
  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
  vec2 p = (v_uv - 0.5) * aspect;

  int n = int(u_count + 0.5);
  float cycles = floor(u_speed + 0.5);
  float ph = TAU * u_phase * cycles;

  float field = 1e9;
  for (int i = 0; i < 8; i++) {
    if (i >= n) break;
    float fi = float(i);
    float a0 = fi * 2.3999632;
    float rr = 0.30 * (0.55 + 0.8 * rnd1(fi + 1.3));
    vec2 c = rr * vec2(cos(a0), sin(a0));
    float r = u_radius * (0.65 + 0.75 * rnd1(fi + 7.7));
    vec2 bp = c + 0.16 * vec2(cos(ph + a0), sin(ph + a0));
    float d = length(p - bp) - r;
    field = smin(field, d, max(0.02, u_merge));
  }

  float aa = fwidth(field) + 0.0012;
  float inside = 1.0 - smoothstep(-aa, aa, field);

  float t = gradCoord(p, u_gradAngle, u_gradShape);
  vec3 body = gradSample(clamp(0.15 + 0.7 * t, 0.0, 1.0));
  vec3 rim = gradSample(clamp(0.55 + 0.45 * t, 0.0, 1.0));

  // Inner contour band gives the flat shapes a little structure.
  float ring = 1.0 - smoothstep(0.0, 0.05, abs(field + 0.05));
  vec3 col = mix(gradSample(0.02), body, inside);
  col = mix(col, rim, inside * ring * 0.5);

  col += (hash12(v_uv * 640.0) - 0.5) * u_grain * 0.10;
  outColor = vec4(max(col, 0.0), 1.0);
}
`;

const VG = vectorGradient(['#10121e', '#5f0f40', '#9a031e', '#fb8b24', '#ffd166']);

export const vectorBlobs: Generator = {
  id: 'vector-blobs',
  name: 'Vector Blobs',
  category: 'Geometric',
  fragmentShader: FRAG,
  paramSchema: [
    { kind: 'number', key: 'count', label: 'Blobs', min: 2.0, max: 8.0, step: 1.0, defaultValue: 5.0 },
    { kind: 'number', key: 'radius', label: 'Radius', min: 0.05, max: 0.5, step: 0.01, defaultValue: 0.22 },
    { kind: 'number', key: 'merge', label: 'Merge', min: 0.02, max: 0.4, step: 0.01, defaultValue: 0.12 },
    { kind: 'number', key: 'speed', label: 'Orbit speed', min: 1.0, max: 4.0, step: 1.0, defaultValue: 2.0 },
    { kind: 'number', key: 'grain', label: 'Grain', min: 0.0, max: 0.6, step: 0.01, defaultValue: 0.06 },
    ...VG.schema,
  ],
  defaultParams: {
    count: 5.0,
    radius: 0.22,
    merge: 0.12,
    speed: 2.0,
    grain: 0.06,
    ...VG.defaults,
  },
  randomize(rng: Rng): Params {
    return {
      count: Math.round(rng.range(3, 8)),
      radius: r2(rng.range(0.12, 0.34)),
      merge: r2(rng.range(0.04, 0.28)),
      speed: Math.round(rng.range(1, 4)),
      grain: r2(rng.range(0.0, 0.16)),
      ...VG.random(rng),
    };
  },
};
