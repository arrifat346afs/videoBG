// Mix-stack editor: up to MAX_LAYERS generators composited together. Each row
// selects/moves/blends one layer; the active layer is what the style controls
// above edit.
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Dices,
  Eye,
  EyeOff,
  Layers as LayersIcon,
  Plus,
  Trash2,
} from 'lucide-react';
import { getGenerator, listGenerators } from '../engine/registry.ts';
import { MAX_LAYERS } from '../engine/layers.ts';
import { BLEND_MODES, type BlendMode, type Layer } from '../engine/types.ts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAppStore } from './store.ts';

function IconBtn(props: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={props.label}
          aria-pressed={props.active}
          disabled={props.disabled}
          onClick={props.onClick}
          className={cn(props.active && 'bg-accent text-accent-foreground')}
        >
          {props.children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{props.label}</TooltipContent>
    </Tooltip>
  );
}

function LayerRow(props: {
  layer: Layer;
  index: number;
  top: boolean;
  bottom: boolean;
  canAdd: boolean;
  canRemove: boolean;
}) {
  const { layer, index } = props;
  const st = useAppStore.getState();
  const activeLayer = useAppStore((s) => s.activeLayer);
  const gen = getGenerator(layer.generatorId);
  const isActive = activeLayer === index;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => st.setActiveLayer(index)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') st.setActiveLayer(index);
      }}
      className={cn(
        'flex flex-col gap-1.5 rounded-lg border p-2 text-left transition-colors',
        isActive ? 'border-primary bg-accent/40' : 'border-border hover:border-muted-foreground/40',
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className="w-4 text-center font-mono text-xs text-muted-foreground">{index + 1}</span>
        <Select value={layer.generatorId} onValueChange={(v) => {
          st.setActiveLayer(index);
          st.setGenerator(v);
        }}>
          <SelectTrigger size="sm" className="min-w-0 flex-1" aria-label={`Layer ${index + 1} style`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {listGenerators().map((g) => (
              <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <IconBtn
          label={layer.visible ? 'Hide layer' : 'Show layer'}
          active={layer.visible}
          onClick={() => st.toggleLayerVisible(layer.id)}
        >
          {layer.visible ? <Eye /> : <EyeOff />}
        </IconBtn>
        <IconBtn label="Solo layer" active={layer.solo} onClick={() => st.toggleLayerSolo(layer.id)}>
          <span className="text-[10px] font-bold">S</span>
        </IconBtn>
      </div>
      <div className="flex items-center gap-2">
        <Label className="w-10 shrink-0 text-xs text-muted-foreground">Opacity</Label>
        <Slider
          value={[layer.opacity]}
          min={0}
          max={1}
          step={0.01}
          aria-label={`Layer ${index + 1} opacity`}
          className="min-w-0 flex-1"
          onValueChange={([v]) => {
            if (v !== undefined) st.setLayerOpacity(layer.id, v);
          }}
        />
        <span className="w-8 text-right font-mono text-xs text-muted-foreground">
          {Math.round(layer.opacity * 100)}%
        </span>
        <Select value={layer.blend} onValueChange={(v) => st.setLayerBlend(layer.id, v as BlendMode)}>
          <SelectTrigger size="sm" className="max-w-[104px]" aria-label={`Layer ${index + 1} blend mode`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BLEND_MODES.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-1">
        <span className="flex-1 truncate text-[11px] text-muted-foreground">
          {gen?.name ?? layer.generatorId} · seed {layer.seed >>> 0}
        </span>
        <IconBtn label="Move up" disabled={props.top} onClick={() => st.moveLayerBy(layer.id, 1)}>
          <ArrowUp />
        </IconBtn>
        <IconBtn label="Move down" disabled={props.bottom} onClick={() => st.moveLayerBy(layer.id, -1)}>
          <ArrowDown />
        </IconBtn>
        <IconBtn label="Duplicate layer" disabled={!props.canAdd} onClick={() => st.duplicateLayer(layer.id)}>
          <Copy />
        </IconBtn>
        <IconBtn label="Remove layer" disabled={!props.canRemove} onClick={() => st.removeLayer(layer.id)}>
          <Trash2 />
        </IconBtn>
      </div>
    </div>
  );
}

export function LayersPanel() {
  const layers = useAppStore((s) => s.layers);
  const st = useAppStore.getState();
  const canAdd = layers.length < MAX_LAYERS;
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="flex items-center gap-2 px-3 py-2">
        <LayersIcon className="size-[15px] text-muted-foreground" aria-hidden />
        <CardTitle className="text-sm">Layers</CardTitle>
        <span className="ml-auto text-xs text-muted-foreground">
          {layers.length}/{MAX_LAYERS}
        </span>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5 px-3 pb-3">
        <div className="flex flex-col gap-1.5">
          {layers
            .map((l, i) => ({ l, i }))
            .reverse()
            .map(({ l, i }) => (
              <LayerRow
                key={l.id}
                layer={l}
                index={i}
                top={i === layers.length - 1}
                bottom={i === 0}
                canAdd={canAdd}
                canRemove={layers.length > 1}
              />
            ))}
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" disabled={!canAdd} onClick={() => st.addLayer()}>
                <Plus /> Add layer
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add a random compatible layer</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" disabled={!canAdd} onClick={() => st.mixLayer()}>
                <Dices /> Mix
              </Button>
            </TooltipTrigger>
            <TooltipContent>Blend in a compatible style with this palette</TooltipContent>
          </Tooltip>
        </div>
      </CardContent>
    </Card>
  );
}
