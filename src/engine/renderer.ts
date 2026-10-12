// Frame-accurate renderer: every frame = f(generator, params, seed, phase).
// Single-pass in M2; owns a PingPong for future multi-pass generators.

import { createFullscreenPass, createGL, createProgram, FULLSCREEN_VERT } from './gl.ts';
import { COMMON_GLSL } from './glsl_common.ts';
import { PingPong } from './pingpong.ts';
import { DEFAULT_POST, POST_FRAG, type PostSettings } from './post.ts';
import type { Generator, Params } from './types.ts';
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
          this.sceneFbo = null;
          this.sceneTex = null;
          this.sceneW = 0;
          this.sceneH = 0;
          this.progGenId = '';
          this.locs.clear();
          this.postLocs.clear();
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
    this.params = { ...gen.defaultParams };
    this.ensureProgram(gen);
  }

  setParams(params: Params): void {
    this.params = { ...params };
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

  /** Deterministic single-frame render. phase in [0, 1). Generator -> scene FBO -> post -> screen. */
  renderPhase(phase: number): void {
    const gl = this.gl;
    const gen = this.gen;
    if (!gl || !gen || this.lost || this.disposed || !this.pass) return;
    this.ensureProgram(gen);
    this.ensurePost();
    this.ensureScene(gl);
    if (!this.prog || !this.postProg || !this.sceneFbo || !this.sceneTex) return;
    const p = phase - Math.floor(phase);
    const seed01 = (this.seed >>> 0) / 4294967296;
    const W = this.canvas.width;
    const H = this.canvas.height;

    // Pass 1: generator into scene texture.
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFbo);
    gl.viewport(0, 0, W, H);
    gl.useProgram(this.prog);
    this.setUniform('u_resolution', () => {
      const l = this.loc('u_resolution');
      if (l) gl.uniform2f(l, W, H);
    });
    this.setUniform('u_phase', () => {
      const l = this.loc('u_phase');
      if (l) gl.uniform1f(l, p);
    });
    this.setUniform('u_seed', () => {
      const l = this.loc('u_seed');
      if (l) gl.uniform1f(l, seed01);
    });
    this.setUniform('u_time', () => {
      const l = this.loc('u_time');
      if (l) gl.uniform1f(l, p * TAU_F);
    });
    for (const def of gen.paramSchema) {
      const v = this.params[def.key] ?? def.defaultValue;
      const name = `u_${def.key}`;
      if (def.kind === 'number' && typeof v === 'number') {
        const l = this.loc(name);
        if (l) gl.uniform1f(l, v);
      } else if (def.kind === 'color' && typeof v === 'string') {
        const l = this.loc(name);
        if (l) {
          try {
            const [r, g, b] = hexToRgb01(v);
            gl.uniform3f(l, r ?? 0, g ?? 0, b ?? 0);
          } catch {
            gl.uniform3f(l, 1, 0, 1);
          }
        }
      } else if (def.kind === 'boolean' && typeof v === 'boolean') {
        const l = this.loc(name);
        if (l) gl.uniform1i(l, v ? 1 : 0);
      } else if (def.kind === 'select' && typeof v === 'string') {
        const l = this.loc(name);
        if (l) gl.uniform1i(l, def.options.indexOf(v));
      }
    }
    this.pass.draw(gl);

    // Pass 2: post to screen.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.useProgram(this.postProg);
    const pl = (n: string): WebGLUniformLocation | null | undefined => {
      if (!this.postProg) return null;
      if (!this.postLocs.has(n)) this.postLocs.set(n, gl.getUniformLocation(this.postProg, n));
      return this.postLocs.get(n);
    };
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneTex);
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
    this.pass.draw(gl);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  private setUniform(_key: string, fn: () => void): void {
    fn();
  }

  private loc(name: string): WebGLUniformLocation | null | undefined {
    const gl = this.gl;
    if (!gl || !this.prog) return null;
    if (!this.locs.has(name)) {
      this.locs.set(name, gl.getUniformLocation(this.prog, name));
    }
    return this.locs.get(name);
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
    try {
      if (this.prog) gl.deleteProgram(this.prog);
      this.prog = createProgram(gl, FULLSCREEN_VERT, SHADER_HEADER + COMMON_GLSL + gen.fragmentShader);
      this.progGenId = gen.id;
      this.locs.clear();
    } catch (e) {
      this.prog = null;
      this.events.onError?.(e instanceof Error ? e.message : String(e));
    }
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
      if (this.sceneFbo) gl.deleteFramebuffer(this.sceneFbo);
      if (this.sceneTex) gl.deleteTexture(this.sceneTex);
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
