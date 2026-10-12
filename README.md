# videoBg — procedural abstract motion backgrounds

Web app that generates random, high-quality ANIMATED abstract backgrounds with math,
previews them live, and exports 5s/10s looping video (MP4 via WebCodecs + mediabunny,
WebM fallback via MediaRecorder).

## Stack

- Vite + React 19 + TypeScript (strict) — spec said 18; kept 19 (installed template, no reason to downgrade).
- WebGL2 + custom tiny wrapper (`src/engine/gl.ts`, no `ogl`) — fullscreen triangle, uniform cache, context-loss handling.
- Zustand for state, Tweakpane for settings panel.
- mediabunny (successor to mp4-muxer) + WebCodecs VideoEncoder; MediaRecorder fallback.
- Vitest (53 tests: RNG, loop math, palettes, registry, share, export math).

## Architecture

- `src/engine/` is framework-agnostic (no React imports). `src/ui/` is React only.
  React never touches GL — it calls `Renderer` methods (`setGenerator`, `setParams`,
  `setSeed`, `setPost`, `renderPhase`).
- Every frame is pure `f(generator, params, seed, phase)`, `phase = i / N` in `[0,1)`.
  Motion uses `sin/cos(TAU·phase·k)` (integer k) or `u_time = phase·TAU`, so frame N
  flows into frame 0 with no jump. Seeded `mulberry32`/`sfc32`; no `Math.random`
  in rendering paths.
- `Renderer` does generator → scene FBO → post → screen. Post stack
  (`src/engine/post.ts`): contrast/brightness/saturation, grain, vignette,
  chromatic aberration, posterize.
- `PingPong` (`src/engine/pingpong.ts`) exists for multi-pass (reaction-diffusion
  ships as single-pass approximation with `isMultiPass: true` reserved for a true sim).
- Export is offline and frame-accurate: step `phase = i/total`, render at exact
  export size, encode via `VideoFrame` → mediabunny `VideoSampleSource`. Never
  real-time. Progress + cancel via `AbortSignal`.

## Generators (22)

2D shader generators (16): domain-warp, gradient-mesh, aurora, flow-field,
metaballs, voronoi, plasma, kaleidoscope, truchet, topographic, julia, particles,
halftone, raymarched, reaction-diffusion, god-rays.

3D scene generators (6): wave-mesh, dot-wave, hex-wave, tri-wave, plexus-3d,
data-flow.

## How to add a new generator (one file + one line)

1. Create `src/engine/generators/myStyle.ts`:
   ```ts
   import { generatePalette } from '../palettes.ts';
   import type { Generator, Params, Rng } from '../types.ts';
   const FRAG = `
   in vec2 v_uv;
   out vec4 outColor;
   uniform float u_scale;
   uniform vec3 u_dark;
   // u_resolution, u_phase, u_seed provided by renderer.
   // COMMON_GLSL provides hash12, vnoise, gnoise, snoise, fbm2, smin.
   void main() {
     float t = 6.28318530718 * u_phase; // 0..TAU over one loop
     // ... periodic motion only (integer k in sin/cos(TAU*u_phase*k)) ...
     outColor = vec4(col, 1.0);
   }`;
   export const myStyle: Generator = {
     id: 'my-style', name: 'My Style', fragmentShader: FRAG,
     paramSchema: [{ kind: 'number', key: 'scale', label: 'Scale', min: 1, max: 3, step: 0.05, defaultValue: 2 }],
     defaultParams: { scale: 2 },
     randomize(rng: Rng): Params { return { scale: rng.range(1.4, 2.6) }; },
   };
   ```
   Rules: no `uniform float u_time;` / `u_resolution` redeclaration (renderer
   provides them); color params arrive as `vec3`; motion must be periodic in
   `u_phase`/`u_time`; no `hexToRgb01()` in GLSL (renderer converts hex→vec3).
2. Add one line in `src/engine/generators/index.ts`: import + `registerGenerator(myStyle)` + list entry.

## Scripts

- `bun run dev` / `build` / `lint` / `test` / `typecheck`
- Keyboard: Space play/pause, R randomize, E export.

## Constraints noted

- Shaders are original implementations (standard noise/fBm/SDF techniques).
- No backend, no paid services.
- Files kept under ~300 lines.
