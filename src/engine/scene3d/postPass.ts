// Post shader for the 3D pipeline: mirrors src/engine/post.ts grading
// (contrast/saturation/vignette/grain/chromAb/posterize) so scene3d and
// shader2d outputs grade identically. Grain is loop-safe via u_phase.
export const Scene3DPostShader = {
  uniforms: {
    tDiffuse: { value: null as unknown },
    u_resolution: { value: [1920, 1080] as unknown as number[] },
    u_phase: { value: 0 },
    u_seed: { value: 0 },
    u_contrast: { value: 1 },
    u_brightness: { value: 0 },
    u_saturation: { value: 1 },
    u_grain: { value: 0.015 },
    u_vignette: { value: 0.25 },
    u_chromAb: { value: 0 },
    u_posterize: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
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
      vec2 uv = vUv;
      vec2 px = 1.0 / u_resolution;
      float ab = u_chromAb * 0.003;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + vec2(ab, 0.0)).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - vec2(ab, 0.0)).b;

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
      // strongest in midtones, ~0 in deep blacks and highlights.
      float lum2 = dot(clamp(col, 0.0, 1.0), vec3(0.2126, 0.7152, 0.0722));
      float gw = smoothstep(0.015, 0.18, lum2) * (1.0 - smoothstep(0.55, 0.95, lum2));
      float g = hash12(uv * u_resolution + fract(u_phase) * 913.0 + u_seed * 77.0) - 0.5;
      col += g * u_grain * gw;

      // Tiny +-0.5/255 triangular dither against banding (never speckle).
      float d1 = hash12(uv * u_resolution + 17.0 + u_seed * 131.0);
      float d2 = hash12(uv * u_resolution + 91.0 + u_seed * 197.0);
      col += (d1 + d2 - 1.0) * (0.5 / 255.0);

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,
};
