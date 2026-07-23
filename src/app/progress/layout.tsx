"use client"

import DashboardShell from "@/components/dashboard/dashboard-shell"
import { studentNavItems, studentMobileNavItems } from "@/lib/nav-items"

export default function ProgressLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell navItems={studentNavItems} mobileNav={studentMobileNavItems} bottomItems={[]} hideTopBar>
      {children}
    </DashboardShell>
  )
}
