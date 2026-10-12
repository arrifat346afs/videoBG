// Seamless-loop math. Every frame is a pure function of
// (generator, params, seed, phase) with phase in [0, 1).
// Motion must be periodic: use sin/cos(TAU * phase * k), k integer.

export const TAU = Math.PI * 2;

/** Frame index -> loop phase in [0, 1). */
export function phaseForFrame(frame: number, totalFrames: number): number {
  if (!Number.isInteger(frame) || frame < 0) throw new Error('frame must be >= 0 int');
  if (!Number.isInteger(totalFrames) || totalFrames <= 0) {
    throw new Error('totalFrames must be > 0 int');
  }
  return (frame % totalFrames) / totalFrames;
}

/** Phase -> wall-clock seconds within one loop. */
export function timeForPhase(phase: number, durationSec: number): number {
  if (phase < 0 || phase >= 1) throw new Error('phase must be in [0, 1)');
  return phase * durationSec;
}

/** Loop-safe angle: integer k guarantees f(0) == f(1). */
export function loopAngle(phase: number, cycles = 1): number {
  if (!Number.isInteger(cycles)) throw new Error('cycles must be integer for seamless loop');
  return TAU * phase * cycles;
}

export function loopSin(phase: number, cycles = 1): number {
  return Math.sin(loopAngle(phase, cycles));
}

export function loopCos(phase: number, cycles = 1): number {
  return Math.cos(loopAngle(phase, cycles));
}

/** 2D point travelling on a circle — for sampling noise without seams. */
export function circlePoint(
  phase: number,
  cycles = 1,
  radius = 1,
): readonly [number, number] {
  const a = loopAngle(phase, cycles);
  return [Math.cos(a) * radius, Math.sin(a) * radius];
}
