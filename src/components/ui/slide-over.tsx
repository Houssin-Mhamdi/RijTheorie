"use client"

import { useEffect } from "react"
import { X } from "lucide-react"

interface SlideOverProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export default function SlideOver({ open, onClose, title, description, children, footer }: SlideOverProps) {
  const isRtl = typeof document !== "undefined" && document.documentElement.dir === "rtl"

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [open])

  const positionClass = isRtl ? "left-0" : "right-0"
  const closedClass = isRtl ? "-translate-x-full" : "translate-x-full"

  return (
    <>
      <div
        className={`fixed inset-0 bg-primary/20 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      <div
        className={`fixed top-0 ${positionClass} h-screen w-full md:w-[600px] bg-surface shadow-2xl z-50 transform transition-transform duration-500 ease-in-out flex flex-col ${
          open ? "translate-x-0" : closedClass
        }`}
      >
        <div className="p-6 border-b border-outline-variant flex justify-between items-center bg-surface-bright sticky top-0">
          <div>
            <h3 className="text-headline-md text-primary">{title}</h3>
            {description && <p className="text-label-md text-on-surface-variant">{description}</p>}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-container-high rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8 pb-32">
          {children}
        </div>

        {footer && (
          <div className="p-6 border-t border-outline-variant bg-surface-bright sticky bottom-0">{footer}</div>
        )}
      </div>
    </>
  )
}
