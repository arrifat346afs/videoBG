import { create } from 'zustand';
import { generatePalette } from '../engine/palettes.ts';
import { DEFAULT_POST, type PostSettings } from '../engine/post.ts';
import { getGenerator, listGenerators } from '../engine/registry.ts';
import '../engine/generators/index.ts';
import { mulberry32 } from '../engine/rng.ts';
import type { Harmony, Params, ResolutionPresetId } from '../engine/types.ts';

export interface Snapshot {
  readonly seed: number;
  readonly generatorId: string;
  readonly params: Params;
  readonly post: PostSettings;
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
  readonly exportOpen: boolean;
  readonly past: readonly Snapshot[];
  readonly future: readonly Snapshot[];
  readonly favorites: readonly Snapshot[];
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
  setExportOpen: (v: boolean) => void;
  undo: () => void;
  redo: () => void;
  toggleFavorite: () => void;
  loadSnapshot: (s: Snapshot) => void;
}

function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}

function snap(s: Pick<AppState, 'seed' | 'generatorId' | 'params' | 'post'>): Snapshot {
  return { seed: s.seed, generatorId: s.generatorId, params: { ...s.params }, post: { ...s.post } };
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

export const useAppStore = create<AppState>()((set) => ({
  ...init,
  seedLocked: false,
  post: { ...DEFAULT_POST },
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
  exportOpen: false,
  past: [],
  future: [],
  favorites: [],

  setSeed: (seed) => set({ seed: seed >>> 0 }),
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
      return {
        generatorId: id,
        params: { ...gen.defaultParams },
        panelRev: s.panelRev + 1,
        ...pushPast(s),
      };
    }),
  setParam: (key, value) => set((s) => ({ params: { ...s.params, [key]: value } })),
  setParams: (params) => set((s) => ({ params: { ...params }, panelRev: s.panelRev + 1 })),
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
      return {
        seed,
        generatorId: gen.id,
        params: gen.randomize(mulberry32(s.seedLocked ? randomSeed() : seed)),
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
      return { params: next, panelRev: s.panelRev + 1, ...pushPast(s) };
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
      return { params: next, panelRev: s.panelRev + 1, ...pushPast(s) };
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
  setExportOpen: (v) => set({ exportOpen: v }),
  undo: () =>
    set((s) => {
      const prev = s.past[s.past.length - 1];
      if (!prev) return s;
      return {
        seed: prev.seed,
        generatorId: prev.generatorId,
        params: { ...prev.params },
        post: { ...prev.post },
        past: s.past.slice(0, -1),
        future: [snap(s), ...s.future].slice(0, 50),
        panelRev: s.panelRev + 1,
      };
    }),
  redo: () =>
    set((s) => {
      const next = s.future[0];
      if (!next) return s;
      return {
        seed: next.seed,
        generatorId: next.generatorId,
        params: { ...next.params },
        post: { ...next.post },
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
    set((s) => ({
      seed: sn.seed >>> 0,
      generatorId: sn.generatorId,
      params: { ...sn.params },
      post: { ...sn.post },
      panelRev: s.panelRev + 1,
      ...pushPast(s),
    })),
}));
