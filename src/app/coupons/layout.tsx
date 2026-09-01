"use client"

import DashboardShell from "@/components/dashboard/dashboard-shell"

export default function CouponsLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell requireAdmin>{children}</DashboardShell>
}
