import { useMemo, useRef, useState } from "react"
import { Check, Pipette } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import { DEFAULT_SWATCHES, hexToRgb, normalizeHex, rgbToHex } from "@/lib/colors"

interface ColorPickerProps {
  value: string
  onChange: (hex: string) => void
  label?: string
  presets?: string[]
}

export function ColorPicker({ value, onChange, label, presets }: ColorPickerProps) {
  const [open, setOpen] = useState(false)
  const draftRef = useRef(value)
  const rgbRef = useRef<[number, number, number]>(hexToRgb(value))

  // Track prop changes without setState-in-effect (reading refs during render
  // is safe; React docs endorse this pattern for form editors).
  const prevValueRef = useRef(value)
  if (prevValueRef.current !== value) {
    prevValueRef.current = value
    draftRef.current = value
    rgbRef.current = hexToRgb(value)
  }

  const draft = draftRef.current
  const rgb = rgbRef.current
  const current = normalizeHex(draftRef.current) ?? value

  const swatches = useMemo(() => {
    const extra = (presets ?? []).map((c) => normalizeHex(c)).filter((c): c is string => !!c)
    return [...extra, ...DEFAULT_SWATCHES].slice(0, 32)
  }, [presets])

  const commitHex = (hex: string) => {
    const n = normalizeHex(hex)
    if (n) {
      draftRef.current = n
      rgbRef.current = hexToRgb(n)
      onChange(n)
    } else {
      draftRef.current = hex
    }
  }

  const commitRgb = (next: [number, number, number]) => {
    rgbRef.current = next
    const hex = rgbToHex(next[0], next[1], next[2])
    draftRef.current = hex
    onChange(hex)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-8 w-11 shrink-0 p-1"
          style={{ background: "transparent" }}
          title={label ? `Edit ${label} (${current})` : `Edit color (${current})`}
          aria-label={label ? `Edit ${label}, current ${current}` : `Edit color ${current}`}
        >
          <span
            className="block h-full w-full rounded-[4px] border"
            style={{ background: current }}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-3" align="start">
        <div className="flex items-center gap-2">
          <span
            className="h-9 w-9 shrink-0 rounded-md border"
            style={{ background: current }}
          />
          <div className="min-w-0 flex-1">
            <Label htmlFor="color-hex" className="text-xs text-muted-foreground">
              {label ?? "Color"} · hex
            </Label>
            <Input
              id="color-hex"
              value={draft}
              maxLength={7}
              spellCheck={false}
              className="h-8 font-mono"
              onChange={(e) => commitHex(e.target.value)}
              placeholder="#ffffff"
            />
          </div>
          <Pipette className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </div>

        <div className="space-y-2">
          {(["R", "G", "B"] as const).map((ch, i) => (
            <div key={ch} className="flex items-center gap-2">
              <span className="w-3 text-xs font-medium text-muted-foreground">{ch}</span>
              <Slider
                value={[rgb[i] ?? 0]}
                min={0}
                max={255}
                step={1}
                aria-label={`${label ?? "Color"} ${ch}`}
                onValueChange={([v]) => {
                  const next: [number, number, number] = [...rgb]
                  next[i] = v ?? 0
                  commitRgb(next)
                }}
              />
              <span className="w-8 text-right font-mono text-xs text-muted-foreground">
                {rgb[i]}
              </span>
            </div>
          ))}
        </div>

        <div>
          <p className="mb-1.5 text-xs text-muted-foreground">Swatches</p>
          <div className="grid grid-cols-8 gap-1.5">
            {swatches.map((c) => {
              const active = normalizeHex(c) === normalizeHex(current)
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => commitHex(c)}
                  title={c}
                  aria-label={`Use color ${c}`}
                  aria-pressed={active}
                  className={cn(
                    "relative aspect-square rounded-md border transition-transform hover:scale-110",
                    active && "ring-2 ring-ring ring-offset-2 ring-offset-background"
                  )}
                  style={{ background: c }}
                >
                  {active && (
                    <Check className="absolute inset-0 m-auto size-3 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
