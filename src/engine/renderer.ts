// Frame-accurate renderer: every frame = f(generator, params, seed, phase).
// Single-pass in M2; owns a PingPong for future multi-pass generators.

import { createFullscreenPass, createGL, createProgram, FULLSCREEN_VERT } from './gl.ts';
import { COMMON_GLSL } from './glsl_common.ts';
import { COMPOSITE_FRAG, blendIndex } from './composite.ts';
import { decodeGradient, gradientUniforms, migrateParams } from './gradient.ts';
import type { GradientStops } from './gradient.ts';
import { visibleLayers } from './layers.ts';
import { getGenerator } from './registry.ts';
import { PingPong } from './pingpong.ts';
import { DEFAULT_POST, POST_FRAG, type PostSettings } from './post.ts';
import type { Generator, Layer, Params } from './types.ts';
import { hexToRgb01 } from './palettes.ts';

export interface RendererEvents {
  onContextLost?: () => void;
  onContextRestored?: () => void;
  onError?: (msg: string) => void;
}

const SHADER_HEADER = `#version 300 es
precision highp float;
uniform vec2 u_resolution;
uniform float u_phase;
uniform float u_seed;
uniform float u_time;
`;

const TAU_F = 6.28318530718;

/**
 * Fragment contract:
 * - `in vec2 v_uv; out vec4 outColor;`
 * - standard uniforms above + `uniform float u_<number>`,
 *   `uniform vec3 u_<color>`, `uniform int u_<bool|select>`.
 * - motion must be periodic in u_phase (sin/cos(TAU*u_phase*k)).
 */
export class Renderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext | null = null;
  private pass: { dispose(gl: WebGL2RenderingContext): void; draw(gl: WebGL2RenderingContext): void } | null = null;
  private prog: WebGLProgram | null = null;
  private progGenId = '';
  private locs = new Map<string, WebGLUniformLocation | null>();
  private postProg: WebGLProgram | null = null;
  private postLocs = new Map<string, WebGLUniformLocation | null>();
  private compProg: WebGLProgram | null = null;
  private compLocs = new Map<string, WebGLUniformLocation | null>();
  private layerFbo: WebGLFramebuffer | null = null;
  private layerTex: WebGLTexture | null = null;
  private layerW = 0;
  private layerH = 0;
  private accum: PingPong | null = null;
  private progs = new Map<string, { prog: WebGLProgram; locs: Map<string, WebGLUniformLocation | null> }>();
  private layers: readonly Layer[] = [];
  private layerSources = new Map<string, TexImageSource>();
  private outputTex: WebGLTexture | null = null;
  private sceneFbo: WebGLFramebuffer | null = null;
  private sceneTex: WebGLTexture | null = null;
  private sceneW = 0;
  private sceneH = 0;
  private pingpong: PingPong | null = null;
  private gen: Generator | null = null;
  private params: Params = {};
  private post: PostSettings = { ...DEFAULT_POST };
  private seed = 0;
  private quality = 0.5;
  private lost = false;
  private disposed = false;
  private events: RendererEvents;

  constructor(canvas: HTMLCanvasElement, events: RendererEvents = {}, glAttrs?: WebGLContextAttributes) {
    this.canvas = canvas;
    this.events = events;
    this.gl = createGL(
      canvas,
      {
        onLost: () => {
          // A disposed renderer must not touch global state: under React
          // StrictMode (dev) / HMR the preview effect mounts, cleans up and
          // remounts on the SAME canvas element, and the stale instance's
          // teardown events would otherwise stick the UI in "lost" forever.
          if (this.disposed) return;
          this.lost = true;
          this.events.onContextLost?.();
        },
        onRestored: () => {
          if (this.disposed) return;
          this.lost = false;
          this.prog = null;
          this.postProg = null;
          this.compProg = null;
          this.sceneFbo = null;
          this.sceneTex = null;
          this.layerFbo = null;
          this.layerTex = null;
          this.sceneW = 0;
          this.sceneH = 0;
          this.layerW = 0;
          this.layerH = 0;
          this.accum = null;
          this.outputTex = null;
          this.progs.clear();
          this.progGenId = '';
          this.locs.clear();
          this.postLocs.clear();
          this.compLocs.clear();
          // GL object handles (incl. the fullscreen pass) are invalid after a
          // restore and must be recreated, not just un-cached.
          const gl = this.gl;
          if (gl) {
            try {
              this.pass?.dispose(gl);
            } catch {
              /* handles already invalid */
            }
            this.pass = createFullscreenPass(gl);
          }
          if (this.gen) this.ensureProgram(this.gen);
          this.events.onContextRestored?.();
        },
      },
      glAttrs,
    );
    if (this.gl) {
      if (this.gl.isContextLost()) {
        // Reused canvas whose previous occupant left the context lost (e.g.
        // dispose-with-release before a remount). Best-effort restore; the
        // restored handler above rebuilds everything when it fires.
        this.lost = true;
        try {
          this.gl.getExtension('WEBGL_lose_context')?.restoreContext();
        } catch {
          /* restore will arrive via the event, or not at all */
        }
        this.events.onContextLost?.();
      } else {
        this.pass = createFullscreenPass(this.gl);
      }
    } else {
      this.events.onError?.('WebGL2 is not available in this browser.');
    }
  }

  get isReady(): boolean {
    return this.gl !== null && !this.lost;
  }
  get isContextLost(): boolean {
    return this.lost;
  }
  get canvasEl(): HTMLCanvasElement {
    return this.canvas;
  }
  get framebuffer(): PingPong | null {
    return this.pingpong;
  }

  setGenerator(gen: Generator): void {
    this.gen = gen;
    this.params = migrateParams(gen, { ...gen.defaultParams });
    this.ensureProgram(gen);
  }

  setParams(params: Params): void {
    this.params = this.gen ? migrateParams(this.gen, { ...params }) : { ...params };
  }

  setPost(post: PostSettings): void {
    this.post = { ...post };
  }

  getPost(): PostSettings {
    return { ...this.post };
  }

  setSeed(seed: number): void {
    this.seed = seed >>> 0;
  }

  /** Set the mix stack. When non-empty, renderPhase composites these layers. */
  setLayers(layers: readonly Layer[]): void {
    this.layers = layers;
  }

  /** Provide an external pixel source (e.g. the scene3d canvas) for a layer id. */
  setLayerSource(id: string, source: TexImageSource | null): void {
    if (source) this.layerSources.set(id, source);
    else this.layerSources.delete(id);
  }

  setQuality(q: number): void {
    this.quality = Math.min(1, Math.max(0.15, q));
    this.resizeToClient();
  }

  /** Backing store = CSS size * devicePixelRatio * quality. Call on resize. */
  resizeToClient(): void {
    const dpr =
      typeof window !== 'undefined' && window.devicePixelRatio
        ? Math.min(2, window.devicePixelRatio)
        : 1;
    const rect = this.canvas.getBoundingClientRect();
    const cssW = Math.max(2, Math.round(rect.width || this.canvas.clientWidth || 640));
    const cssH = Math.max(2, Math.round(rect.height || this.canvas.clientHeight || 360));
    const w = Math.max(2, Math.floor(cssW * this.quality * dpr));
    const h = Math.max(2, Math.floor(cssH * this.quality * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.pingpong?.resize(Math.floor(w / 2), Math.floor(h / 2));
  }

  ensurePingPong(scale = 0.5): PingPong | null {
    if (!this.gl) return null;
    const w = Math.max(2, Math.floor(this.canvas.width * scale));
    const h = Math.max(2, Math.floor(this.canvas.height * scale));
    if (!this.pingpong) this.pingpong = new PingPong(this.gl, w, h);
    else this.pingpong.resize(w, h);
    return this.pingpong;
  }

  /** Deterministic single-frame render. phase in [0, 1). Layer stack -> composite -> post -> screen. */
  renderPhase(phase: number): void {
    const gl = this.gl;
    if (!gl || this.lost || this.disposed || !this.pass) return;
    this.ensurePost();
    if (!this.postProg) return;
    const p = phase - Math.floor(phase);
    const seed01 = (this.seed >>> 0) / 4294967296;
    const W = this.canvas.width;
    const H = this.canvas.height;
    if (this.layers.length > 0) {
      if (!this.renderLayerStack(gl, p, W, H)) return;
    } else {
      const gen = this.gen;
      if (!gen || !this.renderSingle(gl, gen, p, seed01, W, H)) return;
    }
    this.runPost(gl, p, seed01, W, H);
  }

  private renderSingle(
    gl: WebGL2RenderingContext,
    gen: Generator,
    p: number,
    seed01: number,
    W: number,
    H: number,
  ): boolean {
    this.ensureProgram(gen);
    this.ensureScene(gl);
    if (!this.prog || !this.locs || !this.sceneFbo) return false;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFbo);
    gl.viewport(0, 0, W, H);
    this.bindGenerator(gl, gen, this.params, this.prog, this.locs, W, H, p, seed01);
    this.pass?.draw(gl);
    this.outputTex = this.sceneTex;
    return true;
  }

  private runPost(
    gl: WebGL2RenderingContext,
    p: number,
    seed01: number,
    W: number,
    H: number,
  ): void {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.useProgram(this.postProg);
    const pl = (n: string): WebGLUniformLocation | null | undefined => {
      if (!this.postProg) return null;
      if (!this.postLocs.has(n)) this.postLocs.set(n, gl.getUniformLocation(this.postProg, n));
      return this.postLocs.get(n);
    };
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.outputTex ?? this.sceneTex);
    const lScene = pl('u_scene');
    if (lScene) gl.uniform1i(lScene, 0);
    const lRes = pl('u_resolution');
    if (lRes) gl.uniform2f(lRes, W, H);
    const lPh = pl('u_phase');
    if (lPh) gl.uniform1f(lPh, p);
    const lSeed = pl('u_seed');
    if (lSeed) gl.uniform1f(lSeed, seed01);
    const set1 = (n: string, v: number): void => {
      const l = pl(n);
      if (l) gl.uniform1f(l, v);
    };
    set1('u_contrast', this.post.contrast);
    set1('u_brightness', this.post.brightness);
    set1('u_saturation', this.post.saturation);
    set1('u_grain', this.post.grain);
    set1('u_vignette', this.post.vignette);
    set1('u_chromAb', this.post.chromAb);
    set1('u_posterize', this.post.posterize);
    this.pass?.draw(gl);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  /** Render each 2D layer to a scratch texture, then blend into the accumulation. */
  private renderLayerStack(gl: WebGL2RenderingContext, p: number, W: number, H: number): boolean {
    this.ensureComposite();
    this.ensureLayer(gl);
    this.ensureAccum(gl);
    if (!this.compProg || !this.layerFbo || !this.layerTex || !this.accum) return false;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.accum.writeFbo);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.accum.swap();

    const list = visibleLayers(this.layers);
    let any = false;
    for (const layer of list) {
      const gen = getGenerator(layer.generatorId);
      const src = this.layerSources.get(layer.id);
      if (gen && gen.fragmentShader) {
        this.ensureProgram(gen);
        if (!this.prog || !this.locs) continue;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.layerFbo);
        gl.viewport(0, 0, W, H);
        const lseed = (layer.seed >>> 0) / 4294967296;
        this.bindGenerator(gl, gen, layer.params, this.prog, this.locs, W, H, p, lseed);
        this.pass?.draw(gl);
      } else if (src) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.layerFbo);
        gl.viewport(0, 0, W, H);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.layerTex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        try {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, src);
        } catch {
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
          gl.bindTexture(gl.TEXTURE_2D, null);
          continue;
        }
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.bindTexture(gl.TEXTURE_2D, null);
      } else {
        continue;
      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, this.accum.writeFbo);
      gl.viewport(0, 0, W, H);
      gl.useProgram(this.compProg);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.accum.readTexture);
      const lb = this.compLoc(gl, 'u_base');
      if (lb) gl.uniform1i(lb, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.layerTex);
      const ll = this.compLoc(gl, 'u_layer');
      if (ll) gl.uniform1i(ll, 1);
      const lo = this.compLoc(gl, 'u_opacity');
      if (lo) gl.uniform1f(lo, Math.max(0, Math.min(1, layer.opacity)));
      const lbl = this.compLoc(gl, 'u_blend');
      if (lbl) gl.uniform1i(lbl, blendIndex(layer.blend));
      this.pass?.draw(gl);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, null);
      this.accum.swap();
      any = true;
    }
    this.outputTex = any ? this.accum.readTexture : this.sceneTex;
    return true;
  }

  private bindGenerator(
    gl: WebGL2RenderingContext,
    gen: Generator,
    params: Params,
    prog: WebGLProgram,
    locs: Map<string, WebGLUniformLocation | null>,
    W: number,
    H: number,
    p: number,
    seed01: number,
  ): void {
    gl.useProgram(prog);
    const loc = (n: string): WebGLUniformLocation | null | undefined => {
      if (!locs.has(n)) locs.set(n, gl.getUniformLocation(prog, n));
      return locs.get(n);
    };
    const lRes = loc('u_resolution');
    if (lRes) gl.uniform2f(lRes, W, H);
    const lPh = loc('u_phase');
    if (lPh) gl.uniform1f(lPh, p);
    const lSeed = loc('u_seed');
    if (lSeed) gl.uniform1f(lSeed, seed01);
    const lTime = loc('u_time');
    if (lTime) gl.uniform1f(lTime, p * TAU_F);
    for (const def of gen.paramSchema) {
      const v = params[def.key] ?? def.defaultValue;
      const name = `u_${def.key}`;
      if (def.kind === 'number' && typeof v === 'number') {
        const l = loc(name);
        if (l) gl.uniform1f(l, v);
      } else if (def.kind === 'color' && typeof v === 'string') {
        const l = loc(name);
        if (l) {
          try {
            const [r, g, b] = hexToRgb01(v);
            gl.uniform3f(l, r ?? 0, g ?? 0, b ?? 0);
          } catch {
            gl.uniform3f(l, 1, 0, 1);
          }
        }
      } else if (def.kind === 'boolean' && typeof v === 'boolean') {
        const l = loc(name);
        if (l) gl.uniform1i(l, v ? 1 : 0);
      } else if (def.kind === 'select' && typeof v === 'string') {
        const l = loc(name);
        if (l) gl.uniform1i(l, def.options.indexOf(v));
      } else if (def.kind === 'gradient') {
        this.setGradientUniforms(gl, prog, locs, decodeGradient(v));
      }
    }
  }

  private setGradientUniforms(
    gl: WebGL2RenderingContext,
    prog: WebGLProgram,
    locs: Map<string, WebGLUniformLocation | null>,
    grad: GradientStops,
  ): void {
    const gu = gradientUniforms(grad);
    const loc = (n: string): WebGLUniformLocation | null | undefined => {
      if (!locs.has(n)) locs.set(n, gl.getUniformLocation(prog, n));
      return locs.get(n);
    };
    const lc = loc('u_gradCol');
    if (lc) gl.uniform3fv(lc, gu.colors);
    const lp = loc('u_gradPos');
    if (lp) gl.uniform1fv(lp, gu.positions);
    const ln = loc('u_gradCount');
    if (ln) gl.uniform1i(ln, gu.count);
    const lm = loc('u_gradMode');
    if (lm) gl.uniform1i(lm, gu.mode);
  }

  private ensurePost(): void {
    const gl = this.gl;
    if (!gl || this.postProg) return;
    try {
      this.postProg = createProgram(gl, FULLSCREEN_VERT, POST_FRAG);
      this.postLocs.clear();
    } catch (e) {
      this.postProg = null;
      this.events.onError?.(e instanceof Error ? e.message : String(e));
    }
  }

  private ensureScene(gl: WebGL2RenderingContext): void {
    const W = Math.max(2, this.canvas.width);
    const H = Math.max(2, this.canvas.height);
    if (this.sceneFbo && this.sceneTex && W === this.sceneW && H === this.sceneH) return;
    if (this.sceneFbo) gl.deleteFramebuffer(this.sceneFbo);
    if (this.sceneTex) gl.deleteTexture(this.sceneTex);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.sceneTex = tex;
    this.sceneFbo = fbo;
    this.sceneW = W;
    this.sceneH = H;
  }

  private ensureProgram(gen: Generator): void {
    const gl = this.gl;
    if (!gl) return;
    if (this.prog && this.progGenId === gen.id) return;
    const hit = this.progs.get(gen.id);
    if (hit) {
      this.prog = hit.prog;
      this.locs = hit.locs;
      this.progGenId = gen.id;
      return;
    }
    if (!gen.fragmentShader) return;
    try {
      const prog = createProgram(gl, FULLSCREEN_VERT, SHADER_HEADER + COMMON_GLSL + gen.fragmentShader);
      const locs = new Map<string, WebGLUniformLocation | null>();
      this.progs.set(gen.id, { prog, locs });
      this.prog = prog;
      this.locs = locs;
      this.progGenId = gen.id;
    } catch (e) {
      this.prog = null;
      this.events.onError?.(e instanceof Error ? e.message : String(e));
    }
  }

  private ensureComposite(): void {
    const gl = this.gl;
    if (!gl || this.compProg) return;
    try {
      this.compProg = createProgram(gl, FULLSCREEN_VERT, COMPOSITE_FRAG);
      this.compLocs.clear();
    } catch (e) {
      this.compProg = null;
      this.events.onError?.(e instanceof Error ? e.message : String(e));
    }
  }

  private compLoc(gl: WebGL2RenderingContext, name: string): WebGLUniformLocation | null | undefined {
    if (!this.compProg) return null;
    if (!this.compLocs.has(name)) {
      this.compLocs.set(name, gl.getUniformLocation(this.compProg, name));
    }
    return this.compLocs.get(name);
  }

  /** Full-res scratch target used to render a single layer before compositing. */
  private ensureLayer(gl: WebGL2RenderingContext): void {
    const W = Math.max(2, this.canvas.width);
    const H = Math.max(2, this.canvas.height);
    if (this.layerFbo && this.layerTex && W === this.layerW && H === this.layerH) return;
    if (this.layerFbo) gl.deleteFramebuffer(this.layerFbo);
    if (this.layerTex) gl.deleteTexture(this.layerTex);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.layerTex = tex;
    this.layerFbo = fbo;
    this.layerW = W;
    this.layerH = H;
  }

  private ensureAccum(gl: WebGL2RenderingContext): void {
    const W = Math.max(2, this.canvas.width);
    const H = Math.max(2, this.canvas.height);
    if (!this.accum) this.accum = new PingPong(gl, W, H);
    else this.accum.resize(W, H);
  }

  /**
   * Tear down GL resources.
   * @param releaseContext When true (default, for DISCARDED offscreen
   * canvases: thumbnails, export), also force-lose the context to free the
   * browser's context slot. Pass false when the canvas element itself lives
   * on (preview unmount/remount on the same element): losing the context
   * there would poison the next occupant, since getContext() returns the
   * same lost context instead of a fresh one.
   */
  dispose(releaseContext = true): void {
    this.disposed = true;
    const gl = this.gl;
    if (gl) {
      if (this.prog) gl.deleteProgram(this.prog);
      if (this.postProg) gl.deleteProgram(this.postProg);
      if (this.compProg) gl.deleteProgram(this.compProg);
      for (const { prog } of this.progs.values()) {
        if (prog !== this.prog) gl.deleteProgram(prog);
      }
      this.progs.clear();
      if (this.sceneFbo) gl.deleteFramebuffer(this.sceneFbo);
      if (this.sceneTex) gl.deleteTexture(this.sceneTex);
      if (this.layerFbo) gl.deleteFramebuffer(this.layerFbo);
      if (this.layerTex) gl.deleteTexture(this.layerTex);
      this.accum?.dispose();
      this.pass?.dispose(gl);
      this.pingpong?.dispose();
      // Free the browser's WebGL context slot deterministically so
      // repeated offscreen renderers (export, thumbnails) can't exhaust it.
      // Skipped for live canvases (see dispose() docs).
      if (releaseContext) {
        try {
          gl.getExtension('WEBGL_lose_context')?.loseContext();
        } catch {
          /* ignore */
        }
      }
    }
    this.prog = null;
    this.postProg = null;
    this.sceneFbo = null;
    this.sceneTex = null;
    this.pass = null;
    this.pingpong = null;
    this.gl = null;
  }
}
