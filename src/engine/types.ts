// Framework-agnostic generator types. No React imports allowed in src/engine.

export type ParamType = 'number' | 'color' | 'boolean' | 'select';

export interface NumberParamDef {
  readonly kind: 'number';
  readonly key: string;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly defaultValue: number;
}

export interface ColorParamDef {
  readonly kind: 'color';
  readonly key: string;
  readonly label: string;
  readonly defaultValue: string; // #rrggbb
}

export interface BooleanParamDef {
  readonly kind: 'boolean';
  readonly key: string;
  readonly label: string;
  readonly defaultValue: boolean;
}

export interface SelectParamDef {
  readonly kind: 'select';
  readonly key: string;
  readonly label: string;
  readonly options: readonly string[];
  readonly defaultValue: string;
}

export interface GradientParamDef {
  readonly kind: 'gradient';
  readonly key: string;
  readonly label: string;
  /** Encoded gradient (see engine/gradient.ts encodeGradient). */
  readonly defaultValue: string;
}

export type ParamDef =
  | NumberParamDef
  | ColorParamDef
  | BooleanParamDef
  | SelectParamDef
  | GradientParamDef;

export type ParamValue = number | string | boolean;
export type Params = Record<string, ParamValue>;

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  range(min: number, max: number): number;
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
}

export type GeneratorKind = 'shader2d' | 'scene3d';
export type GeneratorCategory = 'Organic' | 'Geometric' | 'Light' | 'Network';

export interface PostSettingsLike {
  readonly contrast: number;
  readonly brightness: number;
  readonly saturation: number;
  readonly grain: number;
  readonly vignette: number;
  readonly chromAb: number;
  readonly posterize: number;
}

export interface Scene3DFrameState {
  readonly phase: number;
  readonly params: Params;
  readonly seed: number;
  readonly post: PostSettingsLike;
  readonly width: number;
  readonly height: number;
}

export interface Scene3DHandle {
  render(state: Scene3DFrameState): void;
  dispose(): void;
}

export interface Generator {
  readonly id: string;
  readonly name: string;
  readonly kind?: GeneratorKind;
  readonly category?: GeneratorCategory;
  /** Full fragment shader source (GLSL ES 3.0). Required when kind is shader2d. */
  readonly fragmentShader?: string;
  /** Multi-pass generators use ping-pong framebuffers and receive u_c1/u_d1 textures. */
  readonly isMultiPass?: boolean;
  readonly paramSchema: readonly ParamDef[];
  readonly defaultParams: Params;
  randomize(rng: Rng): Params;
  /** Scene3D factories implement this; Renderer/Preview/Export branch on kind. */
  readonly createScene3D?: (canvas: HTMLCanvasElement) => Scene3DHandle;
}

export function generatorKind(gen: Generator): GeneratorKind {
  return gen.kind ?? 'shader2d';
}

export function isScene3D(gen: Generator): boolean {
  return generatorKind(gen) === 'scene3d';
}

export type ResolutionPresetId =
  | '720p'
  | '1080p'
  | '1440p'
  | '4k'
  | 'vertical'
  | 'square'
  | 'std43'
  | 'wide21';

export interface Resolution {
  readonly width: number;
  readonly height: number;
  readonly label: string;
}

export type Harmony =
  | 'analogous'
  | 'complementary'
  | 'split-complementary'
  | 'triadic'
  | 'tetradic'
  | 'monochrome'
  | 'gradient-ramp'
  | 'pastel'
  | 'vibrant'
  | 'random';

export interface Palette {
  /** 3-8 hex colors, e.g. ["#0b1026", ...]. */
  readonly colors: readonly string[];
  readonly harmony: Harmony;
}
