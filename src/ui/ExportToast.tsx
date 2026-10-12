import { CheckCircle2, Download, Loader2, RotateCcw, TriangleAlert, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cancelExport, dismissExport, startExport } from '../export/runExport.ts';
import { useAppStore } from './store.ts';

/**
 * Notification-style export progress. Sits above the bottom bar and is the only
 * place export progress is surfaced, so the app stays usable during a render.
 */
export function ExportToast() {
  const status = useAppStore((s) => s.exportStatus);
  const frame = useAppStore((s) => s.exportFrame);
  const total = useAppStore((s) => s.exportTotal);
  const formatLabel = useAppStore((s) => s.exportFormatLabel);
  const error = useAppStore((s) => s.exportError);
  const download = useAppStore((s) => s.exportDownload);

  if (status === 'idle') return null;

  const pct = total > 0 ? Math.round((frame / total) * 100) : 0;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[84px] z-50 flex justify-center px-4 sm:inset-x-auto sm:right-4 sm:justify-end">
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex w-full max-w-sm flex-col gap-2 rounded-lg border bg-card p-3 shadow-lg"
      >
        {status === 'working' && (
          <>
            <div className="flex items-center gap-2">
              <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
              <span className="flex-1 text-sm font-medium">Exporting video…</span>
            </div>
            <Progress value={pct} aria-label="Export progress" />
            <p className="text-xs tabular-nums text-muted-foreground">
              {frame}/{total} ({pct}%){formatLabel ? ` · ${formatLabel}` : ''}
            </p>
            <div>
              <Button variant="outline" size="sm" onClick={cancelExport}>
                <X /> Cancel
              </Button>
            </div>
          </>
        )}

        {status === 'done' && download && (
          <>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-500" aria-hidden />
              <span className="flex-1 text-sm font-medium">Export ready</span>
            </div>
            <p className="text-xs text-muted-foreground">Downloading {download.name}…</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href={download.url} download={download.name}>
                  <Download /> Download
                </a>
              </Button>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="flex items-center gap-2">
              <TriangleAlert className="size-4 shrink-0 text-destructive" aria-hidden />
              <span className="flex-1 text-sm font-medium">Export failed</span>
            </div>
            <p className="text-xs break-words text-destructive">{error}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => void startExport()}>
                <RotateCcw /> Retry
              </Button>
              <Button variant="ghost" size="sm" onClick={dismissExport}>
                Dismiss
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
