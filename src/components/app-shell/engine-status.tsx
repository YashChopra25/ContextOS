import { RelativeTime } from "@/components/context/relative-time"
import type { LayerStats } from "@/lib/types"
import type { CacheStats } from "@/server/cache/cache"
import { cn } from "@/lib/utils"

export interface IntegrationFlags {
  redis: boolean
  tavily: boolean
  github: boolean
}

function Row({ label, on, offLabel = "Not configured", onLabel = "Connected" }: { label: string; on: boolean; offLabel?: string; onLabel?: string }) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span>{label}</span>
      <span className={cn("flex items-center gap-1.5", on ? "text-foreground" : "text-muted-foreground")}>
        <span className={cn("size-1.5 rounded-full", on ? "bg-signal" : "bg-muted-foreground/40")} aria-hidden />
        {on ? onLabel : offLabel}
      </span>
    </li>
  )
}

/** Where the Context Engine stands: how much context exists and which integrations feed it. */
function cacheLabel(cache: CacheStats) {
  const total = cache.hits + cache.misses
  return total ? `${Math.round((cache.hits / total) * 100)}% hits` : "Connected"
}

export function EngineStatus({ stats, integrations, cache }: { stats: LayerStats; integrations: IntegrationFlags; cache: CacheStats }) {
  return (
    <div className="space-y-3 rounded-lg border bg-card p-3 text-xs">
      <div>
        <p className="font-medium">Context Engine</p>
        <p className="mt-0.5 text-muted-foreground">
          {stats.readyContexts} of {stats.people} profiles built
          {stats.lastSyncedAt ? (
            <>
              , last <RelativeTime iso={stats.lastSyncedAt} />
            </>
          ) : null}
        </p>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className="h-full rounded-full bg-signal" style={{ width: `${Math.max(2, (stats.readyContexts / Math.max(stats.people, 1)) * 100)}%` }} />
        </div>
      </div>
      <ul className="space-y-1.5 text-muted-foreground">
        <Row label="Tavily agent" on={integrations.tavily} offLabel="Not configured" />
        <li className="flex items-center justify-between gap-2" title={cache.connected ? `${cache.keys} keys, ${cache.memory ?? "?"} used` : undefined}>
          <span>Redis cache</span>
          <span className={cn("flex items-center gap-1.5", cache.connected ? "text-foreground" : "text-muted-foreground")}>
            <span className={cn("size-1.5 rounded-full", cache.connected ? "bg-signal" : "bg-muted-foreground/40")} aria-hidden />
            {cache.connected ? cacheLabel(cache) : cache.configured ? "Unreachable" : "Off"}
          </span>
        </li>
        <Row label="GitHub token" on={integrations.github} offLabel="60 req/hr" />
      </ul>
    </div>
  )
}
