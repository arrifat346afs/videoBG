// Post-processing stack: color grade + film effects.
// Applied as a second fullscreen pass sampling the generator output.

export interface PostSettings {
  readonly contrast: number;
  readonly brightness: number;
  readonly saturation: number;
  readonly grain: number;
  readonly vignette: number;
  readonly chromAb: number;
  readonly posterize: number;
}

export const DEFAULT_POST: PostSettings = {
  contrast: 1.0,
  brightness: 0.0,
  saturation: 1.0,
  grain: 0.015,
  vignette: 0.25,
  chromAb: 0.0,
  posterize: 0.0,
};

export const POST_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_scene;
uniform vec2 u_resolution;
uniform float u_phase;
uniform float u_seed;
uniform float u_contrast;
uniform float u_brightness;
uniform float u_saturation;
uniform float u_grain;
uniform float u_vignette;
uniform float u_chromAb;
uniform float u_posterize;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec2 uv = v_uv;
  vec2 px = 1.0 / u_resolution;
  float ab = u_chromAb * 0.003;
  vec3 col;
  col.r = texture(u_scene, uv + vec2(ab, 0.0)).r;
  col.g = texture(u_scene, uv).g;
  col.b = texture(u_scene, uv - vec2(ab, 0.0)).b;

  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(luma), col, u_saturation);
  col = (col - 0.5) * u_contrast + 0.5 + u_brightness;

  if (u_posterize > 0.5) {
    col = floor(col * 6.0 + 0.5) / 6.0;
  }

  vec2 q = uv - 0.5;
  q.x *= u_resolution.x / u_resolution.y;
  col *= 1.0 - u_vignette * smoothstep(0.3, 1.1, length(q) * 1.4);

  // Luminance-weighted fine grain, display space, LAST step only:
  // strongest in midtones, ~0 in deep blacks and highlights, so dark
  // backgrounds stay clean. Deterministic per (pixel, frame).
  float lum2 = dot(clamp(col, 0.0, 1.0), vec3(0.2126, 0.7152, 0.0722));
  float gw = smoothstep(0.015, 0.18, lum2) * (1.0 - smoothstep(0.55, 0.95, lum2));
  float g = hash12(uv * u_resolution + fract(u_phase) * 913.0 + u_seed * 77.0) - 0.5;
  col += g * u_grain * gw;

  // Tiny +-0.5/255 triangular dither against banding (never speckle).
  float d1 = hash12(uv * u_resolution + 17.0 + u_seed * 131.0);
  float d2 = hash12(uv * u_resolution + 91.0 + u_seed * 197.0);
  col += (d1 + d2 - 1.0) * (0.5 / 255.0);

  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
