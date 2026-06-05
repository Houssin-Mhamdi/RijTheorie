"use client"

import { type ReactNode } from "react"
import { cn } from "@/lib/utils"

interface StatsCardProps {
  label: string
  value: string | number
  children?: ReactNode
  className?: string
}

export default function StatsCard({ label, value, children, className }: StatsCardProps) {
  return (
    <div className={cn("bg-surface-container-lowest p-6 rounded-2xl shadow-[0px_4px_20px_rgba(26,60,110,0.05)] border border-surface-container", className)}>
      <p className="text-label-md text-on-surface-variant mb-1">{label}</p>
      <p className="text-headline-md font-bold text-primary">{value}</p>
      {children && <div className="mt-2 text-label-sm">{children}</div>}
    </div>
  )
}
