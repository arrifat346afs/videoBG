import { describe, expect, it } from 'vitest';
import { aspectLabel, getResolution, RESOLUTIONS, resolutionLabel } from '../engine/resolutions.ts';
import type { ResolutionPresetId } from '../engine/types.ts';

describe('export presets (preview aspect source of truth)', () => {
  const ids = Object.keys(RESOLUTIONS) as ResolutionPresetId[];
  it('covers 16:9, 9:16, 1:1, 4:3 and 21:9', () => {
    const labels = new Set(ids.map((id) => aspectLabel(getResolution(id).width, getResolution(id).height)));
    for (const want of ['16:9', '9:16', '1:1', '4:3', '21:9']) {
      expect(labels).toContain(want);
    }
  });
  it('labels read like "1920×1080 (16:9)"', () => {
    expect(resolutionLabel(1920, 1080)).toBe('1920×1080 (16:9)');
    expect(resolutionLabel(1080, 1920)).toBe('1080×1920 (9:16)');
    expect(resolutionLabel(1080, 1080)).toBe('1080×1080 (1:1)');
    expect(resolutionLabel(1600, 1200)).toBe('1600×1200 (4:3)');
    expect(resolutionLabel(2560, 1080)).toBe('2560×1080 (21:9)');
  });
  it('every preset has positive dimensions', () => {
    for (const id of ids) {
      const r = getResolution(id);
      expect(r.width).toBeGreaterThan(0);
      expect(r.height).toBeGreaterThan(0);
    }
  });
});
