import { describe, expect, it } from 'vitest';
import { buildGrid, buildHex } from './topology.ts';
import { frustumCoverage, frustumVisibleExtent, COVERAGE_MARGIN } from './frustum.ts';

const BASE = { fovDeg: 50, camHeight: 10, pitchDeg: 2, distance: 30, drift: 1.5 };
const ASPECTS = [16 / 9, 21 / 9, 9 / 16, 4 / 3];

describe('frustum coverage', () => {
  it('recommended size always exceeds the visible extent', () => {
    for (const aspect of ASPECTS) {
      const vis = frustumVisibleExtent({ ...BASE, aspect });
      const cov = frustumCoverage({ ...BASE, aspect });
      expect(cov.halfWidth).toBeGreaterThanOrEqual(vis.halfWidth * COVERAGE_MARGIN - 1e-6);
      expect(cov.halfDepth).toBeGreaterThanOrEqual(vis.halfDepth * COVERAGE_MARGIN - 1e-6);
    }
  });

  it('grid half-extent covers the visible frustum extent at several aspects', () => {
    for (const aspect of ASPECTS) {
      const vis = frustumVisibleExtent({ ...BASE, aspect });
      const cov = frustumCoverage({ ...BASE, aspect });
      const g = buildGrid(60, 60, cov.width, cov.depth);
      expect(g.width / 2).toBeGreaterThanOrEqual(vis.halfWidth);
      expect(g.depth / 2).toBeGreaterThanOrEqual(vis.halfDepth);
      // Built grid really spans the recommended extents.
      let maxX = 0;
      let maxZ = 0;
      for (let i = 0; i < g.positions.length; i += 3) {
        maxX = Math.max(maxX, Math.abs(g.positions[i] ?? 0));
        maxZ = Math.max(maxZ, Math.abs(g.positions[i + 2] ?? 0));
      }
      expect(maxX).toBeCloseTo(cov.halfWidth, 4);
      expect(maxZ).toBeCloseTo(cov.halfDepth, 4);
    }
  });

  it('is aspect-aware: a portrait frame needs more depth than a wide one', () => {
    const wide = frustumCoverage({ ...BASE, aspect: 21 / 9 });
    const tall = frustumCoverage({ ...BASE, aspect: 9 / 16 });
    // Wider aspect -> wider footprint; taller aspect -> deeper footprint.
    expect(wide.halfWidth).toBeGreaterThan(tall.halfWidth);
    expect(tall.halfDepth).toBeGreaterThanOrEqual(wide.halfDepth);
  });

  it('hex lattice also spans the recommended extents', () => {
    const cov = frustumCoverage({ ...BASE, aspect: 16 / 9 });
    const h = buildHex(80, 80, cov.width, cov.depth);
    let maxZ = 0;
    for (let i = 0; i < h.positions.length; i += 3) maxZ = Math.max(maxZ, Math.abs(h.positions[i + 2] ?? 0));
    expect(maxZ).toBeGreaterThan(cov.halfDepth * 0.8);
  });

  it('far distance is capped so fog fully hides it', () => {
    const cov = frustumCoverage({ ...BASE, aspect: 9 / 16, pitchDeg: 18 });
    expect(cov.farDist).toBeLessThanOrEqual(180);
  });
});
