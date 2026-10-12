// Renders generator + post samples to PNGs on headless Chrome WebGL2, for
// visual inspection. Defaults to Aurora Waves with the six seeds from the task.
//
// Run: bun scripts/renderSamples.ts
//      bun scripts/renderSamples.ts --gen plasma --seeds 1,2,3 --phase 0.25
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { COMMON_GLSL } from '../src/engine/glsl_common.ts';
import { FULLSCREEN_VERT } from '../src/engine/gl.ts';
import { POST_FRAG, DEFAULT_POST } from '../src/engine/post.ts';
import { getGenerator, listGenerators } from '../src/engine/registry.ts';
import { hexToRgb01 } from '../src/engine/palettes.ts';
import { mulberry32 } from '../src/engine/rng.ts';
import type { Generator } from '../src/engine/types.ts';
import '../src/engine/generators/index.ts';

const HEADER = `#version 300 es
precision highp float;
uniform vec2 u_resolution;
uniform float u_phase;
uniform float u_seed;
uniform float u_time;
`;

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1]! : def;
}

const genId = arg('gen', 'aurora');
const seeds = arg('seeds', '12345,20277,28196,36115,44034,51953').split(',').map((s) => Number(s.trim()));
const phase = Number(arg('phase', '0.2'));
const seedMode = arg('seed-mode', 'fixed'); // fixed | randomize
const [wStr, hStr] = arg('size', '480x270').split('x');
const W = Number(wStr);
const H = Number(hStr);
const outDir = arg('out', `/tmp/opencode/samples/${genId}`);

const gen = getGenerator(genId);
if (!gen) {
  console.error(`unknown generator: ${genId}. Available: ${listGenerators().map((g) => g.id).join(', ')}`);
  process.exit(2);
}
if (!gen.fragmentShader) {
  console.error(`${genId} is not a shader2d generator`);
  process.exit(2);
}

function gpuUniforms(g: Generator, params: Record<string, unknown>) {
  const out: Array<{ name: string; kind: string; value: unknown }> = [];
  for (const def of g.paramSchema) {
    const v = params[def.key] ?? def.defaultValue;
    if (def.kind === 'color' && typeof v === 'string') out.push({ name: `u_${def.key}`, kind: 'vec3', value: [...hexToRgb01(v)] });
    else if (def.kind === 'select' && typeof v === 'string') out.push({ name: `u_${def.key}`, kind: 'int', value: def.options.indexOf(v) });
    else if (def.kind === 'boolean') out.push({ name: `u_${def.key}`, kind: 'int', value: v ? 1 : 0 });
    else out.push({ name: `u_${def.key}`, kind: 'float', value: Number(v) });
  }
  return out;
}

const jobs = seeds.map((seed) => {
  const params = seedMode === 'randomize' ? gen.randomize(mulberry32(seed)) : { ...gen.defaultParams };
  return { seed, uniforms: gpuUniforms(gen, params) };
});

const html = `<!doctype html><html><body>
<pre id="samples">pending</pre>
<script>
const JOBS = ${JSON.stringify(jobs)};
const GEN_FRAG = ${JSON.stringify(HEADER + COMMON_GLSL + gen.fragmentShader)};
const POST_FRAG = ${JSON.stringify(POST_FRAG)};
const VERT = ${JSON.stringify(FULLSCREEN_VERT)};
const POST = ${JSON.stringify(DEFAULT_POST)};
const W = ${W}, H = ${H}, PHASE = ${phase};

function compile(gl, type, src) {
  const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
function program(gl, frag) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}

(function main() {
  const out = document.getElementById('samples');
  try {
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false });
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    const gp = program(gl, GEN_FRAG);
    const pp = program(gl, POST_FRAG);
    const out2 = { images: [] };

    for (const job of JOBS) {
      const seed01 = job.seed / 4294967296;
      // Pass 1: generator -> FBO.
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, W, H);
      gl.useProgram(gp);
      const set = (n, kind, v) => {
        const l = gl.getUniformLocation(gp, n); if (!l) return;
        if (kind === 'vec3') gl.uniform3f(l, v[0], v[1], v[2]);
        else if (kind === 'int') gl.uniform1i(l, v);
        else gl.uniform1f(l, v);
      };
      const lRes = gl.getUniformLocation(gp, 'u_resolution'); gl.uniform2f(lRes, W, H);
      const lPh = gl.getUniformLocation(gp, 'u_phase'); if (lPh) gl.uniform1f(lPh, PHASE);
      const lSe = gl.getUniformLocation(gp, 'u_seed'); if (lSe) gl.uniform1f(lSe, seed01);
      const lTi = gl.getUniformLocation(gp, 'u_time'); if (lTi) gl.uniform1f(lTi, PHASE * 6.28318530718);
      for (const u of job.uniforms) set(u.name, u.kind, u.value);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // Pass 2: post -> screen.
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, W, H);
      gl.useProgram(pp);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      const pl = (n) => gl.getUniformLocation(pp, n);
      const l2 = pl('u_scene'); if (l2) gl.uniform1i(l2, 0);
      const lr = pl('u_resolution'); if (lr) gl.uniform2f(lr, W, H);
      const lp = pl('u_phase'); if (lp) gl.uniform1f(lp, PHASE);
      const ls = pl('u_seed'); if (ls) gl.uniform1f(ls, seed01);
      const p1 = (n, v) => { const l = pl(n); if (l) gl.uniform1f(l, v); };
      p1('u_contrast', POST.contrast); p1('u_brightness', POST.brightness);
      p1('u_saturation', POST.saturation); p1('u_grain', POST.grain);
      p1('u_vignette', POST.vignette); p1('u_chromAb', POST.chromAb);
      p1('u_posterize', POST.posterize);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // Read back for objective inspection (ASCII + stats).
      const px = new Uint8Array(W * H * 4);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const AW = 96, AH = 27;
      const chars = ' .:-=+*#%@';
      let sumL = 0, sumSat = 0, n = 0, bright = 0;
      const lumas = [];
      const lines = [];
      for (let ay = 0; ay < AH; ay++) {
        let line = '';
        // GL readPixels is bottom-up: display row ay (top) maps to the last rows.
        const gy0 = H - Math.floor(((ay + 1) / AH) * H);
        const gy1 = H - Math.floor((ay / AH) * H);
        for (let ax = 0; ax < AW; ax++) {
          const x0 = Math.floor((ax / AW) * W), x1 = Math.max(x0 + 1, Math.floor(((ax + 1) / AW) * W));
          let r = 0, g = 0, b = 0, c = 0;
          for (let y = gy0; y < gy1; y++) for (let x = x0; x < x1; x++) {
            const i = (y * W + x) * 4; r += px[i]; g += px[i+1]; b += px[i+2]; c++;
          }
          r /= c; g /= c; b /= c;
          const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
          line += chars[Math.min(chars.length - 1, Math.floor(l * chars.length))];
        }
        lines.push(line);
      }
      for (let i = 0; i < px.length; i += 4) {
        const r = px[i] / 255, g = px[i+1] / 255, b = px[i+2] / 255;
        const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        sumL += l; sumSat += mx - mn; n++; if (l > 0.6) bright++;
        if (i % 400 === 0) lumas.push(l);
      }
      lumas.sort((a, b) => a - b);
      const pct = (p) => lumas[Math.min(lumas.length - 1, Math.floor(p * lumas.length))];
      out2.images.push({
        seed: job.seed,
        png: canvas.toDataURL('image/png'),
        ascii: lines.join('\\n'),
        stats: {
          meanLuma: +(sumL / n).toFixed(4),
          meanSat: +(sumSat / n).toFixed(4),
          brightFrac: +(bright / n).toFixed(4),
          p05: +pct(0.05).toFixed(3),
          p50: +pct(0.5).toFixed(3),
          p95: +pct(0.95).toFixed(3),
        },
      });
    }
    out.textContent = JSON.stringify(out2);
  } catch (e) {
    out.textContent = JSON.stringify({ fatal: String(e) });
  }
})();
</script></body></html>`;

mkdirSync(outDir, { recursive: true });
const htmlPath = '/tmp/opencode/samples.html';
writeFileSync(htmlPath, html);

const dom = execFileSync(
  'google-chrome-stable',
  ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--dump-dom', `file://${htmlPath}`],
  { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 300000, stdio: ['ignore', 'pipe', 'ignore'] },
);

const m = /<pre id="samples">([\s\S]*?)<\/pre>/.exec(dom);
if (!m) {
  console.error('could not parse result from chrome DOM');
  process.exit(2);
}
const parsed = JSON.parse(m[1]!.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
if (parsed.fatal) {
  console.error('fatal:', parsed.fatal);
  process.exit(2);
}
for (const img of parsed.images) {
  const b64 = String(img.png).replace(/^data:image\/png;base64,/, '');
  const file = `${outDir}/seed-${img.seed}.png`;
  writeFileSync(file, Buffer.from(b64, 'base64'));
  console.log(`\n=== ${genId} seed ${img.seed} -> ${file} ===`);
  console.log(img.ascii);
  console.log('stats:', JSON.stringify(img.stats));
}
