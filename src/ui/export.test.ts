import { afterEach, describe, expect, it } from 'vitest';
import { useAppStore } from './store.ts';

afterEach(() => {
  useAppStore.getState().resetExport();
});

describe('export job state', () => {
  it('tracks working -> progress -> done', () => {
    const st = useAppStore.getState();
    st.setExportWorking('MP4 (WebCodecs)', 150);
    let s = useAppStore.getState();
    expect(s.exportStatus).toBe('working');
    expect(s.exportTotal).toBe(150);
    expect(s.exportFormatLabel).toBe('MP4 (WebCodecs)');
    expect(s.exportError).toBeNull();
    expect(s.exportDownload).toBeNull();

    useAppStore.getState().setExportProgress(75, 150);
    s = useAppStore.getState();
    expect(s.exportFrame).toBe(75);
    expect(s.exportTotal).toBe(150);

    useAppStore.getState().setExportDone({ url: 'blob:x', name: 'clip.mp4' });
    s = useAppStore.getState();
    expect(s.exportStatus).toBe('done');
    expect(s.exportDownload).toEqual({ url: 'blob:x', name: 'clip.mp4' });
  });

  it('reports errors and can be reset back to idle', () => {
    const st = useAppStore.getState();
    st.setExportError('encoder blew up');
    let s = useAppStore.getState();
    expect(s.exportStatus).toBe('error');
    expect(s.exportError).toBe('encoder blew up');

    useAppStore.getState().resetExport();
    s = useAppStore.getState();
    expect(s.exportStatus).toBe('idle');
    expect(s.exportFrame).toBe(0);
    expect(s.exportTotal).toBe(0);
    expect(s.exportError).toBeNull();
    expect(s.exportDownload).toBeNull();
  });

  it('persists format + filename preferences', () => {
    const st = useAppStore.getState();
    st.setExportFormat('webm');
    st.setExportFilename('my-clip');
    const s = useAppStore.getState();
    expect(s.exportFormat).toBe('webm');
    expect(s.exportFilename).toBe('my-clip');
    useAppStore.getState().setExportFormat('auto');
    useAppStore.getState().setExportFilename('videobg-export');
  });
});
