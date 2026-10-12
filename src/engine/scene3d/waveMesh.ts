// Network family (a): Wave Mesh — grid wireframe + vertex dots on a rolling
// wave surface in perspective. Reference: blue wireframe wave.
import { generatePalette } from '../palettes.ts';
import type { Generator, Params, Rng } from '../types.ts';
import { WaveEngine } from './WaveEngine.ts';
import { cameraParams, depthParams, glowParams, meshParams, surfaceParams } from './params.ts';

const SCHEMA = [
  ...cameraParams({ fov: 52, height: 11, pitch: 3, distance: 32, drift: 1.6 }),
  ...surfaceParams({ density: 110, width: 44, depth: 34, amplitude: 2.4, frequency: 0.85, waves: 4 }),
  ...meshParams({ lines: true, dots: true, dotMin: 0.12, dotMax: 0.3, lineWidth: 1.6, shape: 'circle' }),
  ...depthParams({ focus: 27, dof: 0.3, fog: 0.026 }),
  ...glowParams({ crest: 1.0, bloom: 0.6 }),
  { kind: 'color', key: 'dark', label: 'Background', defaultValue: '#040918' },
  { kind: 'color', key: 'a', label: 'Valley', defaultValue: '#123a8f' },
  { kind: 'color', key: 'b', label: 'Crest', defaultValue: '#5db9ff' },
] as const;

type Schema = typeof SCHEMA;
function defaults(): Params {
  const o: Params = {};
  for (const d of SCHEMA) o[d.key] = d.defaultValue;
  return o;
}

function rnd(v: number): number {
  return Math.round(v * 100) / 100;
}

export const waveMesh: Generator = {
  id: 'wave-mesh',
  name: 'Wave Mesh',
  kind: 'scene3d',
  category: 'Network',
  paramSchema: [...SCHEMA],
  defaultParams: defaults(),
  createScene3D: (canvas) => new WaveEngine(canvas, { topology: 'grid', faceShading: false }),
  randomize(rng: Rng): Params {
    const pal = generatePalette(rng, rng.pick(['analogous', 'complementary', 'triadic'] as const));
    const c = pal.colors;
    return {
      ...defaults(),
      fov: rng.int(42, 60),
      camHeight: rnd(rng.range(7, 14)),
      pitch: rnd(rng.range(0, 6)),
      distance: rnd(rng.range(26, 38)),
      drift: rnd(rng.range(0.8, 2.5)),
      density: rng.int(80, 140),
      fillFrame: true,
      detail: rnd(rng.range(0.7, 1.4)),
      edgeFade: rnd(rng.range(0.4, 0.9)),
      surfWidth: rng.int(50, 120),
      surfDepth: rng.int(40, 90),
      amplitude: rnd(rng.range(1.6, 3.2)),
      frequency: rnd(rng.range(0.6, 1.2)),
      waveCount: rng.int(3, 5),
      direction: rng.int(0, 360),
      flow: rng.int(1, 2),
      chop: rnd(rng.range(0.05, 0.4)),
      showLines: true,
      showDots: rng.next() < 0.75,
      dotMin: rnd(rng.range(0.08, 0.16)),
      dotMax: rnd(rng.range(0.2, 0.36)),
      lineWidth: rnd(rng.range(1.0, 2.4)),
      lineOpacity: rnd(rng.range(0.6, 1.1)),
      shape: rng.pick(['circle', 'circle', 'glow'] as const),
      crestGlow: rnd(rng.range(0.6, 1.4)),
      bloom: rnd(rng.range(0.3, 0.8)),
      dark: c[0] ?? '#040918',
      a: c[1] ?? '#123a8f',
      b: c[2] ?? '#5db9ff',
    };
  },
};

export type { Schema };
