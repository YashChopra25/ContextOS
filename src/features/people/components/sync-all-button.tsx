"use client"

import { RefreshCw, Square } from "lucide-react"
import { useEffect, useRef } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import type { SyncJobStatus } from "@/server/sync-job"
import { useSyncAll } from "../hooks/use-sync-all"

/** Syncs every GitHub profile that doesn't have a built context yet, with live progress. */
export function SyncAllButton({ pending, initialStatus }: { pending: number; initialStatus: SyncJobStatus }) {
  const { status, error, start, stop } = useSyncAll(initialStatus)
  const wasRunning = useRef(false)
  const running = status.running

  useEffect(() => {
    if (wasRunning.current && !status.running) {
      const summary = `${status.synced} synced${status.failed ? `, ${status.failed} failed` : ""}`
      if (status.stoppedReason && status.stoppedReason !== "Stopped") toast.warning("Sync paused", { description: `${summary}. ${status.stoppedReason}` })
      else toast.success(status.stoppedReason === "Stopped" ? "Sync stopped" : "GitHub sync complete", { description: summary })
    }
    wasRunning.current = running
  }, [running, status])

  if (running) {
    const percent = status.total ? Math.round((status.processed / status.total) * 100) : 0
    return (
      <div className="flex w-full items-center gap-3 rounded-lg border bg-card px-3 py-1.5 sm:w-80" aria-live="polite">
        <RefreshCw className="size-4 shrink-0 animate-spin text-signal motion-reduce:animate-none" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-xs">
            Syncing GitHub <span className="tabular-nums">{status.processed}</span> of <span className="tabular-nums">{status.total}</span>
            {status.failed ? <span className="text-muted-foreground">, {status.failed} failed</span> : null}
          </p>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-signal transition-[width]" style={{ width: `${percent}%` }} />
          </div>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={() => void stop()} aria-label="Stop syncing" title="Stop syncing">
          <Square />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" onClick={() => void start()} disabled={!pending} title={pending ? undefined : "Every GitHub profile is already synced"}>
        <RefreshCw data-icon="inline-start" />
        {pending ? `Sync all GitHub profiles (${pending.toLocaleString("en-US")})` : "All GitHub profiles synced"}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
