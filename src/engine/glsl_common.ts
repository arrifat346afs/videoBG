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
`;
