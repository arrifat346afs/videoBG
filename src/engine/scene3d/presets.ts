// 10+ curated scene3d presets matching the reference looks.
import type { Params } from '../types.ts';

export interface Scene3DPreset {
  readonly name: string;
  readonly generatorId: string;
  readonly seed: number;
  readonly params: Params;
}

export const SCENE3D_PRESETS: readonly Scene3DPreset[] = [
  {
    name: 'Blue Wireframe Wave',
    generatorId: 'wave-mesh',
    seed: 1101,
    params: { fillFrame: true, fov: 52, camHeight: 11, pitch: 3, distance: 32, drift: 1.6, density: 110, amplitude: 2.4, dark: '#040918', a: '#123a8f', b: '#5db9ff', crestGlow: 1.4, bloom: 0.8 },
  },
  {
    name: 'Green Dot Wave',
    generatorId: 'dot-wave',
    seed: 2202,
    params: { fillFrame: true, camHeight: 6.5, distance: 30, density: 160, amplitude: 2.6, layers: 2, shape: 'glow', dark: '#031207', a: '#0a4d2e', b: '#52ff9e', crestGlow: 2.0 },
  },
  {
    name: 'Cyan Hex Wave',
    generatorId: 'hex-wave',
    seed: 3303,
    params: { fillFrame: true, density: 90, amplitude: 2.2, pulses: 3, dark: '#031018', a: '#0b5b6e', b: '#4ef3ff' },
  },
  {
    name: 'Teal Crest Mesh',
    generatorId: 'tri-wave',
    seed: 4404,
    params: { fillFrame: true, density: 70, amplitude: 2.5, dark: '#061314', a: '#134e4a', b: '#5eead4' },
  },
  {
    name: 'Deep Space Plexus',
    generatorId: 'plexus-3d',
    seed: 5505,
    params: { nodeCount: 240, linkDist: 8, shape: 'mixed', dof: 1.1, dark: '#040a1c', a: '#1e3a8a', b: '#9fd8ff' },
  },
  {
    name: 'Neon Mesh',
    generatorId: 'wave-mesh',
    seed: 6606,
    params: { fillFrame: true, density: 130, amplitude: 2.0, frequency: 1.1, dark: '#0d0217', a: '#7c3aed', b: '#f0abfc', crestGlow: 1.8, bloom: 1.1 },
  },
  {
    name: 'Soft Low-Poly Wave',
    generatorId: 'tri-wave',
    seed: 7707,
    params: { fillFrame: true, density: 52, amplitude: 2.8, jitter: 0.3, crestGlow: 0.8, dark: '#0b1026', a: '#334155', b: '#cbd5e1' },
  },
  {
    name: 'Monochrome Minimal',
    generatorId: 'dot-wave',
    seed: 8808,
    params: { fillFrame: true, density: 110, layers: 1, shape: 'circle', crestGlow: 0.9, dark: '#0a0a0f', a: '#3a3a48', b: '#e8e8f0' },
  },
  {
    name: 'Aurora Dot Field',
    generatorId: 'dot-wave',
    seed: 9909,
    params: { fillFrame: true, density: 170, layers: 3, amplitude: 3.0, dark: '#02120e', a: '#0d9488', b: '#a7f3d0', crestGlow: 1.8 },
  },
  {
    name: 'Data Ocean',
    generatorId: 'data-flow',
    seed: 1010,
    params: { nodeCount: 220, pulses: 5, shape: 'mixed', dark: '#04121a', a: '#0e7490', b: '#67e8f9' },
  },
  {
    name: 'Hex Energy Grid',
    generatorId: 'hex-wave',
    seed: 1111,
    params: { fillFrame: true, density: 110, pulses: 5, lineWidth: 2.2, dark: '#06121f', a: '#1d4ed8', b: '#22d3ee', crestGlow: 1.7 },
  },
  {
    name: 'Cyber Blue Plexus',
    generatorId: 'plexus-3d',
    seed: 1212,
    params: { nodeCount: 340, linkDist: 6, shape: 'circle', lineWidth: 1.0, dark: '#020617', a: '#1e40af', b: '#60a5fa' },
  },
];
