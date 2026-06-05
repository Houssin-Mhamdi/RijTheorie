"use client"

import { useRef, useState, useCallback } from "react"
import { Play, Pause, Minus, Plus, Trash2 } from "lucide-react"
import { useVideoPoster } from "@/hooks/use-video-poster"

interface HotspotOption {
  text: string
  isCorrect: boolean
  x?: number
  y?: number
}

interface VideoHotspotProps {
  videoUrl: string
  options: HotspotOption[]
  onChange: (index: number, x: number, y: number) => void
  onTextChange: (index: number, text: string) => void
  onDelete?: (index: number) => void
  pauseAt?: number
}

export default function VideoHotspot({ videoUrl, options, onChange, onTextChange, onDelete, pauseAt = 3 }: VideoHotspotProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<{ index: number } | null>(null)
  const poster = useVideoPoster(videoUrl)
  const [playing, setPlaying] = useState(false)
  const [paused, setPaused] = useState(false)
  const [showOverlay, setShowOverlay] = useState(true)
  const [pauseTime, setPauseTime] = useState(pauseAt)

  const [prevVideoUrl, setPrevVideoUrl] = useState(videoUrl)

  if (videoUrl !== prevVideoUrl) {
    setPrevVideoUrl(videoUrl)
    setPlaying(false)
    setPaused(false)
    setShowOverlay(true)
    setPauseTime(pauseAt)
  }

  function handleTimeUpdate() {
    const video = videoRef.current
    if (!video || !playing) return
    if (video.currentTime >= pauseTime) {
      video.pause()
      setPlaying(false)
      setPaused(true)
      setShowOverlay(false)
    }
  }

  function handlePlay() {
    const video = videoRef.current
    if (!video) return
    if (video.currentTime >= pauseTime) video.currentTime = 0
    setShowOverlay(false)
    setPaused(false)
    video.play()
    setPlaying(true)
  }

  function handleRestart() {
    const video = videoRef.current
    if (!video) return
    video.currentTime = 0
    setPaused(false)
    setShowOverlay(false)
    video.play()
    setPlaying(true)
  }

  const getPos = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: Math.round(((clientX - rect.left) / rect.width) * 100),
      y: Math.round(((clientY - rect.top) / rect.height) * 100),
    }
  }, [])

  const handlePointerDown = useCallback((index: number) => (e: React.PointerEvent) => {
    if (!paused && !showOverlay) return
    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    dragging.current = { index }
    const pos = getPos(e.clientX, e.clientY)
    onChange(index, pos.x, pos.y)
  }, [getPos, onChange, paused, showOverlay])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current || !paused) return
    const pos = getPos(e.clientX, e.clientY)
    onChange(dragging.current.index, pos.x, pos.y)
  }, [getPos, onChange, paused])

  const handlePointerUp = useCallback(() => {
    dragging.current = null
  }, [])

  function adjustTime(delta: number) {
    setPauseTime((t) => Math.max(0.5, Math.round((t + delta) * 10) / 10))
  }

  return (
    <div className="space-y-4">
      <div
        ref={containerRef}
        className="relative rounded-2xl overflow-hidden border border-outline-variant bg-neutral-950 select-none touch-none"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          poster={poster}
          className="w-full max-h-[400px] block pointer-events-none"
          playsInline
          preload="auto"
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => { setPlaying(false); setPaused(true); setShowOverlay(false) }}
        />

        {showOverlay && (
          <button
            type="button"
            onClick={handlePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/50 transition-colors cursor-pointer"
          >
            <div className="size-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg hover:scale-105 transition-transform">
              <Play size={28} className="text-primary ml-1" />
            </div>
          </button>
        )}

        {!showOverlay && !playing && (
          <button
            type="button"
            onClick={handleRestart}
            className="absolute top-3 right-3 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors z-10"
          >
            <Pause size={16} />
          </button>
        )}

        {paused && options.map((opt, i) => {
          const left = opt.x ?? 10 + (i * 15)
          const top = opt.y ?? 30 + (i * 20)
          return (
            <div
              key={i}
              className="absolute flex items-center justify-center size-10 rounded-full bg-primary text-white font-bold text-sm cursor-grab active:cursor-grabbing shadow-lg border-2 border-white/60 hover:bg-primary/90 transition-colors select-none touch-none"
              style={{ left: `${left}%`, top: `${top}%`, transform: "translate(-50%, -50%)" }}
              onPointerDown={handlePointerDown(i)}
            >
              {i + 1}
            </div>
          )
        })}

        {!showOverlay && !paused && playing && (
          <div className="absolute bottom-3 left-3 bg-black/60 text-white text-label-sm px-3 py-1 rounded-full">
            Playing…
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => adjustTime(-0.5)}
          disabled={playing}
          className="p-2 rounded-xl border border-outline-variant text-on-surface-variant hover:bg-surface-container-low transition-colors disabled:opacity-30"
        >
          <Minus size={18} />
        </button>
        <div className="flex items-center gap-2 bg-surface-container-lowest rounded-xl px-4 py-2 border border-outline-variant/30">
          <span className="text-label-sm text-on-surface-variant">Pause at</span>
          <span className="text-headline-sm text-primary font-bold tabular-nums">{pauseTime.toFixed(1)}s</span>
        </div>
        <button
          type="button"
          onClick={() => adjustTime(0.5)}
          disabled={playing}
          className="p-2 rounded-xl border border-outline-variant text-on-surface-variant hover:bg-surface-container-low transition-colors disabled:opacity-30"
        >
          <Plus size={18} />
        </button>
      </div>

      {paused && (
        <div className="space-y-2">
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-3 bg-surface-container-lowest rounded-xl px-4 py-3 border border-outline-variant/30">
              <div className="size-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm shrink-0">
                {i + 1}
              </div>
              <input
                type="text"
                defaultValue={opt.text}
                onBlur={(e) => onTextChange(i, e.target.value)}
                placeholder={`Vehicle ${i + 1} label…`}
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
      )}
    </div>
  )
}
