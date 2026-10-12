import { useState, type ReactNode } from 'react';
import {
  ChevronDown,
  Clapperboard,
  Dices,
  Download,
  Leaf,
  Lightbulb,
  Lock,
  LockOpen,
  Network,
  Palette,
  Plus,
  RotateCcw,
  Settings2,
  Shapes,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  TriangleAlert,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  generatorCategory,
  getGenerator,
  getResolution,
  listGenerators,
  resolutionLabel,
  RESOLUTIONS,
} from '../engine/index.ts';
import { DEFAULT_POST, type PostSettings } from '../engine/post.ts';
import { PRESET_PALETTES } from '../engine/palettes.ts';
import {
  addGradientStop,
  decodeGradient,
  encodeGradient,
  randomizeGradient,
  removeGradientStop,
  reverseGradient,
  setGradientStop,
  type GradientInterp,
  type GradientStops,
} from '../engine/gradient.ts';
import { mulberry32 } from '../engine/rng.ts';
import type { Harmony, ResolutionPresetId } from '../engine/types.ts';
import { supportsWebCodecs } from '../export/types.ts';
import { startExport } from '../export/runExport.ts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ColorPicker } from '@/components/ui/color-picker';
import { cn } from '@/lib/utils';
import { useAppStore, type ExportFormat } from './store.ts';
import { LayersPanel } from './LayersPanel.tsx';

/* ---------- small building blocks (shadcn) ---------- */

function Section(props: {
  icon: LucideIcon;
  title: string;
  open: boolean;
  onToggle: () => void;
  onReset?: () => void;
  resetTitle?: string;
  summary?: string;
  children: ReactNode;
}) {
  const Icon = props.icon;
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="flex items-center gap-2 px-3 py-0">
        <Button
          variant="ghost"
          className="h-10 flex-1 justify-start gap-2 px-1 font-semibold"
          onClick={props.onToggle}
          aria-expanded={props.open}
          title={`${props.open ? 'Collapse' : 'Expand'} ${props.title}`}
        >
          <Icon className="size-4 text-muted-foreground" aria-hidden />
          <CardTitle className="text-sm">{props.title}</CardTitle>
          <ChevronDown
            className={cn('ml-auto size-3.5 text-muted-foreground transition-transform', props.open && 'rotate-180')}
            aria-hidden
          />
        </Button>
        {props.onReset && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={props.onReset}
                aria-label={props.resetTitle ?? `Reset ${props.title}`}
              >
                <RotateCcw className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{props.resetTitle ?? `Reset ${props.title}`}</TooltipContent>
          </Tooltip>
        )}
      </CardHeader>
      {!props.open && props.summary && (
        <div className="truncate px-3 pb-2 text-xs text-muted-foreground">{props.summary}</div>
      )}
      {props.open && (
        <CardContent className="flex flex-col gap-1 px-3 pb-3">
          {props.children}
        </CardContent>
      )}
    </Card>
  );
}

function SliderRow(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  onChange: (v: number) => void;
  title?: string;
}) {
  const fmt = (v: number): string =>
    props.step >= 1 ? String(Math.round(v)) : String(Math.round(v * 100) / 100);
  const reset = () => props.onChange(props.defaultValue);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="flex min-h-8 items-center gap-2 py-0.5"
          onDoubleClick={reset}
        >
          <Label className="w-[118px] shrink-0 truncate text-sm text-muted-foreground">{props.label}</Label>
          <Slider
            value={[props.value]}
            min={props.min}
            max={props.max}
            step={props.step}
            aria-label={props.label}
            className="min-w-0 flex-1"
            onValueChange={([v]) => {
              if (v !== undefined) props.onChange(v);
            }}
          />
          <Input
            type="number"
            min={props.min}
            max={props.max}
            step={props.step}
            value={Math.round(props.value * 1000) / 1000}
            aria-label={`${props.label} value`}
            className="h-7 w-16 shrink-0 px-1.5 text-right font-mono text-xs"
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) {
                props.onChange(Math.min(props.max, Math.max(props.min, v)));
              }
            }}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent>{props.title ?? `${props.label} — double-click to reset to ${fmt(props.defaultValue)}`}</TooltipContent>
    </Tooltip>
  );
}

function ToggleRow(props: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  title?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex min-h-8 items-center gap-2 py-0.5">
          <Label className="flex-1 text-sm text-muted-foreground">{props.label}</Label>
          <span className="text-xs text-muted-foreground tabular-nums">{props.checked ? 'On' : 'Off'}</span>
          <Switch
            checked={props.checked}
            onCheckedChange={props.onChange}
            aria-label={props.label}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent>{props.title ?? props.label}</TooltipContent>
    </Tooltip>
  );
}

function SelectRow(props: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  title?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex min-h-8 items-center gap-2 py-0.5">
          <Label className="flex-1 text-sm text-muted-foreground">{props.label}</Label>
          <Select value={props.value} onValueChange={props.onChange}>
            <SelectTrigger size="sm" className="ml-auto max-w-[150px]" aria-label={props.label}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {props.options.map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </TooltipTrigger>
      <TooltipContent>{props.title ?? props.label}</TooltipContent>
    </Tooltip>
  );
}

function ColorRow(props: { name: string; value: string; onChange: (v: string) => void; presets?: string[] }) {
  const hex = typeof props.value === 'string' ? props.value : '#ffffff';
  return (
    <div className="flex min-h-10 items-center gap-2 py-1">
      <span className="w-[118px] shrink-0 truncate text-sm text-muted-foreground">{props.name}</span>
      <ColorPicker value={hex} onChange={props.onChange} label={props.name} presets={props.presets} />
      <code className="font-mono text-xs text-muted-foreground">{hex}</code>
    </div>
  );
}

function GradientRow(props: {
  name: string;
  value: string;
  presets?: string[];
  onChange: (v: string) => void;
}) {
  const grad: GradientStops = decodeGradient(props.value);
  const stops = [...grad.stops];
  const setGrad = (next: GradientStops) => props.onChange(encodeGradient(next));
  const setStop = (i: number, patch: { color?: string; pos?: number }) => setGrad(setGradientStop(grad, i, patch));
  const preview = `linear-gradient(90deg, ${stops
    .map((s) => `${s.color} ${Math.round(s.pos * 100)}%`)
    .join(', ')})`;
  const addMid = () => {
    const mid = stops[Math.floor(stops.length / 2)];
    const pos = mid ? Math.min(0.99, mid.pos + 0.15) : 0.5;
    setGrad(addGradientStop(grad, mid?.color ?? '#ffffff', pos));
  };
  return (
    <div className="flex flex-col gap-1.5 py-1.5">
      <div className="flex items-center gap-2">
        <Label className="flex-1 text-sm text-muted-foreground">{props.name}</Label>
        <Select value={grad.interp} onValueChange={(v) => setGrad({ stops, interp: v as GradientInterp })}>
          <SelectTrigger size="sm" className="max-w-[130px]" aria-label="Gradient interpolation">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="rgb">linear RGB</SelectItem>
            <SelectItem value="smooth">smooth RGB</SelectItem>
            <SelectItem value="oklab">perceptual (OKLab)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="h-5 w-full rounded-md border" style={{ background: preview }} aria-hidden />
      <div className="flex flex-col gap-1">
        {stops.map((s, i) => (
          <div key={`stop-${i}`} className="flex items-center gap-2">
            <ColorPicker
              value={s.color}
              onChange={(c) => setStop(i, { color: c })}
              label={`Stop ${i + 1}`}
              presets={props.presets}
            />
            <Slider
              value={[s.pos]}
              min={0}
              max={1}
              step={0.01}
              aria-label={`Stop ${i + 1} position`}
              className="min-w-0 flex-1"
              onValueChange={([v]) => {
                if (v !== undefined) setStop(i, { pos: v });
              }}
            />
            <span className="w-8 text-right font-mono text-xs text-muted-foreground">
              {Math.round(s.pos * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove stop ${i + 1}`}
              disabled={stops.length <= 2}
              onClick={() => setGrad(removeGradientStop(grad, i))}
            >
              <X className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button variant="outline" size="sm" onClick={addMid} disabled={stops.length >= 8}>
          <Plus /> Add colour
        </Button>
        <Button variant="outline" size="sm" onClick={() => setGrad(reverseGradient(grad))}>
          <RotateCcw /> Reverse
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setGrad(randomizeGradient(mulberry32((Math.random() * 0xffffffff) >>> 0)))}
        >
          <Shuffle /> Randomize
        </Button>
      </div>
    </div>
  );
}

/* ---------- panel ---------- */

const POST_DEFS: { key: keyof PostSettings; label: string; min: number; max: number; step: number }[] = [
  { key: 'contrast', label: 'Contrast', min: 0.5, max: 1.8, step: 0.01 },
  { key: 'brightness', label: 'Brightness', min: -0.3, max: 0.3, step: 0.01 },
  { key: 'saturation', label: 'Saturation', min: 0, max: 2, step: 0.01 },
  { key: 'grain', label: 'Grain', min: 0, max: 0.3, step: 0.005 },
  { key: 'vignette', label: 'Vignette', min: 0, max: 1, step: 0.01 },
  { key: 'chromAb', label: 'ChromAb', min: 0, max: 3, step: 0.05 },
];

export function SettingsPanel() {
  const generatorId = useAppStore((s) => s.generatorId);
  const seed = useAppStore((s) => s.seed);
  const seedLocked = useAppStore((s) => s.seedLocked);
  const quality = useAppStore((s) => s.quality);
  const speed = useAppStore((s) => s.speed);
  const loop = useAppStore((s) => s.loop);
  const params = useAppStore((s) => s.params);
  const post = useAppStore((s) => s.post);
  const resolutionId = useAppStore((s) => s.resolutionId);
  const fps = useAppStore((s) => s.fps);
  const durationSec = useAppStore((s) => s.durationSec);
  const exportStatus = useAppStore((s) => s.exportStatus);
  const exportFormat = useAppStore((s) => s.exportFormat);
  const exportFilename = useAppStore((s) => s.exportFilename);

  const [open, setOpen] = useState<Record<string, boolean>>({
    style: true,
    motion: true,
    palette: true,
    styleParams: true,
    look: false,
    export: true,
  });
  const [harmony, setHarmony] = useState<Harmony>('random');
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const st = useAppStore.getState();
  const gen = getGenerator(generatorId);
  const gens = listGenerators();
  const CATEGORY_ORDER = ['Organic', 'Geometric', 'Light', 'Network'] as const;
  const CATEGORY_ICON: Record<string, LucideIcon> = { Organic: Leaf, Geometric: Shapes, Light: Lightbulb, Network: Network };
  const CurrentCatIcon = (gen ? CATEGORY_ICON[generatorCategory(gen)] : undefined) ?? Sparkles;
  const colorDefs = (gen?.paramSchema ?? []).filter((d) => d.kind === 'color');
  const gradientDefs = (gen?.paramSchema ?? []).filter((d) => d.kind === 'gradient');
  const otherDefs = (gen?.paramSchema ?? []).filter((d) => d.kind !== 'color' && d.kind !== 'gradient');

  const lookSummary =
    `Contrast ${post.contrast.toFixed(2)} · Sat ${post.saturation.toFixed(2)} · ` +
    `Grain ${post.grain.toFixed(3)} · Vig ${post.vignette.toFixed(2)}` +
    (post.chromAb > 0 ? ` · CA ${post.chromAb.toFixed(2)}` : '');

  const resetMotion = () => {
    st.setSpeed(1);
    st.setLoop(true);
  };
  const resetPalette = () => {
    if (!gen) return;
    const next = { ...params };
    for (const d of [...colorDefs, ...gradientDefs]) {
      const pv = gen.defaultParams[d.key];
      if (pv !== undefined) next[d.key] = pv;
    }
    st.setParams(next);
  };
  const resetStyleParams = () => {
    if (!gen) return;
    const next = { ...params };
    for (const d of otherDefs) {
      const pv = gen.defaultParams[d.key];
      if (pv !== undefined) next[d.key] = pv;
    }
    st.setParams(next);
  };

  const applyChip = (colors: string[]) => {
    if (colorDefs.length === 0) return;
    const next = { ...params };
    colorDefs.forEach((d, i) => {
      const c = colors[i % colors.length];
      if (c) next[d.key] = c;
    });
    st.setParams(next);
  };

  const allPresetColors = PRESET_PALETTES.flatMap((p) => p.colors);

  return (
    <>
      {/* Style */}
      <Section
        icon={Sparkles} title="Style" open={!!open.style} onToggle={() => toggle('style')}
        onReset={() => gen && st.setGenerator(gen.id)} resetTitle="Reset style to generator defaults"
      >
        <div className="flex min-h-8 items-center gap-2">
          <Label className="text-sm text-muted-foreground">Preset style</Label>
          <span className="text-muted-foreground" title={`Category: ${gen ? generatorCategory(gen) : ''}`}>
            <CurrentCatIcon className="size-[15px]" aria-hidden />
          </span>
          <Select value={generatorId} onValueChange={(v) => st.setGenerator(v)}>
            <SelectTrigger className="ml-auto max-w-[150px]" aria-label="Preset style">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_ORDER.map((cat) => (
                <SelectGroup key={cat}>
                  <SelectLabel>{cat}</SelectLabel>
                  {gens.filter((g) => generatorCategory(g) === cat).map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-h-8 items-center gap-2">
          <Label htmlFor="seed-input" className="w-[118px] shrink-0 text-muted-foreground">Seed</Label>
          <Input
            id="seed-input"
            type="number"
            min={0}
            max={4294967295}
            step={1}
            value={seed >>> 0}
            aria-label="Seed (number input)"
            title="Seed — type a number, dice for random, lock to keep it"
            className="h-8 min-w-0 flex-1 font-mono"
            onChange={(e) => {
              const v = Math.floor(Number(e.target.value));
              if (Number.isFinite(v) && v >= 0) st.setSeed(v);
            }}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => st.randomizeSeed()}
                disabled={seedLocked}
                aria-label="Randomize seed"
              >
                <Dices />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{seedLocked ? 'Seed is locked — unlock to randomize (R)' : 'Randomize seed (R)'}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => st.toggleSeedLock()}
                aria-pressed={seedLocked}
                aria-label={seedLocked ? 'Unlock seed' : 'Lock seed'}
              >
                {seedLocked ? <Lock /> : <LockOpen />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{seedLocked ? 'Unlock seed' : 'Lock seed (keep on randomize)'}</TooltipContent>
          </Tooltip>
        </div>
        <SliderRow
          label="Preview quality" value={quality} min={0.25} max={1} step={0.05}
          defaultValue={0.5} onChange={(v) => st.setQuality(v)}
          title="Preview sharpness (CSS × DPR × quality) — double-click to reset"
        />
        <div className="flex flex-wrap gap-2 py-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button className="flex-1" onClick={() => st.randomizeAll()}>
                <Dices /> Randomize
              </Button>
            </TooltipTrigger>
            <TooltipContent>Randomize style + seed (R)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={() => st.randomizePaletteOnly(harmony)}>
                <Palette /> Palette
              </Button>
            </TooltipTrigger>
            <TooltipContent>Randomize palette colors only</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={() => st.randomizeMotionOnly()}>
                <Clapperboard /> Motion
              </Button>
            </TooltipTrigger>
            <TooltipContent>Randomize motion parameters only</TooltipContent>
          </Tooltip>
        </div>
      </Section>

      {/* Layers / mix */}
      <LayersPanel />

      {/* Motion */}
      <Section
        icon={Clapperboard} title="Motion" open={!!open.motion} onToggle={() => toggle('motion')}
        onReset={resetMotion} resetTitle="Reset motion (speed 1, loop on)"
      >
        <SliderRow
          label="Speed" value={speed} min={0.1} max={3} step={0.05}
          defaultValue={1} onChange={(v) => st.setSpeed(v)}
        />
        <ToggleRow label="Seamless loop" checked={loop} onChange={(v) => st.setLoop(v)}
          title="Loop the animation seamlessly" />
      </Section>

      {/* Palette */}
      <Section
        icon={Palette} title="Color / Palette" open={!!open.palette} onToggle={() => toggle('palette')}
        onReset={resetPalette} resetTitle="Reset palette to style defaults"
      >
        {colorDefs.length === 0 && gradientDefs.length === 0 && (
          <p className="text-sm text-muted-foreground">This style has no editable colors.</p>
        )}
        {colorDefs.map((d) => (
          <ColorRow key={d.key} name={d.label} value={String(params[d.key] ?? d.defaultValue)}
            presets={allPresetColors} onChange={(v) => st.setParam(d.key, v)} />
        ))}
        {gradientDefs.map((d) => (
          <GradientRow key={d.key} name={d.label} value={String(params[d.key] ?? d.defaultValue)}
            presets={allPresetColors} onChange={(v) => st.setParam(d.key, v)} />
        ))}
        <div className="text-xs text-muted-foreground">
          Tap a palette to apply it to this style&apos;s colors · {PRESET_PALETTES.length} presets
        </div>
        <div className="grid max-h-56 grid-cols-5 gap-1.5 overflow-y-auto py-1 pr-1">
          {PRESET_PALETTES.map((p, i) => (
            <Tooltip key={`chip-${i}`}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => applyChip([...p.colors])}
                  aria-label={`Apply palette ${i + 1}`}
                  className="flex h-[26px] cursor-pointer overflow-hidden rounded-lg border transition-all hover:-translate-y-px hover:border-primary hover:shadow-[0_0_0_1px_var(--ring)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {p.colors.slice(0, 6).map((c, j) => (
                    <span key={j} className="flex-1" style={{ background: c }} />
                  ))}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {String(i + 1).padStart(2, '0')} · {p.harmony}: {p.colors.slice(0, 6).join(', ')}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
        <div className="flex min-h-8 items-center gap-2">
          <Label className="flex-1 text-sm text-muted-foreground">Harmony</Label>
          <Select value={harmony} onValueChange={(v) => setHarmony(v as Harmony)}>
            <SelectTrigger size="sm" className="ml-auto max-w-[150px]" aria-label="Palette harmony">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="random">random</SelectItem>
              <SelectItem value="analogous">analogous</SelectItem>
              <SelectItem value="complementary">complementary</SelectItem>
              <SelectItem value="split-complementary">split-complementary</SelectItem>
              <SelectItem value="triadic">triadic</SelectItem>
              <SelectItem value="tetradic">tetradic</SelectItem>
              <SelectItem value="monochrome">monochrome</SelectItem>
              <SelectItem value="gradient-ramp">gradient-ramp</SelectItem>
              <SelectItem value="pastel">pastel</SelectItem>
              <SelectItem value="vibrant">vibrant</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="py-1">
          <Button variant="outline" size="sm" className="w-full"
            onClick={() => st.randomizePaletteOnly(harmony)}
            title={`Randomize palette (${harmony} harmony)`}>
            <Palette /> Randomize palette
          </Button>
        </div>
      </Section>

      {/* Style parameters */}
      <Section
        icon={Settings2} title="Style Parameters" open={!!open.styleParams} onToggle={() => toggle('styleParams')}
        onReset={resetStyleParams} resetTitle="Reset style parameters to defaults"
        summary={gen ? `${gen.name} · ${otherDefs.length} controls` : undefined}
      >
        {!gen && <p className="text-sm text-muted-foreground">No style selected.</p>}
        {otherDefs.map((d) => {
          const cur = params[d.key] ?? d.defaultValue;
          if (d.kind === 'number' && typeof cur === 'number') {
            return (
              <SliderRow key={d.key} label={d.label} value={cur}
                min={d.min} max={d.max} step={d.step} defaultValue={d.defaultValue}
                onChange={(v) => st.setParam(d.key, v)} />
            );
          }
          if (d.kind === 'boolean' && typeof cur === 'boolean') {
            return (
              <ToggleRow key={d.key} label={d.label} checked={cur}
                onChange={(v) => st.setParam(d.key, v)}
                title={`${d.label} — proper on/off switch`} />
            );
          }
          if (d.kind === 'select' && typeof cur === 'string') {
            return (
              <SelectRow key={d.key} label={d.label} value={cur}
                options={d.options} onChange={(v) => st.setParam(d.key, v)} />
            );
          }
          return null;
        })}
      </Section>

      {/* Look (post) */}
      <Section
        icon={SlidersHorizontal} title="Look (post)" open={!!open.look} onToggle={() => toggle('look')}
        onReset={() => st.resetPost()} resetTitle="Reset look to defaults"
        summary={lookSummary}
      >
        {POST_DEFS.map((d) => (
          <SliderRow key={d.key} label={d.label} value={post[d.key]}
            min={d.min} max={d.max} step={d.step} defaultValue={DEFAULT_POST[d.key]}
            onChange={(v) => st.setPost({ [d.key]: v } as Partial<PostSettings>)} />
        ))}
        <ToggleRow label="Posterize" checked={post.posterize > 0.5}
          onChange={(v) => st.setPost({ posterize: v ? 1 : 0 })}
          title="Posterize: flat 6-step color bands" />
      </Section>

      {/* Export */}
      <Section icon={Download} title="Export" open={!!open.export} onToggle={() => toggle('export')}>
        <div className="flex min-h-8 items-center gap-2">
          <Label className="flex-1 text-sm text-muted-foreground">Resolution</Label>
          <Select value={resolutionId} onValueChange={(v) => st.setResolution(v as ResolutionPresetId)}>
            <SelectTrigger className="ml-auto max-w-[170px]" aria-label="Export resolution">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(RESOLUTIONS) as ResolutionPresetId[]).map((id) => {
                const r = getResolution(id);
                return <SelectItem key={id} value={id}>{resolutionLabel(r.width, r.height)}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-h-8 items-center gap-2">
          <Label className="flex-1 text-sm text-muted-foreground">FPS</Label>
          <div className="ml-auto inline-flex overflow-hidden rounded-md border bg-muted" role="group" aria-label="Frames per second">
            {[30, 60].map((f) => (
              <Button
                key={f}
                variant={fps === f ? 'secondary' : 'ghost'}
                size="sm"
                className={cn('rounded-none', fps === f && 'shadow-[inset_0_0_0_1px_var(--ring)]')}
                aria-pressed={fps === f}
                onClick={() => st.setFps(f as 30 | 60)}
              >
                {f}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex min-h-8 items-center gap-2">
          <Label className="flex-1 text-sm text-muted-foreground">Duration</Label>
          <div className="ml-auto inline-flex overflow-hidden rounded-md border bg-muted" role="group" aria-label="Duration">
            {[5, 10].map((d) => (
              <Button
                key={d}
                variant={durationSec === d ? 'secondary' : 'ghost'}
                size="sm"
                className={cn('rounded-none', durationSec === d && 'shadow-[inset_0_0_0_1px_var(--ring)]')}
                aria-pressed={durationSec === d}
                onClick={() => st.setDuration(d as 5 | 10)}
              >
                {d}s
              </Button>
            ))}
          </div>
        </div>
        <div className="flex min-h-8 items-center gap-2">
          <Label className="flex-1 text-sm text-muted-foreground">Format</Label>
          <Select
            value={exportFormat}
            onValueChange={(v) => st.setExportFormat(v as ExportFormat)}
          >
            <SelectTrigger className="ml-auto max-w-[170px]" aria-label="Export format">
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
          <Label htmlFor="export-name" className="text-sm text-muted-foreground">Filename</Label>
          <Input
            id="export-name"
            value={exportFilename}
            maxLength={80}
            onChange={(e) => st.setExportFilename(e.target.value)}
            placeholder="videobg-export"
            aria-label="Export filename"
          />
        </div>
        {exportFormat === 'mp4' && !supportsWebCodecs() && (
          <p className="flex items-center gap-1.5 text-xs text-amber-500">
            <TriangleAlert className="size-4 shrink-0" /> MP4 needs WebCodecs — this browser will fall back to WebM.
          </p>
        )}
        {exportFormat === 'auto' && !supportsWebCodecs() && (
          <p className="flex items-center gap-1.5 text-xs text-amber-500">
            <TriangleAlert className="size-4 shrink-0" /> WebCodecs unavailable — WebM fallback (real-time, best-effort).
          </p>
        )}
        <Separator className="my-1" />
        <div className="py-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="w-full"
                disabled={exportStatus === 'working'}
                onClick={() => void startExport()}
              >
                <Download /> {exportStatus === 'working' ? 'Exporting…' : 'Start export'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Start export (E) — runs in the background</TooltipContent>
          </Tooltip>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline">{getResolution(resolutionId).width}×{getResolution(resolutionId).height}</Badge>
          <Badge variant="outline">{fps}fps</Badge>
          <Badge variant="outline">{durationSec}s</Badge>
        </div>
      </Section>
    </>
  );
}
