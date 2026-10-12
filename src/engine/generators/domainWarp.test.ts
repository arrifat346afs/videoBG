import { describe, expect, it } from 'vitest';
import { domainWarp } from './domainWarp.ts';
import { mulberry32 } from '../rng.ts';

describe('domainWarp', () => {
  it('has valid schema + defaults', () => {
    expect(domainWarp.id).toBe('domain-warp');
    for (const def of domainWarp.paramSchema) {
      expect(domainWarp.defaultParams[def.key]).toBeDefined();
    }
  });
  it('randomize is deterministic and in range', () => {
    const a = domainWarp.randomize(mulberry32(7));
    const b = domainWarp.randomize(mulberry32(7));
    expect(a).toEqual(b);
    expect(a['scale']).toBeGreaterThanOrEqual(1.4);
    expect(a['warp']).toBeLessThanOrEqual(1.9);
  });
  it('shader uses loop phase and declares contract uniforms', () => {
    expect(domainWarp.fragmentShader).toContain('u_phase');
    expect(domainWarp.fragmentShader).toContain('u_seed');
    expect(domainWarp.fragmentShader).toContain('outColor');
    // Loop-safe: TAU * u_phase with integer multiples only.
    expect(domainWarp.fragmentShader).toContain('TAU * u_phase');
  });
});
