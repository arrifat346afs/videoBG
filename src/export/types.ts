// Export types + support detection. Framework-agnostic (no React).

export interface ExportRequest {
  readonly width: number;
  readonly height: number;
  readonly fps: 30 | 60;
  readonly durationSec: 5 | 10;
  readonly totalFrames: number;
}

export interface ExportProgress {
  readonly frame: number;
  readonly totalFrames: number;
  readonly done: boolean;
}

export function buildExportRequest(
  width: number,
  height: number,
  fps: 30 | 60,
  durationSec: 5 | 10,
): ExportRequest {
  return { width, height, fps, durationSec, totalFrames: fps * durationSec };
}

export function supportsWebCodecs(): boolean {
  return (
    typeof window !== 'undefined' &&
    'VideoEncoder' in window &&
    'VideoFrame' in window
  );
}

export function supportsMediaRecorder(): boolean {
  return typeof window !== 'undefined' && 'MediaRecorder' in window;
}
