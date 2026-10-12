// Static topology builders + stable kNN edges (spatial hash, not O(n^2)).
// Topology is built once from (seed, params); per-frame motion never
// changes membership — edges only fade by current length (no popping).
import { mulberry32 } from '../rng.ts';

export interface GridTopology {
  /** Base XZ positions, y=0. length = nx*nz*3. */
  readonly positions: Float32Array;
  readonly nx: number;
  readonly nz: number;
  readonly width: number;
  readonly depth: number;
  /** Quad edges as index pairs for wireframe. */
  readonly edges: Uint32Array;
  /** Triangle indices for face shading. */
  readonly indices: Uint32Array;
}

export function buildGrid(nx: number, nz: number, width: number, depth: number): GridTopology {
  const positions = new Float32Array(nx * nz * 3);
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const i = iz * nx + ix;
      positions[i * 3] = (ix / Math.max(1, nx - 1) - 0.5) * width;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = (iz / Math.max(1, nz - 1) - 0.5) * depth;
    }
  }
  const edges: number[] = [];
  const indices: number[] = [];
  const at = (ix: number, iz: number): number => iz * nx + ix;
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      if (ix + 1 < nx) edges.push(at(ix, iz), at(ix + 1, iz));
      if (iz + 1 < nz) edges.push(at(ix, iz), at(ix, iz + 1));
      if (ix + 1 < nx && iz + 1 < nz) {
        const a = at(ix, iz);
        const b = at(ix + 1, iz);
        const c = at(ix, iz + 1);
        const d = at(ix + 1, iz + 1);
        indices.push(a, c, b, b, c, d);
      }
    }
  }
  return { positions, nx, nz, width, depth, edges: new Uint32Array(edges), indices: new Uint32Array(indices) };
}

export interface HexTopology {
  readonly positions: Float32Array;
  readonly count: number;
  readonly edges: Uint32Array;
}

/** Pointy-top hex lattice clipped to width*depth, edges to E/SE/SW neighbors. */
export function buildHex(cols: number, rows: number, width: number, depth: number): HexTopology {
  const dx = width / Math.max(1, cols);
  const dz = depth / Math.max(1, rows);
  const pts: number[] = [];
  const keyOf = (c: number, r: number): number => r * cols + c;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = (c + 0.5 * (r & 1) - cols / 2) * dx * 0.98;
      const z = (r - rows / 2) * dz * 0.9;
      pts.push(x, 0, z);
    }
  }
  const edges: number[] = [];
  const has = (c: number, r: number): boolean => c >= 0 && c < cols && r >= 0 && r < rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = keyOf(c, r);
      const even = (r & 1) === 0;
      const neighbors: ReadonlyArray<readonly [number, number]> = even
        ? [[c + 1, r], [c, r + 1], [c - 1, r + 1]]
        : [[c + 1, r], [c + 1, r + 1], [c, r + 1]];
      for (const [nc, nr] of neighbors) {
        if (has(nc, nr)) edges.push(a, keyOf(nc, nr));
      }
    }
  }
  return { positions: new Float32Array(pts), count: cols * rows, edges: new Uint32Array(edges) };
}

/** Clustered 3D volume points (gaussian blobs, not uniform) for plexus. */
export function buildVolumePoints(seed: number, count: number, w: number, h: number, d: number): Float32Array {
  const rng = mulberry32(seed >>> 0);
  const blobs: Array<readonly [number, number, number, number]> = [];
  const nBlobs = 3 + Math.floor(rng.next() * 3);
  for (let i = 0; i < nBlobs; i++) {
    blobs.push([
      rng.range(-w / 3, w / 3),
      rng.range(-h / 3, h / 3),
      rng.range(-d / 3, d / 3),
      rng.range(0.25, 0.6),
    ]);
  }
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const b = blobs[Math.floor(rng.next() * blobs.length)] ?? [0, 0, 0, 0.5];
    const gauss = (): number => (rng.next() + rng.next() + rng.next() - 1.5) * 0.66;
    out[i * 3] = clamp(b[0] + gauss() * w * b[3], -w / 2, w / 2);
    out[i * 3 + 1] = clamp(b[1] + gauss() * h * b[3], -h / 2, h / 2);
    out[i * 3 + 2] = clamp(b[2] + gauss() * d * b[3], -d / 2, d / 2);
  }
  return out;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Stable k-nearest edges under maxDist using a spatial hash grid.
 * Returns index pairs; callers fade alpha by current length per frame.
 */
export function buildKnnEdges(points: Float32Array, k: number, maxDist: number): Uint32Array {
  const n = Math.floor(points.length / 3);
  if (n === 0) return new Uint32Array(0);
  const cell = Math.max(1e-3, maxDist);
  const grid = new Map<string, number[]>();
  const key = (x: number, y: number, z: number): string =>
    `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  for (let i = 0; i < n; i++) {
    const kk = key(points[i * 3] ?? 0, points[i * 3 + 1] ?? 0, points[i * 3 + 2] ?? 0);
    const arr = grid.get(kk);
    if (arr) arr.push(i);
    else grid.set(kk, [i]);
  }
  const edges: number[] = [];
  const maxD2 = maxDist * maxDist;
  for (let i = 0; i < n; i++) {
    const xi = points[i * 3] ?? 0;
    const yi = points[i * 3 + 1] ?? 0;
    const zi = points[i * 3 + 2] ?? 0;
    const cx = Math.floor(xi / cell);
    const cy = Math.floor(yi / cell);
    const cz = Math.floor(zi / cell);
    const cands: Array<{ j: number; d2: number }> = [];
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        for (let oz = -1; oz <= 1; oz++) {
          const arr = grid.get(`${cx + ox},${cy + oy},${cz + oz}`);
          if (!arr) continue;
          for (const j of arr) {
            if (j <= i) continue;
            const dx = (points[j * 3] ?? 0) - xi;
            const dy = (points[j * 3 + 1] ?? 0) - yi;
            const dz = (points[j * 3 + 2] ?? 0) - zi;
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 <= maxD2 && d2 > 1e-9) cands.push({ j, d2 });
          }
        }
      }
    }
    cands.sort((a, b) => a.d2 - b.d2);
    for (let t = 0; t < Math.min(k, cands.length); t++) {
      const c = cands[t];
      if (c) edges.push(i, c.j);
    }
  }
  return new Uint32Array(edges);
}
