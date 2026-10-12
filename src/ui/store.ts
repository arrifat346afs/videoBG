import { create } from 'zustand';
import { generatePalette } from '../engine/palettes.ts';
import { DEFAULT_POST, type PostSettings } from '../engine/post.ts';
import { getGenerator, listGenerators } from '../engine/registry.ts';
import '../engine/generators/index.ts';
import { mulberry32 } from '../engine/rng.ts';
import {
  MAX_LAYERS,
  compatibleMix,
  makeLayer,
  moveLayer,
  patchLayer,
} from '../engine/layers.ts';
import type { BlendMode, Harmony, Layer, Params, ResolutionPresetId } from '../engine/types.ts';

export interface Snapshot {
  readonly seed: number;
  readonly generatorId: string;
  readonly params: Params;
  readonly post: PostSettings;
  /** Mix stack; absent on legacy snapshots (migrated to a single layer). */
  readonly layers?: readonly Layer[];
  readonly activeLayer?: number;
}

export type ExportFormat = 'auto' | 'mp4' | 'webm';
export type ExportStatus = 'idle' | 'working' | 'done' | 'error';

export interface ExportDownload {
  readonly url: string;
  readonly name: string;
}

interface AppState {
  readonly seed: number;
  readonly seedLocked: boolean;
  readonly generatorId: string;
  readonly params: Params;
  readonly post: PostSettings;
  readonly phase: number;
  readonly playing: boolean;
  readonly durationSec: 5 | 10;
  readonly fps: 30 | 60;
  readonly resolutionId: ResolutionPresetId;
  readonly quality: number;
  readonly speed: number;
  readonly loop: boolean;
  readonly panelRev: number;
  readonly error: string | null;
  readonly contextLost: boolean;
  readonly exportStatus: ExportStatus;
  readonly exportFrame: number;
  readonly exportTotal: number;
  readonly exportFormatLabel: string;
  readonly exportError: string | null;
  readonly exportDownload: ExportDownload | null;
  readonly exportFormat: ExportFormat;
  readonly exportFilename: string;
  readonly past: readonly Snapshot[];
  readonly future: readonly Snapshot[];
  readonly favorites: readonly Snapshot[];
  /** Mix stack. layers[activeLayer] mirrors seed/generatorId/params. */
  readonly layers: readonly Layer[];
  readonly activeLayer: number;
  setSeed: (seed: number) => void;
  setSeedLocked: (v: boolean) => void;
  toggleSeedLock: () => void;
  randomizeSeed: () => void;
  setGenerator: (id: string) => void;
  setParam: (key: string, value: Params[string]) => void;
  setParams: (params: Params) => void;
  setPost: (post: Partial<PostSettings>) => void;
  resetPost: () => void;
  randomizeAll: () => void;
  randomizePaletteOnly: (harmony?: Harmony) => void;
  randomizeMotionOnly: () => void;
  setPhase: (phase: number) => void;
  setPlaying: (playing: boolean) => void;
  togglePlay: () => void;
  setDuration: (d: 5 | 10) => void;
  setFps: (f: 30 | 60) => void;
  setResolution: (id: ResolutionPresetId) => void;
  setQuality: (q: number) => void;
  setSpeed: (s: number) => void;
  setLoop: (v: boolean) => void;
  setError: (msg: string | null) => void;
  setContextLost: (v: boolean) => void;
  setExportWorking: (formatLabel: string, total: number) => void;
  setExportProgress: (frame: number, total: number) => void;
  setExportDone: (download: ExportDownload) => void;
  setExportError: (msg: string) => void;
  resetExport: () => void;
  setExportFormat: (format: ExportFormat) => void;
  setExportFilename: (name: string) => void;
  undo: () => void;
  redo: () => void;
  toggleFavorite: () => void;
  loadSnapshot: (s: Snapshot) => void;
  /* ---- layers ---- */
  setActiveLayer: (index: number) => void;
  addLayer: (generatorId?: string) => void;
  duplicateLayer: (id: string) => void;
  removeLayer: (id: string) => void;
  moveLayerBy: (id: string, dir: -1 | 1) => void;
  setLayerOpacity: (id: string, opacity: number) => void;
  setLayerBlend: (id: string, blend: BlendMode) => void;
  toggleLayerVisible: (id: string) => void;
  toggleLayerSolo: (id: string) => void;
  setLayerSeed: (id: string, seed: number) => void;
  mixLayer: () => void;
}

function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}

function snap(
  s: Pick<AppState, 'seed' | 'generatorId' | 'params' | 'post' | 'layers' | 'activeLayer'>,
): Snapshot {
  return {
    seed: s.seed,
    generatorId: s.generatorId,
    params: { ...s.params },
    post: { ...s.post },
    layers: s.layers.map((l) => ({ ...l, params: { ...l.params } })),
    activeLayer: s.activeLayer,
  };
}

/** Restore the mix stack from a snapshot, migrating legacy single-gen ones. */
function snapshotLayers(sn: Snapshot): { layers: Layer[]; activeLayer: number } {
  if (sn.layers && sn.layers.length > 0) {
    const layers = sn.layers
      .slice(0, MAX_LAYERS)
      .map((l) => ({ ...l, params: { ...l.params } }));
    const activeLayer = Math.min(Math.max(0, sn.activeLayer ?? 0), layers.length - 1);
    return { layers, activeLayer };
  }
  return {
    layers: [makeLayer({ generatorId: sn.generatorId, params: { ...sn.params }, seed: sn.seed })],
    activeLayer: 0,
  };
}

/** Sync the active layer's mirror fields after a state change. */
function syncActive(
  s: Pick<AppState, 'layers' | 'activeLayer'>,
  patch: Partial<Layer>,
): readonly Layer[] {
  const id = s.layers[s.activeLayer]?.id;
  if (!id) return s.layers;
  return patchLayer(s.layers, id, patch);
}

function pushPast(
  s: AppState,
): Pick<AppState, 'past' | 'future'> {
  return { past: [...s.past.slice(-49), snap(s)], future: [] };
}

function defaultState(): Pick<AppState, 'seed' | 'generatorId' | 'params'> {
  const gens = listGenerators();
  const first = gens[0]?.id ?? 'domain-warp';
  const gen = getGenerator(first);
  return {
    seed: 12345,
    generatorId: first,
    params: { ...(gen?.defaultParams ?? {}) },
  };
}

const init = defaultState();
const initLayers: Layer[] = [
  makeLayer({ generatorId: init.generatorId, params: { ...init.params }, seed: init.seed }),
];

export const useAppStore = create<AppState>()((set) => ({
  ...init,
  seedLocked: false,
  post: { ...DEFAULT_POST },
  layers: initLayers,
  activeLayer: 0,
  phase: 0,
  playing: true,
  durationSec: 5,
  fps: 30,
  resolutionId: '1080p',
  quality: 0.5,
  speed: 1,
  loop: true,
  panelRev: 0,
  error: null,
  contextLost: false,
  exportStatus: 'idle',
  exportFrame: 0,
  exportTotal: 0,
  exportFormatLabel: '',
  exportError: null,
  exportDownload: null,
  exportFormat: 'auto',
  exportFilename: 'videobg-export',
  past: [],
  future: [],
  favorites: [],

  setSeed: (seed) =>
    set((s) => {
      const v = seed >>> 0;
      return { seed: v, layers: syncActive(s, { seed: v }) };
    }),
  setSeedLocked: (v) => set({ seedLocked: v }),
  toggleSeedLock: () => set((s) => ({ seedLocked: !s.seedLocked })),
  randomizeSeed: () =>
    set((s) => {
      if (s.seedLocked) return s;
      return { seed: randomSeed(), panelRev: s.panelRev + 1, ...pushPast(s) };
    }),
  setGenerator: (id) =>
    set((s) => {
      const gen = getGenerator(id);
      if (!gen) return s;
      const params = { ...gen.defaultParams };
      return {
        generatorId: id,
        params,
        layers: syncActive(s, { generatorId: id, params: { ...params } }),
        panelRev: s.panelRev + 1,
        ...pushPast(s),
      };
    }),
  setParam: (key, value) =>
    set((s) => {
      const params = { ...s.params, [key]: value };
      return { params, layers: syncActive(s, { params }) };
    }),
  setParams: (params) =>
    set((s) => {
      const next = { ...params };
      return { params: next, layers: syncActive(s, { params: { ...next } }), panelRev: s.panelRev + 1 };
    }),
  setPost: (post) => set((s) => ({ post: { ...s.post, ...post } })),
  resetPost: () => set((s) => ({ post: { ...DEFAULT_POST }, panelRev: s.panelRev + 1 })),
  randomizeAll: () =>
    set((s) => {
      const gens = listGenerators();
      if (gens.length === 0) return s;
      const idx = Math.floor(Math.random() * gens.length);
      const gen = gens[idx] ?? gens[0];
      if (!gen) return s;
      // Locked seed: keep the seed value, still pick fresh params.
      const seed = s.seedLocked ? s.seed : randomSeed();
      const params = gen.randomize(mulberry32(s.seedLocked ? randomSeed() : seed));
      return {
        seed,
        generatorId: gen.id,
        params,
        layers: syncActive(s, { seed, generatorId: gen.id, params: { ...params } }),
        panelRev: s.panelRev + 1,
        ...pushPast(s),
      };
    }),
  randomizePaletteOnly: (harmony: Harmony = 'random') =>
    set((s) => {
      const gen = getGenerator(s.generatorId);
      if (!gen) return s;
      const pal = generatePalette(mulberry32(randomSeed()), harmony);
      const colors = [...pal.colors];
      const next: Params = { ...s.params };
      for (const def of gen.paramSchema) {
        if (def.kind === 'color') {
          const c = colors.shift() ?? colors[0] ?? '#ffffff';
          next[def.key] = c;
        }
      }
      return {
        params: next,
        layers: syncActive(s, { params: { ...next } }),
        panelRev: s.panelRev + 1,
        ...pushPast(s),
      };
    }),
  randomizeMotionOnly: () =>
    set((s) => {
      const gen = getGenerator(s.generatorId);
      if (!gen) return s;
      const fresh = gen.randomize(mulberry32(randomSeed()));
      const next: Params = { ...s.params };
      for (const def of gen.paramSchema) {
        if (def.kind !== 'color' && fresh[def.key] !== undefined) {
          next[def.key] = fresh[def.key] as Params[string];
        }
      }
      return {
        params: next,
        layers: syncActive(s, { params: { ...next } }),
        panelRev: s.panelRev + 1,
        ...pushPast(s),
      };
    }),
  setPhase: (phase) => set({ phase: phase - Math.floor(phase) }),
  setPlaying: (playing) => set({ playing }),
  togglePlay: () => set((s) => ({ playing: !s.playing })),
  setDuration: (d) => set({ durationSec: d }),
  setFps: (f) => set({ fps: f }),
  setResolution: (id) => set({ resolutionId: id }),
  setQuality: (q) => set({ quality: Math.min(1, Math.max(0.15, q)) }),
  setSpeed: (sp) => set({ speed: Math.min(3, Math.max(0.1, sp)) }),
  setLoop: (v) => set({ loop: v }),
  setError: (msg) => set({ error: msg }),
  setContextLost: (v) => set({ contextLost: v }),
  setExportWorking: (formatLabel, total) =>
    set({
      exportStatus: 'working',
      exportFrame: 0,
      exportTotal: total,
      exportFormatLabel: formatLabel,
      exportError: null,
      exportDownload: null,
    }),
  setExportProgress: (frame, total) => set({ exportFrame: frame, exportTotal: total }),
  setExportDone: (download) => set({ exportStatus: 'done', exportDownload: download }),
  setExportError: (msg) => set({ exportStatus: 'error', exportError: msg }),
  resetExport: () =>
    set({
      exportStatus: 'idle',
      exportFrame: 0,
      exportTotal: 0,
      exportFormatLabel: '',
      exportError: null,
      exportDownload: null,
    }),
  setExportFormat: (format) => set({ exportFormat: format }),
  setExportFilename: (name) => set({ exportFilename: name }),
  undo: () =>
    set((s) => {
      const prev = s.past[s.past.length - 1];
      if (!prev) return s;
      const { layers, activeLayer } = snapshotLayers(prev);
      return {
        seed: prev.seed,
        generatorId: prev.generatorId,
        params: { ...prev.params },
        post: { ...prev.post },
        layers,
        activeLayer,
        past: s.past.slice(0, -1),
        future: [snap(s), ...s.future].slice(0, 50),
        panelRev: s.panelRev + 1,
      };
    }),
  redo: () =>
    set((s) => {
      const next = s.future[0];
      if (!next) return s;
      const { layers, activeLayer } = snapshotLayers(next);
      return {
        seed: next.seed,
        generatorId: next.generatorId,
        params: { ...next.params },
        post: { ...next.post },
        layers,
        activeLayer,
        past: [...s.past, snap(s)].slice(-50),
        future: s.future.slice(1),
        panelRev: s.panelRev + 1,
      };
    }),
  toggleFavorite: () =>
    set((s) => {
      const cur = snap(s);
      const exists = s.favorites.some(
        (f) => f.seed === cur.seed && f.generatorId === cur.generatorId,
      );
      return {
        favorites: exists
          ? s.favorites.filter((f) => !(f.seed === cur.seed && f.generatorId === cur.generatorId))
          : [...s.favorites, cur].slice(-30),
      };
    }),
  loadSnapshot: (sn) =>
    set((s) => {
      const { layers, activeLayer } = snapshotLayers(sn);
      return {
        seed: sn.seed >>> 0,
        generatorId: sn.generatorId,
        params: { ...sn.params },
        post: { ...sn.post },
        layers,
        activeLayer,
        panelRev: s.panelRev + 1,
        ...pushPast(s),
      };
    }),

  /* ---- layers ---- */
  setActiveLayer: (index) =>
    set((s) => {
      const i = Math.min(Math.max(0, index), s.layers.length - 1);
      const l = s.layers[i];
      if (!l) return s;
      return {
        activeLayer: i,
        seed: l.seed,
        generatorId: l.generatorId,
        params: { ...l.params },
        panelRev: s.panelRev + 1,
      };
    }),
  addLayer: (generatorId) =>
    set((s) => {
      if (s.layers.length >= MAX_LAYERS) return s;
      const gen = getGenerator(generatorId ?? '') ?? listGenerators()[0];
      if (!gen) return s;
      const layer = makeLayer({
        generatorId: gen.id,
        params: gen.randomize(mulberry32(randomSeed())),
        seed: randomSeed(),
      });
      return {
        layers: [...s.layers, layer],
        activeLayer: s.layers.length,
        seed: layer.seed,
        generatorId: layer.generatorId,
        params: { ...layer.params },
        panelRev: s.panelRev + 1,
        ...pushPast(s),
      };
    }),
  duplicateLayer: (id) =>
    set((s) => {
      if (s.layers.length >= MAX_LAYERS) return s;
      const src = s.layers.find((l) => l.id === id);
      if (!src) return s;
      const copy = makeLayer({ ...src, id: undefined, params: { ...src.params }, seed: randomSeed() });
      const i = s.layers.findIndex((l) => l.id === id);
      const layers = [...s.layers.slice(0, i + 1), copy, ...s.layers.slice(i + 1)];
      return { layers, activeLayer: i + 1, panelRev: s.panelRev + 1, ...pushPast(s) };
    }),
  removeLayer: (id) =>
    set((s) => {
      if (s.layers.length <= 1) return s;
      const i = s.layers.findIndex((l) => l.id === id);
      if (i < 0) return s;
      const layers = s.layers.filter((l) => l.id !== id);
      const activeLayer = Math.min(s.activeLayer > i ? s.activeLayer - 1 : s.activeLayer, layers.length - 1);
      const l = layers[activeLayer];
      if (!l) return s;
      return {
        layers,
        activeLayer,
        seed: l.seed,
        generatorId: l.generatorId,
        params: { ...l.params },
        panelRev: s.panelRev + 1,
        ...pushPast(s),
      };
    }),
  moveLayerBy: (id, dir) =>
    set((s) => {
      const i = s.layers.findIndex((l) => l.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= s.layers.length) return s;
      return { layers: moveLayer(s.layers, id, dir), activeLayer: j, panelRev: s.panelRev + 1 };
    }),
  setLayerOpacity: (id, opacity) =>
    set((s) => ({ layers: patchLayer(s.layers, id, { opacity: Math.min(1, Math.max(0, opacity)) }) })),
  setLayerBlend: (id, blend) => set((s) => ({ layers: patchLayer(s.layers, id, { blend }) })),
  toggleLayerVisible: (id) =>
    set((s) => {
      const l = s.layers.find((x) => x.id === id);
      if (!l) return s;
      return { layers: patchLayer(s.layers, id, { visible: !l.visible }) };
    }),
  toggleLayerSolo: (id) =>
    set((s) => {
      const l = s.layers.find((x) => x.id === id);
      if (!l) return s;
      return { layers: patchLayer(s.layers, id, { solo: !l.solo }) };
    }),
  setLayerSeed: (id, seed) =>
    set((s) => {
      const v = seed >>> 0;
      const layers = patchLayer(s.layers, id, { seed: v });
      const activeId = s.layers[s.activeLayer]?.id;
      return id === activeId ? { layers, seed: v } : { layers };
    }),
  mixLayer: () =>
    set((s) => {
      if (s.layers.length >= MAX_LAYERS) return s;
      const mix = compatibleMix(mulberry32(randomSeed()), s.layers);
      if (!mix) return s;
      const layer = makeLayer({ generatorId: mix.generatorId, params: mix.params, seed: randomSeed() });
      return {
        layers: [...s.layers, layer],
        activeLayer: s.layers.length,
        seed: layer.seed,
        generatorId: layer.generatorId,
        params: { ...layer.params },
        panelRev: s.panelRev + 1,
        ...pushPast(s),
      };
    }),
}));
