"use client"

import { useEffect, useRef, useState } from "react"
import { Play } from "lucide-react"

/**
 * A React-safe <video> wrapper that prevents the mobile `removeChild`
 * NotFoundError (Android Chrome aggressively reclaims loading media elements,
 * which desyncs React's virtual DOM and causes the crash).
 *
 * Strategy:
 *  - No <video> is mounted until the user taps "play" (lazy mount), so no
 *    network data is loaded while merely viewing the question. When `autoPlay`
 *    is true it mounts and plays immediately (used in the results view where
 *    videos are muted thumbnails).
 *  - The src is controlled via a ref (React never sets/unsets the src attr
 *    directly, so React holds no stale node reference to reconcile).
 *  - On unmount we pause + clear src so the browser is not mid-playback when
 *    React removes the node.
 */
export default function QuestionVideo({
  src,
  className,
  autoPlay = false,
  muted = false,
}: {
  src: string
  className?: string
  autoPlay?: boolean
  muted?: boolean
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [started, setStarted] = useState(autoPlay)

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    el.muted = muted
    el.src = src
    if (autoPlay || started) {
      el.play().catch(() => {})
    }
    return () => {
      try {
        el.pause()
        el.removeAttribute("src")
        el.load()
      } catch {
        /* ignore teardown errors */
      }
    }
  }, [src, autoPlay, started, muted])

  if (!started) {
    return (
      <div className={`relative bg-neutral-950 ${className ? `${className} ` : ""}aspect-video`}>
        <button
          type="button"
          onClick={() => setStarted(true)}
          aria-label="Play video"
          className="absolute inset-0 flex items-center justify-center bg-neutral-950/40 hover:bg-neutral-950/50 transition-colors cursor-pointer"
        >
          <div className="size-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg hover:scale-105 transition-transform">
            <Play size={28} className="text-primary ml-1" />
          </div>
        </button>
      </div>
    )
  }

  return <video ref={videoRef} controls autoPlay={autoPlay} muted={muted} playsInline preload="none" className={className} />
}
