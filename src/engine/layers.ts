// Pure layer-stack helpers shared by the store, renderer, share links and UI.
import { mulberry32 } from './rng.ts';
import { generatePalette } from './palettes.ts';
import { getGenerator, listGenerators } from './registry.ts';
import type { BlendMode, Layer, Params, Rng } from './types.ts';
import './generators/index.ts';

export const MAX_LAYERS = 4;

let layerSeq = 0;

export function newLayerId(): string {
  layerSeq += 1;
  return `layer-${Date.now().toString(36)}-${layerSeq}`;
}

export function makeLayer(o: Partial<Layer> & { generatorId: string }): Layer {
  const gen = getGenerator(o.generatorId);
  return {
    id: o.id ?? newLayerId(),
    generatorId: o.generatorId,
    params: o.params ?? { ...(gen?.defaultParams ?? {}) },
    seed: o.seed ?? 12345,
    opacity: o.opacity ?? 1,
    blend: o.blend ?? 'normal',
    visible: o.visible ?? true,
    solo: o.solo ?? false,
  };
}

/** Which layers actually render for a given stack (solo + visible). */
export function visibleLayers(layers: readonly Layer[]): Layer[] {
  const anySolo = layers.some((l) => l.solo);
  return layers.filter((l) => (anySolo ? l.solo : l.visible));
}

/** Migrate a legacy single-generator state into a one-entry layer stack. */
export function migrateToLayers(o: {
  layers?: readonly Layer[] | null;
  generatorId: string;
  params: Params;
  seed: number;
}): Layer[] {
  if (o.layers && o.layers.length > 0) return o.layers.map((l) => ({ ...l, params: { ...l.params } }));
  return [makeLayer({ generatorId: o.generatorId, params: { ...o.params }, seed: o.seed })];
}

/** Replace one layer's fields immutably. */
export function patchLayer(layers: readonly Layer[], id: string, patch: Partial<Layer>): Layer[] {
  return layers.map((l) => (l.id === id ? { ...l, ...patch } : l));
}

export function moveLayer(layers: readonly Layer[], id: string, dir: -1 | 1): Layer[] {
  const i = layers.findIndex((l) => l.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= layers.length) return [...layers];
  const next = [...layers];
  const tmp = next[i] as Layer;
  next[i] = next[j] as Layer;
  next[j] = tmp;
  return next;
}

/** Pick a compatible style + matching palette for mixing. */
export function compatibleMix(rng: Rng, existing: readonly Layer[]): { generatorId: string; params: Params } | null {
  const gens = listGenerators().filter((g) => (g.kind ?? 'shader2d') === 'shader2d');
  if (gens.length === 0) return null;
  const avoid = new Set(existing.map((l) => l.generatorId));
  const pool = gens.filter((g) => !avoid.has(g.id));
  const gen = (pool.length > 0 ? pool : gens)[Math.floor(rng.next() * (pool.length > 0 ? pool.length : gens.length))];
  if (!gen) return null;
  const params = gen.randomize(rng);
  // Reuse the base layer's palette colours where the style exposes color params.
  const base = existing[0];
  if (base) {
    const baseGen = getGenerator(base.generatorId);
    const pal = baseGen
      ? baseGen.paramSchema.filter((d) => d.kind === 'color').map((d) => String(base.params[d.key] ?? d.defaultValue))
      : [];
    if (pal.length >= 2) {
      let i = 0;
      for (const d of gen.paramSchema) {
        if (d.kind === 'color') params[d.key] = pal[i++ % pal.length] as Params[string];
      }
    }
  }
  return { generatorId: gen.id, params };
}

/** Random palette aligned with an existing layer (used by the Mix button). */
export function mixPalette(rng: Rng): readonly string[] {
  return generatePalette(rng, 'random').colors;
}

export function seedRng(seed: number): Rng {
  return mulberry32(seed >>> 0);
}

export type { BlendMode };
