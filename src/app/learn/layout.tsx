"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useSession, useProfile } from "@/hooks/use-auth"
import { Loader2, LogOut, Settings, ChevronDown, X } from "lucide-react"

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  const { data: session, isLoading: sessionLoading } = useSession()
  const { data: profile } = useProfile()
  const router = useRouter()
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const name = profile?.name || ""
  const email = profile?.email || session?.user?.email || ""
  const initials = (name || email)
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  useEffect(() => {
    if (!sessionLoading && !session) {
      router.push("/login")
    }
  }, [session, sessionLoading, router])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  if (sessionLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!session) return null

  return (
    <>
      <div className="min-h-screen bg-background">
        <header className="border-b border-outline-variant/20 bg-surface">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/screen.png" alt="RijTheorie Pro" className="h-8 w-auto" />
              <span className="text-label-md font-semibold text-primary">RijTheorie Pro</span>
            </div>
            <div className="flex items-center gap-4">
              <a href="/" className="text-label-sm text-on-surface-variant hover:text-primary transition-colors">Home</a>
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 hover:bg-surface-container rounded-full py-1 pl-1 pr-2 transition-all active:scale-95"
                >
                  <span className="size-8 rounded-full bg-primary flex items-center justify-center text-on-primary text-label-sm font-bold shrink-0">
                    {initials || "?"}
                  </span>
                  <span className="text-label-sm font-semibold text-on-surface hidden sm:block max-w-[120px] truncate">{name || email}</span>
                  <ChevronDown size={16} className="text-on-surface-variant" />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 top-11 w-64 bg-surface shadow-lg rounded-2xl border border-outline-variant/30 overflow-hidden z-50">
                    <div className="px-4 py-4 border-b border-outline-variant/20">
                      <p className="text-label-md font-bold text-primary truncate">{name || email}</p>
                      <p className="text-label-xs text-on-surface-variant truncate mt-0.5">{email}</p>
                    </div>
                    <div className="py-1">
                      <button
                        onClick={() => { router.push("/dashboard/settings"); setDropdownOpen(false) }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-label-md text-on-surface hover:bg-surface-container transition-colors"
                      >
                        <Settings size={18} className="text-on-surface-variant" />
                        Instellingen
                      </button>
                    </div>
                    <div className="border-t border-outline-variant/20 py-1">
                      <button
                        onClick={() => { setDropdownOpen(false); setLogoutOpen(true) }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-label-md text-error hover:bg-red-50 transition-colors"
                      >
                        <LogOut size={18} />
                        Uitloggen
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>
        <div className="max-w-5xl mx-auto px-4 py-8">{children}</div>
      </div>
      {logoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-xs" onClick={() => setLogoutOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <button onClick={() => setLogoutOpen(false)} className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface">
              <X size={20} />
            </button>
            <h3 className="text-headline-md text-primary mb-2">Uitloggen</h3>
            <p className="text-body-md text-on-surface-variant mb-6">Weet je zeker dat je wilt uitloggen?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setLogoutOpen(false)} className="px-5 py-2.5 rounded-xl border border-outline-variant text-label-md font-bold text-on-surface-variant hover:bg-surface-container transition-all">
                Annuleren
              </button>
              <button
                onClick={async () => { await supabase.auth.signOut(); router.push("/") }}
                className="px-5 py-2.5 rounded-xl bg-error text-on-error text-label-md font-bold hover:opacity-90 transition-all flex items-center gap-2"
              >
                <LogOut size={16} />
                Uitloggen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
