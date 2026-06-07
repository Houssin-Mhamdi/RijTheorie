import { LayoutDashboard, ClipboardList, BookOpen, Users, FileText, Settings, BarChart3 } from "lucide-react"
import type { NavItem } from "@/components/dashboard/sidebar"

export const dashboardNavItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/questions", label: "Questions", icon: ClipboardList },
  { href: "/lessons", label: "Courses", icon: BookOpen },
  { href: "/students", label: "Students", icon: Users },
]

export const studentNavItems: NavItem[] = [
  { href: "/exams", label: "Exams", icon: FileText },
  { href: "/exams/statistics", label: "Statistieken", icon: BarChart3 },
]

export const settingsItem = { href: "/dashboard/settings", label: "Settings", icon: Settings }

export const mobileNavItems = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/questions", label: "Questions", icon: ClipboardList },
  { href: "/lessons", label: "Courses", icon: BookOpen },
]

export const studentMobileNavItems = [
  { href: "/exams", label: "Exams", icon: FileText },
  { href: "/exams/statistics", label: "Statistieken", icon: BarChart3 },
]
