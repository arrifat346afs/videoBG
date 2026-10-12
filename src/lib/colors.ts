/** Normalize a hex string (with or without #), 3- or 6-digit. Returns null if invalid. */
export function normalizeHex(input: string): string | null {
  let h = input.trim().replace(/^#/, "")
  if (/^[0-9a-fA-F]{3}$/.test(h)) {
    h = h.split("").map((c) => c + c).join("")
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null
  return `#${h.toLowerCase()}`
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = normalizeHex(hex) ?? "#ffffff"
  const v = parseInt(n.slice(1), 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0")
  return `#${c(r)}${c(g)}${c(b)}`
}

export const DEFAULT_SWATCHES = [
  "#000000", "#1f2937", "#6b7280", "#ffffff",
  "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6",
  "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1",
  "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
  "#f43f5e", "#fb7185", "#fda4af", "#fecdd3",
]
