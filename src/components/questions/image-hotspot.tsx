"use client"

import { useRef, useCallback } from "react"
import { Trash2 } from "lucide-react"

interface HotspotOption {
  text: string
  isCorrect: boolean
  x?: number
  y?: number
}

interface ImageHotspotProps {
  imageUrl: string
  options: HotspotOption[]
  onChange: (index: number, x: number, y: number) => void
  onTextChange: (index: number, text: string) => void
  onDelete?: (index: number) => void
  labels?: string[]
}

export default function ImageHotspot({ imageUrl, options, onChange, onTextChange, onDelete, labels }: ImageHotspotProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<{ index: number } | null>(null)

  const getPos = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: Math.round(((clientX - rect.left) / rect.width) * 100),
      y: Math.round(((clientY - rect.top) / rect.height) * 100),
    }
  }, [])

  const handlePointerDown = useCallback((index: number) => (e: React.PointerEvent) => {
    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    dragging.current = { index }
    const pos = getPos(e.clientX, e.clientY)
    onChange(index, pos.x, pos.y)
  }, [getPos, onChange])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return
    const pos = getPos(e.clientX, e.clientY)
    onChange(dragging.current.index, pos.x, pos.y)
  }, [getPos, onChange])

  const handlePointerUp = useCallback(() => {
    dragging.current = null
  }, [])

  const circleLabels = labels ?? options.map((_, i) => String(i + 1))

  return (
    <div className="space-y-4">
      <div
        ref={containerRef}
        className="relative rounded-2xl overflow-hidden border border-outline-variant bg-surface-container-low select-none touch-none"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <img src={imageUrl} alt="Hotspot" className="w-full h-auto block pointer-events-none" draggable={false} />

        {options.map((opt, i) => {
          const left = opt.x ?? 10 + (i * 15)
          const top = opt.y ?? 30 + (i * 20)
          return (
            <div
              key={i}
              className="absolute flex items-center justify-center size-10 rounded-full bg-primary text-white font-bold text-sm cursor-grab active:cursor-grabbing shadow-lg border-2 border-white/60 hover:bg-primary/90 transition-colors select-none touch-none"
              style={{ left: `${left}%`, top: `${top}%`, transform: "translate(-50%, -50%)" }}
              onPointerDown={handlePointerDown(i)}
            >
              {circleLabels[i]}
            </div>
          )
        })}
      </div>

      <div className="space-y-2">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-3 bg-surface-container-lowest rounded-xl px-4 py-3 border border-outline-variant/30">
            <div className="size-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm shrink-0">
              {circleLabels[i]}
            </div>
            <input
              type="text"
              defaultValue={opt.text}
              onBlur={(e) => onTextChange(i, e.target.value)}
              placeholder={`Option ${i + 1} label…`}
              className="flex-1 bg-transparent border-none focus:outline-none text-body-md text-on-surface"
            />
            {onDelete && options.length > 1 && (
              <button
                type="button"
                onClick={() => onDelete(i)}
                className="p-1.5 rounded-lg text-on-surface-variant hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
