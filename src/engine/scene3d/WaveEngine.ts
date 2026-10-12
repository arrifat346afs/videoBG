// Three.js scene engine shared by all scene3d (Network/Wave) generators.
// Pure function of (seed, params, phase): topology built once per cache key,
// per-frame CPU update of positions/colors (no topology rebuild), perspective
// camera on a loop-safe drift orbit, instanced billboard points (shape SDFs),
// thick screen-space lines (Line2), optional face shading, post composer.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { TAU } from '../loop.ts';
import { mulberry32 } from '../rng.ts';
import type { Params, Scene3DFrameState, Scene3DHandle } from '../types.ts';
import { hexToLinear } from './color.ts';
import { frustumCoverage } from './frustum.ts';
import { bool, num, str } from './params.ts';
import { PointsQuads, shapeId } from './pointsQuad.ts';
import { Scene3DPostShader } from './postPass.ts';
import { buildGrid, buildHex, buildKnnEdges, buildVolumePoints } from './topology.ts';
import { buildWaves, crestFactor, waveHeight, type WaveComponent } from './waves.ts';

export type TopologyKind = 'grid' | 'hex' | 'tri' | 'plexus';

export interface EngineOptions {
  readonly topology: TopologyKind;
  readonly faceShading: boolean;
}

interface Cache {
  readonly key: string;
  readonly kind: TopologyKind;
  readonly count: number;
  readonly base: Float32Array;
  readonly edges: Uint32Array;
  readonly nodeShape: Float32Array;
  readonly nodeSizeT: Float32Array;
  readonly nodePhase: Float32Array;
  readonly orbitR: Float32Array;
  readonly orbitK: Float32Array;
  readonly waves: WaveComponent[];
  readonly nx: number;
  readonly nz: number;
  readonly width: number;
  readonly depth: number;
  readonly amplitude: number;
  readonly edgeFade: number;
}

function fract(v: number): number {
  return v - Math.floor(v);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

function hex(rgb: string): readonly [number, number, number] {
  return hexToLinear(rgb);
}

// Dark vertical gradient backdrop (near-black top -> deep tint at horizon),
// parented to the camera so it always fills the view and bakes into export.
const BG_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const BG_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec3 u_top;
uniform vec3 u_horizon;
void main() {
  vec3 col = mix(u_horizon, u_top, smoothstep(0.28, 1.0, vUv.y));
  col *= 1.0 - 0.22 * smoothstep(0.28, 0.0, vUv.y);
  gl_FragColor = vec4(col, 1.0);
}
`;

export class WaveEngine implements Scene3DHandle {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private composer: EffectComposer;
  private post: ShaderPass;
  private points: PointsQuads;
  private bgMesh: THREE.Mesh;
  private bgMat: THREE.ShaderMaterial;
  private lines: LineSegments2 | null = null;
  private lineGeo: LineSegmentsGeometry | null = null;
  private lineMat: LineMaterial | null = null;
  private mesh: THREE.Mesh | null = null;
  private meshGeo: THREE.BufferGeometry | null = null;
  private opts: EngineOptions;
  private cache: Cache | null = null;
  private W = 2;
  private H = 2;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, opts: EngineOptions) {
    this.opts = opts;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.5, 400);
    this.scene.add(this.camera);
    this.bgMat = new THREE.ShaderMaterial({
      vertexShader: BG_VERT,
      fragmentShader: BG_FRAG,
      uniforms: {
        u_top: { value: new THREE.Color(0, 0, 0) },
        u_horizon: { value: new THREE.Color(0, 0, 0) },
      },
      depthWrite: false,
      depthTest: false,
    });
    this.bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(240, 130), this.bgMat);
    this.bgMesh.position.set(0, 0, -60);
    this.bgMesh.renderOrder = -10;
    this.bgMesh.frustumCulled = false;
    this.camera.add(this.bgMesh);
    const rt = new THREE.WebGLRenderTarget(2, 2, { samples: 4, type: THREE.HalfFloatType });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.post = new ShaderPass(Scene3DPostShader as never);
    this.composer.addPass(this.post);
    this.composer.addPass(new OutputPass());
    // Over-allocate once; per-frame we only set instanceCount.
    this.points = new PointsQuads(90000);
    this.scene.add(this.points.mesh);
  }

  render(state: Scene3DFrameState): void {
    if (this.disposed) return;
    const { phase, params, seed, post, width, height } = state;
    if (width !== this.W || height !== this.H) this.resize(width, height);
    this.ensureCache(seed, params);
    const c = this.cache;
    if (!c) return;

    const p = fract(phase);
    // Camera rig (loop-safe drift orbit).
    const fov = num(params, 'fov', 50);
    const camH = num(params, 'camHeight', 10);
    const pitch = num(params, 'pitch', 2);
    const dist = num(params, 'distance', 30);
    const drift = num(params, 'drift', 1.5);
    const roll = num(params, 'roll', 0);
    this.camera.fov = fov;
    this.camera.aspect = this.W / this.H;
    const dx = drift * Math.cos(TAU * p);
    const dzc = drift * 0.6 * Math.sin(TAU * p);
    this.camera.position.set(dx, camH, dist + dzc);
    this.camera.lookAt(dx * 0.3, -pitch * 0.6, -4);
    this.camera.rotateZ((roll * Math.PI) / 180 * Math.sin(TAU * p));
    this.camera.updateProjectionMatrix();

    // Palette (hex is sRGB; converted to linear working space once here).
    const darkS = str(params, 'dark', '#050914');
    const aS = str(params, 'a', '#1b2a6b');
    const bS = str(params, 'b', '#3a86ff');
    const cDark = hex(darkS);
    const cA = hex(aS);
    const cB = hex(bS);
    // Dark gradient backdrop: near-black top, deep tint toward the horizon.
    // Fog blends toward the horizon color so distance melts into the
    // background instead of a lifted grey.
    const top: readonly [number, number, number] = [cDark[0] * 0.25, cDark[1] * 0.25, cDark[2] * 0.25];
    const horizonC: readonly [number, number, number] = [
      cDark[0] * 0.75 + cA[0] * 0.25,
      cDark[1] * 0.75 + cA[1] * 0.25,
      cDark[2] * 0.75 + cA[2] * 0.25,
    ];
    (this.bgMat.uniforms['u_top'] as { value: THREE.Color }).value.setRGB(top[0], top[1], top[2]);
    (this.bgMat.uniforms['u_horizon'] as { value: THREE.Color }).value.setRGB(horizonC[0], horizonC[1], horizonC[2]);
    this.scene.background = new THREE.Color(top[0], top[1], top[2]);
    this.scene.fog = new THREE.FogExp2(new THREE.Color(horizonC[0], horizonC[1], horizonC[2]), num(params, 'fog', 0.028));

    const showLines = bool(params, 'showLines', true);
    const showDots = bool(params, 'showDots', true);
    const dotMin = num(params, 'dotMin', 0.18);
    const dotMax = num(params, 'dotMax', 0.5);
    const lineOpacity = num(params, 'lineOpacity', 0.9);
    const focus = num(params, 'focus', 26);
    const dof = num(params, 'dof', 0.6);
    const horizon = num(params, 'horizon', 0.7);
    const nearFade = num(params, 'nearFade', 4);
    const crestGlow = num(params, 'crestGlow', 1.2);
    const bloom = num(params, 'bloom', 0.7);
    const pulses = Math.round(num(params, 'pulses', 0));
    const pulseSpeed = Math.round(num(params, 'pulseSpeed', 1));
    const layers = Math.max(1, Math.min(3, Math.round(num(params, 'layers', 1))));
    const flow = Math.max(1, Math.min(3, Math.round(num(params, 'flow', 1))));
    const chop = num(params, 'chop', 0.2);
    const tp = fract(p * flow);
    const camPos = this.camera.position;
    const fogK = num(params, 'fog', 0.028);

    const n = c.count;
    const arr = this.points.arrays;
    let pi = 0;
    const linePos: number[] = showLines ? [] : [];
    const lineCol: number[] = showLines ? [] : [];
    // Displaced positions for edge reuse (layer 0 only for lines).
    const disp = new Float32Array(n * 3);

    for (let layer = 0; layer < layers; layer++) {
      const layerAlpha = layer === 0 ? 1 : layer === 1 ? 0.45 : 0.25;
      const layerDy = layer === 0 ? 0 : layer === 1 ? -1.6 : -3.0;
      for (let i = 0; i < n; i++) {
        const bx = c.base[i * 3] ?? 0;
        const by = c.base[i * 3 + 1] ?? 0;
        const bz = c.base[i * 3 + 2] ?? 0;
        let wx = bx;
        let wy = by;
        let wz = bz;
        let hN = 0;
        if (c.kind === 'plexus') {
          const r = c.orbitR[i] ?? 0;
          const k = c.orbitK[i] ?? 1;
          const ph = c.nodePhase[i] ?? 0;
          wx += r * Math.cos(TAU * (p * k + ph));
          wy += r * 0.6 * Math.sin(TAU * (p * k + ph) + 1.3);
          wz += r * 0.6 * Math.sin(TAU * (p * (k === 1 ? 2 : 1) + ph));
        } else {
          const h = waveHeight(bx, bz, tp, c.waves);
          hN = c.amplitude > 1e-6 ? h / c.amplitude : 0;
          // Gerstner-style horizontal nudge from local slope (cheap central diff).
          const e = 0.35;
          const sx = (waveHeight(bx + e, bz, tp, c.waves) - waveHeight(bx - e, bz, tp, c.waves)) / (2 * e);
          const sz = (waveHeight(bx, bz + e, tp, c.waves) - waveHeight(bx, bz - e, tp, c.waves)) / (2 * e);
          wx -= sx * chop * 0.8;
          wz -= sz * chop * 0.8;
          wy = h + layerDy;
        }
        if (layer === 0) {
          disp[i * 3] = wx;
          disp[i * 3 + 1] = wy;
          disp[i * 3 + 2] = wz;
        }
        const dxn = wx - camPos.x;
        const dyn = wy - camPos.y;
        const dzn = wz - camPos.z;
        const depth = Math.sqrt(dxn * dxn + dyn * dyn + dzn * dzn);
        const fogF = 1 - Math.exp(-(depth * fogK) * (depth * fogK));
        const coc = clamp((Math.abs(depth - focus) / (focus * 0.6 + 2)) * dof, 0, 1);
        const hFade = 1 - clamp(horizon, 0, 1.5) * 0.75 * smoothstep(focus * 1.15, focus * 1.15 + 26, depth);
        const nFade = smoothstep(Math.max(0.5, nearFade * 0.3), Math.max(1, nearFade), depth);
        // Height gradient valley->crest.
        const t = smoothstep(-0.65, 0.95, hN);
        let rC = cA[0] + (cB[0] - cA[0]) * t;
        let gC = cA[1] + (cB[1] - cA[1]) * t;
        let bC = cA[2] + (cB[2] - cA[2]) * t;
        // Dark valleys sink toward background.
        const sink = (1 - t) * 0.45;
        rC = rC * (1 - sink) + cDark[0] * sink;
        gC = gC * (1 - sink) + cDark[1] * sink;
        bC = bC * (1 - sink) + cDark[2] * sink;
        const crest = c.kind === 'plexus' ? 0.25 : crestFactor(hN * c.amplitude, c.amplitude, 0.9);
        // Gentle highlight lift only where content is bright; never enough
        // to clip saturated palette color to white.
        const boost = Math.min(2.0, 1 + crest * crestGlow * 0.35 + bloom * 0.12);
        rC *= boost;
        gC *= boost;
        bC *= boost;
        // Fog toward the horizon gradient color, never grey.
        rC = rC * (1 - fogF) + horizonC[0] * fogF;
        gC = gC * (1 - fogF) + horizonC[1] * fogF;
        bC = bC * (1 - fogF) + horizonC[2] * fogF;
        const edgeSoft = c.edgeFade > 0
          ? 1 - c.edgeFade * smoothstep(0.6, 1.0, Math.max(Math.abs(bx) / (c.width * 0.5), Math.abs(bz) / (c.depth * 0.5)))
          : 1;
        const alpha = (showDots ? 1 : 0) * layerAlpha * hFade * nFade * (1 - coc * 0.45) * edgeSoft;
        const size = (dotMin + (dotMax - dotMin) * (c.nodeSizeT[i] ?? 0.5)) * (1 + coc * 0.8) * (1 + crest * 0.25);
        if (pi < this.points.capacity && alpha > 0.004) {
          arr.pos[pi * 3] = wx;
          arr.pos[pi * 3 + 1] = wy;
          arr.pos[pi * 3 + 2] = wz;
          arr.col[pi * 3] = rC;
          arr.col[pi * 3 + 1] = gC;
          arr.col[pi * 3 + 2] = bC;
          arr.size[pi] = size;
          arr.alpha[pi] = Math.min(1.4, alpha);
          arr.shape[pi] = c.nodeShape[i] ?? 0;
          pi++;
        }
      }
    }
    this.points.setCount(showDots ? pi : 0);
    this.points.commit();
    this.points.mesh.visible = showDots && pi > 0;

    // Lines (layer 0). Colors fade toward black (additive => invisible).
    if (showLines && c.edges.length > 0) {
      const pulseOn = pulses > 0;
      const linkDist = num(params, 'linkDist', 8.5);
      const flowDirX = Math.cos(0.4);
      const flowDirZ = Math.sin(0.4);
      for (let e = 0; e < c.edges.length; e += 2) {
        const ia = c.edges[e] ?? 0;
        const ib = c.edges[e + 1] ?? 0;
        const ax = disp[ia * 3] ?? 0;
        const ay = disp[ia * 3 + 1] ?? 0;
        const az = disp[ia * 3 + 2] ?? 0;
        const bx2 = disp[ib * 3] ?? 0;
        const by2 = disp[ib * 3 + 1] ?? 0;
        const bz2 = disp[ib * 3 + 2] ?? 0;
        const mx = (ax + bx2) / 2 - camPos.x;
        const my = (ay + by2) / 2 - camPos.y;
        const mz = (az + bz2) / 2 - camPos.z;
        const depth = Math.sqrt(mx * mx + my * my + mz * mz);
        const fogF = 1 - Math.exp(-(depth * fogK) * (depth * fogK));
        let edgeFade = 1;
        if (c.kind === 'plexus') {
          const len = Math.sqrt((ax - bx2) ** 2 + (ay - by2) ** 2 + (az - bz2) ** 2);
          edgeFade = 1 - smoothstep(linkDist * 0.55, linkDist, len);
          if (edgeFade <= 0.01) continue;
        }
        const ex0 = (ax + bx2) * 0.5;
        const ez0 = (az + bz2) * 0.5;
        const edgeSoft = c.edgeFade > 0
          ? 1 - c.edgeFade * smoothstep(0.6, 1.0, Math.max(Math.abs(ex0) / (c.width * 0.5), Math.abs(ez0) / (c.depth * 0.5)))
          : 1;
        const hFade = (1 - clamp(horizon, 0, 1.5) * 0.75 * smoothstep(focus * 1.15, focus * 1.15 + 26, depth)) * edgeFade * edgeSoft;
        if (hFade <= 0.01) continue;
        const t = c.kind === 'plexus' ? 0.55 : smoothstep(-0.65, 0.95, ((ay + by2) / 2 / Math.max(0.2, c.amplitude)));
        let rC = (cA[0] + (cB[0] - cA[0]) * t) * (1 - fogF) + horizonC[0] * fogF;
        let gC = (cA[1] + (cB[1] - cA[1]) * t) * (1 - fogF) + horizonC[1] * fogF;
        let bC = (cA[2] + (cB[2] - cA[2]) * t) * (1 - fogF) + horizonC[2] * fogF;
        if (pulseOn) {
          const s = 0.5 + 0.5 * Math.sin(TAU * (((ax + az) * flowDirX + (ax - az) * flowDirZ) * 0.02 - p * pulseSpeed) + (e / 2) * 0.0);
          void s;
          const trav = 0.5 + 0.5 * Math.sin(TAU * ((ax * flowDirX + az * flowDirZ) * 0.03 - p * pulseSpeed * pulses * 0.25));
          const pk = Math.pow(trav, 10) * 1.2;
          rC += cB[0] * pk;
          gC += cB[1] * pk;
          bC += cB[2] * pk;
        }
        const k = lineOpacity * hFade * (1 - fogF * 0.5);
        linePos.push(ax, ay, az, bx2, by2, bz2);
        lineCol.push(rC * k, gC * k, bC * k, rC * k, gC * k, bC * k);
      }
      this.ensureLines();
      if (this.lineGeo && this.lineMat && this.lines) {
        this.lineGeo.setPositions(linePos);
        this.lineGeo.setColors(lineCol);
        this.lineMat.linewidth = num(this.lastParams(params), 'lineWidth', 1.6) * (this.H / 1080);
        this.lineMat.opacity = 1;
        this.lineMat.resolution.set(this.W, this.H);
        this.lines.visible = true;
      }
    } else if (this.lines) {
      this.lines.visible = false;
    }

    // Optional face shading for tri topology.
    if (this.opts.faceShading && c.kind === 'tri') {
      this.updateMesh(c, disp, cDark, cA, cB, fogK, crestGlow);
    } else if (this.mesh) {
      this.mesh.visible = false;
    }

    // Post uniforms (mirror 2D grading).
    const u = this.post.uniforms as unknown as Record<string, { value: unknown }>;
    (u['u_resolution'] as { value: number[] }).value = [this.W, this.H];
    (u['u_phase'] as { value: number }).value = p;
    (u['u_seed'] as { value: number }).value = (seed >>> 0) / 4294967296;
    (u['u_contrast'] as { value: number }).value = post.contrast;
    (u['u_brightness'] as { value: number }).value = post.brightness;
    (u['u_saturation'] as { value: number }).value = post.saturation;
    // Network/3D defaults to clean: clamp grain low (stylistic extra only).
    (u['u_grain'] as { value: number }).value = Math.min(post.grain, 0.02);
    (u['u_vignette'] as { value: number }).value = post.vignette;
    (u['u_chromAb'] as { value: number }).value = post.chromAb;
    (u['u_posterize'] as { value: number }).value = post.posterize;
    this.composer.render();
  }

  private lastParams(params: Params): Params {
    return params;
  }

  private resize(w: number, h: number): void {
    this.W = Math.max(2, Math.floor(w));
    this.H = Math.max(2, Math.floor(h));
    this.renderer.setSize(this.W, this.H, false);
    this.composer.setSize(this.W, this.H);
    this.lineMat?.resolution.set(this.W, this.H);
  }

  private ensureLines(): void {
    if (this.lines && this.lineGeo && this.lineMat) return;
    this.lineGeo = new LineSegmentsGeometry();
    this.lineGeo.setPositions([0, 0, 0, 0, 0, 1]);
    this.lineGeo.setColors([0, 0, 0, 0, 0, 0]);
    this.lineMat = new LineMaterial({
      linewidth: 1.6,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.lineMat.resolution.set(this.W, this.H);
    this.lines = new LineSegments2(this.lineGeo, this.lineMat);
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 4;
    this.scene.add(this.lines);
  }

  private updateMesh(
    c: Cache,
    disp: Float32Array,
    cDark: readonly [number, number, number],
    cA: readonly [number, number, number],
    cB: readonly [number, number, number],
    fogK: number,
    crestGlow: number,
  ): void {
    if (!this.mesh || !this.meshGeo) {
      this.meshGeo = new THREE.BufferGeometry();
      const g = buildGrid(c.nx, c.nz, 1, 1);
      this.meshGeo.setIndex(Array.from(g.indices));
      this.meshGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(c.count * 3), 3).setUsage(THREE.DynamicDrawUsage));
      this.meshGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(c.count * 3), 3).setUsage(THREE.DynamicDrawUsage));
      const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false });
      this.mesh = new THREE.Mesh(this.meshGeo, mat);
      this.mesh.frustumCulled = false;
      this.mesh.renderOrder = 2;
      this.scene.add(this.mesh);
    }
    const posA = this.meshGeo.getAttribute('position') as THREE.BufferAttribute;
    const colA = this.meshGeo.getAttribute('color') as THREE.BufferAttribute;
    const pa = posA.array as Float32Array;
    const ca = colA.array as Float32Array;
    pa.set(disp);
    for (let i = 0; i < c.count; i++) {
      const hN = c.amplitude > 1e-6 ? (disp[i * 3 + 1] ?? 0) / c.amplitude : 0;
      const t = smoothstep(-0.65, 0.95, hN);
      const crest = crestFactor(hN * c.amplitude, c.amplitude, 0.85);
      const b = 0.5 + crest * crestGlow * 0.3;
      const ef = c.edgeFade > 0
        ? 1 - c.edgeFade * smoothstep(0.55, 1.0, Math.max(Math.abs(disp[i * 3] ?? 0) / (c.width * 0.5), Math.abs(disp[i * 3 + 2] ?? 0) / (c.depth * 0.5)))
        : 1;
      ca[i * 3] = (((cA[0] + (cB[0] - cA[0]) * t) * b) * 0.6 + cDark[0] * 0.25) * ef;
      ca[i * 3 + 1] = (((cA[1] + (cB[1] - cA[1]) * t) * b) * 0.6 + cDark[1] * 0.25) * ef;
      ca[i * 3 + 2] = (((cA[2] + (cB[2] - cA[2]) * t) * b) * 0.6 + cDark[2] * 0.25) * ef;
      void fogK;
    }
    posA.needsUpdate = true;
    colA.needsUpdate = true;
    if (this.mesh) this.mesh.visible = true;
  }

  private ensureCache(seed: number, params: Params): void {
    const kind = this.opts.topology;
    const density = Math.round(num(params, 'density', kind === 'plexus' ? 220 : 110));
    const nodeCount = Math.round(num(params, 'nodeCount', density * 2));
    const detail = num(params, 'detail', 1.0);
    const edgeFade = clamp(num(params, 'edgeFade', 0.6), 0, 1);
    const fillFrame = bool(params, 'fillFrame', true);
    let w = num(params, 'surfWidth', 44);
    let d = num(params, 'surfDepth', 34);
    // Surface topologies (not the plexus volume) can auto-size to the frustum
    // so no grid edge is ever visible, including at extreme aspect ratios.
    if (fillFrame && kind !== 'plexus') {
      const cov = frustumCoverage({
        fovDeg: num(params, 'fov', 50),
        aspect: this.W / this.H,
        camHeight: num(params, 'camHeight', 10),
        pitchDeg: num(params, 'pitch', 2),
        distance: num(params, 'distance', 30),
        drift: num(params, 'drift', 1.5),
      });
      w = Math.max(w, cov.width);
      d = Math.max(d, cov.depth);
    }
    const amp = num(params, 'amplitude', 2.2);
    const freq = num(params, 'frequency', 0.9);
    const waves = Math.round(num(params, 'waveCount', 4));
    const dir = num(params, 'direction', 20);
    const jitter = num(params, 'jitter', 0.12);
    const shape = str(params, 'shape', 'circle');
    const linkDist = num(params, 'linkDist', 8.5);
    const motion = num(params, 'motion', 0.8);
    const key = [kind, seed >>> 0, density, nodeCount, detail, edgeFade, w, d, amp, freq, waves, dir, jitter, shape, linkDist, motion].join('|');
    if (this.cache && this.cache.key === key) return;

    const rot = (dir * Math.PI) / 180;
    const mkWaves = buildWaves(seed, waves, amp).map((cm) => {
      // Bake frequency + direction rotation (static => loop-safe).
      const fx = cm.dirX * cm.freq * freq;
      const fz = cm.dirZ * cm.freq * freq;
      return {
        ...cm,
        dirX: fx * Math.cos(rot) - fz * Math.sin(rot),
        dirZ: fx * Math.sin(rot) + fz * Math.cos(rot),
        freq: 1,
      };
    });

    const rng = mulberry32((seed >>> 0) ^ 0x9e3779b9);
    const shapeMixed = shape === 'mixed';
    if (kind === 'plexus') {
      const count = clamp(nodeCount, 40, 600);
      const linkDist = num(params, 'linkDist', 8.5);
      const motion = num(params, 'motion', 0.8);
      const base = buildVolumePoints(seed, count, w * 0.9, 12, d * 0.9);
      // Center the volume ahead of the camera.
      for (let i = 0; i < count; i++) {
        base[i * 3 + 2] = (base[i * 3 + 2] ?? 0) - 6;
      }
      const edges = buildKnnEdges(base, 3, linkDist);
      const { nodeShape, nodeSizeT, nodePhase, orbitR, orbitK } = this.nodeAttrs(rng, count, shapeMixed, shape);
      for (let i = 0; i < count; i++) {
        orbitR[i] = rng.range(0.15, 1.1) * motion;
        orbitK[i] = rng.next() < 0.7 ? 1 : 2;
      }
      this.cache = { key, kind, count, base, edges, nodeShape, nodeSizeT, nodePhase, orbitR, orbitK, waves: mkWaves, nx: 0, nz: 0, amplitude: amp, width: w, depth: d, edgeFade };
      return;
    }

    if (kind === 'hex') {
      const [cols, rows] = this.capGrid(
        clamp(Math.round(density * detail), 20, 400),
        clamp(Math.round(((density * detail) * d) / Math.max(1, w)), 12, 400),
      );
      const h = buildHex(cols, rows, w, d);
      const jittered = new Float32Array(h.positions);
      for (let i = 0; i < h.count; i++) {
        jittered[i * 3] = (jittered[i * 3] ?? 0) + (rng.next() - 0.5) * jitter * 1.4;
        jittered[i * 3 + 2] = (jittered[i * 3 + 2] ?? 0) + (rng.next() - 0.5) * jitter * 1.4;
      }
      const { nodeShape, nodeSizeT, nodePhase, orbitR, orbitK } = this.nodeAttrs(rng, h.count, shapeMixed, shape);
      this.cache = { key, kind, count: h.count, base: jittered, edges: h.edges, nodeShape, nodeSizeT, nodePhase, orbitR, orbitK, waves: mkWaves, nx: cols, nz: rows, amplitude: amp, width: w, depth: d, edgeFade };
      return;
    }

    // grid + tri share grid topology (tri adds face shading).
    const [nx, nz] = this.capGrid(
      clamp(Math.round(density * detail), 20, 400),
      clamp(Math.round(((density * detail) * d) / Math.max(1, w)), 12, 400),
    );
    const g = buildGrid(nx, nz, w, d);
    const jittered = new Float32Array(g.positions);
    for (let i = 0; i < nx * nz; i++) {
      jittered[i * 3] = (jittered[i * 3] ?? 0) + (rng.next() - 0.5) * jitter * 1.6;
      jittered[i * 3 + 2] = (jittered[i * 3 + 2] ?? 0) + (rng.next() - 0.5) * jitter * 1.6;
    }
    const { nodeShape, nodeSizeT, nodePhase, orbitR, orbitK } = this.nodeAttrs(rng, nx * nz, shapeMixed, shape);
    this.cache = { key, kind, count: nx * nz, base: jittered, edges: g.edges, nodeShape, nodeSizeT, nodePhase, orbitR, orbitK, waves: mkWaves, nx, nz, amplitude: amp, width: w, depth: d, edgeFade };
  }

  /** Auto-reduce grid density so the vertex count stays under a safe cap. */
  private capGrid(nx: number, nz: number): [number, number] {
    const CAP = 48000;
    const tot = nx * nz;
    if (tot <= CAP) return [nx, nz];
    const s = Math.sqrt(CAP / tot);
    return [Math.max(20, Math.floor(nx * s)), Math.max(12, Math.floor(nz * s))];
  }

  private nodeAttrs(
    rng: { next(): number; range(a: number, b: number): number },
    count: number,
    mixed: boolean,
    shape: string,
  ): { nodeShape: Float32Array; nodeSizeT: Float32Array; nodePhase: Float32Array; orbitR: Float32Array; orbitK: Float32Array } {
    const nodeShape = new Float32Array(count);
    const nodeSizeT = new Float32Array(count);
    const nodePhase = new Float32Array(count);
    const orbitR = new Float32Array(count);
    const orbitK = new Float32Array(count);
    const fixed = shapeId(shape);
    for (let i = 0; i < count; i++) {
      nodeShape[i] = mixed ? Math.floor(rng.next() * 8) : fixed;
      nodeSizeT[i] = rng.next();
      nodePhase[i] = rng.next();
      orbitR[i] = 0;
      orbitK[i] = 1;
    }
    return { nodeShape, nodeSizeT, nodePhase, orbitR, orbitK };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.points.dispose();
    this.lineGeo?.dispose();
    (this.lineMat as unknown as { dispose?: () => void })?.dispose?.();
    this.meshGeo?.dispose();
    (this.mesh?.material as THREE.Material | undefined)?.dispose();
    this.bgMesh.geometry.dispose();
    this.bgMat.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}
