// Layer compositing pass: blends a single layer texture onto the accumulated
// result with the chosen blend mode + opacity. Runs once per extra layer, then
// the post pass runs once on the final accumulation texture.
//
// All blend functions operate on non-premultiplied sRGB values in [0,1] and are
// clamped, matching the common graphics-editor blend set.
export const COMPOSITE_FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_base;
uniform sampler2D u_layer;
uniform float u_opacity;
uniform int u_blend;
in vec2 v_uv;
out vec4 outColor;

float softLight(float b, float s) {
  return s <= 0.5
    ? b - (1.0 - 2.0 * s) * b * (1.0 - b)
    : b + (2.0 * s - 1.0) * (sqrt(b) - b);
}

vec3 blend(vec3 a, vec3 b) {
  if (u_blend == 1) return a + b;                          // add
  if (u_blend == 2) return 1.0 - (1.0 - a) * (1.0 - b);    // screen
  if (u_blend == 3) return a * b;                          // multiply
  if (u_blend == 4) {                                      // overlay
    return mix(2.0 * a * b, 1.0 - 2.0 * (1.0 - a) * (1.0 - b), step(0.5, a));
  }
  if (u_blend == 5) {                                      // soft-light
    return vec3(softLight(a.r, b.r), softLight(a.g, b.g), softLight(a.b, b.b));
  }
  if (u_blend == 6) return abs(a - b);                     // difference
  return b;                                                // normal
}

void main() {
  vec3 a = texture(u_base, v_uv).rgb;
  vec3 b = texture(u_layer, v_uv).rgb;
  vec3 c = clamp(blend(a, b), 0.0, 1.0);
  outColor = vec4(mix(a, c, clamp(u_opacity, 0.0, 1.0)), 1.0);
}
`;

/** Index into the shader's u_blend branch. */
export function blendIndex(blend: string): number {
  const order = ['normal', 'add', 'screen', 'multiply', 'overlay', 'soft-light', 'difference'];
  const i = order.indexOf(blend);
  return i < 0 ? 0 : i;
}
