// Network family (d): Triangulated Wave — triangle mesh with soft face shading
// by surface height/normal. Reference: teal low-poly crest mesh.
import { generatePalette } from '../palettes.ts';
import type { Generator, Params, Rng } from '../types.ts';
import { WaveEngine } from './WaveEngine.ts';
import { cameraParams, depthParams, glowParams, meshParams, surfaceParams } from './params.ts';

const SCHEMA = [
  ...cameraParams({ fov: 48, height: 12, pitch: 4, distance: 33, drift: 1.2 }),
  ...surfaceParams({ density: 70, width: 44, depth: 34, amplitude: 2.5, frequency: 0.7, waves: 4, jitter: 0.2 }),
  ...meshParams({ lines: true, dots: true, dotMin: 0.12, dotMax: 0.3, lineWidth: 1.2, shape: 'circle' }),
  ...depthParams({ focus: 28, dof: 0.3, fog: 0.024 }),
  ...glowParams({ crest: 0.9, bloom: 0.5 }),
  { kind: 'color', key: 'dark', label: 'Background', defaultValue: '#061314' },
  { kind: 'color', key: 'a', label: 'Valley', defaultValue: '#134e4a' },
  { kind: 'color', key: 'b', label: 'Crest', defaultValue: '#5eead4' },
] as const;

function defaults(): Params {
  const o: Params = {};
  for (const d of SCHEMA) o[d.key] = d.defaultValue;
  return o;
}

function rnd(v: number): number {
  return Math.round(v * 100) / 100;
}

export const triWave: Generator = {
  id: 'tri-wave',
  name: 'Tri Wave',
  kind: 'scene3d',
  category: 'Network',
  paramSchema: [...SCHEMA],
  defaultParams: defaults(),
  createScene3D: (canvas) => new WaveEngine(canvas, { topology: 'tri', faceShading: true }),
  randomize(rng: Rng): Params {
    const pal = generatePalette(rng, rng.pick(['analogous', 'monochrome', 'triadic'] as const));
    const c = pal.colors;
    return {
      ...defaults(),
      fov: rng.int(40, 58),
      camHeight: rnd(rng.range(8, 15)),
      distance: rnd(rng.range(27, 38)),
      density: rng.int(45, 95),
      amplitude: rnd(rng.range(1.6, 3.2)),
      frequency: rnd(rng.range(0.5, 1.0)),
      waveCount: rng.int(3, 5),
      direction: rng.int(0, 360),
      flow: rng.int(1, 2),
      jitter: rnd(rng.range(0.05, 0.35)),
      showLines: rng.next() < 0.85,
      showDots: rng.next() < 0.6,
      lineWidth: rnd(rng.range(0.8, 1.8)),
      crestGlow: rnd(rng.range(0.7, 1.6)),
      dark: c[0] ?? '#061314',
      a: c[1] ?? '#134e4a',
      b: c[2] ?? '#5eead4',
    };
  },
};
