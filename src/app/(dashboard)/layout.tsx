import { connection } from "next/server"

import { AppSidebar } from "@/components/app-shell/app-sidebar"
import { MobileHeader } from "@/components/app-shell/mobile-header"
import { TrackingProvider } from "@/features/tracking/components/tracking-provider"
import { cacheStats } from "@/server/cache/cache"
import { integrations } from "@/server/env"
import { getLayerStats } from "@/server/repository/people"

export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  // Context changes as people are tracked and synced; always read it fresh.
  await connection()
  const [stats, cache] = await Promise.all([getLayerStats(), cacheStats()])

  return (
    <TrackingProvider>
      <div className="flex min-h-dvh">
        <AppSidebar stats={stats} integrations={integrations} cache={cache} />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileHeader />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </TrackingProvider>
  )
}
