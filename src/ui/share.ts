// Shareable URL encoding: seed + generator + params + post in location.hash.
import type { PostSettings } from '../engine/post.ts';
import type { Params } from '../engine/types.ts';
import type { Snapshot } from './store.ts';

export interface SharePayload {
  readonly s: number;
  readonly g: string;
  readonly p: Params;
  readonly post: PostSettings;
}

export function encodeShare(sn: Snapshot): string {
  const payload: SharePayload = { s: sn.seed, g: sn.generatorId, p: sn.params, post: sn.post };
  const json = JSON.stringify(payload);
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeShare(hash: string): SharePayload | null {
  try {
    const b64 = hash.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(escape(atob(b64)));
    const o = JSON.parse(json) as Partial<SharePayload>;
    if (typeof o.s !== 'number' || typeof o.g !== 'string' || typeof o.p !== 'object' || !o.p) {
      return null;
    }
    return o as SharePayload;
  } catch {
    return null;
  }
}

export function readShareFromUrl(): SharePayload | null {
  if (typeof window === 'undefined') return null;
  const h = window.location.hash.replace(/^#/, '');
  if (!h) return null;
  return decodeShare(h);
}
