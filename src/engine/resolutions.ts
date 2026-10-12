import type { Resolution, ResolutionPresetId } from './types.ts';

export const RESOLUTIONS: Record<ResolutionPresetId, Resolution> = {
  '720p': { width: 1280, height: 720, label: '720p (1280×720)' },
  '1080p': { width: 1920, height: 1080, label: '1080p (1920×1080)' },
  '1440p': { width: 2560, height: 1440, label: '1440p (2560×1440)' },
  '4k': { width: 3840, height: 2160, label: '4K (3840×2160)' },
  vertical: { width: 1080, height: 1920, label: 'Vertical (1080×1920)' },
  square: { width: 1080, height: 1080, label: 'Square (1080×1080)' },
  std43: { width: 1600, height: 1200, label: 'Standard (1600×1200)' },
  wide21: { width: 2560, height: 1080, label: 'Ultrawide (2560×1080)' },
};

export function getResolution(id: ResolutionPresetId): Resolution {
  return RESOLUTIONS[id] ?? RESOLUTIONS['1080p'];
}

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y !== 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x || 1;
}

/** Short aspect label, e.g. "16:9". Ultrawide snaps to 21:9. */
export function aspectLabel(width: number, height: number): string {
  if (width <= 0 || height <= 0) return '—';
  const r = width / height;
  if (Math.abs(r - 16 / 9) < 0.02) return '16:9';
  if (Math.abs(r - 9 / 16) < 0.02) return '9:16';
  if (Math.abs(r - 1) < 0.015) return '1:1';
  if (Math.abs(r - 4 / 3) < 0.02) return '4:3';
  if (Math.abs(r - 3 / 4) < 0.02) return '3:4';
  if (Math.abs(r - 21 / 9) < 0.05) return '21:9';
  const g = gcd(width, height);
  return `${Math.round(width / g)}:${Math.round(height / g)}`;
}

/** "1920×1080 (16:9)" for preset dropdowns. */
export function resolutionLabel(width: number, height: number): string {
  return `${width}×${height} (${aspectLabel(width, height)})`;
}
