// Mound-based height field for the low-poly terrain generator.
// height = sum of smooth localized bumps (some elongated ridge-like, one
// taller hero) + low-amplitude floor noise. A curl term displaces vertices
// horizontally near crests (swirl + lean) so ridges can curl over.
// All motion is in sin/cos(TAU * k * phase) with integer k: f(0) == f(1).
// Pure TS (no GL): unit-testable and reused by the engine per frame.
import { TAU } from '../loop.ts';
import { mulberry32 } from '../rng.ts';

export interface Mound {
  /** Base centre (before the per-frame orbit offset). */
  readonly cx: number;
  readonly cz: number;
  /** Ellipse radii before the per-frame pulse. */
  readonly rx: number;
  readonly rz: number;
  readonly rot: number;
  readonly amp: number;
  readonly hero: boolean;
  /** Closed orbit of the centre (integer cycles). */
  readonly orbitR: number;
  readonly orbitK: number;
  readonly orbitPhase: number;
  /** Amplitude breathing (integer cycles). */
  readonly breatheAmp: number;
  readonly breatheK: number;
  readonly breathePhase: number;
  /** Radius pulse (integer cycles). */
  readonly radiusPulse: number;
  readonly radiusK: number;
  readonly radiusPhase: number;
  /** Curl direction (+1 swirl CCW, -1 CW). */
  readonly curlSign: number;
}

export interface MoundField {
  readonly mounds: readonly Mound[];
  readonly heroHeight: number;
  readonly floorAmp: number;
  readonly floorFreq: number;
  readonly floorK1: number;
  readonly floorK2: number;
}

export interface TerrainOpts {
  readonly count: number;
  readonly heroHeight: number;
  readonly radius: number;
  readonly elongation: number;
  readonly width: number;
  readonly depth: number;
}

/** Deterministic mound set from seed. First mound is always the hero. */
export function buildMounds(seed: number, o: TerrainOpts): MoundField {
  const rng = mulberry32(seed >>> 0);
  const m = Math.max(1, Math.min(4, Math.round(o.count)));
  const mounds: Mound[] = [];
  for (let i = 0; i < m; i++) {
    const hero = i === 0;
    const amp = hero ? o.heroHeight : o.heroHeight * rng.range(0.3, 0.62);
    const baseR = o.radius * (hero ? rng.range(0.85, 1.1) : rng.range(0.45, 0.8));
    const ridge = rng.next() < 0.5;
    // Random ridge elongation; the param scales how much of it applies
    // (1 = near-round, 3 = full) so wide flat swells can't happen by default.
    const base = ridge ? rng.range(1.6, 2.4) : rng.range(1.0, 1.4);
    const elong = 1 + (base - 1) * (0.1 + 0.45 * (o.elongation - 1));
    // The hero stays near the frame centre so both lit flanks stay visible;
    // secondary mounds may sit further out.
    const spreadX = hero ? 0.04 : 0.2;
    mounds.push({
      cx: rng.range(-spreadX, spreadX) * o.width,
      cz: rng.range(-0.1, 0.12) * o.depth + (hero ? 2 : 0),
      rx: baseR * elong,
      rz: baseR,
      rot: rng.range(0, Math.PI),
      amp,
      hero,
      orbitR: rng.range(0.4, 1.8),
      orbitK: rng.int(1, 2),
      orbitPhase: rng.range(0, TAU),
      breatheAmp: rng.range(0.05, 0.18),
      breatheK: rng.int(1, 2),
      breathePhase: rng.range(0, TAU),
      radiusPulse: rng.range(0.04, 0.14),
      radiusK: rng.int(1, 2),
      radiusPhase: rng.range(0, TAU),
      curlSign: rng.next() < 0.5 ? 1 : -1,
    });
  }
  return {
    mounds,
    heroHeight: Math.max(0.5, o.heroHeight),
    floorAmp: 0.16,
    floorFreq: 0.35,
    floorK1: 1,
    floorK2: 2,
  };
}

/** Directional-light direction from azimuth/elevation degrees. */
export function dirFromAzEl(azDeg: number, elDeg: number): readonly [number, number, number] {
  const az = (azDeg * Math.PI) / 180;
  const el = (elDeg * Math.PI) / 180;
  const c = Math.cos(el);
  return [Math.sin(az) * c, Math.sin(el), Math.cos(az) * c];
}

export interface TerrainDisp {
  /** Displaced position. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Raw mound height (before floor noise), for dots/edges. */
  readonly h: number;
}

/**
 * Displaced vertex + mound height at phase p in [0,1). p is wrapped, so
 * p=1 evaluates identically to p=0 (all time terms are integer cycles).
 */
export function terrainDisp(
  x: number,
  z: number,
  p: number,
  field: MoundField,
  curl: number,
): TerrainDisp {
  const ph = p - Math.floor(p);
  let h = 0;
  let dx = 0;
  let dz = 0;
  for (const md of field.mounds) {
    const cx = md.cx + md.orbitR * Math.cos(TAU * md.orbitK * ph + md.orbitPhase);
    const cz = md.cz + md.orbitR * 0.7 * Math.sin(TAU * md.orbitK * ph + md.orbitPhase);
    const amp = md.amp * (1 + md.breatheAmp * Math.sin(TAU * md.breatheK * ph + md.breathePhase));
    const rp = 1 + md.radiusPulse * Math.sin(TAU * md.radiusK * ph + md.radiusPhase);
    const rx = Math.max(0.6, md.rx * rp);
    const rz = Math.max(0.6, md.rz * rp);
    const ox = x - cx;
    const oz = z - cz;
    const cs = Math.cos(md.rot);
    const sn = Math.sin(md.rot);
    const qx = (ox * cs + oz * sn) / rx;
    const qz = (-ox * sn + oz * cs) / rz;
    const d2 = qx * qx + qz * qz;
    const bump = amp * Math.exp(-d2 * 2.2);
    h += bump;
    if (curl > 0 && bump > 1e-4) {
      // Swirl around the centre + inward lean, both proportional to height,
      // so the crest skews sideways as it rises (curled crest).
      const len = Math.sqrt(ox * ox + oz * oz) + 1e-4;
      const sw = curl * bump * 0.32 * md.curlSign;
      dx += (-oz / len) * sw;
      dz += (ox / len) * sw;
      const lean = curl * bump * bump * 0.02;
      dx += (-ox / len) * lean;
      dz += (-oz / len) * lean;
    }
  }
  // Low floor noise sampled on a time circle (integer cycles => loops).
  const f = field.floorFreq;
  const n =
    0.55 * Math.sin(x * f + TAU * field.floorK1 * ph) * Math.sin(z * f * 1.31 + 1.7) +
    0.45 * Math.sin(z * f * 0.77 + TAU * field.floorK2 * ph + 0.6) * Math.sin(x * f * 1.13 + 2.9);
  const y = h + n * field.floorAmp;
  return { x: x + dx, y, z: z + dz, h };
}

// Flat-shaded dual-light translucent face shader. Face normals come from
// screen-space derivatives (one solid colour per triangle); triangle edges
// are a barycentric wireframe in the same pass. three.js ShaderMaterial
// (GLSL1 style, auto-upgraded); output is linear HDR, tone-mapped by the
// composer's OutputPass. Additive blending => order-independent.
export const TERRAIN_VERT = /* glsl */ `
attribute vec3 aBary;
varying vec3 vBary;
varying vec3 vWorld;
varying float vViewZ;
void main() {
  vBary = aBary;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vec4 mv = viewMatrix * wp;
  vViewZ = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

export const TERRAIN_FRAG = /* glsl */ `
precision highp float;
varying vec3 vBary;
varying vec3 vWorld;
varying float vViewZ;
uniform vec3 u_lightA;
uniform vec3 u_dirA;
uniform float u_intA;
uniform vec3 u_lightB;
uniform vec3 u_dirB;
uniform float u_intB;
uniform float u_ambient;
uniform float u_wrap;
uniform float u_rim;
uniform vec3 u_rimColor;
uniform float u_alpha;
uniform float u_backface;
uniform float u_bloom;
uniform float u_hero;
uniform vec3 u_fogColor;
uniform float u_fogK;
uniform float u_edgeOpacity;
uniform float u_edgeWidth;
uniform float u_focus;
uniform float u_dof;
uniform float u_near;

void main() {
  // Screen-space face normal: one solid colour per triangle. Triangles wind
  // consistently (see the index builder), and the cross operand order yields
  // up-facing normals; the Y-force keeps overhangs deterministic too.
  vec3 N = normalize(cross(dFdy(vWorld), dFdx(vWorld)));
  if (N.y < 0.0) N = -N;
  vec3 V = normalize(cameraPosition - vWorld);
  float difA = clamp((dot(N, u_dirA) + u_wrap) / (1.0 + u_wrap), 0.0, 1.0);
  float difB = clamp((dot(N, u_dirB) + u_wrap) / (1.0 + u_wrap), 0.0, 1.0);
  vec3 col = u_lightA * (difA * u_intA) + u_lightB * (difB * u_intB);
  col += vec3(0.035, 0.04, 0.05) * u_ambient;
  // Height falloff: the flat floor recedes to near-black while raised facets
  // keep full brightness (dots carry the floor grid separately).
  float hNz = clamp(vWorld.y / max(0.5, u_hero), 0.0, 1.0);
  col *= mix(0.2, 1.0, smoothstep(0.0, 0.45, hNz));
  float fres = pow(1.0 - abs(dot(N, V)), 2.0);
  col += u_rimColor * (fres * u_rim * 0.35);
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col += col * (u_bloom * smoothstep(0.3, 0.9, luma));
  float alpha = u_alpha + fres * u_rim * 0.3;

  float dist = length(vWorld - cameraPosition);
  float f = 1.0 - exp(-pow(dist * u_fogK, 2.0));
  col = mix(col, u_fogColor, f);
  alpha *= 1.0 - f;

  // Barycentric wireframe: ~1px screen-space lines, brighter on mounds.
  // The nearest foreground fades (soft near edge) while dots stay behind.
  float near = smoothstep(u_near * 0.3, max(u_near, 0.6), dist);
  float hN = clamp(vWorld.y / max(0.5, u_hero), 0.0, 1.0);  float e = min(vBary.x, min(vBary.y, vBary.z));
  float w = (fwidth(e) + 1e-4) * u_edgeWidth;
  float line = 1.0 - smoothstep(0.0, w, e);
  col += vec3(0.65, 0.72, 0.85) * (line * u_edgeOpacity * (0.3 + 0.7 * hN) * (1.0 - f) * near);
  alpha = max(alpha, line * u_edgeOpacity * 0.5 * (1.0 - f)) * near;

  // Subtle DOF: defocused fragments dim slightly (never blur).
  float coc = clamp(abs(vViewZ - u_focus) / (u_focus * 0.6 + 2.0) * u_dof, 0.0, 1.0);
  col *= 1.0 - coc * 0.3;

  // Back faces (seen through the translucent top) render dimmer. Winding is
  // consistent, so gl_FrontFacing is coherent across the mesh.
  if (!gl_FrontFacing) {
    col *= u_backface;
    alpha *= u_backface;
  }
  gl_FragColor = vec4(col, alpha);
}
`;
