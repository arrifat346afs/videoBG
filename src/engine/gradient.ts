// Gradient colour system: 2-8 stops, each a colour + position in [0,1], with an
// interpolation mode (linear sRGB, smoothed sRGB, or perceptual OKLab).
//
// Gradients are stored in params as a compact string so they serialise cleanly
// through share links / history / export exactly like any other param:
//   "rgb:#0b1026@0,#3a86ff@0.5,#ffffff@1"
// This module is pure TypeScript (no GL) so it is easy to unit test and reuse
// on the CPU side (three.js backgrounds) and to pack into GLSL uniforms.
import type { Generator, Palette, Params, ParamDef, Rng } from './types.ts';

export type GradientInterp = 'rgb' | 'smooth' | 'oklab';
export type GradientMode = 'linear' | 'radial' | 'conic' | 'mesh';

export const GRADIENT_MODES: readonly GradientMode[] = ['linear', 'radial', 'conic', 'mesh'];
export const GRADIENT_INTERPS: readonly GradientInterp[] = ['rgb', 'smooth', 'oklab'];
export const MAX_GRADIENT_STOPS = 8;

export interface GradientStop {
  readonly color: string;
  readonly pos: number;
}

export interface GradientStops {
  readonly stops: readonly GradientStop[];
  readonly interp: GradientInterp;
}

const HEX = /^#?([0-9a-f]{6})$/i;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function parseHex(hex: string): readonly [number, number, number] {
  const m = HEX.exec(hex.trim());
  if (!m?.[1]) return [1, 0, 1];
  const n = m[1];
  return [
    parseInt(n.slice(0, 2), 16) / 255,
    parseInt(n.slice(2, 4), 16) / 255,
    parseInt(n.slice(4, 6), 16) / 255,
  ];
}

function toHex(r: number, g: number, b: number): string {
  const c = (v: number): string =>
    Math.round(clamp01(v) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/* ---- sRGB <-> OKLab (Björn Ottosson) ---- */

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function linearToSrgb(c: number): number {
  const v = clamp01(c);
  return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

function linearRgbToOklab(r: number, g: number, b: number): readonly [number, number, number] {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  ];
}

function oklabToLinearRgb(L: number, a: number, b: number): readonly [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function smoothstep(u: number): number {
  const t = clamp01(u);
  return t * t * (3 - 2 * t);
}

/* ---- core sampling ---- */

/** Sample a gradient at t in [0,1]. Returns sRGB [r,g,b] in [0,1]. */
export function sampleGradient(grad: GradientStops, t: number): readonly [number, number, number] {
  const stops = [...grad.stops].sort((a, b) => a.pos - b.pos);
  if (stops.length === 0) return [0, 0, 0];
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (!first || !last) return [0, 0, 0];
  const x = clamp01(t);
  if (x <= first.pos) return parseHex(first.color);
  if (x >= last.pos) return parseHex(last.color);
  let i = 0;
  while (i < stops.length - 1 && (stops[i + 1]?.pos ?? 1) < x) i++;
  const a = stops[i];
  const b = stops[i + 1];
  if (!a || !b) return parseHex(a?.color ?? first.color);
  const span = b.pos - a.pos;
  let u = span > 1e-6 ? (x - a.pos) / span : 0;
  if (grad.interp === 'smooth') u = smoothstep(u);
  const ca = parseHex(a.color);
  const cb = parseHex(b.color);
  if (grad.interp === 'rgb') {
    return [ca[0] + (cb[0] - ca[0]) * u, ca[1] + (cb[1] - ca[1]) * u, ca[2] + (cb[2] - ca[2]) * u];
  }
  // OKLab (and smooth uses eased u then OKLab).
  const la = linearRgbToOklab(srgbToLinear(ca[0]), srgbToLinear(ca[1]), srgbToLinear(ca[2]));
  const lb = linearRgbToOklab(srgbToLinear(cb[0]), srgbToLinear(cb[1]), srgbToLinear(cb[2]));
  const L = la[0] + (lb[0] - la[0]) * u;
  const A = la[1] + (lb[1] - la[1]) * u;
  const B = la[2] + (lb[2] - la[2]) * u;
  const lin = oklabToLinearRgb(L, A, B);
  return [linearToSrgb(lin[0]), linearToSrgb(lin[1]), linearToSrgb(lin[2])];
}

export function sampleGradientHex(grad: GradientStops, t: number): string {
  const [r, g, b] = sampleGradient(grad, t);
  return toHex(r, g, b);
}

/* ---- construction + edits ---- */

export function normalizeGradient(grad: GradientStops): GradientStops {
  const stops = [...grad.stops]
    .map((s) => ({ color: (HEX.test(s.color) ? s.color : '#ffffff').toLowerCase(), pos: Math.round(clamp01(s.pos) * 1000) / 1000 }))
    .sort((a, b) => a.pos - b.pos)
    .slice(0, MAX_GRADIENT_STOPS);
  while (stops.length < 2) stops.push({ color: '#000000', pos: stops.length });
  return { stops, interp: grad.interp };
}

/** Build evenly-spaced stops from 2-8 colours (legacy dark/a/b/c migration). */
export function gradientFromColors(colors: readonly string[], interp: GradientInterp = 'oklab'): GradientStops {
  const cs = colors.filter((c) => HEX.test(c)).slice(0, MAX_GRADIENT_STOPS);
  const list = cs.length >= 2 ? cs : [cs[0] ?? '#0b1026', '#ffffff'];
  const n = list.length;
  const stops = list.map((color, i) => ({ color: color.toLowerCase(), pos: n === 1 ? 0 : i / (n - 1) }));
  return normalizeGradient({ stops, interp });
}

export function gradientFromPalette(pal: Palette, interp: GradientInterp = 'oklab'): GradientStops {
  return gradientFromColors(pal.colors, interp);
}

export function reverseGradient(grad: GradientStops): GradientStops {
  const stops = grad.stops.map((s) => ({ color: s.color, pos: clamp01(1 - s.pos) })).reverse();
  return { stops, interp: grad.interp };
}

export function addGradientStop(grad: GradientStops, color: string, pos: number): GradientStops {
  if (grad.stops.length >= MAX_GRADIENT_STOPS) return grad;
  return normalizeGradient({ stops: [...grad.stops, { color, pos }], interp: grad.interp });
}

export function removeGradientStop(grad: GradientStops, index: number): GradientStops {
  if (grad.stops.length <= 2) return grad;
  return normalizeGradient({ stops: grad.stops.filter((_, i) => i !== index), interp: grad.interp });
}

export function setGradientStop(grad: GradientStops, index: number, patch: Partial<GradientStop>): GradientStops {
  const stops = grad.stops.map((s, i) => (i === index ? { ...s, ...patch } : s));
  return normalizeGradient({ stops, interp: grad.interp });
}

export function randomizeGradient(rng: Rng, colors?: readonly string[]): GradientStops {
  if (colors && colors.length >= 2) return gradientFromPalette({ colors, harmony: 'random' }, rng.next() < 0.6 ? 'oklab' : 'rgb');
  const n = rng.int(2, 5);
  const base = rng.range(0, 360);
  const stops: GradientStop[] = [];
  for (let i = 0; i < n; i++) {
    const h = base + i * 24 + rng.range(-12, 12);
    const l = 0.08 + (i / Math.max(1, n - 1)) * 0.82;
    stops.push({ color: hslToHexLocal(h, rng.range(0.4, 0.9), l), pos: i / (n - 1) });
  }
  return normalizeGradient({ stops, interp: rng.next() < 0.6 ? 'oklab' : 'smooth' });
}

function hslToHexLocal(h: number, s: number, l: number): string {
  const hh = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = l - c / 2;
  let rgb: readonly [number, number, number];
  if (hh < 60) rgb = [c, x, 0];
  else if (hh < 120) rgb = [x, c, 0];
  else if (hh < 180) rgb = [0, c, x];
  else if (hh < 240) rgb = [0, x, c];
  else if (hh < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return toHex(rgb[0] + m, rgb[1] + m, rgb[2] + m);
}

/* ---- string serialisation (params / share links) ---- */

export function encodeGradient(grad: GradientStops): string {
  const g = normalizeGradient(grad);
  return `${g.interp}:${g.stops.map((s) => `${s.color}@${s.pos.toFixed(3)}`).join(',')}`;
}

export function decodeGradient(str: unknown): GradientStops {
  if (typeof str !== 'string' || str.length === 0) return gradientFromColors(['#0b1026', '#3a86ff', '#ffffff']);
  const [modeRaw, rest] = str.split(':', 2);
  const interp: GradientInterp = modeRaw === 'rgb' || modeRaw === 'smooth' || modeRaw === 'oklab' ? modeRaw : 'oklab';
  const stops: GradientStop[] = [];
  for (const part of (rest ?? '').split(',')) {
    const at = part.lastIndexOf('@');
    if (at <= 0) continue;
    const color = part.slice(0, at);
    const pos = Number(part.slice(at + 1));
    if (!HEX.test(color) || !Number.isFinite(pos)) continue;
    stops.push({ color: color.toLowerCase(), pos: clamp01(pos) });
  }
  if (stops.length < 2) return gradientFromColors(stops.map((s) => s.color), interp);
  return normalizeGradient({ stops, interp });
}

/** GPU packing: 8 colours + 8 positions + count + mode id. */
export function gradientUniforms(grad: GradientStops): { colors: Float32Array; positions: Float32Array; count: number; mode: number } {
  const g = normalizeGradient(grad);
  const colors = new Float32Array(MAX_GRADIENT_STOPS * 3);
  const positions = new Float32Array(MAX_GRADIENT_STOPS);
  g.stops.forEach((s, i) => {
    if (i >= MAX_GRADIENT_STOPS) return;
    const [r, gg, b] = parseHex(s.color);
    colors[i * 3] = r;
    colors[i * 3 + 1] = gg;
    colors[i * 3 + 2] = b;
    positions[i] = s.pos;
  });
  const mode = g.interp === 'rgb' ? 0 : g.interp === 'smooth' ? 1 : 2;
  return { colors, positions, count: g.stops.length, mode };
}

/* ---- generator param helpers ---- */

/** Standard gradient params every style can opt into. */
export function gradientParams(o: { stops?: string; angle?: number; shape?: GradientMode } = {}): ParamDef[] {
  return [
    {
      kind: 'gradient',
      key: 'gradient',
      label: 'Gradient',
      defaultValue: o.stops ?? encodeGradient(gradientFromColors(['#0b1026', '#1b2a6b', '#3a86ff', '#ffffff'])),
    },
    { kind: 'select', key: 'gradShape', label: 'Gradient shape', options: GRADIENT_MODES, defaultValue: o.shape ?? 'linear' },
    { kind: 'number', key: 'gradAngle', label: 'Gradient angle', min: 0, max: 360, step: 1, defaultValue: o.angle ?? 0 },
  ];
}

export function gradientDef(gen: Generator): Extract<ParamDef, { kind: 'gradient' }> | undefined {
  return gen.paramSchema.find((d): d is Extract<ParamDef, { kind: 'gradient' }> => d.kind === 'gradient');
}

/**
 * Migrate legacy params: if a style declares a gradient but the incoming params
 * predate it (old share links / presets), build stops from its colour params so
 * old links keep rendering with an equivalent ramp.
 */
export function migrateParams(gen: Generator, params: Params): Params {
  const def = gradientDef(gen);
  if (!def) return params;
  if (typeof params[def.key] === 'string' && params[def.key]) return params;
  const colors: string[] = [];
  for (const d of gen.paramSchema) {
    if (d.kind === 'color') {
      const v = params[d.key];
      colors.push(typeof v === 'string' ? v : d.defaultValue);
    }
  }
  const stops = colors.length >= 2 ? gradientFromColors(colors, 'oklab') : decodeGradient(def.defaultValue);
  return { ...params, [def.key]: encodeGradient(stops) };
}

