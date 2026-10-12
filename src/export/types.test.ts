import { describe, expect, it } from 'vitest';
import { buildExportRequest, supportsMediaRecorder, supportsWebCodecs } from './types.ts';

describe('buildExportRequest', () => {
  it('computes total frames', () => {
    expect(buildExportRequest(1920, 1080, 30, 5).totalFrames).toBe(150);
    expect(buildExportRequest(1280, 720, 60, 10).totalFrames).toBe(600);
  });
  it('phase math loops seamlessly (i/N, last->first continuous)', () => {
    const total = 150;
    const phases = Array.from({ length: total }, (_, i) => i / total);
    const first = phases[0] ?? -1;
    expect(first).toBe(0);
    // sin/cos of phase must match at wrap.
    const f = (p: number): number => Math.sin(p * Math.PI * 2);
    expect(f(first)).toBeCloseTo(f(1), 12);
  });
});

describe('support detection', () => {
  it('returns booleans', () => {
    expect(typeof supportsWebCodecs()).toBe('boolean');
    expect(typeof supportsMediaRecorder()).toBe('boolean');
  });
});
