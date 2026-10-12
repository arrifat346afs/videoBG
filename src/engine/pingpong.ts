// Ping-pong framebuffers for multi-pass generators
// (reaction-diffusion, feedback trails). Ready from M2.

export class PingPong {
  private gl: WebGL2RenderingContext;
  private fbos: (WebGLFramebuffer | null)[] = [null, null];
  private texs: (WebGLTexture | null)[] = [null, null];
  private w = 0;
  private h = 0;
  private readIdx = 0;

  constructor(gl: WebGL2RenderingContext, width: number, height: number) {
    this.gl = gl;
    this.resize(width, height);
  }

  get width(): number {
    return this.w;
  }
  get height(): number {
    return this.h;
  }
  get readTexture(): WebGLTexture | null {
    return this.texs[this.readIdx] ?? null;
  }
  get writeFbo(): WebGLFramebuffer | null {
    return this.fbos[1 - this.readIdx] ?? null;
  }

  resize(width: number, height: number): void {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    if (w === this.w && h === this.h && this.texs[0]) return;
    this.disposeTargets();
    this.w = w;
    this.h = h;
    const gl = this.gl;
    for (let i = 0; i < 2; i++) {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      this.texs[i] = tex;
      this.fbos[i] = fbo;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  swap(): void {
    this.readIdx = 1 - this.readIdx;
  }

  private disposeTargets(): void {
    const gl = this.gl;
    for (const t of this.texs) if (t) gl.deleteTexture(t);
    for (const f of this.fbos) if (f) gl.deleteFramebuffer(f);
    this.texs = [null, null];
    this.fbos = [null, null];
  }

  dispose(): void {
    this.disposeTargets();
    this.w = 0;
    this.h = 0;
  }
}
