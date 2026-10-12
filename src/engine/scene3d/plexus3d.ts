// Network family (e): 3D Plexus / Constellation — clustered points in a 3D
// volume with stable kNN edges, strong DOF bokeh, drifting dust.
// Reference: deep-blue 3D plexus with near glow + far dim + fog.
import { generatePalette } from '../palettes.ts';
import type { Generator, ParamDef, Params, Rng } from '../types.ts';
import { WaveEngine } from './WaveEngine.ts';
import { cameraParams, depthParams, glowParams } from './params.ts';
import { SHAPES } from './params.ts';

const SCHEMA: readonly ParamDef[] = [
  ...cameraParams({ fov: 55, height: 7, pitch: 0, distance: 34, drift: 2.0 }),
  { kind: 'number', key: 'nodeCount', label: 'Node count', min: 60, max: 500, step: 10, defaultValue: 240 },
  { kind: 'number', key: 'linkDist', label: 'Link dist', min: 3, max: 14, step: 0.5, defaultValue: 8 },
  { kind: 'number', key: 'motion', label: 'Motion', min: 0, max: 2, step: 0.1, defaultValue: 0.8 },
  { kind: 'number', key: 'density', label: 'Density', min: 20, max: 220, step: 5, defaultValue: 110 },
  { kind: 'number', key: 'surfWidth', label: 'Width', min: 10, max: 80, step: 1, defaultValue: 40 },
  { kind: 'number', key: 'surfDepth', label: 'Depth', min: 10, max: 80, step: 1, defaultValue: 30 },
  { kind: 'boolean', key: 'showLines', label: 'Show lines', defaultValue: true },
  { kind: 'boolean', key: 'showDots', label: 'Show dots', defaultValue: true },
  { kind: 'number', key: 'dotMin', label: 'Dot min', min: 0.05, max: 1.5, step: 0.05, defaultValue: 0.12 },
  { kind: 'number', key: 'dotMax', label: 'Dot max', min: 0.1, max: 2.5, step: 0.05, defaultValue: 0.38 },
  { kind: 'number', key: 'lineWidth', label: 'Line width', min: 0.5, max: 5, step: 0.1, defaultValue: 1.2 },
  { kind: 'number', key: 'lineOpacity', label: 'Line opacity', min: 0, max: 1.5, step: 0.05, defaultValue: 0.75 },
  { kind: 'select', key: 'shape', label: 'Node shape', options: SHAPES, defaultValue: 'mixed' },
  ...depthParams({ focus: 26, dof: 0.6, fog: 0.03 }),
  ...glowParams({ crest: 0.7, bloom: 0.7 }),
  { kind: 'color', key: 'dark', label: 'Background', defaultValue: '#040a1c' },
  { kind: 'color', key: 'a', label: 'Far', defaultValue: '#1e3a8a' },
  { kind: 'color', key: 'b', label: 'Near', defaultValue: '#9fd8ff' },
];

function defaults(): Params {
  const o: Params = {};
  for (const d of SCHEMA) o[d.key] = d.defaultValue;
  return o;
}

function rnd(v: number): number {
  return Math.round(v * 100) / 100;
}

export const plexus3d: Generator = {
  id: 'plexus-3d',
  name: 'Plexus 3D',
  kind: 'scene3d',
  category: 'Network',
  paramSchema: SCHEMA,
  defaultParams: defaults(),
  createScene3D: (canvas) => new WaveEngine(canvas, { topology: 'plexus', faceShading: false }),
  randomize(rng: Rng): Params {
    const pal = generatePalette(rng, rng.pick(['analogous', 'complementary', 'monochrome'] as const));
    const c = pal.colors;
    const dense = rng.next() < 0.5;
    return {
      ...defaults(),
      fov: rng.int(45, 62),
      camHeight: rnd(rng.range(4, 10)),
      distance: rnd(rng.range(28, 40)),
      drift: rnd(rng.range(1.0, 3.0)),
      nodeCount: dense ? rng.int(280, 420) : rng.int(120, 240),
      linkDist: rnd(dense ? rng.range(5, 7.5) : rng.range(7, 11)),
      motion: rnd(rng.range(0.3, 1.2)),
      dotMin: rnd(dense ? rng.range(0.06, 0.12) : rng.range(0.1, 0.18)),
      dotMax: rnd(dense ? rng.range(0.2, 0.35) : rng.range(0.35, 0.6)),
      lineWidth: rnd(dense ? rng.range(0.7, 1.2) : rng.range(1.0, 1.8)),
      lineOpacity: rnd(rng.range(0.5, 1.0)),
      shape: dense ? 'circle' : rng.pick(['circle', 'mixed', 'glow', 'ring'] as const),
      focus: rnd(rng.range(20, 32)),
      dof: rnd(rng.range(0.3, 0.8)),
      fog: rnd(rng.range(0.02, 0.04)),
      dark: c[0] ?? '#040a1c',
      a: c[1] ?? '#1e3a8a',
      b: c[3] ?? '#9fd8ff',
    };
  },
};
