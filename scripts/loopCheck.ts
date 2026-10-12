// Loop-continuity check for every shader2d generator.
//
// Renders each generator on a headless Chrome WebGL2 context (SwiftShader).
// Primary check: an integer-cycle loop must satisfy f(p) == f(p + 1), since
// the app renders phases in [0,1) and wraps the last frame straight to 0.
// We render f(p) and f(p + 1) for several p and require the mean absolute
// difference to be ~0. Also reports the wrap step (frame N-1 -> frame 0)
// against adjacent-frame steps as a secondary signal.
//
// Run: bun scripts/loopCheck.ts [--verbose] [--threshold 0.002]
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { COMMON_GLSL } from '../src/engine/glsl_common.ts';
import { FULLSCREEN_VERT } from '../src/engine/gl.ts';
import { listGenerators } from '../src/engine/registry.ts';
import { hexToRgb01 } from '../src/engine/palettes.ts';
import type { Generator } from '../src/engine/types.ts';
import '../src/engine/generators/index.ts';

const HEADER = `#version 300 es
precision highp float;
uniform vec2 u_resolution;
uniform float u_phase;
uniform float u_seed;
uniform float u_time;
`;

const N = 20; // frames around the loop
const SIZE = 128;
const SEED = 12345;

const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const tIdx = args.indexOf('--threshold');
const THRESHOLD = tIdx >= 0 ? Number(args[tIdx + 1]) : 0.05; // max periodErr
const WRAP_RATIO = 1.8; // wrap step may be at most this many median steps
const gIdx = args.indexOf('--gen');
const ONLY = gIdx >= 0 ? args[gIdx + 1] : undefined;

interface GpuUniform {
  name: string;
  kind: 'float' | 'vec3' | 'int';
  value: number | number[];
}
interface ShaderJob {
  id: string;
  name: string;
  frag: string;
  uniforms: GpuUniform[];
}

function toGpuUniforms(gen: Generator): GpuUniform[] {
  const out: GpuUniform[] = [];
  for (const def of gen.paramSchema) {
    const v = gen.defaultParams[def.key] ?? def.defaultValue;
    if (def.kind === 'color' && typeof v === 'string') {
      out.push({ name: `u_${def.key}`, kind: 'vec3', value: [...hexToRgb01(v)] });
    } else if (def.kind === 'select' && typeof v === 'string') {
      out.push({ name: `u_${def.key}`, kind: 'int', value: def.options.indexOf(v) });
    } else if (def.kind === 'boolean') {
      out.push({ name: `u_${def.key}`, kind: 'int', value: v ? 1 : 0 });
    } else {
      out.push({ name: `u_${def.key}`, kind: 'float', value: Number(v) });
    }
  }
  return out;
}

const jobs: ShaderJob[] = [];
for (const gen of listGenerators()) {
  if (!gen.fragmentShader) continue; // scene3d handled separately
  if (ONLY && gen.id !== ONLY) continue;
  jobs.push({
    id: gen.id,
    name: gen.name,
    frag: HEADER + COMMON_GLSL + gen.fragmentShader,
    uniforms: toGpuUniforms(gen),
  });
}

const scene3d = listGenerators().filter((g) => !g.fragmentShader);

const html = `<!doctype html><html><body>
<pre id="loop-result">pending</pre>
<script>
const JOBS = ${JSON.stringify(jobs)};
const N = ${N}, SIZE = ${SIZE}, SEED = ${SEED}, THRESHOLD = ${THRESHOLD}, WRAP_RATIO = ${WRAP_RATIO};

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    return { err: gl.getShaderInfoLog(s) };
  }
  return { shader: s };
}

function makeProgram(gl, frag) {
  const v = compile(gl, gl.VERTEX_SHADER, ${JSON.stringify(FULLSCREEN_VERT)});
  if (v.err) return { err: 'vert: ' + v.err };
  const f = compile(gl, gl.FRAGMENT_SHADER, frag);
  if (f.err) return { err: 'frag: ' + f.err };
  const p = gl.createProgram();
  gl.attachShader(p, v.shader); gl.attachShader(p, f.shader);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return { err: 'link: ' + gl.getProgramInfoLog(p) };
  return { prog: p };
}

function renderOne(gl, prog, locs, uniforms, lRes, lPhase, lSeed, lTime, fbo, buf, phase) {
  gl.useProgram(prog);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.viewport(0, 0, SIZE, SIZE);
  if (lRes) gl.uniform2f(lRes, SIZE, SIZE);
  if (lPhase) gl.uniform1f(lPhase, phase);
  if (lSeed) gl.uniform1f(lSeed, SEED / 4294967296);
  if (lTime) gl.uniform1f(lTime, phase * 6.28318530718);
  for (const u of uniforms) {
    const l = locs[u.name]; if (!l) continue;
    if (u.kind === 'vec3') { const v = u.value; gl.uniform3f(l, v[0], v[1], v[2]); }
    else if (u.kind === 'int') gl.uniform1i(l, u.value);
    else gl.uniform1f(l, u.value);
  }
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.readPixels(0, 0, SIZE, SIZE, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  return Array.from(buf);
}

function renderFrames(gl, prog, uniforms, fbo) {
  const locs = {};
  for (const u of uniforms) locs[u.name] = gl.getUniformLocation(prog, u.name);
  const lRes = gl.getUniformLocation(prog, 'u_resolution');
  const lPhase = gl.getUniformLocation(prog, 'u_phase');
  const lSeed = gl.getUniformLocation(prog, 'u_seed');
  const lTime = gl.getUniformLocation(prog, 'u_time');
  const buf = new Uint8Array(SIZE * SIZE * 4);
  const frames = [];
  // Periodicity probe: f(p) must equal f(p + 1) for an integer-cycle loop,
  // because the app renders phases in [0,1) and wraps the last frame to 0.
  let periodErr = 0;
  const M = 6;
  for (let i = 0; i < M; i++) {
    const p = (i + 0.5) / M;
    const a = renderOne(gl, prog, locs, uniforms, lRes, lPhase, lSeed, lTime, fbo, buf, p);
    const b = renderOne(gl, prog, locs, uniforms, lRes, lPhase, lSeed, lTime, fbo, buf, p + 1);
    periodErr += meanAbsDiff(a, b);
  }
  periodErr /= M;
  for (let i = 0; i < N; i++) {
    frames.push(renderOne(gl, prog, locs, uniforms, lRes, lPhase, lSeed, lTime, fbo, buf, i / N));
  }
  return { frames, periodErr };
}

function meanAbsDiff(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i += 4) {
    s += Math.abs(a[i] - b[i]) + Math.abs(a[i+1] - b[i+1]) + Math.abs(a[i+2] - b[i+2]);
  }
  return s / (a.length / 4 * 3 * 255);
}

function median(arr) {
  const s = arr.slice().sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

(function main() {
  const out = document.getElementById('loop-result');
  let gl;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE; canvas.height = SIZE;
    gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
  } catch (e) { out.textContent = JSON.stringify({ fatal: String(e) }); return; }
  if (!gl) { out.textContent = JSON.stringify({ fatal: 'no webgl2' }); return; }

  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, SIZE, SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

  const results = [];
  for (const job of JOBS) {
    const pr = makeProgram(gl, job.frag);
    if (pr.err) { results.push({ id: job.id, name: job.name, error: pr.err }); continue; }
    const r = renderFrames(gl, pr.prog, job.uniforms, fbo);
    const frames = r.frames;
    const adj = [];
    for (let i = 0; i < N - 1; i++) adj.push(meanAbsDiff(frames[i], frames[i+1]));
    const wrap = meanAbsDiff(frames[N - 1], frames[0]);
    const med = median(adj);
    const maxAdj = Math.max.apply(null, adj);
    results.push({
      id: job.id, name: job.name,
      wrap: +wrap.toFixed(5), medianAdj: +med.toFixed(5), maxAdj: +maxAdj.toFixed(5),
      ratio: +(wrap / Math.max(1e-6, med)).toFixed(2),
      periodErr: +r.periodErr.toFixed(5),
      jump: r.periodErr > THRESHOLD || (wrap > WRAP_RATIO * med && wrap > 0.008),
    });
    gl.deleteProgram(pr.prog);
  }
  out.textContent = JSON.stringify({ results, args: { N, SIZE, THRESHOLD } });
})();
</script></body></html>`;

mkdirSync('/tmp/opencode', { recursive: true });
const htmlPath = '/tmp/opencode/loopcheck.html';
writeFileSync(htmlPath, html);

const dom = execFileSync(
  'google-chrome-stable',
  [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--dump-dom',
    `file://${htmlPath}`,
  ],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 600000 },
);

const m = /<pre id="loop-result">([\s\S]*?)<\/pre>/.exec(dom);
if (!m) {
  console.error('could not parse result from chrome DOM');
  process.exit(2);
}
const parsed = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));

if (parsed.fatal) {
  console.error('fatal:', parsed.fatal);
  process.exit(2);
}

const results = parsed.results as Array<Record<string, unknown>>;
const jumped: string[] = [];
console.log(`loop check: N=${N} size=${SIZE} seed=${SEED} period-err-threshold=${THRESHOLD}\n`);
console.log('generator'.padEnd(24), 'periodErr'.padStart(10), 'wrap'.padStart(9), 'medAdj'.padStart(9), 'maxAdj'.padStart(9), '  status');
for (const r of results) {
  if (r['error']) {
    console.log(String(r['id']).padEnd(24), '  COMPILE ERROR:', r['error']);
    jumped.push(String(r['id']));
    continue;
  }
  const st = r['jump'] ? 'JUMP' : 'ok';
  if (r['jump']) jumped.push(String(r['id']));
  console.log(
    String(r['id']).padEnd(24),
    String(r['periodErr']).padStart(10),
    String(r['wrap']).padStart(9),
    String(r['medianAdj']).padStart(9),
    String(r['maxAdj']).padStart(9),
    '  ' + st,
  );
}
if (scene3d.length) console.log('\nscene3d (checked separately):', scene3d.map((g) => g.id).join(', '));

if (verbose) console.log(JSON.stringify(results, null, 2));
if (jumped.length) {
  console.error(`\n${jumped.length} generator(s) still jump: ${jumped.join(', ')}`);
  process.exit(1);
}
console.log('\nAll shader2d generators loop cleanly.');
