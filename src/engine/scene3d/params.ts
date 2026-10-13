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

/** Mound-terrain params for the low-poly terrain generator. */
export function terrainParams(o: {
  mounds?: number;
  hero?: number;
  radius?: number;
  elongation?: number;
  curl?: number;
  floorNoise?: number;
  flow?: number;
  jitter?: number;
  flip?: number;
  density?: number;
  width?: number;
  depth?: number;
  fillFrame?: boolean;
  detail?: number;
  edgeFade?: number;
} = {}): ParamDef[] {
  return [
    { kind: 'number', key: 'moundCount', label: 'Mounds', min: 1, max: 4, step: 1, defaultValue: o.mounds ?? 2 },
    { kind: 'number', key: 'heroHeight', label: 'Hero height', min: 1, max: 10, step: 0.1, defaultValue: o.hero ?? 4.5 },
    { kind: 'number', key: 'moundRadius', label: 'Mound radius', min: 3, max: 20, step: 0.5, defaultValue: o.radius ?? 7 },
    { kind: 'number', key: 'elongation', label: 'Ridge elongation', min: 1, max: 3, step: 0.1, defaultValue: o.elongation ?? 1.6 },
    { kind: 'number', key: 'curl', label: 'Curl', min: 0, max: 1.5, step: 0.05, defaultValue: o.curl ?? 0.55 },
    { kind: 'number', key: 'floorNoise', label: 'Floor noise', min: 0, max: 1, step: 0.05, defaultValue: o.floorNoise ?? 0.25 },
    { kind: 'number', key: 'flow', label: 'Flow speed', min: 1, max: 3, step: 1, defaultValue: o.flow ?? 1 },
    { kind: 'number', key: 'jitter', label: 'Triangle jitter', min: 0, max: 0.35, step: 0.01, defaultValue: o.jitter ?? 0.08 },
    { kind: 'number', key: 'flip', label: 'Diagonal flip', min: 0, max: 1, step: 0.05, defaultValue: o.flip ?? 0.6 },
    { kind: 'number', key: 'density', label: 'Density', min: 40, max: 220, step: 5, defaultValue: o.density ?? 150 },
    { kind: 'number', key: 'surfWidth', label: 'Spread (width)', min: 40, max: 300, step: 1, defaultValue: o.width ?? 120 },
    { kind: 'number', key: 'surfDepth', label: 'Depth', min: 40, max: 300, step: 1, defaultValue: o.depth ?? 90 },
    { kind: 'boolean', key: 'fillFrame', label: 'Fill frame', defaultValue: o.fillFrame ?? true },
    { kind: 'number', key: 'detail', label: 'Detail', min: 0.3, max: 2.0, step: 0.05, defaultValue: o.detail ?? 1.0 },
    { kind: 'number', key: 'edgeFade', label: 'Edge fade', min: 0, max: 1, step: 0.05, defaultValue: o.edgeFade ?? 0.55 },
  ];
}

/** Two coloured directional lights + translucency for flat-shaded terrain. */
export function dualLightParams(o: {
  a?: string;
  azA?: number;
  elA?: number;
  intA?: number;
  b?: string;
  azB?: number;
  elB?: number;
  intB?: number;
  ambient?: number;
  wrap?: number;
  rim?: number;
  alpha?: number;
  backface?: number;
  bloom?: number;
} = {}): ParamDef[] {
  return [
    { kind: 'color', key: 'lightA', label: 'Light A', defaultValue: o.a ?? '#ff2b4e' },
    { kind: 'number', key: 'azA', label: 'Light A azimuth', min: -180, max: 180, step: 1, defaultValue: o.azA ?? -70 },
    { kind: 'number', key: 'elA', label: 'Light A elevation', min: 0, max: 90, step: 1, defaultValue: o.elA ?? 22 },
    { kind: 'number', key: 'intA', label: 'Light A intensity', min: 0, max: 2.5, step: 0.05, defaultValue: o.intA ?? 1.3 },
    { kind: 'color', key: 'lightB', label: 'Light B', defaultValue: o.b ?? '#27e6ff' },
    { kind: 'number', key: 'azB', label: 'Light B azimuth', min: -180, max: 180, step: 1, defaultValue: o.azB ?? 70 },
    { kind: 'number', key: 'elB', label: 'Light B elevation', min: 0, max: 90, step: 1, defaultValue: o.elB ?? 20 },
    { kind: 'number', key: 'intB', label: 'Light B intensity', min: 0, max: 2.5, step: 0.05, defaultValue: o.intB ?? 1.15},
    { kind: 'number', key: 'ambient', label: 'Ambient', min: 0, max: 0.2, step: 0.005, defaultValue: o.ambient ?? 0.03 },
    { kind: 'number', key: 'wrap', label: 'Light wrap', min: 0, max: 1, step: 0.05, defaultValue: o.wrap ?? 0.15 },
    { kind: 'number', key: 'rim', label: 'Rim strength', min: 0, max: 2, step: 0.05, defaultValue: o.rim ?? 0.7 },
    { kind: 'number', key: 'faceAlpha', label: 'Face translucency', min: 0.15, max: 0.9, step: 0.05, defaultValue: o.alpha ?? 0.45 },
    { kind: 'number', key: 'backface', label: 'Back-face intensity', min: 0, max: 1, step: 0.05, defaultValue: o.backface ?? 0.45 },
    { kind: 'number', key: 'bloom', label: 'Bloom', min: 0, max: 2, step: 0.1, defaultValue: o.bloom ?? 0.5 },
  ];
}

/** Dots + barycentric edges for the terrain mesh (single layer). */
export function terrainMeshParams(o: {
  lines?: boolean;
  dots?: boolean;
  dotMin?: number;
  dotMax?: number;
  dotBoost?: number;
  lineWidth?: number;
  lineOpacity?: number;
  edgeOpacity?: number;
  edgeWidth?: number;
} = {}): ParamDef[] {
  return [
    { kind: 'boolean', key: 'showLines', label: 'Show lines', defaultValue: o.lines ?? false },
    { kind: 'boolean', key: 'showDots', label: 'Show dots', defaultValue: o.dots ?? true },
    { kind: 'number', key: 'dotMin', label: 'Dot min', min: 0.05, max: 1.5, step: 0.05, defaultValue: o.dotMin ?? 0.14 },
    { kind: 'number', key: 'dotMax', label: 'Dot max', min: 0.1, max: 2.5, step: 0.05, defaultValue: o.dotMax ?? 0.34 },
    { kind: 'number', key: 'dotBoost', label: 'Dot mound boost', min: 0, max: 2, step: 0.1, defaultValue: o.dotBoost ?? 1.0 },
    { kind: 'number', key: 'lineWidth', label: 'Line width', min: 0.5, max: 5, step: 0.1, defaultValue: o.lineWidth ?? 1.2 },
    { kind: 'number', key: 'lineOpacity', label: 'Line opacity', min: 0, max: 1.5, step: 0.05, defaultValue: o.lineOpacity ?? 0.5 },
    { kind: 'number', key: 'edgeOpacity', label: 'Edge opacity', min: 0, max: 1, step: 0.05, defaultValue: o.edgeOpacity ?? 0.22 },
    { kind: 'number', key: 'edgeWidth', label: 'Edge width', min: 0.5, max: 3, step: 0.1, defaultValue: o.edgeWidth ?? 1.0 },
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
