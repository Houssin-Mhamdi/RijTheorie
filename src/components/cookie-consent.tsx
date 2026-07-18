"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Cookie, X } from "lucide-react"

export function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem("cookie-consent")
    if (!stored) setVisible(true)
  }, [])

  function accept() {
    localStorage.setItem("cookie-consent", "accepted")
    setVisible(false)
    window.dispatchEvent(new Event("cookie-consent-accepted"))
  }

  function reject() {
    localStorage.setItem("cookie-consent", "rejected")
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4">
      <div className="mx-auto max-w-2xl bg-white rounded-2xl shadow-xl border border-outline-variant/30 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Cookie size={20} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-body-sm text-on-surface">
            Deze site gebruikt cookies voor authenticatie en analyse (Microsoft Clarity). 
            Alleen noodzakelijke cookies worden geplaatst zonder toestemming.{" "}
            <Link href="/privacy" className="text-primary font-semibold underline underline-offset-2">
              Lees meer
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={reject}
            className="px-4 py-2 rounded-xl text-label-sm font-bold text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            Alleen noodzakelijk
          </button>
          <button
            onClick={accept}
            className="px-5 py-2 rounded-xl text-label-sm font-bold bg-primary text-on-primary hover:bg-primary/90 transition-colors active:scale-95"
          >
            Accepteren
          </button>
        </div>
      </div>
    </div>
  )
}
