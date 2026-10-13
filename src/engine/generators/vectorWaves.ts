// Vector Waves: flat, antialiased wave bands with a gradient ramp.
import type { Generator, Params, Rng } from '../types.ts';
import { r2, vectorGradient } from './vectorShared.ts';

const FRAG = `
in vec2 v_uv;
out vec4 outColor;
uniform float u_scale;
uniform float u_bands;
uniform float u_width;
uniform float u_wobble;
uniform float u_grain;
uniform float u_gradAngle;
uniform int u_gradShape;

const float TAU = 6.28318530718;

void main() {
  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
  vec2 p = (v_uv - 0.5) * aspect;

  // Integer-cycle phase motion keeps the loop seamless.
  float ph = TAU * u_phase;
  float drift = 0.15 * sin(ph);

  float y1 = p.y + drift + u_wobble * 0.14 * sin(p.x * u_scale * 2.0 + ph * 2.0);
  float f1 = fract(y1 * u_bands);
  float d1 = abs(f1 - 0.5);
  float w = max(0.02, u_width * 0.5);
  float aa = fwidth(d1) + 0.0008;
  float band1 = 1.0 - smoothstep(w - aa, w + aa, d1);

  float y2 = p.y - drift + u_wobble * 0.12 * cos(p.x * u_scale * 1.5 - ph);
  float f2 = fract(y2 * u_bands + 0.5);
  float d2 = abs(f2 - 0.5);
  float band2 = 1.0 - smoothstep(w - aa, w + aa, d2);

  float t = gradCoord(p, u_gradAngle, u_gradShape);
  vec3 base = gradSample(clamp(t, 0.0, 1.0));
  vec3 hi = gradSample(clamp(t + 0.32, 0.0, 1.0));
  vec3 lo = gradSample(clamp(t - 0.32, 0.0, 1.0));

  vec3 col = mix(lo, base, band1);
  col = mix(col, hi, band2 * 0.45);

  // Flat vector look: a static, subtle grain only.
  col += (hash12(v_uv * 512.0) - 0.5) * u_grain * 0.10;
  outColor = vec4(max(col, 0.0), 1.0);
}
`;

const VG = vectorGradient(['#0b1026', '#1b5e8c', '#3a86ff', '#83c5be', '#edf2f4']);

export const vectorWaves: Generator = {
  id: 'vector-waves',
  name: 'Vector Waves',
  category: 'Geometric',
  fragmentShader: FRAG,
  paramSchema: [
    { kind: 'number', key: 'scale', label: 'Scale', min: 0.5, max: 6.0, step: 0.05, defaultValue: 2.0 },
    { kind: 'number', key: 'bands', label: 'Bands', min: 2.0, max: 14.0, step: 1.0, defaultValue: 6.0 },
    { kind: 'number', key: 'width', label: 'Band width', min: 0.05, max: 0.9, step: 0.01, defaultValue: 0.5 },
    { kind: 'number', key: 'wobble', label: 'Wobble', min: 0.0, max: 2.0, step: 0.01, defaultValue: 0.7 },
    { kind: 'number', key: 'grain', label: 'Grain', min: 0.0, max: 0.6, step: 0.01, defaultValue: 0.08 },
    ...VG.schema,
  ],
  defaultParams: {
    scale: 2.0,
    bands: 6.0,
    width: 0.5,
    wobble: 0.7,
    grain: 0.08,
    ...VG.defaults,
  },
  randomize(rng: Rng): Params {
    return {
      scale: r2(rng.range(1.0, 4.0)),
      bands: Math.round(rng.range(3, 11)),
      width: r2(rng.range(0.25, 0.8)),
      wobble: r2(rng.range(0.2, 1.6)),
      grain: r2(rng.range(0.0, 0.18)),
      ...VG.random(rng),
    };
  },
};
