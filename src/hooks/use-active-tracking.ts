"use client"

import { useEffect, useRef } from "react"
import { useSession } from "./use-auth"
import { supabase } from "@/lib/supabase"

export function useActiveTracking() {
  const { data: session } = useSession()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!session?.user?.id) return

    const update = () => {
      supabase.rpc("update_last_active_at").then(({ error }) => {
        if (error) console.error("Failed to update last_active_at", error)
      })
    }

    update()

    intervalRef.current = setInterval(update, 5 * 60 * 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [session?.user?.id])
}
