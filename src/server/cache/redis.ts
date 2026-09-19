import "server-only"

import Redis from "ioredis"

import { serverEnv } from "@/server/env"

const globalForRedis = globalThis as unknown as { contextosRedis?: Redis | null; contextosRedisWarnedAt?: number }

function createClient(): Redis | null {
  if (!serverEnv.REDIS_URL) return null
  const client = new Redis(serverEnv.REDIS_URL, {
    // Fail fast so a missing cache never slows a page down; callers fall back to the source.
    connectTimeout: 1_000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: (attempt) => Math.min(attempt * 500, 5_000),
    keyPrefix: "contextos:",
  })
  client.on("error", (error) => {
    const now = Date.now()
    // One warning per minute is enough while Redis is down.
    if (now - (globalForRedis.contextosRedisWarnedAt ?? 0) > 60_000) {
      globalForRedis.contextosRedisWarnedAt = now
      console.warn(`[redis] ${error.message}. Serving without cache until it reconnects.`)
    }
  })
  return client
}

/** Shared client, reused across hot reloads. Null when REDIS_URL isn't set. */
export function redisClient(): Redis | null {
  if (globalForRedis.contextosRedis === undefined) globalForRedis.contextosRedis = createClient()
  return globalForRedis.contextosRedis
}

/** Waits briefly for the connection; used where skipping Redis would be incorrect (invalidation). */
export async function connectedRedis(timeoutMs = 1_500): Promise<Redis | null> {
  const client = redisClient()
  if (!client) return null
  if (client.status === "ready") return client
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(client.status === "ready" ? client : null), timeoutMs)
    client.once("ready", () => {
      clearTimeout(timer)
      resolve(client)
    })
  })
}

/** Closes the connection so scripts can exit. */
export async function closeRedis(): Promise<void> {
  const client = globalForRedis.contextosRedis
  if (client) await client.quit().catch(() => client.disconnect())
  globalForRedis.contextosRedis = undefined
}

/** The client only when it's connected; otherwise callers skip the cache. */
export function readyRedis(): Redis | null {
  const client = redisClient()
  return client?.status === "ready" ? client : null
}
