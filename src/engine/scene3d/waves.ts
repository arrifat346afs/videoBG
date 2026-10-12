// Loop-safe deterministic wave field shared by all scene3d generators.
// height(x,z,phase) = sum a_i * sin(dot(k_i,p) + TAU*n_i*phase + phi_i)
// with integer n_i so f(phase=0) == f(phase=1). No frame-to-frame state.
import { TAU } from '../loop.ts';
import { mulberry32 } from '../rng.ts';

export interface WaveComponent {
  readonly dirX: number;
  readonly dirZ: number;
  readonly freq: number;
  readonly amp: number;
  /** Integer loop cycles. */
  readonly cycles: number;
  readonly phase: number;
}

/** Deterministic wave set from seed. Amplitudes normalized to sum ~ amplitude. */
export function buildWaves(seed: number, count: number, amplitude: number): WaveComponent[] {
  const rng = mulberry32(seed >>> 0);
  const raw: WaveComponent[] = [];
  let total = 0;
  for (let i = 0; i < count; i++) {
    const a = rng.range(0, TAU);
    raw.push({
      dirX: Math.cos(a),
      dirZ: Math.sin(a),
      freq: rng.range(0.25, 1.4) * (1 + i * 0.35),
      amp: rng.range(0.4, 1.0) / (1 + i * 0.55),
      cycles: rng.int(1, 3),
      phase: rng.range(0, TAU),
    });
    total += Math.abs(raw[i]?.amp ?? 0);
  }
  const scale = total > 0 ? amplitude / total : 0;
  return raw.map((w) => ({ ...w, amp: w.amp * scale }));
}

export function waveHeight(x: number, z: number, phase: number, waves: readonly WaveComponent[]): number {
  const p = phase - Math.floor(phase);
  let h = 0;
  for (const w of waves) {
    h += w.amp * Math.sin((w.dirX * x + w.dirZ * z) * w.freq + TAU * w.cycles * p + w.phase);
  }
  return h;
}

/** Finite-difference normal for crest/normal lighting. eps in world units. */
export function waveNormal(
  x: number,
  z: number,
  phase: number,
  waves: readonly WaveComponent[],
  eps = 0.08,
): readonly [number, number, number] {
  const hC = waveHeight(x, z, phase, waves);
  const hX = waveHeight(x + eps, z, phase, waves);
  const hZ = waveHeight(x, z + eps, phase, waves);
  const nx = (hC - hX) / eps;
  const nz = (hC - hZ) / eps;
  const inv = 1 / Math.hypot(nx, 1, nz);
  return [nx * inv, 1 * inv, nz * inv];
}

/** Crest factor 0..1 from height + up-facing normal (ridges glow). */
export function crestFactor(height: number, amplitude: number, normalY: number): number {
  const h = amplitude > 1e-6 ? height / amplitude : 0;
  const hn = Math.min(1, Math.max(0, 0.5 + h * 0.5));
  return Math.min(1, Math.max(0, hn * hn * (0.35 + 0.65 * normalY)));
}
