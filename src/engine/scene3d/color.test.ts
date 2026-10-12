import { describe, expect, it } from 'vitest';
import { hexToLinear, linearChannelToSrgb, srgbChannelToLinear } from './color.ts';

describe('scene3d color management', () => {
  it('round-trips sRGB <-> linear', () => {
    for (const v of [0, 0.04, 0.18, 0.5, 0.72, 1]) {
      expect(linearChannelToSrgb(srgbChannelToLinear(v))).toBeCloseTo(v, 6);
    }
  });
  it('darkens mid sRGB correctly (no double-brightening)', () => {
    // sRGB 0.5 must NOT stay 0.5 in linear (that bug lifts blacks).
    expect(srgbChannelToLinear(0.5)).toBeCloseTo(0.214, 3);
    expect(srgbChannelToLinear(0)).toBe(0);
    expect(srgbChannelToLinear(1)).toBe(1);
  });
  it('hexToLinear parses display colors into linear working space', () => {
    expect(hexToLinear('#000000')).toEqual([0, 0, 0]);
    expect(hexToLinear('#ffffff')).toEqual([1, 1, 1]);
    const [r, g, b] = hexToLinear('#52ff9e');
    expect(r).toBeLessThan(0.35);
    expect(g).toBe(1);
    expect(b).toBeLessThan(0.45);
    expect(hexToLinear('bogus')).toEqual([1, 0, 1]);
  });
});
