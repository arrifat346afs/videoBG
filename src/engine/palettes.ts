// Procedural palette generation via HSL harmony rules.
// Keeps outputs tasteful: constrained saturation/lightness + contrast guard.

import type { Harmony, Palette, Rng } from './types.ts';

export const PRESET_PALETTES: readonly Palette[] = [
  { harmony: 'analogous', colors: ['#0b1026', '#1b2a6b', '#3a86ff', '#83c5be', '#edf2f4'] },
  { harmony: 'complementary', colors: ['#10002b', '#5a189a', '#ff8500', '#ffc300', '#ffffff'] },
  { harmony: 'triadic', colors: ['#03071e', '#dc2f02', '#ffba08', '#1098ad', '#f1fa8c'] },
  { harmony: 'monochrome', colors: ['#0a0a0f', '#23232e', '#4a4a5a', '#9a9ab0', '#e8e8f0'] },
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
  const h: Harmony = harmony === 'random' ? rng.pick(['analogous', 'complementary', 'triadic', 'monochrome'] as const) : harmony;
  const baseHue = rng.range(0, 360);
  // Tasteful constraints: avoid muddy grays and neon blowouts.
  const sat = rng.range(0.45, 0.85);
  const hues = harmonyHues(baseHue, h, rng);
  const lights = [0.08, 0.22, 0.45, 0.68, 0.9];
  const colors = hues.slice(0, 5).map((hh, i) => {
    const ll = lights[i % lights.length] ?? 0.5;
    const ss = h === 'monochrome' ? rng.range(0.08, 0.25) : sat;
    return hslToHex(hh, ss, ll + rng.range(-0.03, 0.03));
  });
  return { colors, harmony: h };
}

function harmonyHues(base: number, h: Harmony, rng: Rng): number[] {
  switch (h) {
    case 'analogous':
      return [base, base + 25, base + 50, base - 25, base + 75];
    case 'complementary':
      return [base, base, base + 180, base + 180, base + rng.range(20, 40)];
    case 'triadic':
      return [base, base + 120, base + 240, base + 60, base + 180];
    case 'monochrome':
      return [base, base, base, base, base];
    case 'random':
      return [base, base + 180, base + 90, base + 270, base];
  }
}
