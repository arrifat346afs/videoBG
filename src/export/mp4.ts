import { BufferTarget, Mp4OutputFormat, Output, VideoSample, VideoSampleSource } from 'mediabunny';
import { DEFAULT_POST, type PostSettings } from '../engine/post.ts';
import { Renderer } from '../engine/renderer.ts';
import { isScene3D, type Generator, type Params, type Scene3DHandle } from '../engine/types.ts';
import type { ExportProgress, ExportRequest } from './types.ts';

export interface OfflineRenderCtx {
  readonly canvas: HTMLCanvasElement;
  readonly renderer: Renderer | null;
  readonly scene3d: Scene3DHandle | null;
}

/** Offscreen canvas + renderer at exact export size (quality=1). */
export function createOfflineRenderer(
  width: number,
  height: number,
  onError: (msg: string) => void,
  gen?: Generator,
): OfflineRenderCtx {
  const canvas = document.createElement('canvas');
  // Size exactly once, before context creation (resizing resets GL state).
  canvas.width = Math.max(2, Math.floor(width));
  canvas.height = Math.max(2, Math.floor(height));
  if (gen && isScene3D(gen) && gen.createScene3D) {
    // three.js path (preserveDrawingBuffer set inside WaveEngine).
    const scene3d = gen.createScene3D(canvas);
    return { canvas, renderer: null, scene3d };
  }
  // Retained buffer: VideoFrame(canvas) must see the pixels even if the
  // browser composites between our draw and the capture.
  const renderer = new Renderer(canvas, { onError }, { preserveDrawingBuffer: true });
  if (!renderer.isReady) {
    renderer.dispose();
    throw new Error(
      'WebGL2 is not available for export (context lost or limit reached). ' +
        'Try closing other tabs or lowering the resolution.',
    );
  }
  return { canvas, renderer, scene3d: null };
}

export function prepareOffline(
  ctx: OfflineRenderCtx,
  gen: Generator,
  params: Params,
  seed: number,
  post?: PostSettings,
): void {
  if (ctx.renderer) {
    ctx.renderer.setGenerator(gen);
    ctx.renderer.setParams(params);
    ctx.renderer.setSeed(seed);
    if (post) ctx.renderer.setPost(post);
  }
}

function renderOfflineFrame(
  ctx: OfflineRenderCtx,
  params: Params,
  seed: number,
  post: PostSettings | undefined,
  phase: number,
): void {
  if (ctx.scene3d) {
    ctx.scene3d.render({
      phase,
      params,
      seed,
      post: post ?? { ...DEFAULT_POST },
      width: ctx.canvas.width,
      height: ctx.canvas.height,
    });
    return;
  }
  ctx.renderer?.renderPhase(phase);
}

/**
 * Frame-accurate MP4 export via WebCodecs + mediabunny.
 * Steps phase manually: phase = i / totalFrames. Never real-time.
 */
export async function exportMp4(
  req: ExportRequest,
  gen: Generator,
  params: Params,
  seed: number,
  onProgress: (p: ExportProgress) => void,
  signal: AbortSignal,
  post?: PostSettings,
): Promise<Blob> {
  let ctx: OfflineRenderCtx | null = null;
  try {
    ctx = createOfflineRenderer(req.width, req.height, (m) => {
      throw new Error(m);
    }, gen);
    prepareOffline(ctx, gen, params, seed, post);
    const output = new Output({
      format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
      target: new BufferTarget(),
    });
    const bitrate = Math.round(req.width * req.height * req.fps * 0.12);
    const source = new VideoSampleSource({
      codec: 'avc',
      bitrate,
      keyFrameInterval: 2,
    });
    output.addVideoTrack(source, { frameRate: req.fps });
    await output.start();
    const frameDur = 1 / req.fps;
    for (let i = 0; i < req.totalFrames; i++) {
      if (signal.aborted) {
        await output.cancel();
        throw new DOMException('Export cancelled', 'AbortError');
      }
      const phase = i / req.totalFrames;
      renderOfflineFrame(ctx, params, seed, post, phase);
      if (ctx.renderer?.isContextLost) {
        throw new Error(
          'WebGL context was lost during export. Try exporting again or use a lower resolution.',
        );
      }
      const timestamp = i * frameDur;
      let vf: VideoFrame;
      try {
        vf = new VideoFrame(ctx.canvas, { timestamp: timestamp * 1e6, duration: frameDur * 1e6 });
      } catch (e) {
        throw new Error(
          `Could not capture frame ${i + 1}/${req.totalFrames} ` +
            `(${e instanceof Error ? e.message : String(e)}). ` +
            'The export canvas had no readable image — a lost WebGL context is the usual cause. ' +
            'Try exporting again, or use the WebM fallback.',
          { cause: e },
        );
      }
      // VideoSample wraps the frame without copying: keep vf alive until
      // the encoder has accepted the sample, then close both.
      const sample = new VideoSample(vf, { timestamp, duration: frameDur });
      try {
        await source.add(sample, { keyFrame: i % (req.fps * 2) === 0 });
      } finally {
        sample.close();
        vf.close();
      }
      onProgress({ frame: i + 1, totalFrames: req.totalFrames, done: false });
      // Yield to keep progress UI alive.
      await new Promise((r) => setTimeout(r, 0));
    }
    await output.finalize();
    const buf = (output.target as BufferTarget).buffer;
    if (!buf) throw new Error('MP4 finalize produced no data');
    onProgress({ frame: req.totalFrames, totalFrames: req.totalFrames, done: true });
    return new Blob([buf], { type: 'video/mp4' });
  } finally {
    try {
      ctx?.renderer?.dispose();
    } catch {
      /* ignore */
    }
    try {
      ctx?.scene3d?.dispose();
    } catch {
      /* ignore */
    }
  }
}
