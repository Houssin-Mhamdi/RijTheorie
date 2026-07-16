"use client"

import { useEffect } from "react"
import clarity from "@microsoft/clarity"

export function ClarityAnalytics() {
  const projectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID

  useEffect(() => {
    if (!projectId) return
    clarity.init(projectId)
  }, [projectId])

  return null
}
