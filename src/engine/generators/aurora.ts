// Generator 03: aurora — layered vertical curtains of light.
// Rebuilt: 3-5 additive ribbons with wavy baselines (low-freq sine + fbm),
// a bright thin core with soft falloff above/below, and ridged-noise streaks.
// Loop-safe: every time term is an integer multiple of TAU * u_phase, so
// f(phase) == f(phase + 1). No linear-in-time terms. No gamma here — colors
// are authored in display sRGB (see post.ts / renderer.ts).
import { generatePalette } from '../palettes.ts';
import type { Generator, Params, Rng } from '../types.ts';

const FRAG = `
in vec2 v_uv;
out vec4 outColor;
uniform float u_scale;
uniform float u_waves;
uniform float u_noise;
uniform vec3 u_dark;
uniform vec3 u_a;
uniform vec3 u_b;
uniform vec3 u_c;

const float TAU = 6.28318530718;

void main() {
  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
  vec2 p = (v_uv - 0.5) * aspect * u_scale;

  // Integer-cycle motion: phase -> a point on the unit circle.
  float a1 = TAU * u_phase;
  float a2 = 2.0 * a1;
  float ca = cos(a1);
  float sa = sin(a1);

  // Ribbon count from u_waves (3..5); amplitude also grows with it.
  int nR = 3 + int(step(0.8, u_waves)) + int(step(1.6, u_waves));
  float denom = max(1.0, float(nR - 1));
  float amp = 0.5 + 0.35 * u_waves;
  float detail = 0.35 + 0.5 * u_noise;

  // Deep sky: subtle vertical gradient + a faint tint of A toward the top.
  float skyT = smoothstep(-0.8, 0.9, p.y);
  vec3 sky = mix(u_dark * 0.5, u_dark * 1.2, skyT);
  sky += u_a * 0.10 * smoothstep(-0.3, 1.0, p.y);

  // Faint star field. Twinkle rides a2 (integer cycles) so it loops.
  vec2 sp = p * 85.0 + u_seed * 29.0;
  vec2 sid = floor(sp);
  vec2 sf = fract(sp) - 0.5;
  float sr = hash12(sid);
  vec2 spt = (vec2(hash12(sid + 11.3), hash12(sid + 47.1)) - 0.5) * 0.7;
  float star = smoothstep(0.05, 0.0, length(sf - spt)) * step(0.93, sr);
  float tw = 0.55 + 0.45 * sin(a2 + sr * 60.0);
  sky += vec3(0.75, 0.85, 1.0) * star * tw * 0.8 * smoothstep(-0.4, 0.8, p.y);

  vec3 acc = vec3(0.0);
  float ribWidth = 0.026 + 0.012 * u_noise;

  for (int i = 0; i < 5; i++) {
    if (i >= nR) break;
    float fi = float(i);
    float x0 = -0.40 + fi * (0.80 / denom);

    // Wavy vertical baseline: low-freq sines + fbm drifted on the time circle.
    float xb = x0
      + 0.15 * amp * sin(p.y * 1.1 + fi * 1.7 + a1)
      + 0.08 * amp * sin(p.y * 2.3 - fi * 0.9 + a2)
      + (fbm2(vec2(p.y * 0.55 + fi * 3.1 + ca * 0.25, x0 * 2.0 + sa * 0.25), 3.0) - 0.5)
        * detail * amp;

    // Bright hanging curtain, softer toward the top and bottom edges.
    float vfade = smoothstep(-0.85, 0.15, p.y) * (1.0 - 0.30 * smoothstep(0.65, 1.15, p.y));

    float d = abs(p.x - xb);
    float w = ribWidth * (0.7 + 0.6 * amp);
    float core = exp(-d * d / (w * w));
    float soft = exp(-d * d / (0.055 + 0.05 * u_noise)) * 0.32;

    // Ridged noise (1 - |noise|) -> fine vertical streaks in the curtain.
    float fine = 1.0 - abs(gnoise(vec2(p.x * (4.0 + 3.0 * u_noise) + fi * 5.0,
                                         p.y * (1.1 + 0.7 * u_noise) + sa * 0.6)));
    fine = pow(clamp(fine, 0.0, 1.0), 2.2);

    float glow = (core + soft) * vfade * (0.45 + 0.85 * fine);

    vec3 rc = mix(u_a, u_b, clamp(0.10 + 0.80 * fi / denom, 0.0, 1.0));
    rc = mix(rc, u_c, clamp(core, 0.0, 1.0) * 0.85);
    acc += rc * glow * (0.9 + 0.35 * amp);
  }

  // Additive ribbons over a deep sky. Soft glow rolloff keeps highlights
  // bright without blowing out, while the background stays near black.
  vec3 col = sky + acc;
  col = 1.0 - exp(-col * 1.35);

  outColor = vec4(col, 1.0);
}
`;

function rnd(v: number): number {
  return Math.round(v * 100) / 100;
}

export const aurora: Generator = {
  id: 'aurora',
  name: 'Aurora Waves',
  fragmentShader: FRAG,
  paramSchema: [
    { kind: 'number', key: 'scale', label: 'Scale', min: 1.0, max: 3.5, step: 0.05, defaultValue: 1.8 },
    { kind: 'number', key: 'waves', label: 'Ribbon waves', min: 0, max: 2.5, step: 0.05, defaultValue: 1.2 },
    { kind: 'number', key: 'noise', label: 'Detail noise', min: 0, max: 2.5, step: 0.1, defaultValue: 1.0 },
    { kind: 'color', key: 'dark', label: 'Dark', defaultValue: '#0b1026' },
    { kind: 'color', key: 'a', label: 'A', defaultValue: '#1b2a6b' },
    { kind: 'color', key: 'b', label: 'B', defaultValue: '#3a86ff' },
    { kind: 'color', key: 'c', label: 'C', defaultValue: '#83c5be' },
  ],
  defaultParams: {
    scale: 1.8,
    waves: 1.2,
    noise: 1.0,
    dark: '#0b1026',
    a: '#1b2a6b',
    b: '#3a86ff',
    c: '#83c5be',
  },
  randomize(rng: Rng): Params {
    const pal = generatePalette(rng, rng.next() < 0.6 ? 'analogous' : 'random');
    const c = pal.colors;
    return {
      scale: rnd(rng.range(1.3, 2.8)),
      waves: rnd(rng.range(0.6, 1.8)),
      noise: rnd(rng.range(0.4, 1.8)),
      dark: c[0] ?? '#0b1026',
      a: c[1] ?? '#1b2a6b',
      b: c[2] ?? '#3a86ff',
      c: c[3] ?? '#83c5be',
    };
  },
};
