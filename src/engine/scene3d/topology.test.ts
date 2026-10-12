import { describe, expect, it } from 'vitest';
import { buildGrid, buildHex, buildKnnEdges, buildVolumePoints } from './topology.ts';

describe('scene3d topology', () => {
  it('grid has expected verts/edges/tris', () => {
    const g = buildGrid(4, 3, 10, 8);
    expect(g.positions.length).toBe(4 * 3 * 3);
    // horizontal (3*3) + vertical (4*2) edges * 2 indices
    expect(g.edges.length).toBe((3 * 3 + 4 * 2) * 2);
    expect(g.indices.length).toBe(3 * 2 * 2 * 3);
  });
  it('hex lattice is bounded and edged', () => {
    const h = buildHex(6, 5, 12, 9);
    expect(h.count).toBe(30);
    expect(h.edges.length % 2).toBe(0);
    expect(h.edges.length).toBeGreaterThan(0);
    for (let i = 0; i < h.positions.length; i += 3) {
      expect(Math.abs(h.positions[i] ?? 0)).toBeLessThanOrEqual(6.5);
    }
  });
  it('volume points are deterministic and clustered in bounds', () => {
    const a = buildVolumePoints(42, 50, 20, 10, 12);
    const b = buildVolumePoints(42, 50, 20, 10, 12);
    expect(a).toEqual(b);
    expect(a.length).toBe(150);
  });
  it('knn edges are stable, bounded, and under maxDist', () => {
    const pts = buildVolumePoints(7, 40, 20, 10, 12);
    const e1 = buildKnnEdges(pts, 3, 6);
    const e2 = buildKnnEdges(pts, 3, 6);
    expect(e1).toEqual(e2);
    for (let i = 0; i < e1.length; i += 2) {
      const a = (e1[i] ?? 0) * 3;
      const b = (e1[i + 1] ?? 0) * 3;
      const dx = (pts[a] ?? 0) - (pts[b] ?? 0);
      const dy = (pts[a + 1] ?? 0) - (pts[b + 1] ?? 0);
      const dz = (pts[a + 2] ?? 0) - (pts[b + 2] ?? 0);
      expect(Math.hypot(dx, dy, dz)).toBeLessThanOrEqual(6.001);
    }
  });
});
