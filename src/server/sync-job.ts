import "server-only"

import { and, asc, eq, isNotNull, ne } from "drizzle-orm"

import { invalidateContextData } from "@/server/cache/cache"
import { db } from "@/server/db"
import { people } from "@/server/db/schema"
import { syncPersonContext } from "@/server/context-engine/pipeline"
import { serverEnv } from "@/server/env"

export interface SyncJobStatus {
  running: boolean
  total: number
  processed: number
  synced: number
  failed: number
  current: string[]
  stoppedReason: string | null
  startedAt: string | null
  finishedAt: string | null
}

interface SyncJob extends SyncJobStatus {
  cancelled: boolean
}

const idle = (): SyncJob => ({
  running: false,
  total: 0,
  processed: 0,
  synced: 0,
  failed: 0,
  current: [],
  stoppedReason: null,
  startedAt: null,
  finishedAt: null,
  cancelled: false,
})

// One job per server process, kept across hot reloads in development.
const globalForJob = globalThis as unknown as { contextosSyncJob?: SyncJob }
const job = (): SyncJob => (globalForJob.contextosSyncJob ??= idle())

export function getSyncStatus(): SyncJobStatus {
  const { running, total, processed, synced, failed, current, stoppedReason, startedAt, finishedAt } = job()
  return { running, total, processed, synced, failed, current, stoppedReason, startedAt, finishedAt }
}

/** People with a GitHub account whose context hasn't been built from it yet. */
export async function syncableSlugs() {
  const rows = await db
    .select({ slug: people.slug })
    .from(people)
    .where(and(isNotNull(people.githubUsername), ne(people.contextStatus, "ready")))
    .orderBy(asc(people.datasetRow))
  return rows.map((r) => r.slug)
}

export function stopSyncAll() {
  const current = job()
  if (current.running) current.cancelled = true
}

/** Starts syncing every pending GitHub profile in the background. Returns false if a job is already running. */
export async function startSyncAll(): Promise<boolean> {
  if (job().running) return false
  const slugs = await syncableSlugs()
  const state: SyncJob = { ...idle(), running: true, total: slugs.length, startedAt: new Date().toISOString() }
  globalForJob.contextosSyncJob = state

  // With a token GitHub allows 5,000 requests/hour, so a few people can sync in parallel.
  const concurrency = serverEnv.GITHUB_TOKEN ? 4 : 1
  let next = 0

  const worker = async () => {
    while (!state.cancelled && !state.stoppedReason && next < slugs.length) {
      const slug = slugs[next++]
      state.current = [...state.current, slug]
      try {
        const { warning } = await syncPersonContext(slug, { web: false })
        if (warning?.includes("rate limit")) {
          // Leave them pending so the next run retries.
          await db.update(people).set({ contextStatus: "pending" }).where(eq(people.slug, slug))
          await invalidateContextData()
          state.stoppedReason = warning
          state.failed++
        } else {
          state.synced++
        }
      } catch (error) {
        state.failed++
        console.warn(`[sync-all] ${slug} failed:`, (error as Error).message)
      } finally {
        state.processed++
        state.current = state.current.filter((s) => s !== slug)
      }
    }
  }

  void Promise.all(Array.from({ length: concurrency }, worker)).finally(() => {
    state.running = false
    state.finishedAt = new Date().toISOString()
    if (state.cancelled && !state.stoppedReason) state.stoppedReason = "Stopped"
  })
  return true
}
