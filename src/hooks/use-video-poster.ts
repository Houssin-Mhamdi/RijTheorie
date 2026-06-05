import { useEffect, useState, useRef } from "react"

export function useVideoPoster(videoUrl: string | null, seekTime = 0) {
  const [poster, setPoster] = useState<string | undefined>(undefined)
  const posterRef = useRef(poster)

  useEffect(() => {
    if (!videoUrl) {
      setPoster(undefined)
      return
    }

    if (posterRef.current) {
      posterRef.current = undefined
    }
    setPoster(undefined)

    let cancelled = false
    const video = document.createElement("video")
    video.crossOrigin = "anonymous"
    video.preload = "auto"
    video.muted = true
    video.playsInline = true
    video.src = videoUrl

    function capture() {
      if (cancelled || video.readyState < 2) return
      video.currentTime = seekTime
    }

    function onSeeked() {
      if (cancelled) return
      const canvas = document.createElement("canvas")
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 360
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL("image/jpeg", 0.6)
      posterRef.current = dataUrl
      if (!cancelled) setPoster(dataUrl)
    }

    video.addEventListener("loadeddata", capture, { once: true })
    video.addEventListener("seeked", onSeeked, { once: true })
    video.load()

    return () => {
      cancelled = true
      video.removeAttribute("src")
      video.load()
    }
  }, [videoUrl, seekTime])

  return poster
}
