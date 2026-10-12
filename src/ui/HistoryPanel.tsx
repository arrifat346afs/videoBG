import { useState } from 'react';
import { ChevronDown, Copy, FileDown, FileUp, Heart, History, Link2, Redo2, Save, Undo2 } from 'lucide-react';
import { encodeShare, readShareFromUrl } from './share.ts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAppStore, type Snapshot } from './store.ts';

const LS_KEY = 'videobg.presets.v1';

function loadPresets(): Snapshot[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as Snapshot[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function HistoryPanel() {
  const past = useAppStore((s) => s.past);
  const future = useAppStore((s) => s.future);
  const favorites = useAppStore((s) => s.favorites);
  const [presets, setPresets] = useState<Snapshot[]>(() => loadPresets());
  const [msg, setMsg] = useState('');

  const savePreset = (): void => {
    const s = useAppStore.getState();
    const cur: Snapshot = { seed: s.seed, generatorId: s.generatorId, params: { ...s.params }, post: { ...s.post } };
    const next = [...presets, cur].slice(-20);
    setPresets(next);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {
      /* storage may be unavailable */
    }
    setMsg('Preset saved');
  };

  const exportJson = (): void => {
    const s = useAppStore.getState();
    const blob = new Blob(
      [JSON.stringify({ seed: s.seed, generatorId: s.generatorId, params: s.params, post: s.post }, null, 2)],
      { type: 'application/json' },
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'videobg-preset.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const importJson = async (f: File): Promise<void> => {
    try {
      const o = JSON.parse(await f.text()) as Snapshot;
      useAppStore.getState().loadSnapshot(o);
      setMsg('Preset loaded');
    } catch {
      setMsg('Invalid preset file');
    }
  };

  const copyShare = async (): Promise<void> => {
    const s = useAppStore.getState();
    const h = encodeShare({ seed: s.seed, generatorId: s.generatorId, params: s.params, post: s.post });
    const url = `${location.origin}${location.pathname}#${h}`;
    try {
      await navigator.clipboard.writeText(url);
      setMsg('Share URL copied');
    } catch {
      setMsg(url);
    }
  };

  const loadFromUrl = (): void => {
    const p = readShareFromUrl();
    if (!p) {
      setMsg('No share in URL');
      return;
    }
    useAppStore.getState().loadSnapshot({ seed: p.s, generatorId: p.g, params: p.p, post: p.post });
    setMsg('Loaded from URL');
  };

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex-row items-center gap-2 px-3 pt-3 pb-2">
        <History className="size-[15px] text-muted-foreground" aria-hidden />
        <CardTitle className="text-sm">History / presets</CardTitle>
        <div className="flex-1" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              Presets <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Preset actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={savePreset}>
              <Save /> Save current as preset
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportJson}>
              <FileDown /> Export JSON
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => document.getElementById('preset-import')?.click()}>
              <FileUp /> Import JSON…
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void copyShare()}>
              <Copy /> Copy share URL
            </DropdownMenuItem>
            <DropdownMenuItem onClick={loadFromUrl}>
              <Link2 /> Load from URL
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 px-3 pb-3">
        <div className="flex flex-wrap gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" disabled={past.length === 0} onClick={() => useAppStore.getState().undo()}>
                <Undo2 /> Undo
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo last change</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" disabled={future.length === 0} onClick={() => useAppStore.getState().redo()}>
                <Redo2 /> Redo
              </Button>
            </TooltipTrigger>
            <TooltipContent>Redo</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={() => useAppStore.getState().toggleFavorite()}>
                <Heart /> Favorite
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle favorite for current seed + style</TooltipContent>
          </Tooltip>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={savePreset}>
            <Save /> Save preset
          </Button>
          <Button variant="outline" size="sm" onClick={exportJson}>
            <FileDown /> Export JSON
          </Button>
          <Button variant="outline" size="sm" asChild>
            <label className="cursor-pointer">
              <FileUp /> Import
              <input
                id="preset-import"
                type="file"
                accept="application/json"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importJson(f);
                }}
              />
            </label>
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void copyShare()}>
            <Copy /> Copy share URL
          </Button>
          <Button variant="outline" size="sm" onClick={loadFromUrl}>
            <Link2 /> Load from URL
          </Button>
        </div>
        {favorites.length > 0 && (
          <>
            <Separator />
            <div className="flex flex-wrap gap-1.5">
              {favorites.map((f) => (
                <Badge
                  key={`${f.generatorId}-${f.seed}`}
                  variant="outline"
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => useAppStore.getState().loadSnapshot(f)}
                >
                  {f.generatorId} · {f.seed >>> 0}
                </Badge>
              ))}
            </div>
          </>
        )}
        {presets.length > 0 && (
          <>
            <Separator />
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p, i) => (
                <Badge
                  key={`p-${i}`}
                  variant="secondary"
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => useAppStore.getState().loadSnapshot(p)}
                >
                  preset {i + 1} · {p.generatorId}
                </Badge>
              ))}
            </div>
          </>
        )}
        {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
      </CardContent>
    </Card>
  );
}
