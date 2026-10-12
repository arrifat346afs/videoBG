import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  generatePalette,
  hslToHex,
  minContrast,
  PRESET_PALETTES,
} from './palettes.ts';
import { mulberry32 } from './rng.ts';

describe('hslToHex', () => {
  it('converts primaries', () => {
    expect(hslToHex(0, 1, 0.5).toLowerCase()).toBe('#ff0000');
    expect(hslToHex(120, 1, 0.5).toLowerCase()).toBe('#00ff00');
  });
  it('wraps hue', () => {
    expect(hslToHex(360, 1, 0.5)).toBe(hslToHex(0, 1, 0.5));
  });
});

describe('contrast', () => {
  it('black vs white is ~21', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
  });
  it('minContrast scans pairs', () => {
    expect(minContrast(['#000000', '#ffffff'])).toBeCloseTo(21, 0);
  });
});

describe('generatePalette', () => {
  it('is deterministic for a seeded rng', () => {
    const a = generatePalette(mulberry32(99), 'triadic');
    const b = generatePalette(mulberry32(99), 'triadic');
    expect(a).toEqual(b);
  });
  it('produces 5 valid hex colors for each harmony', () => {
    for (const h of ['analogous', 'complementary', 'triadic', 'monochrome'] as const) {
      const p = generatePalette(mulberry32(h), h);
      expect(p.colors).toHaveLength(5);
      for (const c of p.colors) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
  it('presets have contrast spread', () => {
    for (const p of PRESET_PALETTES) {
      expect(minContrast(p.colors)).toBeGreaterThan(1.1);
    }
  });
});
