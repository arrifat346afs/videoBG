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
});
