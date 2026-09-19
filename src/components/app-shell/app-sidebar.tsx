"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import type { LayerStats } from "@/lib/types"
import type { CacheStats } from "@/server/cache/cache"
import { cn } from "@/lib/utils"
import { EngineStatus, type IntegrationFlags } from "./engine-status"
import { Logo } from "./logo"
import { isActive, NAV_ITEMS } from "./nav-items"
import { ThemeToggle } from "./theme-toggle"

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href)
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
              active && "bg-sidebar-accent font-medium text-foreground",
            )}
          >
            {active ? <span className="absolute inset-y-1.5 -left-3 w-0.5 rounded-full bg-signal" aria-hidden /> : null}
            <Icon className="size-4" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

export function AppSidebar({ stats, integrations, cache }: { stats: LayerStats; integrations: IntegrationFlags; cache: CacheStats }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-sidebar px-4 py-5 lg:flex">
      <Link href="/" className="mb-6 px-1">
        <Logo />
      </Link>
      <NavLinks />
      <div className="mt-auto space-y-3">
        <EngineStatus stats={stats} integrations={integrations} cache={cache} />
        <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
          Theme
          <ThemeToggle />
        </div>
      </div>
    </aside>
  )
}
