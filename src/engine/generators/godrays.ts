// Generator 16: volumetric god-rays / light shafts from a movable origin.
// Rebuilt: polar angular rays + smooth low-freq fBm + radial falloff.
// Loop-safe: all motion derives from u_phase via integer-cycle cos/sin
// (time-circle sampling). No high-freq sin on pixel coords, no fract hash.
import { generatePalette } from '../palettes.ts';
import type { Generator, Params, Rng } from '../types.ts';

const FRAG = `
in vec2 v_uv;
out vec4 outColor;
uniform int u_mode;
uniform float u_rays;
uniform float u_width;
uniform float u_soft;
uniform float u_spread;
uniform float u_originX;
uniform float u_originY;
uniform float u_length;
uniform float u_falloff;
uniform float u_haze;
uniform float u_dust;
uniform float u_speed;
uniform float u_bloom;
uniform vec3 u_dark;
uniform vec3 u_a;
uniform vec3 u_b;

void main() {
  float TAU = 6.28318530718;
  float phase = u_phase;

  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
  vec2 p = (v_uv - 0.5) * aspect;
  vec2 o = (vec2(u_originX, u_originY) - 0.5) * aspect;
  vec2 d = p - o;
  float r = length(d);
  float ang = atan(d.y, d.x);

  // Integer loop cycles so f(0) == f(1).
  float cyc = max(1.0, floor(u_speed + 0.5));
  float ca = cos(TAU * phase * cyc + u_seed * TAU);
  float sa = sin(TAU * phase * cyc + u_seed * TAU);

  // Smooth angular modulation: sample fBm on the unit circle (no angle seam)
  // plus a time-circle offset so it drifts slowly and loops perfectly.
  vec2 angVec = vec2(cos(ang), sin(ang));
  float nMod = fbm2(angVec * 1.8 + vec2(ca, sa) * 0.6 + u_seed * 7.0, 3.0);

  float warpAmt = (u_mode == 2) ? 0.65 : 0.28;
  float drift = 0.18 * ca;
  float angW = ang + (nMod - 0.5) * warpAmt * 2.0 + drift * 0.35;

  // Integer ray count keeps the pattern seamless around the circle.
  float N = max(1.0, floor(u_rays + 0.5));
  float s = cos(angW * N);

  // Distance-adaptive softness: far-field rays widen instead of aliasing.
  float aa = fwidth(s) * 1.25 + 1e-4;
  float thresh = 1.0 - clamp(u_width, 0.02, 1.0) * 1.6;
  float soft = clamp(u_soft, 0.02, 1.0) * (0.35 + r * 1.6) + aa;
  float rays = smoothstep(thresh - soft, thresh + soft, s);

  // Spread cone around straight-down from the origin. spread ~= PI => full.
  float dirRef = -1.57079632679;
  float dAng = abs(atan(sin(ang - dirRef), cos(ang - dirRef)));
  float cone = 1.0 - smoothstep(u_spread * 0.55, u_spread, dAng);

  // Radial falloff: bright near source, soft fade with distance.
  float fall = exp(-r * u_falloff * (2.0 / max(0.2, u_length)));
  float core = exp(-r * 3.2) * 0.7;

  // Low-frequency haze + dust layers, both advected on the time circle.
  float hazeN = fbm2(p * 1.4 + vec2(ca, sa) * 0.35 + u_seed * 3.1, 3.0);
  float haze = smoothstep(0.2, 0.9, hazeN) * u_haze;

  vec2 dustUv = p * 2.6 + vec2(ca, -sa) * 0.45 + angVec * 0.4;
  float dustN = fbm2(dustUv, 2.0);
  float dust = smoothstep(0.55, 0.95, dustN) * u_dust * smoothstep(1.6, 0.25, r);

  float light = rays * cone * fall;
  if (u_mode == 2) {
    light += haze * 0.35 * cone * fall * 2.0;
  }
  float glow = light * (1.0 + u_bloom) + core * 0.55 + haze * 0.32 + dust * 0.45;

  // Warm-to-cool gradient along the beam length.
  float tGrad = clamp(r / (u_length * 0.9 + 0.45), 0.0, 1.0);
  vec3 rayCol = mix(u_a, u_b, smoothstep(0.0, 1.0, tGrad));

  float m = clamp(glow, 0.0, 1.0);
  // Extra smoothstep shaping avoids banding in the mid-tones.
  m = m * m * (3.0 - 2.0 * m);
  vec3 col = mix(u_dark, rayCol, m);
  col += rayCol * pow(clamp(glow, 0.0, 1.5), 1.6) * (0.3 + u_bloom * 0.45);

  outColor = vec4(col, 1.0);
}
`;

function rnd(v: number): number {
  return Math.round(v * 100) / 100;
}

const MODES = ['Cathedral beams', 'Sunburst', 'Underwater caustics'] as const;

export const godrays: Generator = {
  id: 'god-rays',
  name: 'Light Rays',
  fragmentShader: FRAG,
  paramSchema: [
    { kind: 'select', key: 'mode', label: 'Mode', options: MODES, defaultValue: MODES[0] },
    { kind: 'number', key: 'rays', label: 'Ray count', min: 3, max: 40, step: 1, defaultValue: 6 },
    { kind: 'number', key: 'width', label: 'Ray width', min: 0.05, max: 0.9, step: 0.01, defaultValue: 0.38 },
    { kind: 'number', key: 'soft', label: 'Softness', min: 0.05, max: 1.0, step: 0.01, defaultValue: 0.5 },
    { kind: 'number', key: 'spread', label: 'Spread', min: 0.3, max: 3.2, step: 0.05, defaultValue: 0.95 },
    { kind: 'number', key: 'originX', label: 'Origin X', min: -0.5, max: 1.5, step: 0.01, defaultValue: 0.5 },
    { kind: 'number', key: 'originY', label: 'Origin Y', min: -0.5, max: 1.5, step: 0.01, defaultValue: 1.15 },
    { kind: 'number', key: 'length', label: 'Length', min: 0.5, max: 2.5, step: 0.05, defaultValue: 1.25 },
    { kind: 'number', key: 'falloff', label: 'Falloff', min: 0.5, max: 4.0, step: 0.05, defaultValue: 1.6 },
    { kind: 'number', key: 'haze', label: 'Haze', min: 0, max: 1.5, step: 0.05, defaultValue: 0.5 },
    { kind: 'number', key: 'dust', label: 'Dust', min: 0, max: 1.5, step: 0.05, defaultValue: 0.35 },
    { kind: 'number', key: 'speed', label: 'Shimmer speed', min: 1, max: 3, step: 1, defaultValue: 1 },
    { kind: 'number', key: 'bloom', label: 'Bloom', min: 0, max: 2, step: 0.05, defaultValue: 0.8 },
    { kind: 'color', key: 'dark', label: 'Dark', defaultValue: '#0b1026' },
    { kind: 'color', key: 'a', label: 'Warm', defaultValue: '#ffdf9e' },
    { kind: 'color', key: 'b', label: 'Cool', defaultValue: '#3a86ff' },
  ],
  defaultParams: {
    mode: MODES[0],
    rays: 6,
    width: 0.38,
    soft: 0.5,
    spread: 0.95,
    originX: 0.5,
    originY: 1.15,
    length: 1.25,
    falloff: 1.6,
    haze: 0.5,
    dust: 0.35,
    speed: 1,
    bloom: 0.8,
    dark: '#0b1026',
    a: '#ffdf9e',
    b: '#3a86ff',
  },
  randomize(rng: Rng): Params {
    const mode = rng.pick(MODES);
    const pal = generatePalette(rng, mode === 'Underwater caustics' ? 'analogous' : 'complementary');
    const c = pal.colors;
    // Tasteful per-mode ranges: never a mess of thin hard stripes.
    let rays: number;
    let width: number;
    let soft: number;
    let spread: number;
    let haze: number;
    let dust: number;
    let originX: number;
    let originY: number;
    if (mode === 'Cathedral beams') {
      rays = rng.int(3, 7);
      width = rnd(rng.range(0.3, 0.55));
      soft = rnd(rng.range(0.4, 0.7));
      spread = rnd(rng.range(0.6, 1.1));
      haze = rnd(rng.range(0.3, 0.7));
      dust = rnd(rng.range(0.2, 0.5));
      originX = rnd(rng.range(0.3, 0.7));
      originY = rnd(rng.range(1.0, 1.3));
    } else if (mode === 'Sunburst') {
      rays = rng.int(18, 32);
      width = rnd(rng.range(0.18, 0.34));
      soft = rnd(rng.range(0.45, 0.75));
      spread = rnd(rng.range(2.6, 3.2));
      haze = rnd(rng.range(0.2, 0.5));
      dust = rnd(rng.range(0.15, 0.4));
      originX = rnd(rng.range(0.35, 0.65));
      originY = rnd(rng.range(0.4, 0.65));
    } else {
      rays = rng.int(8, 16);
      width = rnd(rng.range(0.25, 0.45));
      soft = rnd(rng.range(0.5, 0.8));
      spread = rnd(rng.range(1.0, 1.8));
      haze = rnd(rng.range(0.6, 1.1));
      dust = rnd(rng.range(0.4, 0.8));
      originX = rnd(rng.range(0.2, 0.8));
      originY = rnd(rng.range(0.9, 1.3));
    }
    return {
      mode,
      rays,
      width,
      soft,
      spread,
      originX,
      originY,
      length: rnd(rng.range(0.9, 1.7)),
      falloff: rnd(rng.range(1.1, 2.2)),
      haze,
      dust,
      speed: rng.int(1, 2),
      bloom: rnd(rng.range(0.5, 1.2)),
      dark: c[0] ?? '#0b1026',
      a: c[3] ?? '#ffdf9e',
      b: c[2] ?? '#3a86ff',
    };
  },
};
