// Renders the low-poly terrain generator through the REAL WaveEngine
// (three.js, bundled with bun) on headless Chrome WebGL2/SwiftShader:
// default still, 12-seed contact sheet, loop pair (phase 0 vs 1), and 100%
// crops, with colour stats for every image.
//
// Run: bun scripts/renderTerrain.ts [--size 1280x720] [--out /tmp/opencode/terrain]
import { execFileSync, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1]! : def;
}

const [wStr, hStr] = arg('size', '1280x720').split('x');
const W = Number(wStr);
const H = Number(hStr);
const outDir = arg('out', '/tmp/opencode/terrain');
const seeds = arg('seeds', '1,2,3,4,5,6,7,8,9,10,11,12').split(',').map((s) => Number(s.trim()));

mkdirSync(outDir, { recursive: true });
mkdirSync('/tmp/opencode', { recursive: true });

// Bundle the real engine + generator with bun (three.js included).
const harnessTs = '/tmp/opencode/terrain-harness.ts';
writeFileSync(
  harnessTs,
  `import { WaveEngine } from '${process.cwd()}/src/engine/scene3d/WaveEngine.ts';
import { lowpolyTerrain } from '${process.cwd()}/src/engine/scene3d/lowpolyTerrain.ts';
import { DEFAULT_POST } from '${process.cwd()}/src/engine/post.ts';
import { mulberry32 } from '${process.cwd()}/src/engine/rng.ts';

function statsOf(img: ImageData) {
  const d = img.data;
  const n = d.length / 4;
  let sumL = 0, black = 0, bright = 0;
  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const l = (0.2126 * d[i*4]! + 0.7152 * d[i*4+1]! + 0.0722 * d[i*4+2]!) / 255;
    lum[i] = l; sumL += l;
    if (l < 0.031) black++;
    if (l > 0.6) bright++;
  }
  const sorted = Array.from(lum).sort((a, b) => a - b);
  const q = (f: number) => sorted[Math.min(n - 1, Math.floor(f * n))];
  return { meanLuma: +(sumL / n).toFixed(4), blackFrac: +(black / n).toFixed(4), brightFrac: +(bright / n).toFixed(4), p99: +q(0.99).toFixed(3), p50: +q(0.5).toFixed(3) };
}

function readback(src: HTMLCanvasElement, w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0, w, h);
  return { canvas: c, ctx, img: ctx.getImageData(0, 0, w, h) };
}

function cropPng(src: HTMLCanvasElement, x: number, y: number, w: number, h: number): string {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d')!.drawImage(src, x, y, w, h, 0, 0, w, h);
  return c.toDataURL('image/png');
}

function diff(a: ImageData, b: ImageData): number {
  const n = Math.min(a.data.length, b.data.length);
  let s = 0;
  for (let i = 0; i < n; i += 4) {
    s += Math.abs(a.data[i]! - b.data[i]!) + Math.abs(a.data[i+1]! - b.data[i+1]!) + Math.abs(a.data[i+2]! - b.data[i+2]!);
  }
  return s / (n / 4) / (3 * 255);
}

(async function main() {
  const out = document.getElementById('terrain')!;
  try {
    const W = ${W}, H = ${H};
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const engine = new WaveEngine(canvas, { topology: 'terrain', faceShading: false });
    const post = { ...DEFAULT_POST };
    const res: Record<string, unknown> = { images: [] as unknown[], W, H };
    const thumbs: HTMLCanvasElement[] = [];

    // Default still (reference look) + loop pair on the default seed.
    const defParams = { ...lowpolyTerrain.defaultParams };
    const defSeed = 1313;
    const render = (seed: number, params: Record<string, unknown>, phase: number) => {
      engine.render({ phase, params: params as never, seed, post, width: W, height: H });
      return readback(canvas, W, H);
    };
    const still = render(defSeed, defParams, 0.2);
    (res.images as unknown[]).push({ name: 'default', seed: defSeed, png: still.canvas.toDataURL('image/png'), stats: statsOf(still.img) });
    const f0 = render(defSeed, defParams, 0);
    const f1 = render(defSeed, defParams, 1.0);
    const fLast = render(defSeed, defParams, 0.95);
    (res as Record<string, unknown>).loop = { zeroVsOne: +diff(f0.img, f1.img).toFixed(6), lastVsZero: +diff(fLast.img, f0.img).toFixed(5) };
    // 100% crops from the default still: mound (centre) + floor near horizon.
    (res as Record<string, unknown>).crops = {
      mound: { png: cropPng(still.canvas, Math.floor(W/2 - 240), Math.floor(H/2 - 135), 480, 270) },
      floor: { png: cropPng(still.canvas, Math.floor(W/2 - 240), Math.floor(H * 0.62), 480, 200) },
    };

    // 12-seed sheet at small size (fresh engine state per seed is automatic
    // via the cache key; render each at phase 0.2).
    const SW = 480, SH = 270;
    canvas.width = SW; canvas.height = SH;
    const seeds: number[] = ${JSON.stringify(seeds)};
    const sheet = document.createElement('canvas');
    sheet.width = SW * 4; sheet.height = SH * 3;
    const sctx = sheet.getContext('2d')!;
    sctx.fillStyle = '#000'; sctx.fillRect(0, 0, sheet.width, sheet.height);
    const seedStats: unknown[] = [];
    for (let i = 0; i < seeds.length; i++) {
      const seed = seeds[i]!;
      const params = lowpolyTerrain.randomize(mulberry32(seed));
      engine.render({ phase: 0.2, params: params as never, seed, post, width: SW, height: SH });
      const rb = readback(canvas, SW, SH);
      sctx.drawImage(rb.canvas, (i % 4) * SW, Math.floor(i / 4) * SH);
      sctx.fillStyle = '#fff'; sctx.font = '16px monospace';
      sctx.fillText('seed ' + seed, (i % 4) * SW + 8, Math.floor(i / 4) * SH + 22);
      thumbs.push(rb.canvas);
      seedStats.push({ seed, stats: statsOf(rb.img) });
    }
    void thumbs;
    (res as Record<string, unknown>).sheet = { png: sheet.toDataURL('image/png'), seeds: seedStats };
    out.textContent = JSON.stringify(res);
  } catch (e) {
    out.textContent = JSON.stringify({ fatal: String(e) });
  }
})();
`,
);
execSync(`bun build ${harnessTs} --outfile /tmp/opencode/terrain-harness.js --format iife --minify`, {
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'ignore'],
});
const { readFileSync } = await import('node:fs');
const bundle = readFileSync('/tmp/opencode/terrain-harness.js', 'utf8');

const html = `<!doctype html><html><body>
<pre id="terrain">pending</pre>
<script>${bundle}</script>
</body></html>`;
const htmlPath = '/tmp/opencode/terrain.html';
writeFileSync(htmlPath, html);

const dom = execFileSync(
  'google-chrome-stable',
  ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox', '--dump-dom', `file://${htmlPath}`],
  { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, timeout: 600000, stdio: ['ignore', 'pipe', 'ignore'] },
);
const m = /<pre id="terrain">([\s\S]*?)<\/pre>/.exec(dom);
if (!m) {
  console.error('could not parse result from chrome DOM');
  process.exit(2);
}
const parsed = JSON.parse(m[1]!.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')) as {
  fatal?: string;
  images: Array<{ name: string; seed: number; png: string; stats: unknown }>;
  loop: unknown;
  crops: { mound: { png: string }; floor: { png: string } };
  sheet: { png: string; seeds: Array<{ seed: number; stats: unknown }> };
};
if (parsed.fatal) {
  console.error('fatal:', parsed.fatal.slice(0, 2000));
  process.exit(2);
}
function savePng(dataUrl: string, file: string): void {
  writeFileSync(file, Buffer.from(String(dataUrl).replace(/^data:image\/png;base64,/, ''), 'base64'));
  console.log(`wrote ${file}`);
}
for (const img of parsed.images) {
  savePng(img.png, `${outDir}/${img.name}-seed-${img.seed}.png`);
  console.log(`stats ${img.name}:`, JSON.stringify(img.stats));
}
console.log('loop:', JSON.stringify(parsed.loop));
savePng(parsed.crops.mound.png, `${outDir}/crop-mound.png`);
savePng(parsed.crops.floor.png, `${outDir}/crop-floor.png`);
savePng(parsed.sheet.png, `${outDir}/sheet-12seeds.png`);
for (const s of parsed.sheet.seeds) console.log(`seed ${s.seed}:`, JSON.stringify(s.stats));
