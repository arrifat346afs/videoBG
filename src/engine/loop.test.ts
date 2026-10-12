import { describe, expect, it } from 'vitest';
import { circlePoint, loopAngle, loopCos, loopSin, phaseForFrame, TAU, timeForPhase } from './loop.ts';

describe('phaseForFrame', () => {
  it('maps frames to [0, 1)', () => {
    expect(phaseForFrame(0, 150)).toBe(0);
    expect(phaseForFrame(75, 150)).toBeCloseTo(0.5);
    expect(phaseForFrame(149, 150)).toBeCloseTo(149 / 150);
  });
  it('wraps frame indices', () => {
    expect(phaseForFrame(150, 150)).toBe(0);
  });
  it('rejects bad input', () => {
    expect(() => phaseForFrame(0, 0)).toThrow();
  });
});

describe('seamless loop math', () => {
  it('loopAngle is periodic with integer cycles', () => {
    for (const k of [1, 2, 3, 5]) {
      expect(loopSin(0, k)).toBeCloseTo(loopSin(1, k), 12);
      expect(loopCos(0, k)).toBeCloseTo(loopCos(1, k), 12);
    }
  });
  it('rejects non-integer cycles', () => {
    expect(() => loopAngle(0.5, 1.5)).toThrow();
  });
  it('circlePoint closes the loop', () => {
    const [x0, y0] = circlePoint(0, 2);
    const [x1, y1] = circlePoint(1, 2);
    expect(x0).toBeCloseTo(x1, 12);
    expect(y0).toBeCloseTo(y1, 12);
    expect(Math.hypot(x0, y0)).toBeCloseTo(1);
  });
  it('TAU is 2pi', () => {
    expect(TAU).toBeCloseTo(Math.PI * 2);
  });
  it('timeForPhase scales by duration', () => {
    expect(timeForPhase(0.5, 10)).toBe(5);
    expect(() => timeForPhase(1, 5)).toThrow();
  });
});
