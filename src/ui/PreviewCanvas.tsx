import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Maximize, Minimize, RefreshCw } from 'lucide-react';
import {
  Renderer,
  aspectLabel,
  getGenerator,
  getResolution,
  RESOLUTIONS,
  resolutionLabel,
} from '../engine/index.ts';
import { isScene3D, type Scene3DHandle } from '../engine/types.ts';
import type { ResolutionPresetId } from '../engine/types.ts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAppStore } from './store.ts';

interface Backend {
  readonly kind: 'shader2d' | 'scene3d';
  readonly renderer2d: Renderer | null;
  scene3d: Scene3DHandle | null;
}

// Preview owns the canvas element + RAF loop. 2D generators render through
// Renderer; scene3d generators render through their three.js handle on a
// fresh canvas per kind (never share one GL context between backends).
// The frame is letterboxed: it ALWAYS keeps the selected export aspect ratio
// (never stretched) and fits inside the available area (contain behavior).
export function PreviewCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const areaRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const backendRef = useRef<Backend>({ kind: 'shader2d', renderer2d: null, scene3d: null });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [renderSize, setRenderSize] = useState('');
  // Bump to swap in a brand-new canvas element (guaranteed fresh GL context)
  // via the Retry button, or when switching between 2D and 3D backends.
  const [canvasKey, setCanvasKey] = useState(0);

  const resolutionId = useAppStore((s) => s.resolutionId);
  const generatorId = useAppStore((s) => s.generatorId);
  const genKind: 'shader2d' | 'scene3d' = (() => {
    const g = getGenerator(generatorId);
    return g && isScene3D(g) ? 'scene3d' : 'shader2d';
  })();
  const res = getResolution(resolutionId);
  const aspect = aspectLabel(res.width, res.height);
  const ratio = res.width / res.height;

  const backingSize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return { w: 640, h: 360 };
    const st = useAppStore.getState();
    const dpr = typeof window !== 'undefined' && window.devicePixelRatio ? Math.min(2, window.devicePixelRatio) : 1;
    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(2, Math.round(rect.width || canvas.clientWidth || 640));
    const cssH = Math.max(2, Math.round(rect.height || canvas.clientHeight || 360));
    return {
      w: Math.max(2, Math.floor(cssW * st.quality * dpr)),
      h: Math.max(2, Math.floor(cssH * st.quality * dpr)),
    };
  }, []);

  const renderCurrent = useCallback((phase: number) => {
    const b = backendRef.current;
    const canvas = canvasRef.current;
    const st = useAppStore.getState();
    const gen = getGenerator(st.generatorId);
    if (!canvas || !gen) return;
    if (b.kind === 'scene3d') {
      if (!b.scene3d || !gen.createScene3D) return;
      b.scene3d.render({ phase: phase - Math.floor(phase), params: st.params, seed: st.seed, post: st.post, width: canvas.width, height: canvas.height });
    } else {
      b.renderer2d?.renderPhase(phase);
    }
  }, []);

  const syncRendererSize = useCallback(() => {
    const canvas = canvasRef.current;
    const b = backendRef.current;
    if (!canvas) return;
    if (b.kind === 'scene3d') {
      const { w, h } = backingSize();
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      renderCurrent(useAppStore.getState().phase);
      setRenderSize(`${canvas.width}×${canvas.height}`);
    } else {
      const r = b.renderer2d;
      if (!r) return;
      r.resizeToClient();
      r.renderPhase(useAppStore.getState().phase);
      const c = r.canvasEl;
      setRenderSize(`${c.width}×${c.height}`);
    }
  }, [backingSize, renderCurrent]);

  // Remount the canvas (fresh GL context) when switching 2D <-> 3D.
  const prevKind = useRef(genKind);
  useEffect(() => {
    if (prevKind.current !== genKind) {
      prevKind.current = genKind;
      setCanvasKey((k) => k + 1);
    }
  }, [genKind]);

  // Create backend once per canvas element.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const st = useAppStore.getState();
    const gen = getGenerator(st.generatorId);
    const kind: 'shader2d' | 'scene3d' = gen && isScene3D(gen) ? 'scene3d' : 'shader2d';
    let renderer: Renderer | null = null;
    let scene: Scene3DHandle | null = null;
    if (kind === 'scene3d' && gen?.createScene3D) {
      try {
        scene = gen.createScene3D(canvas);
      } catch (e) {
        useAppStore.getState().setError(e instanceof Error ? e.message : String(e));
      }
    } else {
      renderer = new Renderer(canvas, {
        onContextLost: () => useAppStore.getState().setContextLost(true),
        onContextRestored: () => useAppStore.getState().setContextLost(false),
        onError: (msg) => useAppStore.getState().setError(msg),
      });
      if (gen && !isScene3D(gen)) renderer.setGenerator(gen);
      renderer.setParams(st.params);
      renderer.setPost(st.post);
      renderer.setSeed(st.seed);
      renderer.setQuality(st.quality);
    }
    backendRef.current = { kind, renderer2d: renderer, scene3d: scene };

    // Defer first resize until layout settles so getBoundingClientRect is real.
    requestAnimationFrame(() => {
      syncRendererSize();
    });

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const s = useAppStore.getState();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (s.playing && !s.contextLost) {
        const next = s.loop
          ? (s.phase + (dt * s.speed) / s.durationSec) % 1
          : Math.min(1 - 1e-6, s.phase + (dt * s.speed) / s.durationSec);
        if (next !== s.phase) {
          s.setPhase(next);
          const b = backendRef.current;
          const g = getGenerator(s.generatorId);
          if (!g) return;
          if (b.kind === 'scene3d') {
            if (b.scene3d) {
              try {
                b.scene3d.render({ phase: next, params: s.params, seed: s.seed, post: s.post, width: canvas.width, height: canvas.height });
              } catch (e) {
                useAppStore.getState().setError(e instanceof Error ? e.message : String(e));
              }
            }
          } else {
            renderer?.renderPhase(next);
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const area = areaRef.current;
    const ro =
      typeof ResizeObserver !== 'undefined' && area
        ? new ResizeObserver(() => {
            syncRendererSize();
          })
        : null;
    if (area && ro) ro.observe(area);

    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      document.removeEventListener('fullscreenchange', onFs);
      try {
        renderer?.dispose(false);
      } catch {
        /* ignore */
      }
      try {
        scene?.dispose();
      } catch {
        /* ignore */
      }
      backendRef.current = { kind: 'shader2d', renderer2d: null, scene3d: null };
    };
  }, [canvasKey, syncRendererSize]);

  // Resize the drawing buffer when the export preset (aspect) changes.
  useEffect(() => {
    requestAnimationFrame(() => syncRendererSize());
  }, [resolutionId, syncRendererSize]);

  // Push state -> backend (no GL calls in React beyond method calls).
  const params = useAppStore((s) => s.params);
  const post = useAppStore((s) => s.post);
  const seed = useAppStore((s) => s.seed);
  const quality = useAppStore((s) => s.quality);
  const phase = useAppStore((s) => s.phase);
  const playing = useAppStore((s) => s.playing);
  const contextLost = useAppStore((s) => s.contextLost);
  const error = useAppStore((s) => s.error);

  useEffect(() => {
    const b = backendRef.current;
    const gen = getGenerator(generatorId);
    if (!gen) return;
    // Kind switches remount the canvas (see effect above); only push when kinds match.
    const want3d = isScene3D(gen);
    if ((b.kind === 'scene3d') !== want3d) return;
    if (!want3d) {
      b.renderer2d?.setGenerator(gen);
      b.renderer2d?.setParams(params);
      renderCurrent(useAppStore.getState().phase);
    } else {
      renderCurrent(useAppStore.getState().phase);
    }
  }, [generatorId, params, renderCurrent]);

  useEffect(() => {
    const b = backendRef.current;
    if (b.kind === 'scene3d') renderCurrent(useAppStore.getState().phase);
    else {
      b.renderer2d?.setPost(post);
      b.renderer2d?.renderPhase(useAppStore.getState().phase);
    }
  }, [post, renderCurrent]);

  useEffect(() => {
    const b = backendRef.current;
    if (b.kind === 'scene3d') renderCurrent(useAppStore.getState().phase);
    else {
      b.renderer2d?.setSeed(seed);
      b.renderer2d?.renderPhase(useAppStore.getState().phase);
    }
  }, [seed, renderCurrent]);

  useEffect(() => {
    const b = backendRef.current;
    if (b.kind === 'scene3d') syncRendererSize();
    else {
      b.renderer2d?.setQuality(quality);
      syncRendererSize();
    }
  }, [quality, syncRendererSize]);

  useEffect(() => {
    if (!playing) renderCurrent(phase);
  }, [phase, playing, renderCurrent]);

  const toggleFullscreen = useCallback(() => {
    const frame = frameRef.current;
    if (!frame) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void frame.requestFullscreen?.();
    }
  }, []);

  // Manual recovery: discard the (lost) canvas element entirely and mount a
  // fresh one, which always yields a new GL context.
  const retryPreview = useCallback(() => {
    const canvas = canvasRef.current;
    try {
      canvas?.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch {
      /* best effort */
    }
    try {
      backendRef.current.renderer2d?.dispose();
    } catch {
      /* ignore */
    }
    try {
      backendRef.current.scene3d?.dispose();
    } catch {
      /* ignore */
    }
    backendRef.current = { kind: 'shader2d', renderer2d: null, scene3d: null };
    useAppStore.getState().setContextLost(false);
    useAppStore.getState().setError(null);
    setCanvasKey((k) => k + 1);
  }, []);

  return (
    <>
      <div className="flex min-h-8 shrink-0 items-center gap-2">
        <Select
          value={resolutionId}
          onValueChange={(v) => useAppStore.getState().setResolution(v as ResolutionPresetId)}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <SelectTrigger className="max-w-[260px]" aria-label="Preview aspect ratio / export resolution">
                <SelectValue />
              </SelectTrigger>
            </TooltipTrigger>
            <TooltipContent>Export resolution preset — preview always uses this aspect ratio</TooltipContent>
          </Tooltip>
          <SelectContent>
            {(Object.keys(RESOLUTIONS) as ResolutionPresetId[]).map((id) => {
              const r = getResolution(id);
              return (
                <SelectItem key={id} value={id}>
                  {resolutionLabel(r.width, r.height)} · {r.label.split(' (')[0]}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="rounded-full" title="Preview aspect ratio matches the export preset">
          {aspect}
        </Badge>
        <div className="flex-1" />
        {renderSize && (
          <span className="hidden text-xs text-muted-foreground tabular-nums whitespace-nowrap sm:inline" title="Canvas backing-store size (CSS × DPR × quality)">
            {renderSize}
          </span>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={toggleFullscreen} aria-label={isFullscreen ? 'Exit fullscreen preview' : 'Fullscreen preview'}>
              {isFullscreen ? <Minimize /> : <Maximize />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isFullscreen ? 'Exit fullscreen preview' : 'Fullscreen preview'}</TooltipContent>
        </Tooltip>
      </div>

      <div ref={areaRef} className="preview-area-cq relative grid min-h-0 flex-1 place-items-center overflow-hidden rounded-xl border bg-black p-4">
        <div
          ref={frameRef}
          className="preview-frame-cq relative aspect-video w-full overflow-hidden rounded-[10px] border bg-black shadow-md"
          style={{ aspectRatio: `${res.width} / ${res.height}`, '--ratio': ratio } as CSSProperties}
        >
          <canvas ref={canvasRef} key={canvasKey} className="block h-full w-full bg-black object-contain" />
          {contextLost && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-6 text-center">
              <Card className="max-w-[420px] gap-2 py-4">
                <CardContent className="grid justify-items-center gap-2">
                  <strong>GPU context lost</strong>
                  <span className="text-sm text-muted-foreground">Waiting for the browser to restore it… if this persists, your GPU may be busy or the driver crashed.</span>
                  <Button size="sm" onClick={retryPreview}>
                    <RefreshCw /> Retry preview
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
          {error && !contextLost && (
            <div className="absolute inset-0 flex items-center justify-center bg-destructive/90 p-6 text-center text-white">
              <div className="grid max-w-[420px] justify-items-center gap-2">
                <strong>Preview unavailable</strong>
                <span className="text-sm">
                  {error.includes('WebGL2')
                    ? 'WebGL2 is not available in this browser. Try a recent Chrome, Edge, Firefox, or Safari with hardware acceleration enabled.'
                    : error}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
