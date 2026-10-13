// Vector Stripes: bold diagonal bands with crisp AA edges and sine drift.
import type { Generator, Params, Rng } from '../types.ts';
import { r2, vectorGradient } from './vectorShared.ts';

const FRAG = `
in vec2 v_uv;
out vec4 outColor;
uniform float u_count;
uniform float u_width;
uniform float u_angle;
uniform float u_curve;
uniform float u_wobble;
uniform float u_grain;
uniform float u_gradAngle;
uniform int u_gradShape;

const float TAU = 6.28318530718;

void main() {
  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
  vec2 p = (v_uv - 0.5) * aspect;

  float a = radians(u_angle);
  mat2 rot = mat2(cos(a), -sin(a), sin(a), cos(a));
  vec2 r = rot * p;

  float ph = TAU * u_phase;
  // Integer-cycle motion: one sweep plus two wobbles per loop.
  float y = r.y + u_curve * 0.30 * sin(r.x * 3.0 + ph);
  y += u_wobble * 0.10 * sin(r.x * u_count + ph * 2.0);

  float f = fract(y * u_count);
  float d = abs(f - 0.5);
  float w = max(0.03, u_width * 0.5);
  float aa = fwidth(d) + 0.0008;
  float stripe = 1.0 - smoothstep(w - aa, w + aa, d);

  float t = gradCoord(p, u_gradAngle, u_gradShape);
  vec3 bg = gradSample(clamp(t * 0.6, 0.0, 1.0));
  vec3 fg = gradSample(clamp(t * 0.6 + 0.45, 0.0, 1.0));
  vec3 col = mix(bg, fg, stripe);

  col += (hash12(v_uv * 512.0) - 0.5) * u_grain * 0.10;
  outColor = vec4(max(col, 0.0), 1.0);
}
`;

const VG = vectorGradient(['#0a0908', '#22333b', '#a9927d', '#f2e9e4', '#c6ac8f']);

export const vectorStripes: Generator = {
  id: 'vector-stripes',
  name: 'Vector Stripes',
  category: 'Geometric',
  fragmentShader: FRAG,
  paramSchema: [
    { kind: 'number', key: 'count', label: 'Stripe count', min: 2.0, max: 20.0, step: 1.0, defaultValue: 8.0 },
    { kind: 'number', key: 'width', label: 'Stripe width', min: 0.05, max: 0.95, step: 0.01, defaultValue: 0.55 },
    { kind: 'number', key: 'angle', label: 'Angle', min: 0.0, max: 360.0, step: 1.0, defaultValue: 45.0 },
    { kind: 'number', key: 'curve', label: 'Curve', min: 0.0, max: 2.0, step: 0.01, defaultValue: 0.5 },
    { kind: 'number', key: 'wobble', label: 'Wobble', min: 0.0, max: 2.0, step: 0.01, defaultValue: 0.4 },
    { kind: 'number', key: 'grain', label: 'Grain', min: 0.0, max: 0.6, step: 0.01, defaultValue: 0.06 },
    ...VG.schema,
  ],
  defaultParams: {
    count: 8.0,
    width: 0.55,
    angle: 45.0,
    curve: 0.5,
    wobble: 0.4,
    grain: 0.06,
    ...VG.defaults,
  },
  randomize(rng: Rng): Params {
    return {
      count: Math.round(rng.range(3, 16)),
      width: r2(rng.range(0.2, 0.85)),
      angle: Math.round(rng.range(0, 360)),
      curve: r2(rng.range(0.0, 1.6)),
      wobble: r2(rng.range(0.0, 1.4)),
      grain: r2(rng.range(0.0, 0.16)),
      ...VG.random(rng),
    };
  },
};
