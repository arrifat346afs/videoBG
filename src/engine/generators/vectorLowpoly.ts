// Vector Lowpoly: faceted triangles with flat gradient fills and crisp gaps.
import type { Generator, Params, Rng } from '../types.ts';
import { r2, vectorGradient } from './vectorShared.ts';

const FRAG = `
in vec2 v_uv;
out vec4 outColor;
uniform float u_scale;
uniform float u_gap;
uniform float u_relief;
uniform float u_fold;
uniform float u_grain;
uniform float u_gradAngle;
uniform int u_gradShape;

const float TAU = 6.28318530718;

void main() {
  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
  vec2 p = (v_uv - 0.5) * aspect;

  float slow = 0.06 * sin(TAU * u_phase);
  vec2 gp = (p + slow) * u_scale + u_seed * 17.0;
  vec2 gi = floor(gp);
  vec2 gf = fract(gp);

  // Corner heights drive both the facet colour and the relief shading.
  float v00 = hash12(gi);
  float v10 = hash12(gi + vec2(1.0, 0.0));
  float v01 = hash12(gi + vec2(0.0, 1.0));
  float v11 = hash12(gi + vec2(1.0, 1.0));

  // Split the cell along a jittered diagonal into two flat facets.
  float diag = gf.x + gf.y - u_fold * (hash12(gi + 3.1) - 0.5);
  float upper = step(1.0, diag);
  float facet = mix(mix(v00, v11, 0.5), mix(v10, v01, 0.5), upper);

  float h = mix(mix(v00, v10, gf.x), mix(v01, v11, gf.x), gf.y);
  float shade = 0.75 + u_relief * (h - 0.5);

  float t = gradCoord(p, u_gradAngle, u_gradShape);
  vec3 col = gradSample(clamp(mix(t, facet + 0.1, 0.6), 0.0, 1.0)) * shade;

  // Crisp AA grout along cell borders and the internal diagonal.
  float edge = min(min(gf.x, 1.0 - gf.x), min(gf.y, 1.0 - gf.y));
  float dEdge = edge - u_gap;
  float dDiag = abs(diag - 1.0) * 0.7071 - u_gap;
  float aa = fwidth(edge) + 0.0008;
  float m = smoothstep(-aa, aa, dEdge) * smoothstep(-aa, aa, dDiag);

  vec3 bg = gradSample(0.05);
  col = mix(bg, col, m);

  col += (hash12(v_uv * 768.0) - 0.5) * u_grain * 0.09;
  outColor = vec4(max(col, 0.0), 1.0);
}
`;

const VG = vectorGradient(['#03071e', '#370617', '#9d0208', '#f48c06', '#ffba08']);

export const vectorLowpoly: Generator = {
  id: 'vector-lowpoly',
  name: 'Vector Lowpoly',
  category: 'Geometric',
  fragmentShader: FRAG,
  paramSchema: [
    { kind: 'number', key: 'scale', label: 'Scale', min: 2.0, max: 18.0, step: 0.1, defaultValue: 8.0 },
    { kind: 'number', key: 'gap', label: 'Grout', min: 0.0, max: 0.12, step: 0.005, defaultValue: 0.02 },
    { kind: 'number', key: 'relief', label: 'Relief', min: 0.0, max: 1.0, step: 0.01, defaultValue: 0.45 },
    { kind: 'number', key: 'fold', label: 'Fold', min: 0.0, max: 1.0, step: 0.01, defaultValue: 0.5 },
    { kind: 'number', key: 'grain', label: 'Grain', min: 0.0, max: 0.6, step: 0.01, defaultValue: 0.05 },
    ...VG.schema,
  ],
  defaultParams: {
    scale: 8.0,
    gap: 0.02,
    relief: 0.45,
    fold: 0.5,
    grain: 0.05,
    ...VG.defaults,
  },
  randomize(rng: Rng): Params {
    return {
      scale: r2(rng.range(4.0, 14.0)),
      gap: r2(rng.range(0.0, 0.06)),
      relief: r2(rng.range(0.1, 0.8)),
      fold: r2(rng.range(0.0, 1.0)),
      grain: r2(rng.range(0.0, 0.14)),
      ...VG.random(rng),
    };
  },
};
