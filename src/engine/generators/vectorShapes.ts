// Vector Shapes: a grid of flat geometric glyphs that rotate once per loop.
import type { Generator, Params, Rng } from '../types.ts';
import { r2, vectorGradient } from './vectorShared.ts';

const FRAG = `
in vec2 v_uv;
out vec4 outColor;
uniform float u_scale;
uniform float u_size;
uniform float u_gap;
uniform float u_spin;
uniform float u_grain;
uniform float u_gradAngle;
uniform int u_gradShape;
uniform int u_shape;

const float TAU = 6.28318530718;

float sdShape(vec2 q, float s) {
  if (u_shape == 1) return max(abs(q.x), abs(q.y)) - s;              // square
  if (u_shape == 2) return abs(q.x) + abs(q.y) - s * 1.3;            // diamond
  if (u_shape == 3) return abs(length(q) - s) - s * 0.30;            // ring
  return length(q) - s;                                             // circle
}

void main() {
  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
  vec2 p = (v_uv - 0.5) * aspect * u_scale;

  vec2 g = floor(p);
  vec2 f = fract(p) - 0.5;

  float cell = hash12(g + u_seed * 13.0);
  float spin = TAU * u_phase * floor(u_spin + 0.5);
  float rot = spin * (cell < 0.5 ? 1.0 : -1.0);
  float cs = cos(rot), sn = sin(rot);
  vec2 q = mat2(cs, -sn, sn, cs) * f;

  float size = u_size * (0.55 + 0.7 * cell);
  float d = sdShape(q, size);
  float aa = fwidth(d) + 0.0008;
  float m = 1.0 - smoothstep(-aa, aa, d);

  float t = gradCoord(p, u_gradAngle, u_gradShape);
  float tt = clamp(mix(t, cell + 0.05 * sin(TAU * u_phase), 0.45), 0.0, 1.0);

  vec3 bg = gradSample(0.0);
  vec3 col = mix(bg, gradSample(tt), m);
  col = mix(col, gradSample(clamp(tt + 0.35, 0.0, 1.0)), m * m * 0.35);

  col += (hash12(v_uv * 512.0) - 0.5) * u_grain * 0.10;
  outColor = vec4(max(col, 0.0), 1.0);
}
`;

const VG = vectorGradient(['#0d1b2a', '#1b263b', '#415a77', '#778da9', '#e0e1dd']);

export const vectorShapes: Generator = {
  id: 'vector-shapes',
  name: 'Vector Shapes',
  category: 'Geometric',
  fragmentShader: FRAG,
  paramSchema: [
    { kind: 'number', key: 'scale', label: 'Scale', min: 2.0, max: 14.0, step: 0.1, defaultValue: 6.0 },
    { kind: 'number', key: 'size', label: 'Shape size', min: 0.08, max: 0.45, step: 0.01, defaultValue: 0.22 },
    { kind: 'number', key: 'gap', label: 'Gap', min: 0.0, max: 0.5, step: 0.01, defaultValue: 0.15 },
    { kind: 'number', key: 'spin', label: 'Spin cycles', min: 1.0, max: 3.0, step: 1.0, defaultValue: 1.0 },
    { kind: 'select', key: 'shape', label: 'Shape', options: ['circle', 'square', 'diamond', 'ring'], defaultValue: 'circle' },
    { kind: 'number', key: 'grain', label: 'Grain', min: 0.0, max: 0.6, step: 0.01, defaultValue: 0.06 },
    ...VG.schema,
  ],
  defaultParams: {
    scale: 6.0,
    size: 0.22,
    gap: 0.15,
    spin: 1.0,
    shape: 'circle',
    grain: 0.06,
    ...VG.defaults,
  },
  randomize(rng: Rng): Params {
    return {
      scale: r2(rng.range(4.0, 11.0)),
      size: r2(rng.range(0.12, 0.34)),
      gap: r2(rng.range(0.0, 0.3)),
      spin: Math.round(rng.range(1, 3)),
      shape: rng.pick(['circle', 'square', 'diamond', 'ring'] as const),
      grain: r2(rng.range(0.0, 0.16)),
      ...VG.random(rng),
    };
  },
};
