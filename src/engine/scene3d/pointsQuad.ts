// Instanced camera-facing quads for points (no gl.POINTS).
// Per-instance: position (world), color, size (world units), alpha, shape.
import * as THREE from 'three';

const VERT = /* glsl */ `
attribute vec3 aPos;
attribute vec3 aColor;
attribute float aSize;
attribute float aAlpha;
attribute float aShape;
varying vec3 vColor;
varying float vAlpha;
varying float vShape;
varying vec2 vUv;
void main() {
  vColor = aColor;
  vAlpha = aAlpha;
  vShape = aShape;
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(aPos, 1.0);
  mv.xy += (uv - 0.5) * aSize;
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec3 vColor;
varying float vAlpha;
varying float vShape;
varying vec2 vUv;

float sdPoly(vec2 p, int n, float rot, float r) {
  float a = atan(p.x, p.y) + rot;
  float rb = 6.28318530718 / float(n);
  float d = cos(floor(0.5 + a / rb) * rb - a) * length(p);
  return d - r;
}

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  int shape = int(vShape + 0.5);
  float sd;
  if (shape == 1) { // ring
    sd = abs(length(p) - 0.55) - 0.16;
  } else if (shape == 2) { // square
    sd = sdPoly(p, 4, 0.78539816, 0.72);
  } else if (shape == 3) { // diamond
    sd = sdPoly(p, 4, 0.0, 0.72);
  } else if (shape == 4) { // triangle
    sd = sdPoly(p, 3, 0.0, 0.78);
  } else if (shape == 5) { // hexagon
    sd = sdPoly(p, 6, 0.0, 0.74);
  } else if (shape == 6) { // plus
    float bx = sdPoly(p, 4, 0.78539816, 0.9);
    vec2 q = abs(p);
    float bar = max(q.x - 0.22, q.y - 0.75);
    float bar2 = max(q.y - 0.22, q.x - 0.75);
    sd = min(bar, bar2);
    sd = min(sd, bx + 0.35);
  } else if (shape == 7) { // glow dot: crisp core + tight halo (no wide wash)
    float d = length(p);
    float aa = fwidth(d) + 1e-4;
    float core = 1.0 - smoothstep(0.30 - aa, 0.30 + aa, d);
    float halo = exp(-d * d * 5.5) * 0.45 * (1.0 - core);
    float a = (core + halo) * vAlpha;
    if (a < 0.004) discard;
    gl_FragColor = vec4(vColor * (core + halo * 0.6), a);
    return;
  } else { // circle
    sd = length(p) - 0.78;
  }
  float aa = fwidth(sd) + 1e-4;
  float a = (1.0 - smoothstep(-aa, aa, sd)) * vAlpha;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor, a);
}
`;

export class PointsQuads {
  readonly mesh: THREE.Mesh;
  private geo: THREE.InstancedBufferGeometry;
  private pos: THREE.InstancedBufferAttribute;
  private col: THREE.InstancedBufferAttribute;
  private size: THREE.InstancedBufferAttribute;
  private alpha: THREE.InstancedBufferAttribute;
  private shape: THREE.InstancedBufferAttribute;
  readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    const base = new THREE.PlaneGeometry(1, 1);
    this.geo = new THREE.InstancedBufferGeometry();
    this.geo.index = base.index;
    this.geo.setAttribute('position', base.getAttribute('position'));
    this.geo.setAttribute('uv', base.getAttribute('uv'));
    this.geo.instanceCount = 0;
    this.pos = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.col = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.size = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1).setUsage(THREE.DynamicDrawUsage);
    this.alpha = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1).setUsage(THREE.DynamicDrawUsage);
    this.shape = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('aPos', this.pos);
    this.geo.setAttribute('aColor', this.col);
    this.geo.setAttribute('aSize', this.size);
    this.geo.setAttribute('aAlpha', this.alpha);
    this.geo.setAttribute('aShape', this.shape);
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
  }

  setCount(n: number): void {
    this.geo.instanceCount = Math.min(n, this.capacity);
  }

  get arrays(): {
    pos: Float32Array;
    col: Float32Array;
    size: Float32Array;
    alpha: Float32Array;
    shape: Float32Array;
  } {
    return {
      pos: this.pos.array as Float32Array,
      col: this.col.array as Float32Array,
      size: this.size.array as Float32Array,
      alpha: this.alpha.array as Float32Array,
      shape: this.shape.array as Float32Array,
    };
  }

  commit(): void {
    this.pos.needsUpdate = true;
    this.col.needsUpdate = true;
    this.size.needsUpdate = true;
    this.alpha.needsUpdate = true;
    this.shape.needsUpdate = true;
  }

  dispose(): void {
    this.geo.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

/** Shape name -> float id used in aShape. 'mixed' is resolved per-node by caller. */
export function shapeId(name: string): number {
  switch (name) {
    case 'ring': return 1;
    case 'square': return 2;
    case 'diamond': return 3;
    case 'triangle': return 4;
    case 'hexagon': return 5;
    case 'plus': return 6;
    case 'glow': return 7;
    default: return 0;
  }
}
