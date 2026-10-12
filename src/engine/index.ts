// Public engine API (framework-agnostic, no React).
export type { Generator, ParamDef, Params, Rng } from './types.ts';
export { generatorKind, isScene3D } from './types.ts';
export type { GeneratorCategory, GeneratorKind, Scene3DFrameState, Scene3DHandle } from './types.ts';
export { generatorCategory } from './registry.ts';
export { mulberry32, sfc32, hashSeed } from './rng.ts';
export { phaseForFrame, timeForPhase, loopSin, loopCos, TAU } from './loop.ts';
export { generatePalette, PRESET_PALETTES, contrastRatio } from './palettes.ts';
export { getResolution, RESOLUTIONS, aspectLabel, resolutionLabel } from './resolutions.ts';
export { registerGenerator, getGenerator, listGenerators } from './registry.ts';
export { Renderer } from './renderer.ts';
export { PingPong } from './pingpong.ts';
export { DEFAULT_POST, POST_FRAG, type PostSettings } from './post.ts';
export { COMMON_GLSL } from './glsl_common.ts';
import './generators/index.ts';
