import { useEffect, useRef, useState } from 'react';
import { Download, Play, TriangleAlert } from 'lucide-react';
import { getGenerator, getResolution, resolutionLabel, RESOLUTIONS } from '../engine/index.ts';
import type { ResolutionPresetId } from '../engine/types.ts';
import { buildExportRequest, supportsWebCodecs } from '../export/types.ts';
import { exportMp4 } from '../export/mp4.ts';
import { exportWebmFallback } from '../export/webmFallback.ts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from './store.ts';

type Status = 'idle' | 'working' | 'done' | 'error';
type Format = 'auto' | 'mp4' | 'webm';

function sanitizeFilename(name: string): string {
  const clean = name.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-');
  return clean || 'videobg';
}

export function ExportPanel() {
  const open = useAppStore((s) => s.exportOpen);
  const resolutionId = useAppStore((s) => s.resolutionId);
  const fps = useAppStore((s) => s.fps);
  const durationSec = useAppStore((s) => s.durationSec);
  const [status, setStatus] = useState<Status>('idle');
  const [frame, setFrame] = useState(0);
  const [total, setTotal] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [format, setFormat] = useState<Format>('auto');
  const [usedFormat, setUsedFormat] = useState('');
  const [filename, setFilename] = useState('videobg-export');
  const [err, setErr] = useState<string | null>(null);
  const [canRetryWebm, setCanRetryWebm] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') useAppStore.getState().setExportOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const close = (next: boolean) => {
    if (!next) {
      abortRef.current?.abort();
      // Reset dialog state in the event handler so reopening starts fresh.
      setStatus('idle');
      setErr(null);
      setCanRetryWebm(false);
      useAppStore.getState().setExportOpen(false);
    }
  };

  const start = async (forceWebm = false) => {
    const st = useAppStore.getState();
    const gen = getGenerator(st.generatorId);
    if (!gen) {
      setErr('No generator selected');
      setStatus('error');
      return;
    }
    const res = getResolution(st.resolutionId);
    const req = buildExportRequest(res.width, res.height, st.fps, st.durationSec);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStatus('working');
    setFrame(0);
    setTotal(req.totalFrames);
    setErr(null);
    setCanRetryWebm(false);
    setUrl((u) => {
      if (u) URL.revokeObjectURL(u);
      return null;
    });
    try {
      const wantWebm = forceWebm || format === 'webm' || (format === 'auto' && !supportsWebCodecs());
      const useMp4 = !wantWebm && supportsWebCodecs();
      // Explicit mp4 without WebCodecs falls back with a warning.
      const label = useMp4 ? 'MP4 (WebCodecs)' : 'WebM (fallback)';
      setUsedFormat(label);
      const blob = useMp4
        ? await exportMp4(req, gen, st.params, st.seed, (p) => setFrame(p.frame), ctrl.signal, st.post)
        : await exportWebmFallback(req, gen, st.params, st.seed, (p) => setFrame(p.frame), ctrl.signal, st.post);
      setUrl(URL.createObjectURL(blob));
      setStatus('done');
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        setStatus('idle');
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        setErr(msg);
        setStatus('error');
        // MP4 frame capture failed but MediaRecorder may still work.
        if (/VideoFrame|no .*image|capture|context/i.test(msg) && supportsWebCodecs() && !forceWebm) {
          setCanRetryWebm(true);
        }
      }
    }
  };

  const res = getResolution(resolutionId);
  const pct = total > 0 ? Math.round((frame / total) * 100) : 0;
  const ext = usedFormat.startsWith('MP4') ? 'mp4' : 'webm';
  const downloadName = `${sanitizeFilename(filename)}.${ext}`;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-[480px]" aria-label="Export video">
        <DialogHeader>
          <DialogTitle>Export video</DialogTitle>
          <DialogDescription>
            {res.width}×{res.height} · {fps}fps · {durationSec}s · {total || fps * durationSec} frames ·
            seamless loop (phase = i/N)
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="export-res">Resolution</Label>
            <Select
              value={resolutionId}
              onValueChange={(v) => useAppStore.getState().setResolution(v as ResolutionPresetId)}
            >
              <SelectTrigger id="export-res">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(RESOLUTIONS) as ResolutionPresetId[]).map((id) => {
                  const r = getResolution(id);
                  return (
                    <SelectItem key={id} value={id}>
                      {resolutionLabel(r.width, r.height)}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="export-fps">FPS</Label>
            <Select
              value={String(fps)}
              onValueChange={(v) => useAppStore.getState().setFps(Number(v) as 30 | 60)}
            >
              <SelectTrigger id="export-fps">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30</SelectItem>
                <SelectItem value="60">60</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="export-dur">Duration</Label>
            <Select
              value={String(durationSec)}
              onValueChange={(v) => useAppStore.getState().setDuration(Number(v) as 5 | 10)}
            >
              <SelectTrigger id="export-dur">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5s</SelectItem>
                <SelectItem value="10">10s</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="export-format">Format</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as Format)}>
              <SelectTrigger id="export-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (best available)</SelectItem>
                <SelectItem value="mp4">MP4 (WebCodecs)</SelectItem>
                <SelectItem value="webm">WebM (fallback)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="export-name">Filename</Label>
            <Input
              id="export-name"
              value={filename}
              maxLength={80}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="videobg-export"
              aria-label="Export filename"
            />
          </div>
        </div>

        {format === 'mp4' && !supportsWebCodecs() && (
          <p className="flex items-center gap-1.5 text-sm text-amber-500">
            <TriangleAlert className="size-4" /> MP4 needs WebCodecs — this browser will fall back to WebM.
          </p>
        )}
        {!supportsWebCodecs() && format === 'auto' && (
          <p className="flex items-center gap-1.5 text-sm text-amber-500">
            <TriangleAlert className="size-4" /> WebCodecs unavailable — WebM fallback (real-time, best-effort).
          </p>
        )}

        {status === 'working' && (
          <div className="flex flex-col gap-2">
            <Progress value={pct} aria-label="Export progress" />
            <p className="text-sm text-muted-foreground">
              {frame}/{total} ({pct}%) · {usedFormat || 'starting…'}
            </p>
            <div>
              <Button variant="outline" size="sm" onClick={() => abortRef.current?.abort()}>
                Cancel export
              </Button>
            </div>
          </div>
        )}

        {status === 'done' && url && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{usedFormat}</Badge>
            <Button asChild>
              <a href={url} download={downloadName}>
                <Download /> Download {downloadName}
              </a>
            </Button>
          </div>
        )}
        {status === 'error' && err && <p className="text-sm text-destructive">{err}</p>}
        {status === 'error' && canRetryWebm && (
          <Button variant="outline" size="sm" onClick={() => void start(true)}>
            Retry with WebM fallback
          </Button>
        )}

        {status !== 'working' && (
          <DialogFooter>
            <Button variant="ghost" onClick={() => close(false)}>
              Close
            </Button>
            <Button onClick={() => void start()}>
              <Play /> Start export
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
