"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import { Play, CheckCircle, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useVideoPoster } from "@/hooks/use-video-poster"

interface HotspotOption {
  text: string
  x?: number
  y?: number
}

interface StudentHotspotProps {
  media: string
  mediaMime: string | null
  correctOptions: HotspotOption[]
  onComplete: (positions: { x: number; y: number }[]) => void
  initialPositions?: { x: number; y: number }[]
  initialSubmitted?: boolean
  validationResults?: { index: number; correct: boolean; distance: number | null }[]
  pauseAt?: number
  optionLabels?: string[]
}

const TOLERANCE = 8
const SNAP_DIST = 6

function isWithin(a: number, b: number, tol: number) {
  return Math.abs(a - b) <= tol
}

export default function StudentHotspot({ media, mediaMime, correctOptions, onComplete, initialPositions, initialSubmitted, validationResults, pauseAt = 3, optionLabels }: StudentHotspotProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const dragging = useRef<{ index: number } | null>(null)
  const positionsRef = useRef(initialPositions ?? correctOptions.map((_, i) => ({ x: 15 + i * 22, y: 88 })))

  const isVideo = mediaMime?.startsWith("video/")
  const poster = useVideoPoster(isVideo ? media : null, pauseAt)

  const [playing, setPlaying] = useState(false)
  const [paused, setPaused] = useState(false)
  const [showOverlay, setShowOverlay] = useState(isVideo && !initialSubmitted)

  const [studentPositions, setStudentPositions] = useState<{ x: number; y: number }[]>(() =>
    initialPositions ?? correctOptions.map((_, i) => ({ x: 15 + i * 22, y: 88 })),
  )
  const [submitted, setSubmitted] = useState(initialSubmitted ?? false)

  useEffect(() => {
    if (!isVideo || !videoRef.current) return
    const video = videoRef.current
    function onTimeUpdate() {
      if (video.currentTime >= pauseAt) {
        video.pause()
        setPlaying(false)
        setPaused(true)
        setShowOverlay(false)
      }
    }
    video.addEventListener("timeupdate", onTimeUpdate)
    return () => video.removeEventListener("timeupdate", onTimeUpdate)
  }, [isVideo])

  useEffect(() => {
    positionsRef.current = studentPositions
  }, [studentPositions])

  function handlePlay() {
    const video = videoRef.current
    if (!video) return
    if (video.currentTime >= pauseAt) video.currentTime = 0
    setShowOverlay(false)
    setPaused(false)
    setPlaying(true)
    video.play()
  }

  function handleRestart() {
    const video = videoRef.current
    if (!video) return
    video.currentTime = 0
    setShowOverlay(false)
    setPaused(false)
    setPlaying(true)
    video.play()
  }

  const getPos = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: Math.round(((clientX - rect.left) / rect.width) * 100),
      y: Math.round(((clientY - rect.top) / rect.height) * 100),
    }
  }, [])

  const handlePointerDown = useCallback(
    (index: number) => (e: React.PointerEvent) => {
      if (submitted) return
      if (isVideo && !paused) return
      e.preventDefault()
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      dragging.current = { index }
      const pos = getPos(e.clientX, e.clientY)
      setStudentPositions((prev) => {
        const next = [...prev]
        next[index] = pos
        return next
      })
    },
    [getPos, submitted, isVideo, paused],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragging.current
      if (!drag || submitted) return
      if (isVideo && !paused) return
      const pos = getPos(e.clientX, e.clientY)
      setStudentPositions((prev) => {
        const next = [...prev]
        next[drag.index] = pos
        return next
      })
    },
    [getPos, submitted, isVideo, paused],
  )

  const handlePointerUp = useCallback(() => {
    const drag = dragging.current
    dragging.current = null
    if (!drag) return
    setStudentPositions((prev) => {
      const dragPos = prev[drag.index]
      const targets = correctOptions.map((o) => ({ x: o.x, y: o.y }))
      let closest = -1
      let closestDist = Infinity
      targets.forEach((t, ti) => {
        if (t.x == null || t.y == null) return
        const d = Math.sqrt((dragPos.x - t.x) ** 2 + (dragPos.y - t.y) ** 2)
        if (d < closestDist) {
          closestDist = d
          closest = ti
        }
      })
      if (closest === -1 || closestDist > SNAP_DIST) return prev
      const targetPos = targets[closest]
      const next = [...prev]
      const occupant = next.findIndex((p) => p.x === targetPos.x && p.y === targetPos.y)
      if (occupant !== -1 && occupant !== drag.index) {
        next[occupant] = next[drag.index]
      }
      next[drag.index] = { x: targetPos.x!, y: targetPos.y! }
      return next
    })
  }, [correctOptions])

  const handleSubmit = useCallback(() => {
    setSubmitted(true)
    onComplete(positionsRef.current)
  }, [onComplete])

  const getOptionState = (idx: number) => {
    if (!submitted) return "idle"
    if (validationResults) {
      const r = validationResults.find(v => v.index === idx)
      if (!r) return "idle"
      return r.correct ? "correct" : "wrong"
    }
    const student = studentPositions[idx]
    const correct = correctOptions[idx]
    if (correct.x != null && correct.y != null) {
      const match = isWithin(student.x, correct.x, TOLERANCE) && isWithin(student.y, correct.y, TOLERANCE)
      return match ? "correct" : "wrong"
    }
    return "idle"
  }

  return (
    <div className="space-y-4">
      <div
        ref={containerRef}
        className="relative rounded-2xl overflow-hidden border border-outline-variant bg-surface-container-low select-none touch-none"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {isVideo ? (
          <>
            <video
              ref={videoRef}
              src={media}
              poster={poster}
              className="w-full max-h-[500px] block pointer-events-none"
              playsInline
              preload="auto"
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
                <Play size={16} />
              </button>
            )}
          </>
        ) : (
          <img src={media} alt="Hotspot" className="w-full h-auto block pointer-events-none" draggable={false} />
        )}

        {!showOverlay && (
          <>
            {(!isVideo || paused) && correctOptions.map((opt, i) => {
              if (opt.x == null || opt.y == null) return null
              return (
                <div
                  key={`target-${i}`}
                  className="absolute flex items-center justify-center size-12 rounded-full bg-neutral-300/40 border-2 border-dashed border-neutral-400/60 pointer-events-none"
                  style={{
                    left: `${opt.x}%`,
                    top: `${opt.y}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <span className="text-neutral-400/60 text-xs font-bold">?</span>
                </div>
              )
            })}
            {studentPositions.map((pos, i) => {
              const state = getOptionState(i)
              const bgClass =
                state === "correct" ? "bg-green-500" : state === "wrong" ? "bg-red-500" : "bg-primary"
              const isDraggable = !submitted && (!isVideo || paused)
              return (
                <div
                  key={i}
                  className={`absolute flex items-center justify-center size-10 rounded-full text-white font-bold text-sm shadow-lg border-2 border-white/60 transition-colors select-none touch-none ${isDraggable ? "cursor-grab active:cursor-grabbing" : "cursor-default"} ${bgClass}`}
                  style={{
                    left: `${pos.x}%`,
                    top: `${pos.y}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                  onPointerDown={isDraggable ? handlePointerDown(i) : undefined}
                >
                  {i + 1}
                </div>
              )
            })}
          </>
        )}
      </div>

      {!submitted && !showOverlay && (
        <Button
          type="button"
          variant="secondary"
          size="lg"
          className="w-full"
          onClick={handleSubmit}
        >
          Controleer antwoord
        </Button>
      )}

      {submitted && (
        <div className="space-y-2">
          {correctOptions.map((opt, i) => {
            const state = getOptionState(i)
            const correct = correctOptions[i]
            const student = studentPositions[i]
            const dist = validationResults?.find(v => v.index === i)?.distance ??
              (correct.x != null && correct.y != null
                ? Math.round(Math.sqrt((student.x - correct.x) ** 2 + (student.y - correct.y) ** 2))
                : 0)
            return (
              <div
                key={i}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${state === "correct" ? "bg-green-50 border-green-200" : state === "wrong" ? "bg-red-50 border-red-200" : "bg-surface-container-lowest border-outline-variant/30"}`}
              >
                <div
                  className={`size-8 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${state === "correct" ? "bg-green-500" : state === "wrong" ? "bg-red-500" : "bg-primary"}`}
                >
                  {state === "correct" ? (
                    <CheckCircle size={16} className="fill-white text-green-600" />
                  ) : state === "wrong" ? (
                    <XCircle size={16} className="fill-white text-red-600" />
                  ) : (
                    i + 1
                  )}
                </div>
                <span className="flex-1 text-body-md text-on-surface">{optionLabels?.[i] ?? opt.text}</span>
                {state === "wrong" && (
                  <span className="text-label-sm text-red-600">Afstand: {dist}%</span>
                )}
                {state === "correct" && (
                  <span className="text-label-sm font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded">
                    CORRECT
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
