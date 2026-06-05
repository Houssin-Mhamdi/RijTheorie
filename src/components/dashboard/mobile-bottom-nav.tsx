"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Menu, LogOut, type LucideIcon } from "lucide-react"
import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Drawer from "@/components/ui/drawer"
import { dashboardNavItems, settingsItem } from "@/lib/nav-items"
import type { NavItem } from "@/components/dashboard/sidebar"

interface MobileBottomNavProps {
  items?: NavItem[]
}

export default function MobileBottomNav({ items = dashboardNavItems }: MobileBottomNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const quickLinks = items.slice(0, 3).map((item) => ({
    href: item.href,
    label: item.label,
    icon: item.icon,
  }))

  return (
    <>
      <nav className="fixed bottom-0 w-full z-50 md:hidden border-t border-outline-variant/30 bg-surface shadow-lg">
        <div className="flex justify-around items-center h-16 px-2">
          {quickLinks.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5",
                  isActive ? "text-secondary font-bold" : "text-on-surface-variant",
                )}
              >
                <item.icon size={20} />
                <span className="text-label-sm">{item.label}</span>
              </Link>
            )
          })}
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 text-on-surface-variant"
          >
            <Menu size={20} />
            <span className="text-label-sm">Menu</span>
          </button>
        </div>
      </nav>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <div className="space-y-1">
          <p className="text-label-sm text-on-surface-variant px-3 mb-2">Navigation</p>
          {items.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setDrawerOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-lg transition-colors",
                  isActive
                    ? "text-primary bg-surface-container-high font-bold"
                    : "text-on-surface-variant hover:bg-surface-container-low",
                )}
              >
                <item.icon size={20} />
                <span className="text-label-md">{item.label}</span>
              </Link>
            )
          })}
          <div className="border-t border-outline-variant/30 pt-2 mt-2">
            <Link
              href={settingsItem.href}
              onClick={() => setDrawerOpen(false)}
              className="flex items-center gap-3 p-3 rounded-lg text-on-surface-variant hover:bg-surface-container-low transition-colors"
            >
              <settingsItem.icon size={20} />
              <span className="text-label-md">{settingsItem.label}</span>
            </Link>
            <button
              onClick={async () => {
                await supabase.auth.signOut()
                router.push("/")
              }}
              className="flex items-center gap-3 p-3 rounded-lg text-on-surface-variant hover:bg-surface-container-low transition-colors w-full text-left"
            >
              <LogOut size={20} />
              <span className="text-label-md">Logout</span>
            </button>
          </div>
        </div>
      </Drawer>
    </>
  )
}
