// Shared GLSL prelude injected before every generator fragment shader.
// Provides deterministic noise + SDF helpers. No uniforms declared here
// except helpers; standard uniforms come from renderer SHADER_HEADER.

export const COMMON_GLSL = `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float gnoise(vec2 p) {
  return vnoise(p) * 2.0 - 1.0;
}
float gnoise(vec3 p) {
  return vnoise(p.xy + p.z * 0.73) * 2.0 - 1.0;
}
float snoise(vec3 p) {
  vec2 q = p.xy + p.z * 0.61;
  return vnoise(q) * 2.0 - 1.0;
}
float fbm2(vec2 p, float oct) {
  float v = 0.0;
  float a = 0.5;
  int n = int(oct + 0.5);
  for (int i = 0; i < 6; i++) {
    if (i >= n) break;
    v += a * vnoise(p);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p;
    a *= 0.5;
  }
  return v;
}
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

// ---- gradient system (shared uniforms, set by Renderer from the gradient
// param; see engine/gradient.ts). Up to 8 stops, mode 0=sRGB, 1=smooth sRGB,
// 2=OKLab perceptual.
uniform vec3 u_gradCol[8];
uniform float u_gradPos[8];
uniform int u_gradCount;
uniform int u_gradMode;

vec3 srgb2lin(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
vec3 lin2srgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
float cbrtf_(float x) {
  return sign(x) * pow(abs(x), 1.0 / 3.0);
}
vec3 lin2oklab(vec3 c) {
  float l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
  float m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
  float s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;
  vec3 lms = vec3(cbrtf_(l), cbrtf_(m), cbrtf_(s));
  return vec3(
    0.2104542553 * lms.x + 0.7936177850 * lms.y - 0.0040720468 * lms.z,
    1.9779984951 * lms.x - 2.4285922050 * lms.y + 0.4505937099 * lms.z,
    0.0259040371 * lms.x + 0.7827717662 * lms.y - 0.8086757660 * lms.z);
}
vec3 oklab2lin(vec3 lab) {
  vec3 lms = vec3(
    lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z,
    lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z,
    lab.x - 0.0894841775 * lab.y - 1.2914855480 * lab.z);
  vec3 c = lms * lms * lms;
  return vec3(
    4.0767416621 * c.x - 3.3077115913 * c.y + 0.2309699292 * c.z,
    -1.2684380046 * c.x + 2.6097574011 * c.y - 0.3413193965 * c.z,
    -0.0041960863 * c.x - 0.7034186147 * c.y + 1.7076147010 * c.z);
}
vec3 gradSample(float t) {
  if (u_gradCount < 1) return vec3(0.0);
  if (u_gradCount == 1) return u_gradCol[0];
  t = clamp(t, 0.0, 1.0);
  int i = 0;
  for (int k = 0; k < 7; k++) {
    if (k + 1 < u_gradCount && u_gradPos[k + 1] <= t) i = k + 1;
  }
  int j = min(i + 1, u_gradCount - 1);
  float span = u_gradPos[j] - u_gradPos[i];
  float u = span > 1e-5 ? (t - u_gradPos[i]) / span : 0.0;
  if (u_gradMode == 1) u = u * u * (3.0 - 2.0 * u);
  vec3 ca = u_gradCol[i];
  vec3 cb = u_gradCol[j];
  if (u_gradMode == 0) return mix(ca, cb, u);
  return lin2srgb(oklab2lin(mix(lin2oklab(srgb2lin(ca)), lin2oklab(srgb2lin(cb)), u)));
}
// Spatial gradient coordinate from a (roughly centered) point.
float gradCoord(vec2 p, float angleDeg, int mode) {
  float a = radians(angleDeg);
  vec2 r = vec2(cos(a) * p.x - sin(a) * p.y, sin(a) * p.x + cos(a) * p.y);
  if (mode == 1) return clamp(length(p) * 1.4142, 0.0, 1.0);
  if (mode == 2) return fract(atan(p.y, p.x) / 6.2831853 + 0.5);
  if (mode == 3) return clamp(0.5 + 0.5 * (r.x * 0.7 + r.y * 0.7), 0.0, 1.0);
  return clamp(r.x + 0.5, 0.0, 1.0);
}
`;
