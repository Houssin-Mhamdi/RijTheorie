"use client"

import { useEffect } from "react"
import clarity from "@microsoft/clarity"

export function ClarityAnalytics() {
  const projectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID

  useEffect(() => {
    if (!projectId) return
    const pid: string = projectId
    const consent = localStorage.getItem("cookie-consent")
    if (consent === "accepted") {
      clarity.init(pid)
      return
    }
    function onAccept() {
      clarity.init(pid)
    }
    window.addEventListener("cookie-consent-accepted", onAccept)
    return () => window.removeEventListener("cookie-consent-accepted", onAccept)
  }, [projectId])

  return null
}
