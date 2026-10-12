import { describe, expect, it } from 'vitest';
import { hashSeed, mulberry32, normalizeSeed, sfc32 } from './rng.ts';

describe('normalizeSeed', () => {
  it('masks numbers to uint32', () => {
    expect(normalizeSeed(-1)).toBe(4294967295);
  });
  it('hashes strings deterministically', () => {
    expect(hashSeed('abc')).toBe(hashSeed('abc'));
    expect(hashSeed('abc')).not.toBe(hashSeed('abd'));
  });
});

describe('mulberry32', () => {
  it('is deterministic for the same seed', () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    expect(Array.from({ length: 10 }, () => a.next())).toEqual(
      Array.from({ length: 10 }, () => b.next()),
    );
  });
  it('differs across seeds', () => {
    expect(mulberry32(1).next()).not.toBe(mulberry32(2).next());
  });
  it('stays in [0, 1)', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('range/int/pick respect bounds', () => {
    const rng = mulberry32('hello');
    for (let i = 0; i < 200; i++) {
      expect(rng.range(2, 5)).toBeGreaterThanOrEqual(2);
      expect(rng.int(0, 3)).toBeLessThanOrEqual(3);
      expect([10, 20, 30]).toContain(rng.pick([10, 20, 30] as const));
    }
    expect(() => rng.pick([])).toThrow();
  });
});

describe('sfc32', () => {
  it('is deterministic and bounded', () => {
    const a = sfc32(42);
    const b = sfc32(42);
    expect(a.next()).toBe(b.next());
    expect(a.next()).toBeGreaterThanOrEqual(0);
  });
});
