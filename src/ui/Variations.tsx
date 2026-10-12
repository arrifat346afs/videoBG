import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { Renderer, aspectLabel, getGenerator, getResolution } from '../engine/index.ts';
import { mulberry32 } from '../engine/rng.ts';
import { isScene3D, type Scene3DHandle } from '../engine/types.ts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAppStore, type Snapshot } from './store.ts';

interface Thumb {
  readonly url: string;
  readonly snap: Snapshot;
}

// One shared offscreen renderer for all thumbnail batches: creating a new
// WebGL context per update would exhaust the browser's context limit.
let sharedCanvas: HTMLCanvasElement | null = null;
let sharedRenderer: Renderer | null = null;
// Separate shared canvas/handle for scene3d thumbnails (never share a GL
// context between the 2D renderer and three.js).
let sharedSceneCanvas: HTMLCanvasElement | null = null;
let sharedScene: Scene3DHandle | null = null;
let sharedSceneGenId = '';

function thumbSize(): { w: number; h: number } {
  const st = useAppStore.getState();
  const res = getResolution(st.resolutionId);
  const w = 192;
  const h = Math.max(24, Math.round((w * res.height) / res.width));
  return { w, h };
}

function getSharedRenderer(w: number, h: number): Renderer | null {
  if (
    sharedCanvas &&
    sharedRenderer &&
    sharedRenderer.isReady &&
    sharedCanvas.width === w &&
    sharedCanvas.height === h
  ) {
    return sharedRenderer;
  }
  try {
    sharedRenderer?.dispose();
  } catch {
    /* ignore */
  }
  sharedCanvas = document.createElement('canvas');
  sharedCanvas.width = w;
  sharedCanvas.height = h;
  sharedRenderer = new Renderer(sharedCanvas, {});
  if (!sharedRenderer.isReady) {
    sharedRenderer.dispose();
    sharedRenderer = null;
    sharedCanvas = null;
    return null;
  }
  return sharedRenderer;
}

function getSharedScene(genId: string, w: number, h: number): { canvas: HTMLCanvasElement; scene: Scene3DHandle } | null {
  const gen = getGenerator(genId);
  if (!gen?.createScene3D) return null;
  if (sharedSceneCanvas && sharedScene && sharedSceneGenId === genId && sharedSceneCanvas.width === w && sharedSceneCanvas.height === h) {
    return { canvas: sharedSceneCanvas, scene: sharedScene };
  }
  try {
    sharedScene?.dispose();
  } catch {
    /* ignore */
  }
  sharedSceneCanvas = document.createElement('canvas');
  sharedSceneCanvas.width = w;
  sharedSceneCanvas.height = h;
  try {
    sharedScene = gen.createScene3D(sharedSceneCanvas);
  } catch {
    sharedScene = null;
    sharedSceneCanvas = null;
    return null;
  }
  sharedSceneGenId = genId;
  return { canvas: sharedSceneCanvas, scene: sharedScene };
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// Compact horizontal Variations row BELOW the preview. Tiles keep the export
// aspect ratio and fill with object-fit: cover. Staggered low-res renders so
// the main preview never drops frames.
export function Variations() {
  const generatorId = useAppStore((s) => s.generatorId);
  const seed = useAppStore((s) => s.seed);
  const resolutionId = useAppStore((s) => s.resolutionId);
  const panelRev = useAppStore((s) => s.panelRev);
  const [thumbs, setThumbs] = useState<Thumb[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const runId = useRef(0);

  const refresh = useCallback(() => {
    // Clear in the event handler (not an effect): skeletons show immediately.
    setThumbs([]);
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const myRun = ++runId.current;
    // Debounce rapid store churn; then stagger each tile.
    const timer = setTimeout(() => {
      void (async () => {
        const st = useAppStore.getState();
        const gen = getGenerator(st.generatorId);
        if (!gen) {
          if (!cancelled && runId.current === myRun) setThumbs([]);
          return;
        }
        const { w, h } = thumbSize();
        // Salt the refresh key so "Refresh" yields new variants.
        const base = (st.seed + refreshKey * 1013904223) >>> 0;
        const out: Thumb[] = [];
        const use3d = isScene3D(gen);
        const sceneShared = use3d ? getSharedScene(gen.id, w, h) : null;
        const renderer = use3d ? null : getSharedRenderer(w, h);
        if (use3d && !sceneShared) return;
        if (!use3d && (!renderer || !sharedCanvas)) return;
        for (let i = 0; i < 6; i++) {
          if (cancelled || runId.current !== myRun) return;
          // Yield between tiles: main preview RAF always wins.
          if (i > 0) await sleep(70);
          if (cancelled || runId.current !== myRun) return;
          const vseed = (base + i * 7919 + 13) >>> 0;
          const params = gen.randomize(mulberry32(vseed));
          let url = '';
          if (use3d && sceneShared) {
            // Lower density for thumbnails so 6 tiles stay fast.
            const thumbParams = { ...params };
            if (typeof thumbParams['density'] === 'number') {
              thumbParams['density'] = Math.min(thumbParams['density'] as number, 70);
            }
            if (typeof thumbParams['nodeCount'] === 'number') {
              thumbParams['nodeCount'] = Math.min(thumbParams['nodeCount'] as number, 160);
            }
            try {
              sceneShared.scene.render({ phase: 0.27, params: thumbParams, seed: vseed, post: st.post, width: w, height: h });
              url = sceneShared.canvas.toDataURL('image/png');
            } catch {
              continue;
            }
          } else if (renderer && sharedCanvas) {
            renderer.setGenerator(gen);
            renderer.setParams(params);
            renderer.setSeed(vseed);
            renderer.setPost(st.post);
            renderer.renderPhase(0.27);
            url = sharedCanvas.toDataURL('image/png');
          }
          if (!url) continue;
          out.push({ url, snap: { seed: vseed, generatorId: gen.id, params, post: { ...st.post } } });
          if (!cancelled && runId.current === myRun) setThumbs([...out]);
        }
      })();
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [generatorId, seed, resolutionId, panelRev, refreshKey]);

  const res = getResolution(resolutionId);
  const ratio = `${res.width} / ${res.height}`;
  const ratioLabel = aspectLabel(res.width, res.height);

  return (
    <Card className="shrink-0 gap-0 py-0" aria-label="Variations">
      <CardHeader className="flex items-center gap-2 px-3 py-2">
        <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Variations
        </CardTitle>
        <span className="text-xs text-muted-foreground">6 · {ratioLabel}</span>
        <div className="flex-1" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" onClick={refresh}>
              <RefreshCw /> Refresh variations
            </Button>
          </TooltipTrigger>
          <TooltipContent>Render 6 new random variations</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setCollapsed((c) => !c)}
              aria-expanded={!collapsed}
              aria-label={collapsed ? 'Expand variations' : 'Collapse variations'}
            >
              {collapsed ? <ChevronDown /> : <ChevronUp />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{collapsed ? 'Expand variations (more choice)' : 'Collapse variations (more preview room)'}</TooltipContent>
        </Tooltip>
      </CardHeader>
      {!collapsed && (
        <CardContent className="px-3 pb-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {thumbs.map((t, i) => (
              <Tooltip key={`${t.snap.seed}-${i}`}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => useAppStore.getState().loadSnapshot(t.snap)}
                    className="relative min-w-0 cursor-pointer overflow-hidden rounded-lg border bg-black transition-all hover:-translate-y-px hover:border-primary hover:shadow-[0_0_0_1px_var(--ring)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    style={{ aspectRatio: ratio }}
                  >
                    <img src={t.url} alt={`variation ${i + 1}, seed ${t.snap.seed}`} draggable={false} className="block h-full w-full object-cover" />
                    <Badge variant="secondary" className="absolute bottom-1.5 left-1.5 font-mono text-[10px]">
                      {t.snap.seed >>> 0}
                    </Badge>
                  </button>
                </TooltipTrigger>
                <TooltipContent>Use seed {t.snap.seed} ({ratioLabel})</TooltipContent>
              </Tooltip>
            ))}
            {/* Shimmer skeletons fill any not-yet-rendered tiles (initial load,
                manual refresh, or progressive staggered fill). */}
            {Array.from({ length: Math.max(0, 6 - thumbs.length) }).map((_, i) => (
              <Skeleton key={`skel-${i}`} className="min-h-16 rounded-lg" style={{ aspectRatio: ratio }} />
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
