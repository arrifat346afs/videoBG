// Network family (c): Hex Mesh Wave — honeycomb lattice on the wave surface.
// Reference: cyan hex mesh wave with distance-attenuated glow.
import { generatePalette } from '../palettes.ts';
import type { Generator, Params, Rng } from '../types.ts';
import { WaveEngine } from './WaveEngine.ts';
import { cameraParams, depthParams, glowParams, meshParams, surfaceParams } from './params.ts';

const SCHEMA = [
  ...cameraParams({ fov: 50, height: 10, pitch: 2.5, distance: 31, drift: 1.4 }),
  ...surfaceParams({ density: 90, width: 44, depth: 34, amplitude: 2.2, frequency: 0.8, waves: 4 }),
  ...meshParams({ lines: true, dots: true, dotMin: 0.1, dotMax: 0.26, lineWidth: 1.8, shape: 'circle' }),
  ...depthParams({ focus: 26, dof: 0.35, fog: 0.028 }),
  ...glowParams({ crest: 1.1, bloom: 0.7, pulse: 3, pulseSpeed: 1 }),
  { kind: 'color', key: 'dark', label: 'Background', defaultValue: '#031018' },
  { kind: 'color', key: 'a', label: 'Valley', defaultValue: '#0b5b6e' },
  { kind: 'color', key: 'b', label: 'Crest', defaultValue: '#4ef3ff' },
] as const;

function defaults(): Params {
  const o: Params = {};
  for (const d of SCHEMA) o[d.key] = d.defaultValue;
  return o;
}

function rnd(v: number): number {
  return Math.round(v * 100) / 100;
}

export const hexWave: Generator = {
  id: 'hex-wave',
  name: 'Hex Wave',
  kind: 'scene3d',
  category: 'Network',
  paramSchema: [...SCHEMA],
  defaultParams: defaults(),
  createScene3D: (canvas) => new WaveEngine(canvas, { topology: 'hex', faceShading: false }),
  randomize(rng: Rng): Params {
    const pal = generatePalette(rng, rng.pick(['analogous', 'complementary'] as const));
    const c = pal.colors;
    return {
      ...defaults(),
      fov: rng.int(42, 60),
      camHeight: rnd(rng.range(7, 13)),
      distance: rnd(rng.range(26, 37)),
      drift: rnd(rng.range(0.8, 2.2)),
      density: rng.int(60, 120),
      amplitude: rnd(rng.range(1.5, 3.0)),
      frequency: rnd(rng.range(0.55, 1.1)),
      waveCount: rng.int(3, 5),
      direction: rng.int(0, 360),
      flow: rng.int(1, 2),
      showLines: true,
      showDots: rng.next() < 0.7,
      dotMin: rnd(rng.range(0.08, 0.15)),
      dotMax: rnd(rng.range(0.2, 0.34)),
      lineWidth: rnd(rng.range(1.2, 2.6)),
      shape: rng.pick(['circle', 'hexagon', 'glow'] as const),
      pulses: rng.int(0, 5),
      crestGlow: rnd(rng.range(0.7, 1.5)),
      dark: c[0] ?? '#031018',
      a: c[1] ?? '#0b5b6e',
      b: c[2] ?? '#4ef3ff',
    };
  },
};
