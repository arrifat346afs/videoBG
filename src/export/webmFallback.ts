// MediaRecorder WebM fallback when WebCodecs is unavailable.
// Best-effort real-time capture (not frame-accurate like the MP4 path).
import { DEFAULT_POST, type PostSettings } from '../engine/post.ts';
import { isScene3D, type Generator, type Params } from '../engine/types.ts';
import type { ExportProgress, ExportRequest } from './types.ts';
import { createOfflineRenderer, prepareOffline } from './mp4.ts';

function pickMime(): string {
  const cands = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  if (typeof MediaRecorder === 'undefined') return '';
  for (const c of cands) {
    try {
      if (MediaRecorder.isTypeSupported(c)) return c;
    } catch {
      continue;
    }
  }
  return '';
}

export async function exportWebmFallback(
  req: ExportRequest,
  gen: Generator,
  params: Params,
  seed: number,
  onProgress: (p: ExportProgress) => void,
  signal: AbortSignal,
  post?: PostSettings,
): Promise<Blob> {
  const ctx = createOfflineRenderer(req.width, req.height, (m) => {
    throw new Error(m);
  }, gen);
  try {
    prepareOffline(ctx, gen, params, seed, post);
    const stream = ctx.canvas.captureStream(req.fps);
    const mimeType = pickMime();
    const rec = new MediaRecorder(stream, {
      mimeType: mimeType || undefined,
      videoBitsPerSecond: Math.round(req.width * req.height * req.fps * 0.1),
    });
    const chunks: BlobPart[] = [];
    const done = new Promise<Blob>((resolve, reject) => {
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      rec.onerror = () => reject(new Error('MediaRecorder error'));
      rec.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
    });
    rec.start(250);
    const frameMs = 1000 / req.fps;
    for (let i = 0; i < req.totalFrames; i++) {
      if (signal.aborted) {
        try {
          rec.stop();
        } catch {
          /* noop */
        }
        throw new DOMException('Export cancelled', 'AbortError');
      }
      if (ctx.scene3d && isScene3D(gen)) {
        ctx.scene3d.render({
          phase: i / req.totalFrames,
          params,
          seed,
          post: post ?? { ...DEFAULT_POST },
          width: ctx.canvas.width,
          height: ctx.canvas.height,
        });
      } else {
        ctx.renderer?.renderPhase(i / req.totalFrames);
      }
      onProgress({ frame: i + 1, totalFrames: req.totalFrames, done: false });
      await new Promise((r) => setTimeout(r, frameMs));
    }
    // Allow trailing frames to flush.
    await new Promise((r) => setTimeout(r, 400));
    rec.stop();
    const blob = await done;
    onProgress({ frame: req.totalFrames, totalFrames: req.totalFrames, done: true });
    return blob;
  } finally {
    try {
      ctx.renderer?.dispose();
    } catch {
      /* ignore */
    }
    try {
      ctx.scene3d?.dispose();
    } catch {
      /* ignore */
    }
  }
}
