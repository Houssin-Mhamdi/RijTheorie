"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession, useProfile } from "@/hooks/use-auth"
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
  requireAdmin?: boolean
}

export default function DashboardShell({
  children,
  navItems = dashboardNavItems,
  mobileNav = mobileNavItems,
  bottomItems = [settingsItem],
  hideTopBar = false,
  requireAdmin = false,
}: DashboardShellProps) {
  const { data: session, isLoading: sessionLoading } = useSession()
  const { data: profile, isLoading: profileLoading } = useProfile()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  useActiveTracking()

  useEffect(() => {
    if (!sessionLoading && !session) {
      router.push("/login")
    }
  }, [session, sessionLoading, router])

  const isStudentBlocked = requireAdmin && !sessionLoading && !!session && !profileLoading && profile?.role === "student"

  useEffect(() => {
    if (isStudentBlocked) {
      router.replace("/exams")
    }
  }, [isStudentBlocked, router])

  if (sessionLoading || (requireAdmin && profileLoading)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (isStudentBlocked) return null

  if (!session) return null

  return (
    <div className="flex min-h-screen bg-background">
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
