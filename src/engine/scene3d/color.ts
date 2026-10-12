// sRGB <-> linear-srgb (IEC 61966-2-1) helpers for the scene3d pipeline.
// Palette hex colors are authored in sRGB; three.js renders in linear working
// space with an OutputPass encode at the end. Feeding sRGB values straight
// into vertex colors double-brightens them (washed mid-grey background,
// clipped white highlights). Convert once on the CPU instead.
export function srgbChannelToLinear(v: number): number {
  const c = Math.min(1, Math.max(0, v));
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function linearChannelToSrgb(v: number): number {
  const c = Math.min(1, Math.max(0, v));
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/** Hex sRGB string -> linear-srgb triple for shaders/lights. */
export function hexToLinear(hex: string): readonly [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m?.[1]) return [1, 0, 1];
  const n = m[1] as string;
  return [
    srgbChannelToLinear(parseInt(n.slice(0, 2), 16) / 255),
    srgbChannelToLinear(parseInt(n.slice(2, 4), 16) / 255),
    srgbChannelToLinear(parseInt(n.slice(4, 6), 16) / 255),
  ];
}

/** sRGB triple in [0,1] -> linear-srgb triple. */
export function srgbTripleToLinear(rgb: readonly [number, number, number]): readonly [number, number, number] {
  return [srgbChannelToLinear(rgb[0]), srgbChannelToLinear(rgb[1]), srgbChannelToLinear(rgb[2])];
}
