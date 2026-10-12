// Procedural palette generation via HSL harmony rules.
// Keeps outputs tasteful: constrained saturation/lightness + contrast guard.

import type { Harmony, Palette, Rng } from './types.ts';

export const PRESET_PALETTES: readonly Palette[] = [
  // — core five —
  { harmony: 'analogous', colors: ['#0b1026', '#1b2a6b', '#3a86ff', '#83c5be', '#edf2f4'] },
  { harmony: 'complementary', colors: ['#10002b', '#5a189a', '#ff8500', '#ffc300', '#ffffff'] },
  { harmony: 'triadic', colors: ['#03071e', '#dc2f02', '#ffba08', '#1098ad', '#f1fa8c'] },
  { harmony: 'monochrome', colors: ['#0a0a0f', '#23232e', '#4a4a5a', '#9a9ab0', '#e8e8f0'] },
  // — 24 curated looks —
  { harmony: 'complementary', colors: ['#0d1b2a', '#1b263b', '#e07a5f', '#f2cc8f', '#f4f1de'] }, // sunset
  { harmony: 'analogous', colors: ['#031714', '#0b6e4f', '#19c37d', '#57e6b0', '#c7fff0'] }, // aurora
  { harmony: 'analogous', colors: ['#00131f', '#003049', '#0077b6', '#48cae4', '#caf0f8'] }, // ocean
  { harmony: 'vibrant', colors: ['#0d0221', '#ff2a6d', '#d100d1', '#05d9e8', '#ffffff'] }, // neon
  { harmony: 'pastel', colors: ['#2d1b4e', '#fbcfe8', '#c7d2fe', '#a7f3d0', '#fef3c7', '#fff1f2'] }, // pastel candy
  { harmony: 'tetradic', colors: ['#1b1207', '#6b4f2a', '#a9744f', '#d9b382', '#f0e6d2'] }, // earth
  { harmony: 'pastel', colors: ['#2d1b4e', '#ff6ec7', '#ffb3e6', '#8be9fd', '#fdfd96'] }, // candy
  { harmony: 'monochrome', colors: ['#050505', '#1c1c1c', '#3d3d3d', '#7a7a7a', '#d8d8d8'] }, // mono
  { harmony: 'gradient-ramp', colors: ['#0b132b', '#1c2541', '#3a506b', '#5bc0be', '#6fffe9'] }, // duotone deep
  { harmony: 'split-complementary', colors: ['#160f0a', '#8c3b2b', '#e08e45', '#3f88c5', '#f6f7eb'] }, // canyon
  { harmony: 'analogous', colors: ['#012a4a', '#2a6f97', '#61a5c2', '#a9d6e5', '#e0fbfc'] }, // ice
  { harmony: 'triadic', colors: ['#1a1423', '#3d2c8d', '#ff3864', '#f7b801', '#f4f1de'] }, // retro pop
  { harmony: 'vibrant', colors: ['#0b0c10', '#ff0055', '#00ffd5', '#ffd300', '#ffffff'] }, // arcade
  { harmony: 'pastel', colors: ['#2b2d42', '#8d99ae', '#ffcad4', '#b0f2c2', '#f8edeb'] }, // soft
  { harmony: 'complementary', colors: ['#0a0908', '#22333b', '#c6ac8f', '#eae0d5', '#5e503f'] }, // sepia
  { harmony: 'gradient-ramp', colors: ['#03045e', '#0077b6', '#00b4d8', '#90e0ef', '#caf0f8'] }, // cyan ramp
  { harmony: 'tetradic', colors: ['#241023', '#7b2cbf', '#c77dff', '#ff9e00', '#ffea00'] }, // violet gold
  { harmony: 'analogous', colors: ['#1a1a2e', '#16213e', '#0f3460', '#e94560', '#f5f5f5'] }, // midnight
  { harmony: 'split-complementary', colors: ['#03312e', '#0fa3a3', '#66d9c4', '#ff6b6b', '#ffe66d'] }, // tropical
  { harmony: 'pastel', colors: ['#4a4063', '#bfaee0', '#f0c8ff', '#ffd6e0', '#fff5b7'] }, // lavender
  { harmony: 'vibrant', colors: ['#10002b', '#7b2cbf', '#ff006e', '#ffbe0b', '#fb5607'] }, // magenta heat
  { harmony: 'monochrome', colors: ['#0b0f14', '#22303f', '#4b6478', '#93a7b8', '#e6edf3'] }, // steel
  { harmony: 'complementary', colors: ['#021b1a', '#0b525b', '#14919b', '#ff9f1c', '#fdfcdc'] }, // lagoon
  { harmony: 'gradient-ramp', colors: ['#2b1000', '#7f3300', '#d95f02', '#e6ab02', '#fff2cc'] }, // ember
  { harmony: 'triadic', colors: ['#0b132b', '#5bc0be', '#f4a259', '#e56b6f', '#f7f7ff'] }, // coral teal
  { harmony: 'pastel', colors: ['#3d405b', '#81b29a', '#f2cc8f', '#e07a5f', '#f4f1de'] }, // terracotta
  { harmony: 'vibrant', colors: ['#000814', '#003566', '#ffc300', '#ffd60a', '#ffffff'] }, // cobalt sun
  { harmony: 'analogous', colors: ['#0f0e17', '#2e294e', '#541388', '#d90368', '#f1e9da'] }, // plum rose
];

export function hslToHex(h: number, s: number, l: number): string {
  const hh = ((h % 360) + 360) % 360;
  const ss = clamp01(s);
  const ll = clamp01(l);
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;
  let rgb: readonly [number, number, number];
  if (hh < 60) rgb = [c, x, 0];
  else if (hh < 120) rgb = [x, c, 0];
  else if (hh < 180) rgb = [0, c, x];
  else if (hh < 240) rgb = [0, x, c];
  else if (hh < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return rgbToHex(rgb[0] + m, rgb[1] + m, rgb[2] + m);
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (v: number): string =>
    Math.round(clamp01(v) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export function hexToRgb01(hex: string): readonly [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m?.[1]) throw new Error(`invalid hex color: ${hex}`);
  const n = m[1] as string;
  return [
    parseInt(n.slice(0, 2), 16) / 255,
    parseInt(n.slice(2, 4), 16) / 255,
    parseInt(n.slice(4, 6), 16) / 255,
  ];
}

/** Relative luminance (WCAG). */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb01(hex).map((v) => {
    const vv = v as number;
    return vv <= 0.03928 ? vv / 12.92 : Math.pow((vv + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

export function contrastRatio(a: string, b: string): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** Min contrast between any two distinct colors in the palette. */
export function minContrast(colors: readonly string[]): number {
  let min = Infinity;
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const a = colors[i];
      const b = colors[j];
      if (a === undefined || b === undefined) continue;
      min = Math.min(min, contrastRatio(a, b));
    }
  }
  return min;
}

export function generatePalette(rng: Rng, harmony: Harmony = 'random'): Palette {
  const ALL: readonly Harmony[] = [
    'analogous',
    'complementary',
    'split-complementary',
    'triadic',
    'tetradic',
    'monochrome',
    'gradient-ramp',
    'pastel',
    'vibrant',
  ];
  const h: Harmony = harmony === 'random' ? rng.pick(ALL) : harmony;
  const baseHue = rng.range(0, 360);
  const count = rng.int(5, 8);
  const hues = harmonyHues(baseHue, h, rng, count);
  const lights = SCHEME_LIGHTS[h] ?? SCHEME_LIGHTS['triadic']!;
  const sat = schemeSaturation(h, rng);
  const hueJitter = h === 'monochrome' ? 0 : h === 'gradient-ramp' ? 5 : 12;
  const colors = hues.slice(0, count).map((hh, i) => {
    const ll = lights[i % lights.length] ?? 0.5;
    const ss = Math.min(1, Math.max(0, sat + rng.range(-0.05, 0.05)));
    return hslToHex(hh + rng.range(-hueJitter, hueJitter), ss, Math.min(1, Math.max(0, ll + rng.range(-0.03, 0.03))));
  });
  return { colors, harmony: h };
}

const SCHEME_LIGHTS: Record<string, readonly number[]> = {
  analogous: [0.08, 0.24, 0.46, 0.68, 0.9, 0.34, 0.56, 0.8],
  complementary: [0.08, 0.22, 0.45, 0.68, 0.9, 0.32, 0.56, 0.78],
  'split-complementary': [0.08, 0.24, 0.48, 0.7, 0.9, 0.34, 0.58, 0.8],
  triadic: [0.1, 0.26, 0.46, 0.66, 0.88, 0.36, 0.56, 0.76],
  tetradic: [0.08, 0.22, 0.44, 0.64, 0.86, 0.32, 0.54, 0.74],
  monochrome: [0.06, 0.2, 0.4, 0.6, 0.82, 0.3, 0.5, 0.9],
  'gradient-ramp': [0.1, 0.28, 0.46, 0.62, 0.78, 0.9, 0.2, 0.7],
  pastel: [0.82, 0.88, 0.92, 0.84, 0.9, 0.8, 0.94, 0.86],
  vibrant: [0.62, 0.5, 0.4, 0.56, 0.68, 0.46, 0.72, 0.54],
};

function schemeSaturation(h: Harmony, rng: Rng): number {
  switch (h) {
    case 'monochrome':
      return rng.range(0.06, 0.2);
    case 'pastel':
      return rng.range(0.3, 0.55);
    case 'vibrant':
      return rng.range(0.75, 0.95);
    case 'gradient-ramp':
      return rng.range(0.5, 0.82);
    default:
      return rng.range(0.45, 0.85);
  }
}

function harmonyHues(base: number, h: Harmony, rng: Rng, count: number): number[] {
  let offsets: number[];
  switch (h) {
    case 'analogous':
      offsets = [0, 22, 44, -22, 66, -44, 88, 110];
      break;
    case 'complementary':
      offsets = [0, 180, 180, 20, 200, 340, 160, 40];
      break;
    case 'split-complementary':
      offsets = [0, 150, 210, 15, 165, 195, 30, 180];
      break;
    case 'tetradic':
      offsets = [0, 90, 180, 270, 45, 135, 225, 315];
      break;
    case 'monochrome':
      offsets = [0, 0, 0, 0, 0, 0, 0, 0];
      break;
    case 'gradient-ramp':
      offsets = [0, 8, 16, 24, 32, 40, 48, 56];
      break;
    case 'pastel':
      offsets = [0, 20, 40, -20, 60, -40, 80, -60];
      break;
    case 'vibrant':
      offsets = [0, 30, 60, 90, 120, 150, 180, 210];
      break;
    case 'triadic':
      offsets = [0, 120, 240, 60, 180, 300, 30, 90];
      break;
    default:
      offsets = [0, 180, 90, 270, 45, 135, 225, 315];
      break;
  }
  const hues = offsets.map((o) => base + o);
  // A little seeded variation so repeats aren't identical, without breaking harmony.
  return hues.map((x) => x + rng.range(-4, 4)).slice(0, Math.max(5, count));
}
