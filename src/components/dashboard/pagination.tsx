"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface PaginationProps {
  currentPage: number
  totalPages: number
  from: number
  to: number
  total: number
  onPageChange?: (page: number) => void
}

export default function Pagination({ currentPage, totalPages, from, to, total, onPageChange }: PaginationProps) {
  const pages = Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
    if (totalPages <= 5) return i + 1
    if (currentPage <= 3) return i + 1
    if (currentPage >= totalPages - 2) return totalPages - 4 + i
    return currentPage - 2 + i
  })

  return (
    <div className="flex items-center justify-between">
      <p className="text-label-sm text-on-surface-variant">Toon {from}-{to} van {total}</p>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange?.(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 hover:bg-surface-container rounded-lg text-on-surface-variant disabled:opacity-50 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        {pages.map((page) => (
          <button
            key={page}
            onClick={() => onPageChange?.(page)}
            className={cn(
              "size-8 flex items-center justify-center rounded-lg text-label-sm font-bold transition-colors",
              page === currentPage
                ? "bg-primary text-on-primary"
                : "hover:bg-surface-container text-on-surface-variant",
            )}
          >
            {page}
          </button>
        ))}
        <button
          onClick={() => onPageChange?.(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 hover:bg-surface-container rounded-lg text-on-surface-variant disabled:opacity-50 transition-colors"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  )
}
