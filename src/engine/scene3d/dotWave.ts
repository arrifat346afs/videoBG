// Network family (b): Dot Wave — dense glowing point-cloud terrain with ridge
// highlights. Reference: green dotted wave. Dots only, low camera, layers.
import { generatePalette } from '../palettes.ts';
import type { Generator, Params, Rng } from '../types.ts';
import { WaveEngine } from './WaveEngine.ts';
import { cameraParams, depthParams, glowParams, meshParams, surfaceParams } from './params.ts';

const SCHEMA = [
  ...cameraParams({ fov: 55, height: 6.5, pitch: 1, distance: 30, drift: 1.2 }),
  ...surfaceParams({ density: 130, width: 46, depth: 36, amplitude: 2.6, frequency: 1.0, waves: 4 }),
  ...meshParams({ lines: false, dots: true, dotMin: 0.1, dotMax: 0.3, lineWidth: 1.2, shape: 'glow', layers: 1 }),
  ...depthParams({ focus: 24, dof: 0.35, fog: 0.03 }),
  ...glowParams({ crest: 1.2, bloom: 0.6 }),
  { kind: 'color', key: 'dark', label: 'Background', defaultValue: '#031207' },
  { kind: 'color', key: 'a', label: 'Valley', defaultValue: '#0a4d2e' },
  { kind: 'color', key: 'b', label: 'Crest', defaultValue: '#52ff9e' },
] as const;

function defaults(): Params {
  const o: Params = {};
  for (const d of SCHEMA) o[d.key] = d.defaultValue;
  return o;
}

function rnd(v: number): number {
  return Math.round(v * 100) / 100;
}

export const dotWave: Generator = {
  id: 'dot-wave',
  name: 'Dot Wave',
  kind: 'scene3d',
  category: 'Network',
  paramSchema: [...SCHEMA],
  defaultParams: defaults(),
  createScene3D: (canvas) => new WaveEngine(canvas, { topology: 'grid', faceShading: false }),
  randomize(rng: Rng): Params {
    const green = rng.next() < 0.55;
    const pal = green ? generatePalette(rng, 'analogous') : generatePalette(rng, rng.pick(['analogous', 'triadic'] as const));
    const c = pal.colors;
    return {
      ...defaults(),
      fov: rng.int(48, 62),
      camHeight: rnd(rng.range(4.5, 9)),
      distance: rnd(rng.range(26, 36)),
      drift: rnd(rng.range(0.6, 1.8)),
      density: rng.int(100, 150),
      amplitude: rnd(rng.range(1.8, 3.4)),
      frequency: rnd(rng.range(0.7, 1.3)),
      waveCount: rng.int(3, 5),
      direction: rng.int(0, 360),
      flow: rng.int(1, 2),
      showLines: rng.next() < 0.12,
      showDots: true,
      dotMin: rnd(rng.range(0.06, 0.12)),
      dotMax: rnd(rng.range(0.2, 0.34)),
      shape: rng.pick(['glow', 'glow', 'circle'] as const),
      layers: rng.int(1, 2),
      crestGlow: rnd(rng.range(0.8, 1.6)),
      bloom: rnd(rng.range(0.3, 0.8)),
      dark: green ? '#031207' : (c[0] ?? '#031207'),
      a: green ? '#0a4d2e' : (c[1] ?? '#0a4d2e'),
      b: green ? '#52ff9e' : (c[2] ?? '#52ff9e'),
    };
  },
};
