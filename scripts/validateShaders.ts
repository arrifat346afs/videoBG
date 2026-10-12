// Validates every generator's assembled fragment source with glslangValidator.
// Run: bun scripts/validateShaders.ts  (writes to /tmp/opencode/shaders)
import { mkdirSync, writeFileSync } from 'node:fs';
import { COMMON_GLSL } from '../src/engine/glsl_common.ts';
import { FULLSCREEN_VERT } from '../src/engine/gl.ts';
import { POST_FRAG } from '../src/engine/post.ts';
import { listGenerators } from '../src/engine/registry.ts';
import '../src/engine/generators/index.ts';

const HEADER = `#version 300 es
precision highp float;
uniform vec2 u_resolution;
uniform float u_phase;
uniform float u_seed;
uniform float u_time;
`;

mkdirSync('/tmp/opencode/shaders', { recursive: true });
writeFileSync('/tmp/opencode/shaders/fullscreen.vert', FULLSCREEN_VERT);
writeFileSync('/tmp/opencode/shaders/post.frag', POST_FRAG);
for (const g of listGenerators()) {
  writeFileSync(`/tmp/opencode/shaders/${g.id}.frag`, HEADER + COMMON_GLSL + g.fragmentShader);
}
console.log(`wrote ${listGenerators().length} fragment shaders + vert + post`);
