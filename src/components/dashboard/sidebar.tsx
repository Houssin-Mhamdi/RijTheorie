"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { LogOut, PanelLeftClose, PanelLeft, X, type LucideIcon } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { useState } from "react"

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

const EMPTY_NAV_ITEMS: NavItem[] = []

interface SidebarProps {
  navItems?: NavItem[]
  logo?: { icon: LucideIcon; label: string; subtitle: string }
  bottomItems?: { href: string; label: string; icon: LucideIcon }[]
  showLogout?: boolean
  collapsed?: boolean
  onToggleCollapse?: () => void
}

export default function Sidebar({
  navItems = EMPTY_NAV_ITEMS,
  logo,
  bottomItems,
  showLogout = true,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [logoutOpen, setLogoutOpen] = useState(false)

  return (
    <div className={cn("flex flex-col h-full py-4 transition-[width] duration-300 ease-in-out overflow-hidden", collapsed ? "w-[64px]" : "w-[280px]")}>
      {logo && (
        <div className={cn("mb-6 flex items-center", collapsed ? "justify-center px-2" : "px-5 gap-3")}>
          <div className="size-10 shrink-0 rounded-lg bg-primary-container flex items-center justify-center text-on-primary-container">
            <logo.icon size={24} />
          </div>
          {!collapsed && (
            <div className="whitespace-nowrap overflow-hidden">
              <h1 className="text-headline-md font-bold text-primary truncate">{logo.label}</h1>
              <p className="text-label-sm text-on-surface-variant truncate">{logo.subtitle}</p>
            </div>
          )}
        </div>
      )}

      <nav className="flex-1 space-y-1 px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center rounded-lg transition-colors",
                collapsed ? "justify-center h-11 w-11 mx-auto" : "gap-3 px-4 py-3",
                isActive
                  ? "text-primary bg-surface-container-high font-bold"
                  : "text-on-surface-variant hover:bg-surface-container-low",
              )}
              title={collapsed ? item.label : undefined}
            >
              {isActive && !collapsed && <div className="absolute left-0 w-1 h-full bg-secondary-container rounded-r-full" />}
              <item.icon size={20} className="shrink-0" />
              {!collapsed && <span className="text-label-md truncate">{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto space-y-1">
        {bottomItems?.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center rounded-lg transition-colors",
              collapsed ? "justify-center h-11 w-11 mx-auto" : "gap-3 px-4 py-3 mx-3",
              "text-on-surface-variant hover:bg-surface-container-low",
            )}
            title={collapsed ? item.label : undefined}
          >
            <item.icon size={20} className="shrink-0" />
            {!collapsed && <span className="text-label-md truncate">{item.label}</span>}
          </Link>
        ))}
        {showLogout && (
          <button
            onClick={() => setLogoutOpen(true)}
            className={cn(
              "flex items-center rounded-lg transition-colors w-full text-left",
              collapsed ? "justify-center h-11 w-11 mx-auto" : "gap-3 px-4 py-3 mx-3",
              "text-on-surface-variant hover:bg-surface-container-low",
            )}
            title={collapsed ? "Uitloggen" : undefined}
          >
            <LogOut size={20} className="shrink-0" />
            {!collapsed && <span className="text-label-md truncate">Uitloggen</span>}
          </button>
        )}
        {logoutOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/30 backdrop-blur-xs" onClick={() => setLogoutOpen(false)} />
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
              <button onClick={() => setLogoutOpen(false)} className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface">
                <X size={20} />
              </button>
              <h3 className="text-headline-md text-primary mb-2">Uitloggen</h3>
              <p className="text-body-md text-on-surface-variant mb-6">Weet je zeker dat je wilt uitloggen?</p>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setLogoutOpen(false)} className="px-5 py-2.5 rounded-xl border border-outline-variant text-label-md font-bold text-on-surface-variant hover:bg-surface-container transition-all">
                  Annuleren
                </button>
                <button
                  onClick={async () => { await supabase.auth.signOut(); router.push("/") }}
                  className="px-5 py-2.5 rounded-xl bg-error text-on-error text-label-md font-bold hover:opacity-90 transition-all flex items-center gap-2"
                >
                  <LogOut size={16} />
                  Uitloggen
                </button>
              </div>
            </div>
          </div>
        )}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className={cn(
              "flex items-center rounded-lg transition-colors w-full text-left border-t border-outline-variant/30 pt-3 mt-3",
              collapsed ? "justify-center h-11 w-11 mx-auto" : "gap-3 px-4 py-3 mx-3",
              "text-on-surface-variant hover:bg-surface-container-low",
            )}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeft size={20} className="shrink-0" /> : <PanelLeftClose size={20} className="shrink-0" />}
            {!collapsed && <span className="text-label-md truncate">Collapse</span>}
          </button>
        )}
      </div>
    </div>
  )
}
