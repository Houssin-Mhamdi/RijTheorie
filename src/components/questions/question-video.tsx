"use client"

import { useEffect, useRef } from "react"

/**
 * A React-safe <video> wrapper that prevents the mobile `removeChild`
 * NotFoundError. The crash happens when React unmounts a <video> the browser
 * is still managing (e.g. during navigation in the exam). We avoid it by:
 *
 *  - controlling the src via a ref (React never sets/unsets the src attr,
 *    so React holds no stale node/attribute reference to reconcile),
 *  - pausing + clearing src in the cleanup so the browser is not mid-playback
 *    when React removes the element from the DOM.
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

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    el.src = src
    if (autoPlay) {
      el.play().catch(() => {})
    }
    return () => {
      // Tear down cleanly so the browser isn't holding the element when
      // React removes it from the DOM (prevents removeChild crash on mobile).
      try {
        el.pause()
        el.removeAttribute("src")
        el.load()
      } catch {
        /* ignore teardown errors */
      }
    }
  }, [src, autoPlay])

  return <video ref={videoRef} controls className={className} playsInline preload="metadata" />
}