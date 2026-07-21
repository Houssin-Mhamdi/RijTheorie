"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "@/hooks/use-auth"
import { useActiveTracking } from "@/hooks/use-active-tracking"
import { Loader2, Car, type LucideIcon } from "lucide-react"
import Sidebar from "@/components/dashboard/sidebar"
import TopBar from "@/components/dashboard/top-bar"
import MobileBottomNav from "@/components/dashboard/mobile-bottom-nav"
import type { NavItem } from "@/components/dashboard/sidebar"
import { dashboardNavItems, mobileNavItems, settingsItem } from "@/lib/nav-items"

interface DashboardShellProps {
  children: React.ReactNode
  navItems?: NavItem[]
  mobileNav?: NavItem[]
  bottomItems?: { href: string; label: string; icon: LucideIcon }[]
  hideTopBar?: boolean
}

export default function DashboardShell({
  children,
  navItems = dashboardNavItems,
  mobileNav = mobileNavItems,
  bottomItems = [settingsItem],
  hideTopBar = false,
}: DashboardShellProps) {
  const { data: session, isLoading: sessionLoading } = useSession()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  useActiveTracking()

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
    <div className="flex min-h-screen bg-background" dir="ltr">
      <aside
        className={`hidden md:flex h-screen sticky top-0 bg-surface shadow-[0px_4px_20px_rgba(26,60,110,0.05)] z-30 transition-[width] duration-300 ease-in-out shrink-0 ${
          collapsed ? "w-[64px]" : "w-[280px]"
        }`}
      >
        <Sidebar
          navItems={navItems}
          logo={{ icon: Car, label: "RijTheorie", subtitle: "Theory SaaS" }}
          bottomItems={bottomItems}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(!collapsed)}
        />
      </aside>

      <main className="flex-1 min-h-screen w-0 pb-20 md:pb-8">
        {!hideTopBar && <TopBar />}

        {children}
      </main>

      <MobileBottomNav items={mobileNav} />
    </div>
  )
}
