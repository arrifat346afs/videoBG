// Pure frustum-coverage math for scene3d surfaces.
//
// The wave surface is a finite axis-aligned grid on the y=0 plane. To make the
// grid edge invisible we must size it so the camera frustum, swept over the
// loop-safe camera drift orbit, always lands inside the grid. This module is a
// deterministic function of (fov, aspect, camHeight, pitch, distance, drift) —
// no three.js, no renderer state — so it is cheap to unit test.
//
// Camera model mirrors WaveEngine: the camera sits at
//   x = drift*cos, y = camHeight, z = distance + 0.6*drift*sin
// and looks toward a point just below/behind the origin. We approximate the
// view-axis depression from that, then intersect the four frustum corner rays
// with the ground plane.

export interface FrustumInput {
  readonly fovDeg: number;
  readonly aspect: number;
  readonly camHeight: number;
  readonly pitchDeg: number;
  readonly distance: number;
  readonly drift: number;
}

export interface FrustumExtent {
  /** Half width along X that the visible frustum footprint spans (world units). */
  readonly halfWidth: number;
  /** Half depth along Z that the visible frustum footprint spans (world units). */
  readonly halfDepth: number;
  /** Distance from camera to the nearest visible ground point. */
  readonly nearDist: number;
  /** Distance from camera to the farthest visible ground point (capped). */
  readonly farDist: number;
}

export interface FrustumCoverage extends FrustumExtent {
  readonly width: number;
  readonly depth: number;
}

/** Safety margin multiplier so the edge is always comfortably off-screen. */
export const COVERAGE_MARGIN = 1.4;
/** Fog hides everything past this depth; cap far distance here. */
export const MAX_FAR_DIST = 180;
const MIN_HALF = 18;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Raw (un-margined) footprint of the camera frustum on the ground plane. */
export function frustumVisibleExtent(inp: FrustumInput): FrustumExtent {
  const aspect = Math.max(0.1, inp.aspect);
  const halfV = ((clamp(inp.fovDeg, 5, 120) * Math.PI) / 180) / 2;
  const halfH = Math.atan(Math.tan(halfV) * aspect);
  const camH = Math.max(1, inp.camHeight);
  const dist = Math.max(1, inp.distance);
  const drift = Math.max(0, inp.drift);

  // Depression angle of the view axis below horizontal (below = positive).
  const downAngle = Math.atan2(camH + 0.6 * inp.pitchDeg, dist + 4);
  const phiNear = downAngle + halfV; // bottom frame edge (steepest down)
  const phiFar = downAngle - halfV; // top frame edge (shallowest down)

  const nearDist = camH / Math.max(0.05, Math.tan(phiNear));
  const farDist = phiFar <= 0.02 ? MAX_FAR_DIST : Math.min(MAX_FAR_DIST, camH / Math.max(0.05, Math.tan(phiFar)));

  const dz = drift * 0.6;
  const camZLo = dist - dz;
  const camZHi = dist + dz;
  // Grid is centred at the origin; the camera is at +z looking toward -z.
  let halfDepth = 0;
  for (const cz of [camZLo, camZHi]) {
    halfDepth = Math.max(halfDepth, Math.abs(cz - farDist), Math.abs(cz - nearDist));
  }

  const tanH = Math.tan(halfH);
  const wFar = farDist * tanH;
  const wNear = nearDist * tanH;
  const lateral = Math.max(wFar, wNear);
  let halfWidth = 0;
  for (const cx of [-drift, drift, 0]) {
    halfWidth = Math.max(halfWidth, Math.abs(cx) + lateral);
  }

  return {
    halfWidth: Math.max(MIN_HALF, halfWidth),
    halfDepth: Math.max(MIN_HALF, halfDepth),
    nearDist,
    farDist,
  };
}

/** Frustum footprint with a safety margin — use this to size the surface. */
export function frustumCoverage(inp: FrustumInput): FrustumCoverage {
  const e = frustumVisibleExtent(inp);
  const halfWidth = e.halfWidth * COVERAGE_MARGIN;
  const halfDepth = e.halfDepth * COVERAGE_MARGIN;
  return { ...e, halfWidth, halfDepth, width: halfWidth * 2, depth: halfDepth * 2 };
}
