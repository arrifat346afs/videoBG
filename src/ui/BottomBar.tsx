import { useEffect } from 'react';
import { ChevronDown, Clapperboard, Dices, Download, Lock, Palette, Pause, Play, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAppStore } from './store.ts';

function fmtTime(sec: number): string {
  return `${sec.toFixed(1).padStart(4, '0')}s`;
}

export function BottomBar() {
  const phase = useAppStore((s) => s.phase);
  const playing = useAppStore((s) => s.playing);
  const seed = useAppStore((s) => s.seed);
  const seedLocked = useAppStore((s) => s.seedLocked);
  const durationSec = useAppStore((s) => s.durationSec);
  const loop = useAppStore((s) => s.loop);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.target instanceof HTMLSelectElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        useAppStore.getState().togglePlay();
      } else if (e.key === 'r' || e.key === 'R') {
        useAppStore.getState().randomizeAll();
      } else if (e.key === 'e' || e.key === 'E') {
        useAppStore.getState().setExportOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const cur = phase * durationSec;

  return (
    <footer className="flex min-h-[60px] shrink-0 flex-wrap items-center gap-3 border-t bg-card px-4 py-2">
      <div className="flex items-center gap-2">
        <div className="flex items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="rounded-r-none"
                onClick={() => useAppStore.getState().randomizeAll()}
              >
                <Dices /> Randomize
              </Button>
            </TooltipTrigger>
            <TooltipContent>Randomize style + seed (R)</TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="rounded-l-none border-l-0 px-1.5" aria-label="More randomize options">
                    <ChevronDown />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Randomize palette or motion only</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => useAppStore.getState().randomizeAll()}>
                <Dices /> Randomize everything (R)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => useAppStore.getState().randomizePaletteOnly('random')}>
                <Palette /> Randomize palette only
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => useAppStore.getState().randomizeMotionOnly()}>
                <Clapperboard /> Randomize motion only
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              onClick={() => useAppStore.getState().togglePlay()}
              aria-label={playing ? 'Pause' : 'Play'}
              aria-pressed={playing}
            >
              {playing ? <Pause /> : <Play />} {playing ? 'Pause' : 'Play'}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Play / pause (Space)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon-sm"
              variant={loop ? 'secondary' : 'outline'}
              className={cn(loop && 'shadow-[inset_0_0_0_1px_var(--ring)]')}
              onClick={() => useAppStore.getState().setLoop(!loop)}
              aria-pressed={loop}
              aria-label="Toggle loop"
            >
              <Repeat />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{loop ? 'Looping on — click to play once' : 'Looping off — click to loop'}</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex min-w-0 flex-1 basis-full items-center gap-3 order-3 lg:order-none lg:basis-auto">
        <span className="text-sm whitespace-nowrap tabular-nums text-muted-foreground" title="Current time / total duration">
          {fmtTime(cur)} / {fmtTime(durationSec)}
        </span>
        <Slider
          value={[Math.floor(phase * 1000)]}
          min={0}
          max={1000}
          step={1}
          aria-label="Timeline scrubber"
          className="min-w-[60px] flex-1"
          onValueChange={([v]) => {
            useAppStore.getState().setPlaying(false);
            useAppStore.getState().setPhase((v ?? 0) / 1000);
          }}
        />
        <div className="inline-flex overflow-hidden rounded-md border bg-muted" role="group" aria-label="Clip duration">
          {[5, 10].map((d) => (
            <Button
              key={d}
              size="sm"
              variant={durationSec === d ? 'secondary' : 'ghost'}
              className={cn('rounded-none', durationSec === d && 'shadow-[inset_0_0_0_1px_var(--ring)]')}
              aria-pressed={durationSec === d}
              title={`Set duration to ${d} seconds`}
              onClick={() => useAppStore.getState().setDuration(d as 5 | 10)}
            >
              {d}s
            </Button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="outline" className="font-mono" title={seedLocked ? `Seed ${seed >>> 0} (locked)` : `Seed ${seed >>> 0}`}>
          {seedLocked && <Lock className="size-3" />}seed {seed >>> 0}
        </Badge>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button id="export-btn" size="sm" onClick={() => useAppStore.getState().setExportOpen(true)}>
              <Download /> Export
            </Button>
          </TooltipTrigger>
          <TooltipContent>Export video (E)</TooltipContent>
        </Tooltip>
      </div>
    </footer>
  );
}
