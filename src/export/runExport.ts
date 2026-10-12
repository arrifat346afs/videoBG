// Background export runner. Keeps the actual encoding off any React component
// so the app stays usable while a clip renders, and reports progress through
// the app store (consumed by the export toast).
import { getGenerator, getResolution } from '../engine/index.ts';
import { useAppStore } from '../ui/store.ts';
import { exportMp4 } from './mp4.ts';
import { buildExportRequest, supportsWebCodecs } from './types.ts';
import { exportWebmFallback } from './webmFallback.ts';

let controller: AbortController | null = null;
let dismissTimer: ReturnType<typeof setTimeout> | null = null;

function sanitizeFilename(name: string): string {
  const clean = name.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-');
  return clean || 'videobg';
}

function triggerDownload(url: string, name: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function clearDismissTimer(): void {
  if (dismissTimer) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }
}

/** Abort an in-flight export. The running task cleans up its own state. */
export function cancelExport(): void {
  controller?.abort();
  controller = null;
}

/** Dismiss the notification and release the finished clip's object URL. */
export function dismissExport(): void {
  clearDismissTimer();
  const url = useAppStore.getState().exportDownload?.url;
  if (url) URL.revokeObjectURL(url);
  useAppStore.getState().resetExport();
}

/**
 * Start an export using the current store settings. Non-modal: the caller keeps
 * control while this promise resolves in the background. Only one export runs
 * at a time.
 */
export async function startExport(): Promise<void> {
  if (controller) return;

  // A previous run's toast may still be waiting to auto-dismiss; cancel it and
  // release its blob so it can't wipe the job we're about to start.
  clearDismissTimer();
  const st = useAppStore.getState();
  if (st.exportDownload?.url) URL.revokeObjectURL(st.exportDownload.url);

  const gen = getGenerator(st.generatorId);
  if (!gen) {
    st.setExportError('No generator selected');
    return;
  }
  const res = getResolution(st.resolutionId);
  const req = buildExportRequest(res.width, res.height, st.fps, st.durationSec);
  const ctrl = new AbortController();
  controller = ctrl;

  const wantWebm = st.exportFormat === 'webm' || !supportsWebCodecs();
  const useMp4 = !wantWebm;
  const label = useMp4 ? 'MP4 (WebCodecs)' : 'WebM (fallback)';
  st.setExportWorking(label, req.totalFrames);

  const onProgress = (p: { frame: number; totalFrames: number }) =>
    useAppStore.getState().setExportProgress(p.frame, p.totalFrames);

  try {
    const blob = useMp4
      ? await exportMp4(req, gen, st.params, st.seed, onProgress, ctrl.signal, st.post)
      : await exportWebmFallback(req, gen, st.params, st.seed, onProgress, ctrl.signal, st.post);
    if (ctrl.signal.aborted) return;
    const ext = useMp4 ? 'mp4' : 'webm';
    const name = `${sanitizeFilename(st.exportFilename)}.${ext}`;
    const url = URL.createObjectURL(blob);
    useAppStore.getState().setExportDone({ url, name });
    triggerDownload(url, name);
    dismissTimer = setTimeout(() => dismissExport(), 3200);
  } catch (e) {
    // If a newer export already replaced this one, leave its state untouched.
    const stillActive = controller === ctrl || controller === null;
    if (e instanceof DOMException && e.name === 'AbortError') {
      if (stillActive) dismissExport();
    } else if (stillActive) {
      useAppStore.getState().setExportError(e instanceof Error ? e.message : String(e));
    }
  } finally {
    if (controller === ctrl) controller = null;
  }
}
