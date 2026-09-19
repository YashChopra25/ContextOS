"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

import type { SyncJobStatus as SyncStatus } from "@/server/sync-job"

const POLL_MS = 1500
const REFRESH_EVERY = 10

/** Starts, stops and follows the server-side "sync all GitHub profiles" job. */
export function useSyncAll(initialStatus: SyncStatus) {
  // The server passes the job's current state, so a sync started earlier is picked up on load.
  const [status, setStatus] = useState<SyncStatus>(initialStatus)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const lastRefreshAt = useRef(0)

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/people/sync-all", { cache: "no-store" })
      const next = (await response.json()) as SyncStatus
      setStatus(next)
      // Refresh the table every few profiles, and once at the end.
      if (next.processed - lastRefreshAt.current >= REFRESH_EVERY || (!next.running && next.processed !== lastRefreshAt.current)) {
        lastRefreshAt.current = next.processed
        router.refresh()
      }
      return next
    } catch {
      return null
    }
  }, [router])

  useEffect(() => {
    if (!status.running) return
    const timer = setInterval(() => void load(), POLL_MS)
    return () => clearInterval(timer)
  }, [status.running, load])

  const start = useCallback(async () => {
    setError(null)
    lastRefreshAt.current = 0
    const response = await fetch("/api/people/sync-all", { method: "POST" })
    const data = (await response.json()) as { started: boolean; status: SyncStatus }
    setStatus(data.status)
    if (!data.started && !data.status.running) setError("Couldn't start the sync. Try again.")
  }, [])

  const stop = useCallback(async () => {
    const response = await fetch("/api/people/sync-all", { method: "DELETE" })
    setStatus((await response.json()) as SyncStatus)
  }, [])

  return { status, error, start, stop }
}
