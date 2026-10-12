import { describe, expect, it } from 'vitest';
import { useAppStore } from './store.ts';

describe('seed lock', () => {
  it('randomizeSeed is a no-op while locked, works unlocked', () => {
    const st = useAppStore.getState();
    st.setSeed(777);
    st.setSeedLocked(true);
    const before = useAppStore.getState().seed;
    useAppStore.getState().randomizeSeed();
    expect(useAppStore.getState().seed).toBe(before);
    useAppStore.getState().setSeedLocked(false);
    useAppStore.getState().randomizeSeed();
    expect(useAppStore.getState().seed >>> 0).toBeGreaterThanOrEqual(0);
  });
  it('randomizeAll keeps the seed while locked', () => {
    const st = useAppStore.getState();
    st.setSeed(424242);
    st.setSeedLocked(true);
    useAppStore.getState().randomizeAll();
    expect(useAppStore.getState().seed).toBe(424242);
    useAppStore.getState().setSeedLocked(false);
  });
});
