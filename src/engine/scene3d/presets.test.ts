import { describe, expect, it } from 'vitest';
import { getGenerator } from '../registry.ts';
import { SCENE3D_PRESETS } from './presets.ts';
import '../generators/index.ts';

describe('scene3d presets', () => {
  it('has 10+ presets referencing real generators with valid keys', () => {
    expect(SCENE3D_PRESETS.length).toBeGreaterThanOrEqual(10);
    for (const p of SCENE3D_PRESETS) {
      const gen = getGenerator(p.generatorId);
      expect(gen, `missing generator ${p.generatorId}`).toBeDefined();
      expect(gen?.kind).toBe('scene3d');
      const keys = new Set(gen?.paramSchema.map((d) => d.key));
      for (const k of Object.keys(p.params)) {
        expect(keys.has(k), `${p.name}: unknown param ${k}`).toBe(true);
      }
    }
  });
});
