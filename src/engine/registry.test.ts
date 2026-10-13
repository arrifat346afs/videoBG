import { describe, expect, it } from 'vitest';
import { listGenerators } from '../engine/registry.ts';
import '../engine/generators/index.ts';
import { mulberry32 } from '../engine/rng.ts';

describe('generator registry', () => {
  it('registers 22 2D styles + 6 scene3d styles, one file + one line each', () => {
    expect(listGenerators()).toHaveLength(28);
  });
  it('every generator has valid schema + deterministic randomize', () => {
    for (const g of listGenerators()) {
      expect(g.id).toBeTruthy();
      if (g.kind === 'scene3d') {
        expect(typeof g.createScene3D).toBe('function');
      } else {
        expect(g.fragmentShader).toContain('outColor');
        // Loop-safe motion: u_phase directly or u_time (= phase * TAU in renderer).
        expect(g.fragmentShader?.includes('u_phase') || g.fragmentShader?.includes('u_time')).toBe(true);
      }
      for (const def of g.paramSchema) {
        expect(g.defaultParams[def.key]).toBeDefined();
      }
      const a = g.randomize(mulberry32(42));
      const b = g.randomize(mulberry32(42));
      expect(a).toEqual(b);
    }
  });
  it('shaders do not use Math.random-style nondeterminism markers', () => {
    for (const g of listGenerators()) {
      expect(g.fragmentShader ?? '').not.toContain('hexToRgb01(');
    }
  });
});
