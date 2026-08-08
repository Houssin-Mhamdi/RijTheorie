"use client"

import { useState } from "react"
import { ImageOff } from "lucide-react"
import { cn } from "@/lib/utils"

interface SmartImageProps {
  src: string
  alt?: string
  className?: string
  lazy?: boolean
}

export default function SmartImage({ src, alt = "", className, lazy = true }: SmartImageProps) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className={cn("flex items-center justify-center bg-surface-container text-outline", className)}>
        <ImageOff size={20} className="opacity-60" />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={lazy ? "lazy" : "eager"}
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
    />
  )
}
