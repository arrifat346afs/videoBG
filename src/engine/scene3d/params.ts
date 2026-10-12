// Shared paramSchema builders for scene3d generators (grouped for the UI).
import type { ParamDef, Params } from '../types.ts';

export const SHAPES = ['circle', 'ring', 'square', 'diamond', 'triangle', 'hexagon', 'plus', 'glow', 'mixed'] as const;

export function cameraParams(o: {
  fov?: number;
  height?: number;
  pitch?: number;
  distance?: number;
  drift?: number;
  roll?: number;
} = {}): ParamDef[] {
  return [
    { kind: 'number', key: 'fov', label: 'FOV', min: 30, max: 70, step: 1, defaultValue: o.fov ?? 50 },
    { kind: 'number', key: 'camHeight', label: 'Cam height', min: 2, max: 30, step: 0.5, defaultValue: o.height ?? 10 },
    { kind: 'number', key: 'pitch', label: 'Pitch', min: -10, max: 20, step: 0.5, defaultValue: o.pitch ?? 2 },
    { kind: 'number', key: 'distance', label: 'Distance', min: 10, max: 60, step: 1, defaultValue: o.distance ?? 30 },
    { kind: 'number', key: 'drift', label: 'Cam drift', min: 0, max: 8, step: 0.1, defaultValue: o.drift ?? 1.5 },
    { kind: 'number', key: 'roll', label: 'Roll', min: 0, max: 10, step: 0.1, defaultValue: o.roll ?? 0 },
  ];
}

export function surfaceParams(o: {
  density?: number;
  width?: number;
  depth?: number;
  amplitude?: number;
  frequency?: number;
  waves?: number;
  direction?: number;
  flow?: number;
  chop?: number;
  jitter?: number;
  fillFrame?: boolean;
  detail?: number;
  edgeFade?: number;
}): ParamDef[] {
  return [
    { kind: 'boolean', key: 'fillFrame', label: 'Fill frame', defaultValue: o.fillFrame ?? true },
    { kind: 'number', key: 'detail', label: 'Detail', min: 0.3, max: 2.0, step: 0.05, defaultValue: o.detail ?? 1.0 },
    { kind: 'number', key: 'edgeFade', label: 'Edge fade', min: 0, max: 1, step: 0.05, defaultValue: o.edgeFade ?? 0.6 },
    { kind: 'number', key: 'density', label: 'Density', min: 20, max: 220, step: 5, defaultValue: o.density ?? 110 },
    { kind: 'number', key: 'surfWidth', label: 'Spread (width)', min: 10, max: 300, step: 1, defaultValue: o.width ?? 44 },
    { kind: 'number', key: 'surfDepth', label: 'Depth', min: 10, max: 300, step: 1, defaultValue: o.depth ?? 34 },
    { kind: 'number', key: 'amplitude', label: 'Amplitude', min: 0.2, max: 6, step: 0.1, defaultValue: o.amplitude ?? 2.2 },
    { kind: 'number', key: 'frequency', label: 'Frequency', min: 0.2, max: 2.5, step: 0.05, defaultValue: o.frequency ?? 0.9 },
    { kind: 'number', key: 'waveCount', label: 'Waves', min: 2, max: 6, step: 1, defaultValue: o.waves ?? 4 },
    { kind: 'number', key: 'direction', label: 'Direction', min: 0, max: 360, step: 5, defaultValue: o.direction ?? 20 },
    { kind: 'number', key: 'flow', label: 'Flow speed', min: 1, max: 3, step: 1, defaultValue: o.flow ?? 1 },
    { kind: 'number', key: 'chop', label: 'Choppiness', min: 0, max: 1.5, step: 0.05, defaultValue: o.chop ?? 0.2 },
    { kind: 'number', key: 'jitter', label: 'Jitter', min: 0, max: 1, step: 0.05, defaultValue: o.jitter ?? 0.12 },
  ];
}

export function meshParams(o: {
  lines?: boolean;
  dots?: boolean;
  dotMin?: number;
  dotMax?: number;
  lineWidth?: number;
  lineOpacity?: number;
  shape?: string;
  layers?: number;
} = {}): ParamDef[] {
  return [
    { kind: 'boolean', key: 'showLines', label: 'Show lines', defaultValue: o.lines ?? true },
    { kind: 'boolean', key: 'showDots', label: 'Show dots', defaultValue: o.dots ?? true },
    { kind: 'number', key: 'dotMin', label: 'Dot min', min: 0.05, max: 1.5, step: 0.05, defaultValue: o.dotMin ?? 0.18 },
    { kind: 'number', key: 'dotMax', label: 'Dot max', min: 0.1, max: 2.5, step: 0.05, defaultValue: o.dotMax ?? 0.5 },
    { kind: 'number', key: 'lineWidth', label: 'Line width', min: 0.5, max: 5, step: 0.1, defaultValue: o.lineWidth ?? 1.6 },
    { kind: 'number', key: 'lineOpacity', label: 'Line opacity', min: 0, max: 1.5, step: 0.05, defaultValue: o.lineOpacity ?? 0.9 },
    { kind: 'select', key: 'shape', label: 'Node shape', options: SHAPES, defaultValue: o.shape ?? 'circle' },
    { kind: 'number', key: 'layers', label: 'Layers', min: 1, max: 3, step: 1, defaultValue: o.layers ?? 1 },
  ];
}

export function depthParams(o: { focus?: number; dof?: number; fog?: number; horizon?: number; near?: number } = {}): ParamDef[] {
  return [
    { kind: 'number', key: 'focus', label: 'Focus dist', min: 5, max: 60, step: 1, defaultValue: o.focus ?? 26 },
    { kind: 'number', key: 'dof', label: 'DOF strength', min: 0, max: 2, step: 0.05, defaultValue: o.dof ?? 0.6 },
    { kind: 'number', key: 'fog', label: 'Fog', min: 0, max: 0.12, step: 0.002, defaultValue: o.fog ?? 0.028 },
    { kind: 'number', key: 'horizon', label: 'Horizon fade', min: 0, max: 1.5, step: 0.05, defaultValue: o.horizon ?? 0.7 },
    { kind: 'number', key: 'nearFade', label: 'Near fade', min: 0, max: 20, step: 0.5, defaultValue: o.near ?? 4 },
  ];
}

export function glowParams(o: { crest?: number; bloom?: number; pulse?: number; pulseSpeed?: number } = {}): ParamDef[] {
  return [
    { kind: 'number', key: 'crestGlow', label: 'Crest glow', min: 0, max: 3, step: 0.1, defaultValue: o.crest ?? 1.2 },
    { kind: 'number', key: 'bloom', label: 'Bloom', min: 0, max: 2, step: 0.1, defaultValue: o.bloom ?? 0.7 },
    { kind: 'number', key: 'pulses', label: 'Pulses', min: 0, max: 8, step: 1, defaultValue: o.pulse ?? 0 },
    { kind: 'number', key: 'pulseSpeed', label: 'Pulse speed', min: 1, max: 3, step: 1, defaultValue: o.pulseSpeed ?? 1 },
  ];
}

export function num(params: Params, key: string, fallback: number): number {
  const v = params[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export function str(params: Params, key: string, fallback: string): string {
  const v = params[key];
  return typeof v === 'string' ? v : fallback;
}

export function bool(params: Params, key: string, fallback: boolean): boolean {
  const v = params[key];
  return typeof v === 'boolean' ? v : fallback;
}
