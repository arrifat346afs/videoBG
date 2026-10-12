import { describe, expect, it } from 'vitest';
import { DEFAULT_POST } from '../engine/post.ts';
import { decodeShare, encodeShare } from './share.ts';

describe('share encoding', () => {
  it('round-trips seed + params + post', () => {
    const snap = {
      seed: 12345,
      generatorId: 'domain-warp',
      params: { scale: 2.2, marble: false },
      post: { ...DEFAULT_POST },
    };
    const h = encodeShare(snap);
    expect(h).not.toContain('+');
    expect(h).not.toContain('/');
    const back = decodeShare(h);
    expect(back?.s).toBe(12345);
    expect(back?.g).toBe('domain-warp');
    expect(back?.p).toEqual({ scale: 2.2, marble: false });
  });
  it('rejects garbage', () => {
    expect(decodeShare('!!!')).toBeNull();
  });
  it('round-trips a mix stack', () => {
    const snap = {
      seed: 7,
      generatorId: 'wave-mesh',
      params: { scale: 1 },
      post: { ...DEFAULT_POST },
      activeLayer: 1,
      layers: [
        {
          id: 'l1',
          generatorId: 'wave-mesh',
          params: { scale: 1 },
          seed: 7,
          opacity: 1,
          blend: 'normal' as const,
          visible: true,
          solo: false,
        },
        {
          id: 'l2',
          generatorId: 'vector-waves',
          params: { scale: 3 },
          seed: 99,
          opacity: 0.5,
          blend: 'screen' as const,
          visible: true,
          solo: false,
        },
      ],
    };
    const back = decodeShare(encodeShare(snap));
    expect(back?.layers).toHaveLength(2);
    expect(back?.activeLayer).toBe(1);
    expect(back?.layers?.[1]?.blend).toBe('screen');
  });
  it('decodes legacy payloads without layers', () => {
    const legacy = btoa(
      unescape(encodeURIComponent(JSON.stringify({ s: 3, g: 'plasma', p: {}, post: DEFAULT_POST }))),
    )
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const back = decodeShare(legacy);
    expect(back?.g).toBe('plasma');
    expect(back?.layers).toBeUndefined();
  });
});
