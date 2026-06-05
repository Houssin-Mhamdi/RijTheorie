"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useSession } from "@/hooks/use-auth"
import { Loader2 } from "lucide-react"

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  const { data: session, isLoading: sessionLoading } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (!sessionLoading && !session) {
      router.push("/login")
    }
  }, [session, sessionLoading, router])

  if (sessionLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!session) return null

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-outline-variant/20 bg-surface">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/screen.png" alt="RijTheorie Pro" className="h-8 w-auto" />
            <span className="text-label-md font-semibold text-primary">RijTheorie Pro</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="/" className="text-label-sm text-on-surface-variant hover:text-primary transition-colors">Home</a>
            <button onClick={async () => { await supabase.auth.signOut(); router.push("/") }} className="text-label-sm text-on-surface-variant hover:text-error transition-colors">
              Uitloggen
            </button>
          </div>
        </div>
      </header>
      <div className="max-w-5xl mx-auto px-4 py-8">{children}</div>
    </div>
  )
}
