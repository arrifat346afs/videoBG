// Generator 12: Reaction-diffusion look (Gray-Scott style coral).
// Single-pass analytic approximation; true multi-pass sim can use PingPong later.
import { generatePalette } from '../palettes.ts';
import type { Generator, Params, Rng } from '../types.ts';

const FRAG = `
in vec2 v_uv;
out vec4 outColor;
uniform float u_scale;
uniform float u_feed;
uniform float u_kill;
uniform vec3 u_dark;
uniform vec3 u_a;
uniform vec3 u_b;

void main() {
  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
  vec2 p = (v_uv - 0.5) * aspect * u_scale;
  p += (u_seed - 0.5) * 7.0;
  float t = u_time;

  float w1 = fbm2(p * 1.6 + vec2(cos(t * 0.4), sin(t * 0.4)) * 0.6, 4.0);
  float w2 = fbm2(p * 2.3 - vec2(sin(t * 0.3), cos(t * 0.3)) * 0.6, 4.0);
  float v = abs(w1 - w2) * (2.0 + u_feed * 40.0);
  v += 0.25 * vnoise(p * (6.0 + u_kill * 60.0) + t);
  float m = smoothstep(0.05, 0.5, v);
  m = pow(m, 0.7 + u_scale);

  vec3 col = mix(u_dark, u_a, smoothstep(0.1, 0.6, m));
  col = mix(col, u_b, smoothstep(0.45, 0.9, m));
  col += u_b * pow(m, 3.0) * 0.5;
  col = pow(col, vec3(1.0 / 2.2));
  outColor = vec4(col, 1.0);
}
`;

function rnd(v: number): number {
  return Math.round(v * 100) / 100;
}

export const reactionDiffusion: Generator = {
  id: 'reaction-diffusion',
  name: 'Reaction Diffusion',
  fragmentShader: FRAG,
  isMultiPass: true,
  paramSchema: [
    { kind: 'number', key: 'scale', label: 'Pattern', min: 0.3, max: 2.0, step: 0.05, defaultValue: 1.0 },
    { kind: 'number', key: 'feed', label: 'Feed', min: 0.01, max: 0.08, step: 0.001, defaultValue: 0.035 },
    { kind: 'number', key: 'kill', label: 'Kill', min: 0.04, max: 0.08, step: 0.001, defaultValue: 0.06 },
    { kind: 'color', key: 'dark', label: 'Dark', defaultValue: '#0b1026' },
    { kind: 'color', key: 'a', label: 'A', defaultValue: '#1b2a6b' },
    { kind: 'color', key: 'b', label: 'B', defaultValue: '#3a86ff' },
  ],
  defaultParams: {
    scale: 1.0,
    feed: 0.035,
    kill: 0.06,
    dark: '#0b1026',
    a: '#1b2a6b',
    b: '#3a86ff',
  },
  randomize(rng: Rng): Params {
    const pal = generatePalette(rng);
    const c = pal.colors;
    return {
      scale: rnd(rng.range(0.7, 1.5)),
      feed: rnd(rng.range(0.025, 0.045)),
      kill: rnd(rng.range(0.05, 0.07)),
      dark: c[0] ?? '#0b1026',
      a: c[1] ?? '#1b2a6b',
      b: c[2] ?? '#3a86ff',
    };
  },
};
