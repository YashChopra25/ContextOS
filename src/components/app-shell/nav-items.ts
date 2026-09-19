import { Activity, LayoutDashboard, MessagesSquare, Target, Users } from "lucide-react"

export const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/people", label: "People", icon: Users },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/matches", label: "Matches", icon: Target },
  { href: "/agent", label: "AI Agent", icon: MessagesSquare },
] as const

export const isActive = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)
