import { LayoutDashboard, ClipboardList, BookOpen, Users, FileText, Settings, BarChart3, CreditCard, Receipt, TrendingUp, Ticket, PenSquare } from "lucide-react"
import type { NavItem } from "@/components/dashboard/sidebar"

export const dashboardNavItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/questions", label: "Questions", icon: ClipboardList },
  { href: "/lessons", label: "Courses", icon: BookOpen },
  { href: "/students", label: "Students", icon: Users },
  { href: "/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/coupons", label: "Coupons", icon: Ticket },
  { href: "/billing", label: "Billing", icon: Receipt },
  { href: "/blog-admin", label: "Blog", icon: PenSquare },
]

export const studentNavItems: NavItem[] = [
  { href: "/exams", label: "Exams", icon: FileText },
  { href: "/progress", label: "Progress", icon: TrendingUp },
  { href: "/exams/statistics", label: "Statistieken", icon: BarChart3 },
]

export const settingsItem = { href: "/dashboard/settings", label: "Settings", icon: Settings }

export const mobileNavItems: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/questions", label: "Questions", icon: ClipboardList },
  { href: "/lessons", label: "Courses", icon: BookOpen },
  { href: "/students", label: "Students", icon: Users },
  { href: "/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/coupons", label: "Coupons", icon: Ticket },
  { href: "/billing", label: "Billing", icon: Receipt },
  { href: "/blog-admin", label: "Blog", icon: PenSquare },
]

export const studentMobileNavItems = [
  { href: "/exams", label: "Exams", icon: FileText },
  { href: "/progress", label: "Progress", icon: TrendingUp },
  { href: "/exams/statistics", label: "Statistieken", icon: BarChart3 },
]
