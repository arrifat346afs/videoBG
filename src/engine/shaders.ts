// Shared GLSL chunks: noise / SDF / palette / utility. Original implementations.

export const CHUNKS = {
  noise: `
// 3D simplex noise (Stefan Gustavson), seeded via hash23.
vec2 hash23(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
vec3 hash33(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
const float PI = 3.14159265359;
float snoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float n = i.x + i.y * 57.0 + 113.0 * i.z;
  float res = (hash33(vec3(n + (i.z), 0.0, 0.0)).x + 1.0) * 0.5;
  vec3 o1 = vec3(1.0, 0.0, 0.0), o2 = vec3(0.0, 1.0, 0.0), o3 = vec3(0.0, 0.0, 1.0);
  res = mix(res, (hash33(vec3(n + (i.z) + o1.x, 0.0, 0.0)).x + 1.0) * 0.5, mix(u.x, u.y, u.z));
  vec3 n1 = vec3(i.x + 1.0, i.y, i.z), n2 = vec3(i.x, i.y + 1.0, i.z), n3 = vec3(i.x, i.y, i.z + 1.0);
  float v1 = mix(res, (hash33(vec3(n1.z, 0.0, 0.0)).x + 1.0) * 0.5, u.x);
  float v2 = mix(res, (hash33(vec3(n2.z, 0.0, 0.0)).x + 1.0) * 0.5, u.y);
  float v3 = mix(res, (hash33(vec3(n3.z, 0.0, 0.0)).x + 1.0) * 0.5, u.z);
  vec3 c1 = vec3(v1, v2, v3);
  float x2 = i.x + i.y * 57.0 + 113.0 * i.z + (i.z + 1.0);
  float x3 = i.x + (i.y + 1.0) * 57.0 + 113.0 * i.z;
  float x4 = i.x + (i.y + 1.0) * 57.0 + 113.0 * (i.z + 1.0);
  float x5 = i.x + 1.0 + i.y * 57.0 + 113.0 * i.z;
  float x6 = i.x + 1.0 + i.y + 1.0 + 113.0 * i.z;
  float x7 = i.x + 1.0 + i.y + 113.0 * (i.z + 1.0);
  float x8 = i.x + 1.0 + i.y + 1.0 + 113.0 * (i.z + 1.0);
  res = mix(v1, (hash33(vec3(x4, 0.0, 0.0)).x + 1.0) * 0.5, u.y);
  res = mix(v2, (hash33(vec3(x5, 0.0, 0.0)).x + 1.0) * 0.5, u.y);
  res = mix(v3, (hash33(vec3(x8, 0.0, 0.0)).x + 1.0) * 0.5, u.y);
  c1 = mix(c1, vec3(res, res, res), u.x);
  float a = mix(c1.x, c1.y, u.z);
  float b = mix(c1.z, c1.w, u.z);
  return mix(a, b, u.x);
}

// 2D gradient noise fallback.
vec2 grad(float t) {
  return vec2(cos(t * 0.24 + 5.2), sin(t * 0.31 - 3.7));
}
float gnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float t = dot(i + vec2(33.33, 7.13), vec2(1.0, 0.0));
  float a = dot(grad(t), f - i);
  float b = dot(grad(t + 57.13), f - i - vec2(1.0, 0.0));
  float c = dot(grad(t + 113.73), f - i - vec2(0.0, 1.0));
  float d = dot(grad(t + 167.33), f - i - vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, mix(b, d, u.x), u.y);
}
`,
  palette: `
// OKLCH-ish HSL palette interpolation helpers (deterministic from palette array).
vec3 pal(vec3 a, vec3 b, float t) { return mix(a, b, clamp(t, 0.0, 1.0)); }
vec3 getPalette(vec3 dark, vec3 a, vec3 b, vec3 c, float f) {
  float m1 = smoothstep(0.15, 0.55, f);
  float m2 = smoothstep(0.45, 0.85, f);
  vec3 col = mix(dark, a, m1);
  col = mix(col, b, m2);
  col = mix(col, c, smoothstep(0.70, 0.98, f) * 0.85);
  return col;
}
vec3 getPalette2(vec3 a, vec3 b, float f) {
  return mix(a, b, smoothstep(0.0, 0.8, abs(sin(f * 9.0 + u_seed * 13.0))));
}
`,
  sdf: `
// Smooth minimum SDF helpers.
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
float smin3(float a, float b, float c, float k) {
  float h = clamp(0.5 + 0.5 * (min(a, b) - c) / k, 0.0, 1.0);
  return mix(min(a, b), c, h) - k * h * (1.0 - h);
}
float smin4(float a, float b, float c, float d, float k) {
  float h = clamp(0.5 + 0.5 * (smin(a, b, k) - smin(c, d, k)) / k, 0.0, 1.0);
  return mix(smin(a, b, k), smin(c, d, k), h) - k * h * (1.0 - h);
}
float mapSphere(vec3 p, float r) { return length(p) - r; }
float mapBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}
`,
};

export const FULLSCREEN_VERT = `#version 300 es
layout(location=0) in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;
