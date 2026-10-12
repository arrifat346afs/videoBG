// Seedable PRNGs for deterministic rendering.
// Never use Math.random() in rendering paths.

import type { Rng } from './types.ts';

/** 32-bit hash of a string seed (FNV-1a). */
export function hashSeed(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function normalizeSeed(seed: number | string): number {
  if (typeof seed === 'string') return hashSeed(seed);
  return seed >>> 0;
}

/** Mulberry32 — small, fast, good enough for params/palettes. */
export function mulberry32(seed: number | string): Rng {
  let a = normalizeSeed(seed);
  const next = (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return makeRng(next);
}

/** SFC32 — slightly higher quality than mulberry32. */
export function sfc32(seed: number | string, ...extra: readonly number[]): Rng {
  let a = normalizeSeed(seed);
  let b = extra[0] ?? 0x9e3779b9;
  let c = extra[1] ?? 0x85ebca6b;
  let d = extra[2] ?? 0xc2b2ae35;
  const next = (): number => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  // Warm up.
  for (let i = 0; i < 8; i++) next();
  return makeRng(next);
}

function makeRng(next: () => number): Rng {
  return {
    next,
    range(min: number, max: number): number {
      return min + (max - min) * next();
    },
    int(min: number, max: number): number {
      // Inclusive bounds.
      return Math.floor(next() * (max - min + 1)) + min;
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error('rng.pick: empty array');
      const i = Math.floor(next() * items.length) % items.length;
      const v = items[i];
      if (v === undefined) throw new Error('rng.pick: out of bounds');
      return v;
    },
  };
}
