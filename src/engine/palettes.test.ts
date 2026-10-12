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
  it('produces 5-8 valid hex colors for every harmony', () => {
    const harmonies = [
      'analogous',
      'complementary',
      'split-complementary',
      'triadic',
      'tetradic',
      'monochrome',
      'gradient-ramp',
      'pastel',
      'vibrant',
    ] as const;
    for (const h of harmonies) {
      const p = generatePalette(mulberry32(h), h);
      expect(p.colors.length).toBeGreaterThanOrEqual(5);
      expect(p.colors.length).toBeLessThanOrEqual(8);
      expect(p.harmony).toBe(h);
      for (const c of p.colors) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
  it('has 24+ curated presets with 3-8 colors and real luminance spread', () => {
    expect(PRESET_PALETTES.length).toBeGreaterThanOrEqual(24);
    for (const p of PRESET_PALETTES) {
      expect(p.colors.length).toBeGreaterThanOrEqual(3);
      expect(p.colors.length).toBeLessThanOrEqual(8);
      for (const c of p.colors) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
      // A background ramp needs a genuine dark-to-light span (max pairwise contrast).
      let max = 0;
      for (let i = 0; i < p.colors.length; i++) {
        for (let j = i + 1; j < p.colors.length; j++) {
          max = Math.max(max, contrastRatio(p.colors[i] ?? '#000', p.colors[j] ?? '#fff'));
        }
      }
      expect(max, `${p.harmony} ${p.colors.join(' ')}`).toBeGreaterThan(4);
    }
  });
  it('minContrast guards near-duplicate generated colors', () => {
    for (const h of ['analogous', 'triadic', 'vibrant'] as const) {
      expect(minContrast(generatePalette(mulberry32(h.length), h).colors)).toBeGreaterThan(1);
    }
  });
});
