// Scene3D family (g): Low-Poly Terrain (Dual-Light) — flat-shaded translucent
// mound terrain on a dotted grid floor, lit by two coloured lights (red from
// one side, cyan from the other) on near-black. Faces are shaded per-triangle
// on the GPU; dots reuse the shared instanced quads.
import { generatePalette } from '../palettes.ts';
import type { Generator, Params, Rng } from '../types.ts';
import { WaveEngine } from './WaveEngine.ts';
import { cameraParams, depthParams, dualLightParams, terrainMeshParams, terrainParams } from './params.ts';

/** Curated complementary light duos (A, B) in sRGB hex. */
const LIGHT_DUOS = [
  ['#ff2b4e', '#27e6ff'],
  ['#ff2bd9', '#22e6ff'],
  ['#ff7a1a', '#1fd6c1'],
  ['#3dff7a', '#a855f7'],
  ['#ffc53d', '#3d7bff'],
  ['#f2f5ff', '#5b8cff'],
] as const;

const SCHEMA = [
  ...cameraParams({ fov: 42, height: 5, pitch: 2, distance: 30, drift: 1.0, roll: 0 }),
  ...terrainParams({ hero: 5.0 }),
  ...dualLightParams({}),
  ...terrainMeshParams({}),
  ...depthParams({ focus: 30, dof: 0.4, fog: 0.016, horizon: 0.8, near: 5 }),
  { kind: 'color', key: 'dark', label: 'Background', defaultValue: '#010307' },
] as const;

function defaults(): Params {
  const o: Params = {};
  for (const d of SCHEMA) o[d.key] = d.defaultValue;
  return o;
}

function rnd(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Palette pairs must be vivid enough to light the scene (no muddy frames). */
function rgb(hexStr: string): readonly [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hexStr.trim());
  if (!m?.[1]) return null;
  const n = m[1] as string;
  return [parseInt(n.slice(0, 2), 16) / 255, parseInt(n.slice(2, 4), 16) / 255, parseInt(n.slice(4, 6), 16) / 255];
}

function lumaOf(c: readonly [number, number, number]): number {
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** sRGB channel -> linear (mirrors scene3d/color.ts for the gate below). */
function toLinear(v: number): number {
  const c = Math.min(1, Math.max(0, v));
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function vivid(hexStr: string): boolean {
  const c = rgb(hexStr);
  if (!c) return false;
  // Judge in LINEAR working space: dark sRGB greys collapse to almost no
  // light energy even when their sRGB "saturation" looks high.
  const lin = [toLinear(c[0]), toLinear(c[1]), toLinear(c[2])] as const;
  const mx = Math.max(lin[0], lin[1], lin[2]);
  const mn = Math.min(lin[0], lin[1], lin[2]);
  return lumaOf(lin) >= 0.1 && mx - mn >= 0.15;
}

export const lowpolyTerrain: Generator = {
  id: 'lowpoly-terrain',
  name: 'Low-Poly Terrain',
  kind: 'scene3d',
  category: 'Network',
  paramSchema: [...SCHEMA],
  defaultParams: defaults(),
  createScene3D: (canvas) => new WaveEngine(canvas, { topology: 'terrain', faceShading: false }),
  randomize(rng: Rng): Params {
    // Complementary lights: curated duos, occasionally a palette pair that
    // passes the vividness gate (dark/muddy pairs fall back to a duo).
    let a = '#ff2b4e';
    let b = '#27e6ff';
    if (rng.next() < 0.3) {
      const pal = generatePalette(rng, 'complementary');
      const pa = pal.colors[1] ?? '';
      const pb = pal.colors[2] ?? '';
      const ca = rgb(pa);
      const cb = rgb(pb);
      // Both vivid, balanced energy, and at least one genuinely bright.
      const la = ca ? lumaOf([toLinear(ca[0]), toLinear(ca[1]), toLinear(ca[2])] as const) : 0;
      const lb = cb ? lumaOf([toLinear(cb[0]), toLinear(cb[1]), toLinear(cb[2])] as const) : 0;
      const ratio = la > 1e-4 && lb > 1e-4 ? Math.min(la, lb) / Math.max(la, lb) : 0;
      if (pa && pb && vivid(pa) && vivid(pb) && ratio >= 0.4 && Math.max(la, lb) >= 0.2) {
        a = pa;
        b = pb;
      } else {
        const duo = rng.pick([...LIGHT_DUOS]);
        a = duo?.[0] ?? a;
        b = duo?.[1] ?? b;
      }
    } else {
      const duo = rng.pick([...LIGHT_DUOS]);
      a = duo?.[0] ?? a;
      b = duo?.[1] ?? b;
    }
    // Static quality guard: bound the total light energy so blacks stay near
    // 0 and highlights can't clip (verified on the contact sheet). A lone
    // mound gets a size boost so the frame can't come out mostly empty.
    let intA = rnd(rng.range(0.8, 1.4));
    let intB = rnd(rng.range(0.8, 1.4));
    const total = intA + intB;
    if (total > 2.6) {
      intA = rnd((intA / total) * 2.6);
      intB = rnd((intB / total) * 2.6);
    }
    const moundCount = rng.int(1, 3);
    let heroHeight = rnd(rng.range(3.5, 6));
    let moundRadius = rnd(rng.range(5, 9));
    if (moundCount === 1) {
      heroHeight = rnd(Math.min(8, heroHeight * 1.2));
      moundRadius = rnd(moundRadius + 1.5);
    }
    return {
      ...defaults(),
      fov: rng.int(35, 48),
      camHeight: rnd(rng.range(4.2, 7)),
      pitch: rnd(rng.range(0, 3)),
      distance: rnd(rng.range(30, 38)),
      drift: rnd(rng.range(0.5, 1.5)),
      moundCount,
      heroHeight,
      moundRadius,
      elongation: rnd(rng.range(1.2, 2.4)),
      curl: rnd(rng.range(0.3, 0.9)),
      floorNoise: rnd(rng.range(0.1, 0.45)),
      flow: rng.int(1, 2),
      jitter: rnd(rng.range(0.03, 0.12)),
      flip: rnd(rng.range(0.3, 0.8)),
      density: rng.int(120, 180),
      lightA: a,
      lightB: b,
      azA: rng.int(-85, -55),
      elA: rng.int(12, 26),
      intA,
      azB: rng.int(55, 85),
      elB: rng.int(12, 26),
      intB,
      ambient: rnd(rng.range(0.01, 0.05)),
      faceAlpha: rnd(rng.range(0.35, 0.6)),
      dof: rnd(rng.range(0.15, 0.6)),
      focus: rng.int(26, 34),
      bloom: rnd(rng.range(0.3, 0.8)),
      dark: '#010307',
    };
  },
};
