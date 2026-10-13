// Shared plumbing for the vector-style generators (flat, crisp, antialiased
// shapes with a gradient/palette ramp). Keeps the six files small and makes
// randomize() pick a coherent palette every time.
import { generatePalette } from '../palettes.ts';
import { encodeGradient, gradientFromColors, gradientParams } from '../gradient.ts';
import type { Params, ParamDef, Rng } from '../types.ts';

export interface VectorGradient {
  readonly schema: readonly ParamDef[];
  readonly defaults: Params;
  random(rng: Rng): Params;
}

/** Gradient param trio (gradient + shape + angle) with a curated default ramp. */
export function vectorGradient(defaultColors: readonly string[]): VectorGradient {
  const stops = encodeGradient(gradientFromColors(defaultColors, 'oklab'));
  return {
    schema: gradientParams({ stops }),
    defaults: { gradient: stops, gradShape: 'linear', gradAngle: 0 },
    random(rng) {
      const pal = generatePalette(rng, 'random');
      return {
        gradient: encodeGradient(gradientFromColors(pal.colors, rng.next() < 0.5 ? 'oklab' : 'rgb')),
        gradShape: rng.pick(['linear', 'radial', 'conic', 'mesh'] as const),
        gradAngle: Math.round(rng.range(0, 360)),
      };
    },
  };
}

/** Round to 2dp like the other generators. */
export function r2(v: number): number {
  return Math.round(v * 100) / 100;
}
