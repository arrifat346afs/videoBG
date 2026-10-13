// Tests for the mound height field: determinism, loop closure, bounds.
import { describe, expect, it } from 'vitest';
import { buildMounds, dirFromAzEl, terrainDisp } from './terrain.ts';

const OPTS = { count: 2, heroHeight: 4.5, radius: 8, elongation: 1.6, width: 120, depth: 90 };

describe('terrain field', () => {
  it('builds 1-4 mounds deterministically with a hero first', () => {
    const a = buildMounds(7, OPTS);
    const b = buildMounds(7, OPTS);
    expect(a.mounds).toHaveLength(2);
    expect(a.mounds).toEqual(b.mounds);
    expect(a.mounds[0]?.hero).toBe(true);
    expect(a.mounds[0]?.amp).toBeCloseTo(4.5, 10);
    const one = buildMounds(7, { ...OPTS, count: 1 });
    expect(one.mounds).toHaveLength(1);
    const four = buildMounds(7, { ...OPTS, count: 9 });
    expect(four.mounds).toHaveLength(4);
  });

  it('closes the loop: disp(phase=1) == disp(phase=0)', () => {
    const field = buildMounds(1234, { ...OPTS, count: 4 });
    for (const [x, z] of [[0, -4], [5.5, 3.25], [-30, 20], [12.75, -18.5]] as const) {
      const d0 = terrainDisp(x, z, 0, field, 0.6);
      const d1 = terrainDisp(x, z, 1, field, 0.6);
      expect(d1.x).toBeCloseTo(d0.x, 12);
      expect(d1.y).toBeCloseTo(d0.y, 12);
      expect(d1.z).toBeCloseTo(d0.z, 12);
      const mid = terrainDisp(x, z, 0.37, field, 0.6);
      expect(Number.isFinite(mid.y)).toBe(true);
    }
  });

  it('keeps the floor near zero far from mounds and bounds the curl', () => {
    const field = buildMounds(99, { ...OPTS, count: 1 });
    const far = terrainDisp(55, 40, 0.2, field, 1.5);
    expect(Math.abs(far.y)).toBeLessThan(0.6);
    expect(Math.abs(far.h)).toBeLessThan(0.05);
    const c = field.mounds[0];
    if (!c) throw new Error('no mound');
    const top = terrainDisp(c.cx, c.cz, 0.2, field, 1.5);
    expect(top.h).toBeGreaterThan(1);
    // Curl displaces horizontally but never teleports a vertex.
    expect(Math.hypot(top.x - c.cx, top.z - c.cz)).toBeLessThan(6);
  });

  it('maps azimuth/elevation to unit directions', () => {
    const [x, y, z] = dirFromAzEl(-35, 28);
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 12);
    expect(y).toBeGreaterThan(0);
  });
});
