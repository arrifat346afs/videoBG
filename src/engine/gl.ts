// Minimal WebGL2 wrapper: context, fullscreen triangle, program cache.
// No React imports. Handles context loss via callback.

export const FULLSCREEN_VERT = `#version 300 es
layout(location=0) in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

export interface ContextLossHandler {
  onLost: () => void;
  onRestored: () => void;
}

export function createGL(
  canvas: HTMLCanvasElement,
  handler?: ContextLossHandler,
  attrs?: WebGLContextAttributes,
): WebGL2RenderingContext | null {
  const gl = canvas.getContext('webgl2', {
    antialias: false,
    depth: false,
    stencil: false,
    alpha: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
    ...attrs,
  });
  if (!gl) return null;
  if (handler) {
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      handler.onLost();
    });
    canvas.addEventListener('webglcontextrestored', () => {
      handler.onRestored();
    });
  }
  return gl as WebGL2RenderingContext;
}

export function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  src: string,
): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error('gl.createShader failed');
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh) ?? 'unknown';
    gl.deleteShader(sh);
    throw new Error(`shader compile failed: ${log}`);
  }
  return sh;
}

export function createProgram(
  gl: WebGL2RenderingContext,
  vsSrc: string,
  fsSrc: string,
): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  const prog = gl.createProgram();
  if (!prog) throw new Error('gl.createProgram failed');
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog) ?? 'unknown';
    gl.deleteProgram(prog);
    throw new Error(`program link failed: ${log}`);
  }
  return prog;
}

export interface FullscreenPass {
  readonly vao: WebGLVertexArrayObject | null;
  readonly vbo: WebGLBuffer | null;
  dispose(gl: WebGL2RenderingContext): void;
  draw(gl: WebGL2RenderingContext): void;
}

/** Single triangle covering the screen (3 verts, no index). */
export function createFullscreenPass(gl: WebGL2RenderingContext): FullscreenPass {
  const vao = gl.createVertexArray();
  const vbo = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  // (-1,-1) (3,-1) (-1,3)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  return {
    vao,
    vbo,
    dispose(g: WebGL2RenderingContext) {
      g.deleteBuffer(vbo);
      g.deleteVertexArray(vao);
    },
    draw(g: WebGL2RenderingContext) {
      g.bindVertexArray(vao);
      g.drawArrays(g.TRIANGLES, 0, 3);
      g.bindVertexArray(null);
    },
  };
}
