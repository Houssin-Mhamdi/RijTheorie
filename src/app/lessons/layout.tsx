"use client"

import DashboardShell from "@/components/dashboard/dashboard-shell"

export default function LessonsLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>
}
