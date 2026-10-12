// Renders a 2-layer mix (generator A over generator B) through the real
// compositor + post shaders on headless Chrome WebGL2, for objective
// inspection (PNG + ASCII + colour stats).
//
// Run: bun scripts/renderMix.ts --a wave-mesh --b vector-waves --blend screen
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { COMMON_GLSL } from '../src/engine/glsl_common.ts';
import { FULLSCREEN_VERT } from '../src/engine/gl.ts';
import { COMPOSITE_FRAG, blendIndex } from '../src/engine/composite.ts';
import { DEFAULT_POST, POST_FRAG } from '../src/engine/post.ts';
import { getGenerator, listGenerators } from '../src/engine/registry.ts';
import { hexToRgb01 } from '../src/engine/palettes.ts';
import { decodeGradient, gradientUniforms } from '../src/engine/gradient.ts';
import { mulberry32 } from '../src/engine/rng.ts';
import type { BlendMode, Generator } from '../src/engine/types.ts';
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

const aId = arg('a', 'wave-mesh');
const bId = arg('b', 'vector-waves');
const blend = arg('blend', 'screen') as BlendMode;
const opacity = Number(arg('opacity', '0.7'));
const phase = Number(arg('phase', '0.2'));
const seedA = Number(arg('seedA', '12345'));
const seedB = Number(arg('seedB', '20277'));
const [wStr, hStr] = arg('size', '480x270').split('x');
const W = Number(wStr);
const H = Number(hStr);
const outDir = arg('out', '/tmp/opencode/mix');

function load(id: string): Generator {
  const g = getGenerator(id);
  if (!g || !g.fragmentShader) {
    console.error(`not a shader2d generator: ${id}. Available: ${listGenerators().map((x) => x.id).join(', ')}`);
    process.exit(2);
  }
  return g;
}

const genA = load(aId);
const genB = load(bId);

function gpuUniforms(g: Generator, params: Record<string, unknown>) {
  const out: Array<{ name: string; kind: string; value: unknown }> = [];
  for (const def of g.paramSchema) {
    const v = params[def.key] ?? def.defaultValue;
    if (def.kind === 'color' && typeof v === 'string') out.push({ name: `u_${def.key}`, kind: 'vec3', value: [...hexToRgb01(v)] });
    else if (def.kind === 'gradient') {
      const gu = gradientUniforms(decodeGradient(v));
      out.push({ name: 'u_gradCol', kind: 'vec3v', value: [Array.from(gu.colors)] });
      out.push({ name: 'u_gradPos', kind: 'floatv', value: Array.from(gu.positions) });
      out.push({ name: 'u_gradCount', kind: 'int', value: gu.count });
      out.push({ name: 'u_gradMode', kind: 'int', value: gu.mode });
    } else if (def.kind === 'select' && typeof v === 'string') out.push({ name: `u_${def.key}`, kind: 'int', value: def.options.indexOf(v) });
    else if (def.kind === 'boolean') out.push({ name: `u_${def.key}`, kind: 'int', value: v ? 1 : 0 });
    else out.push({ name: `u_${def.key}`, kind: 'float', value: Number(v) });
  }
  return out;
}

const uniformsA = gpuUniforms(genA, genA.randomize(mulberry32(seedA)));
const uniformsB = gpuUniforms(genB, genB.randomize(mulberry32(seedB)));

const html = `<!doctype html><html><body>
<pre id="samples">pending</pre>
<script>
const U_A = ${JSON.stringify(uniformsA)};
const U_B = ${JSON.stringify(uniformsB)};
const FRAG_A = ${JSON.stringify(HEADER + COMMON_GLSL + genA.fragmentShader)};
const FRAG_B = ${JSON.stringify(HEADER + COMMON_GLSL + genB.fragmentShader)};
const COMP_FRAG = ${JSON.stringify(COMPOSITE_FRAG)};
const POST_FRAG = ${JSON.stringify(POST_FRAG)};
const VERT = ${JSON.stringify(FULLSCREEN_VERT)};
const POST = ${JSON.stringify(DEFAULT_POST)};
const W = ${W}, H = ${H}, PHASE = ${phase};
const SEED_A = ${seedA / 4294967296}, SEED_B = ${seedB / 4294967296};
const BLEND = ${blendIndex(blend)}, OPACITY = ${opacity};

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
function target(gl, W, H) {
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
  return { tex, fbo };
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

    const A = target(gl, W, H), B = target(gl, W, H), O = target(gl, W, H);
    const pA = program(gl, FRAG_A), pB = program(gl, FRAG_B);
    const pC = program(gl, COMP_FRAG), pP = program(gl, POST_FRAG);

    function uniforms(p, list, seed01) {
      const set = (n, kind, v) => {
        const l = gl.getUniformLocation(p, n); if (!l) return;
        if (kind === 'vec3') gl.uniform3f(l, v[0], v[1], v[2]);
        else if (kind === 'vec3v') gl.uniform3fv(l, v[0]);
        else if (kind === 'floatv') gl.uniform1fv(l, v);
        else if (kind === 'int') gl.uniform1i(l, v);
        else gl.uniform1f(l, v);
      };
      gl.uniform2f(gl.getUniformLocation(p, 'u_resolution'), W, H);
      gl.uniform1f(gl.getUniformLocation(p, 'u_phase'), PHASE);
      const lS = gl.getUniformLocation(p, 'u_seed'); if (lS) gl.uniform1f(lS, seed01);
      const lT = gl.getUniformLocation(p, 'u_time'); if (lT) gl.uniform1f(lT, PHASE * 6.28318530718);
      for (const u of list) set(u.name, u.kind, u.value);
    }

    // Layer A -> A, Layer B -> B.
    gl.bindFramebuffer(gl.FRAMEBUFFER, A.fbo); gl.viewport(0,0,W,H);
    gl.useProgram(pA); uniforms(pA, U_A, SEED_A); gl.drawArrays(gl.TRIANGLES,0,3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, B.fbo); gl.viewport(0,0,W,H);
    gl.useProgram(pB); uniforms(pB, U_B, SEED_B); gl.drawArrays(gl.TRIANGLES,0,3);

    // Composite: base=A, layer=B -> O.
    gl.bindFramebuffer(gl.FRAMEBUFFER, O.fbo); gl.viewport(0,0,W,H);
    gl.useProgram(pC);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, A.tex);
    gl.uniform1i(gl.getUniformLocation(pC,'u_base'), 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, B.tex);
    gl.uniform1i(gl.getUniformLocation(pC,'u_layer'), 1);
    gl.uniform1f(gl.getUniformLocation(pC,'u_opacity'), OPACITY);
    gl.uniform1i(gl.getUniformLocation(pC,'u_blend'), BLEND);
    gl.drawArrays(gl.TRIANGLES,0,3);

    // Post -> screen.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0,0,W,H);
    gl.useProgram(pP);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, O.tex);
    const pl = (n) => gl.getUniformLocation(pP, n);
    gl.uniform1i(pl('u_scene'), 0);
    gl.uniform2f(pl('u_resolution'), W, H);
    gl.uniform1f(pl('u_phase'), PHASE);
    const p1 = (n, v) => { const l = pl(n); if (l) gl.uniform1f(l, v); };
    p1('u_contrast', POST.contrast); p1('u_brightness', POST.brightness);
    p1('u_saturation', POST.saturation); p1('u_grain', POST.grain);
    p1('u_vignette', POST.vignette); p1('u_chromAb', POST.chromAb);
    p1('u_posterize', POST.posterize);
    gl.drawArrays(gl.TRIANGLES,0,3);

    const px = new Uint8Array(W*H*4);
    gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,px);
    const AW = 96, AH = 27, chars = ' .:-=+*#%@';
    let sumL = 0, sumSat = 0, n = 0, bright = 0;
    const lines = [];
    for (let ay=0; ay<AH; ay++) {
      let line='';
      const gy0 = H - Math.floor(((ay+1)/AH)*H), gy1 = H - Math.floor((ay/AH)*H);
      for (let ax=0; ax<AW; ax++) {
        const x0=Math.floor((ax/AW)*W), x1=Math.max(x0+1,Math.floor(((ax+1)/AW)*W));
        let r=0,g=0,b=0,c=0;
        for (let y=gy0;y<gy1;y++) for (let x=x0;x<x1;x++){const i=(y*W+x)*4;r+=px[i];g+=px[i+1];b+=px[i+2];c++;}
        r/=c;g/=c;b/=c;
        const l=(0.2126*r+0.7152*g+0.0722*b)/255;
        line+=chars[Math.min(chars.length-1,Math.floor(l*chars.length))];
      }
      lines.push(line);
    }
    for (let i=0;i<px.length;i+=4){const r=px[i]/255,g=px[i+1]/255,b=px[i+2]/255;
      sumL+=0.2126*r+0.7152*g+0.0722*b; sumSat+=Math.max(r,g,b)-Math.min(r,g,b); n++; if((0.2126*r+0.7152*g+0.0722*b)>0.6)bright++;}
    out.textContent = JSON.stringify({ png: canvas.toDataURL('image/png'), ascii: lines.join('\\n'),
      stats: { meanLuma:+(sumL/n).toFixed(4), meanSat:+(sumSat/n).toFixed(4), brightFrac:+(bright/n).toFixed(4) } });
  } catch (e) { out.textContent = JSON.stringify({ fatal: String(e) }); }
})();
</script></body></html>`;

mkdirSync(outDir, { recursive: true });
const htmlPath = '/tmp/opencode/mix.html';
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
const file = `${outDir}/${aId}+${bId}-${blend}.png`;
writeFileSync(file, Buffer.from(String(parsed.png).replace(/^data:image\/png;base64,/, ''), 'base64'));
console.log(`\n=== ${aId} (base) + ${bId} (${blend} @ ${opacity}) -> ${file} ===`);
console.log(parsed.ascii);
console.log('stats:', JSON.stringify(parsed.stats));
