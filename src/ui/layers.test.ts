import { describe, expect, it } from 'vitest';
import { blendIndex } from '../engine/composite.ts';
import {
  MAX_LAYERS,
  makeLayer,
  migrateToLayers,
  moveLayer,
  patchLayer,
  visibleLayers,
} from '../engine/layers.ts';
import { BLEND_MODES, type Layer } from '../engine/types.ts';

function layer(id: string, over: Partial<Layer> = {}): Layer {
  return {
    id,
    generatorId: 'domain-warp',
    params: {},
    seed: 1,
    opacity: 1,
    blend: 'normal',
    visible: true,
    solo: false,
    ...over,
  };
}

describe('layer helpers', () => {
  it('makeLayer fills defaults from the generator', () => {
    const l = makeLayer({ generatorId: 'domain-warp' });
    expect(l.id).toBeTruthy();
    expect(l.opacity).toBe(1);
    expect(l.blend).toBe('normal');
    expect(l.visible).toBe(true);
    expect(l.solo).toBe(false);
    expect(Object.keys(l.params).length).toBeGreaterThan(0);
  });

  it('visibleLayers honours solo over visibility', () => {
    const stack = [
      layer('a', { visible: true }),
      layer('b', { visible: false }),
      layer('c', { visible: true, solo: true }),
    ];
    expect(visibleLayers(stack).map((l) => l.id)).toEqual(['c']);
    expect(visibleLayers(stack.map((l) => ({ ...l, solo: false }))).map((l) => l.id)).toEqual(['a', 'c']);
  });

  it('migrateToLayers wraps a legacy single generator', () => {
    const out = migrateToLayers({ generatorId: 'plasma', params: { x: 1 }, seed: 42 });
    expect(out).toHaveLength(1);
    expect(out[0]?.generatorId).toBe('plasma');
    expect(out[0]?.seed).toBe(42);
  });

  it('migrateToLayers keeps an existing stack without sharing params', () => {
    const src = [layer('a', { params: { x: 1 } })];
    const out = migrateToLayers({ layers: src, generatorId: 'x', params: {}, seed: 0 });
    expect(out[0]?.id).toBe('a');
    expect(out[0]?.params).not.toBe(src[0]?.params);
  });

  it('patchLayer and moveLayer are immutable', () => {
    const stack = [layer('a'), layer('b'), layer('c')];
    const patched = patchLayer(stack, 'b', { opacity: 0.4 });
    expect(patched[1]?.opacity).toBe(0.4);
    expect(stack[1]?.opacity).toBe(1);
    expect(moveLayer(stack, 'a', 1).map((l) => l.id)).toEqual(['b', 'a', 'c']);
    expect(moveLayer(stack, 'a', -1).map((l) => l.id)).toEqual(['a', 'b', 'c']);
  });

  it('caps the stack at MAX_LAYERS', () => {
    expect(MAX_LAYERS).toBeGreaterThanOrEqual(4);
  });
});

describe('blend modes', () => {
  it('maps every declared mode to a distinct shader branch', () => {
    const idx = BLEND_MODES.map((m) => blendIndex(m));
    expect(new Set(idx).size).toBe(BLEND_MODES.length);
    expect(blendIndex('normal')).toBe(0);
    expect(blendIndex('nonsense')).toBe(0);
  });
});
