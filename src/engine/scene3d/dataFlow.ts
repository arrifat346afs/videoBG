// Network family (f): Data Flow — mixed-size nodes with glowing packets
// traveling along links. Plexus topology + pulses + mixed shapes.
import { generatePalette } from '../palettes.ts';
import type { Generator, ParamDef, Params, Rng } from '../types.ts';
import { WaveEngine } from './WaveEngine.ts';
import { SHAPES, cameraParams, depthParams, glowParams } from './params.ts';

const SCHEMA: readonly ParamDef[] = [
  ...cameraParams({ fov: 50, height: 8, pitch: 1, distance: 35, drift: 1.6 }),
  { kind: 'number', key: 'nodeCount', label: 'Node count', min: 60, max: 500, step: 10, defaultValue: 200 },
  { kind: 'number', key: 'linkDist', label: 'Link dist', min: 3, max: 14, step: 0.5, defaultValue: 9 },
  { kind: 'number', key: 'motion', label: 'Motion', min: 0, max: 2, step: 0.1, defaultValue: 0.6 },
  { kind: 'number', key: 'density', label: 'Density', min: 20, max: 220, step: 5, defaultValue: 110 },
  { kind: 'number', key: 'surfWidth', label: 'Width', min: 10, max: 80, step: 1, defaultValue: 42 },
  { kind: 'number', key: 'surfDepth', label: 'Depth', min: 10, max: 80, step: 1, defaultValue: 30 },
  { kind: 'boolean', key: 'showLines', label: 'Show lines', defaultValue: true },
  { kind: 'boolean', key: 'showDots', label: 'Show dots', defaultValue: true },
  { kind: 'number', key: 'dotMin', label: 'Dot min', min: 0.05, max: 1.5, step: 0.05, defaultValue: 0.14 },
  { kind: 'number', key: 'dotMax', label: 'Dot max', min: 0.1, max: 2.5, step: 0.05, defaultValue: 0.5 },
  { kind: 'number', key: 'lineWidth', label: 'Line width', min: 0.5, max: 5, step: 0.1, defaultValue: 1.4 },
  { kind: 'number', key: 'lineOpacity', label: 'Line opacity', min: 0, max: 1.5, step: 0.05, defaultValue: 0.85 },
  { kind: 'select', key: 'shape', label: 'Node shape', options: SHAPES, defaultValue: 'mixed' },
  ...depthParams({ focus: 27, dof: 0.5, fog: 0.026 }),
  ...glowParams({ crest: 0.8, bloom: 0.7, pulse: 4, pulseSpeed: 1 }),
  { kind: 'color', key: 'dark', label: 'Background', defaultValue: '#04121a' },
  { kind: 'color', key: 'a', label: 'Base', defaultValue: '#0e7490' },
  { kind: 'color', key: 'b', label: 'Packet', defaultValue: '#67e8f9' },
];

function defaults(): Params {
  const o: Params = {};
  for (const d of SCHEMA) o[d.key] = d.defaultValue;
  return o;
}

function rnd(v: number): number {
  return Math.round(v * 100) / 100;
}

export const dataFlow: Generator = {
  id: 'data-flow',
  name: 'Data Flow',
  kind: 'scene3d',
  category: 'Network',
  paramSchema: SCHEMA,
  defaultParams: defaults(),
  createScene3D: (canvas) => new WaveEngine(canvas, { topology: 'plexus', faceShading: false }),
  randomize(rng: Rng): Params {
    const pal = generatePalette(rng, rng.pick(['analogous', 'complementary', 'triadic'] as const));
    const c = pal.colors;
    return {
      ...defaults(),
      fov: rng.int(44, 60),
      camHeight: rnd(rng.range(5, 11)),
      distance: rnd(rng.range(29, 40)),
      nodeCount: rng.int(140, 320),
      linkDist: rnd(rng.range(6.5, 10.5)),
      motion: rnd(rng.range(0.3, 1.0)),
      shape: rng.pick(['mixed', 'mixed', 'circle', 'square'] as const),
      dotMin: rnd(rng.range(0.08, 0.16)),
      dotMax: rnd(rng.range(0.35, 0.6)),
      lineWidth: rnd(rng.range(1.0, 2.0)),
      pulses: rng.int(2, 6),
      pulseSpeed: rng.int(1, 2),
      crestGlow: rnd(rng.range(0.7, 1.4)),
      dark: c[0] ?? '#04121a',
      a: c[1] ?? '#0e7490',
      b: c[2] ?? '#67e8f9',
    };
  },
};
