import { describe, expect, it } from 'vitest';
import {
  addGradientStop,
  decodeGradient,
  encodeGradient,
  gradientFromColors,
  gradientUniforms,
  normalizeGradient,
  randomizeGradient,
  removeGradientStop,
  reverseGradient,
  sampleGradient,
  sampleGradientHex,
  MAX_GRADIENT_STOPS,
} from './gradient.ts';
import { mulberry32 } from './rng.ts';

describe('gradient sampling', () => {
  const g = gradientFromColors(['#000000', '#ff0000', '#ffffff'], 'oklab');

  it('returns the exact stop colours at stop positions', () => {
    expect(sampleGradientHex(g, 0)).toBe('#000000');
    expect(sampleGradientHex(g, 0.5)).toBe('#ff0000');
    expect(sampleGradientHex(g, 1)).toBe('#ffffff');
  });

  it('clamps outside [0,1]', () => {
    expect(sampleGradientHex(g, -3)).toBe('#000000');
    expect(sampleGradientHex(g, 4)).toBe('#ffffff');
  });

  it('interpolates between stops monotonically in luminance', () => {
    const l0 = sampleGradient(g, 0)[0];
    const lMid = sampleGradient(g, 0.25)[0];
    const lEnd = sampleGradient(g, 1)[0];
    expect(lMid).toBeGreaterThan(l0);
    expect(lEnd).toBeGreaterThan(lMid);
  });

  it('rgb and oklab interpolate differently but agree at stops', () => {
    const rgb = sampleGradient({ stops: g.stops, interp: 'rgb' }, 0.25);
    const oklab = sampleGradient(g, 0.25);
    expect(rgb).not.toEqual(oklab);
    expect(sampleGradient({ stops: g.stops, interp: 'rgb' }, 0)).toEqual(sampleGradient(g, 0));
  });
});

describe('gradient edits + serialisation', () => {
  it('round-trips through encode/decode', () => {
    const g = gradientFromColors(['#0b1026', '#3a86ff', '#83c5be', '#edf2f4'], 'oklab');
    expect(decodeGradient(encodeGradient(g))).toEqual(g);
  });

  it('decodes garbage to a valid 2+ stop gradient', () => {
    const g = decodeGradient('not-a-gradient');
    expect(g.stops.length).toBeGreaterThanOrEqual(2);
    expect(g.stops.length).toBeLessThanOrEqual(MAX_GRADIENT_STOPS);
  });

  it('reverses positions and order', () => {
    const g = gradientFromColors(['#000000', '#ffffff'], 'oklab');
    const r = reverseGradient(g);
    expect(r.stops[0]?.color).toBe('#ffffff');
    expect(r.stops[0]?.pos).toBe(0);
  });

  it('clamps to 8 stops and enforces at least 2', () => {
    let g = gradientFromColors(['#000000', '#ffffff']);
    for (let i = 0; i < 12; i++) g = addGradientStop(g, '#ff00ff', (i + 1) / 13);
    expect(g.stops.length).toBe(MAX_GRADIENT_STOPS);
    g = removeGradientStop(g, 0);
    expect(g.stops.length).toBe(MAX_GRADIENT_STOPS - 1);
    g = normalizeGradient({ stops: [{ color: '#ffffff', pos: 0.5 }], interp: 'oklab' });
    expect(g.stops.length).toBe(2);
  });

  it('randomize is deterministic per seed', () => {
    const a = randomizeGradient(mulberry32(7));
    const b = randomizeGradient(mulberry32(7));
    expect(a).toEqual(b);
    expect(a.stops.length).toBeGreaterThanOrEqual(2);
    expect(a.stops.length).toBeLessThanOrEqual(5);
  });
});

describe('gradient GPU packing', () => {
  it('packs colours, positions, count and mode', () => {
    const g = gradientFromColors(['#000000', '#0000ff', '#ff0000', '#ffffff']);
    const { colors, positions, count, mode } = gradientUniforms(g);
    expect(colors.length).toBe(MAX_GRADIENT_STOPS * 3);
    expect(positions.length).toBe(MAX_GRADIENT_STOPS);
    expect(count).toBe(4);
    expect(mode).toBe(2); // oklab
    expect(positions[0]).toBe(0);
    expect(positions[3]).toBe(1);
    expect(colors[3]).toBeCloseTo(0);
    expect(colors[5]).toBeCloseTo(1);
  });
});
