"use client"

import { useState } from "react"

interface SmartImageProps {
  src: string
  alt?: string
  className?: string
  lazy?: boolean
}

// A 1x1 transparent data URI used as a fallback when the real image fails to load.
const FALLBACK_SRC =
  "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="

export default function SmartImage({ src, alt = "", className, lazy = true }: SmartImageProps) {
  const [failed, setFailed] = useState(false)

  return (
    <img
      src={failed ? FALLBACK_SRC : src}
      alt={alt}
      loading={lazy ? "lazy" : "eager"}
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
    />
  )
}
