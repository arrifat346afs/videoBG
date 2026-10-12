import { describe, expect, it } from 'vitest';
import { buildWaves, crestFactor, waveHeight, waveNormal } from './waves.ts';

describe('scene3d wave field', () => {
  it('is deterministic for same seed', () => {
    expect(buildWaves(123, 4, 1.5)).toEqual(buildWaves(123, 4, 1.5));
  });
  it('loops perfectly: f(phase=0) == f(phase=1)', () => {
    const waves = buildWaves(7, 5, 2.0);
    for (const [x, z] of [[0, 0], [3.1, -2.2], [-8, 5], [12.5, 9.4]] as const) {
      expect(waveHeight(x, z, 0, waves)).toBeCloseTo(waveHeight(x, z, 1, waves), 12);
      expect(waveHeight(x, z, 0.37, waves)).toBeCloseTo(waveHeight(x, z, 0.37 + 1, waves), 12);
    }
  });
  it('amplitudes normalize to the requested amplitude', () => {
    const waves = buildWaves(99, 4, 2.0);
    const total = waves.reduce((s, w) => s + Math.abs(w.amp), 0);
    expect(total).toBeCloseTo(2.0, 10);
  });
  it('normals point up and crests are in [0,1]', () => {
    const waves = buildWaves(5, 3, 1.0);
    const n = waveNormal(1, 2, 0.25, waves);
    expect(n[1]).toBeGreaterThan(0.5);
    expect(Math.hypot(n[0], n[1], n[2])).toBeCloseTo(1, 6);
    expect(crestFactor(1, 1, 1)).toBeGreaterThan(crestFactor(-1, 1, 1));
    expect(crestFactor(0, 1, 0.9)).toBeGreaterThanOrEqual(0);
    expect(crestFactor(0, 1, 0.9)).toBeLessThanOrEqual(1);
  });
});
