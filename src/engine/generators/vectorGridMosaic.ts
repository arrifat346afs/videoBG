// Vector Grid Mosaic: rounded tiles that cycle colours through the gradient.
import type { Generator, Params, Rng } from '../types.ts';
import { r2, vectorGradient } from './vectorShared.ts';

const FRAG = `
in vec2 v_uv;
out vec4 outColor;
uniform float u_scale;
uniform float u_gap;
uniform float u_radius;
uniform float u_variance;
uniform float u_grain;
uniform float u_gradAngle;
uniform int u_gradShape;

const float TAU = 6.28318530718;

float sdRoundBox(vec2 q, vec2 b, float r) {
  vec2 d = abs(q) - b + r;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}

void main() {
  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
  vec2 p = (v_uv - 0.5) * aspect;

  vec2 gp = p * u_scale;
  vec2 gi = floor(gp);
  vec2 gf = fract(gp) - 0.5;

  float cell = hash12(gi + u_seed * 29.0);
  // Zero-derivative pulse at the loop seam keeps colour cycling seamless.
  float animv = fract(cell + u_variance * (1.0 - cos(TAU * u_phase)) * 0.5);

  float size = 0.5 - u_gap;
  float rad = clamp(u_radius, 0.0, size);
  float d = sdRoundBox(gf, vec2(size), rad);
  float aa = fwidth(d) + 0.001;
  float m = 1.0 - smoothstep(-aa, aa, d);

  float t = gradCoord(p, u_gradAngle, u_gradShape);
  vec3 bg = gradSample(clamp(t * 0.35, 0.0, 1.0));
  vec3 tile = gradSample(clamp(animv * 0.85 + t * 0.30, 0.0, 1.0));
  vec3 col = mix(bg, tile, m);

  col += (hash12(v_uv * 640.0) - 0.5) * u_grain * 0.10;
  outColor = vec4(max(col, 0.0), 1.0);
}
`;

const VG = vectorGradient(['#10002b', '#240046', '#5a189a', '#9d4edd', '#e0aaff']);

export const vectorGridMosaic: Generator = {
  id: 'vector-grid-mosaic',
  name: 'Vector Grid Mosaic',
  category: 'Geometric',
  fragmentShader: FRAG,
  paramSchema: [
    { kind: 'number', key: 'scale', label: 'Scale', min: 3.0, max: 24.0, step: 0.1, defaultValue: 10.0 },
    { kind: 'number', key: 'gap', label: 'Gap', min: 0.0, max: 0.2, step: 0.005, defaultValue: 0.06 },
    { kind: 'number', key: 'radius', label: 'Corner', min: 0.0, max: 0.3, step: 0.005, defaultValue: 0.08 },
    { kind: 'number', key: 'variance', label: 'Variance', min: 0.0, max: 1.0, step: 0.01, defaultValue: 0.35 },
    { kind: 'number', key: 'grain', label: 'Grain', min: 0.0, max: 0.6, step: 0.01, defaultValue: 0.05 },
    ...VG.schema,
  ],
  defaultParams: {
    scale: 10.0,
    gap: 0.06,
    radius: 0.08,
    variance: 0.35,
    grain: 0.05,
    ...VG.defaults,
  },
  randomize(rng: Rng): Params {
    return {
      scale: r2(rng.range(5.0, 18.0)),
      gap: r2(rng.range(0.0, 0.14)),
      radius: r2(rng.range(0.0, 0.2)),
      variance: r2(rng.range(0.1, 0.8)),
      grain: r2(rng.range(0.0, 0.14)),
      ...VG.random(rng),
    };
  },
};
