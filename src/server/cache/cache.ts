import "server-only"

import { createHash } from "node:crypto"

import { connectedRedis, readyRedis, redisClient } from "./redis"

const VERSION_KEY = "data:version"
const STATS_KEY = "stats"
const VERSION_MEMO_MS = 500

/**
 * Cache keys for Context Layer data include a version number. Any write to people, skills,
 * sources or activity bumps it, so every cached read is invalidated at once and nothing stale
 * is served. Old versions simply age out under Redis's LRU policy.
 */
let versionMemo: { value: string; at: number } | null = null
const inflight = new Map<string, Promise<unknown>>()

async function dataVersion(): Promise<string | null> {
  const redis = readyRedis()
  if (!redis) return null
  if (versionMemo && Date.now() - versionMemo.at < VERSION_MEMO_MS) return versionMemo.value
  const value = (await redis.get(VERSION_KEY)) ?? "0"
  versionMemo = { value, at: Date.now() }
  return value
}

/** Stable short key for arbitrary inputs (queries, filter objects). */
export function hashKey(input: unknown): string {
  return createHash("sha1").update(typeof input === "string" ? input : JSON.stringify(input)).digest("hex").slice(0, 16)
}

interface CacheOptions {
  /** Seconds to keep the value. */
  ttl: number
  /** Tie the entry to the data version (Postgres-derived data). False for external API results. */
  versioned?: boolean
  /** Skip the cached value and store a fresh one (explicit refreshes such as "Sync context"). */
  refresh?: boolean
}

/**
 * Read-through cache: returns the cached value or loads, stores and returns it.
 * Concurrent misses for the same key share one load. Any Redis failure falls back to `load`.
 */
export async function cached<T>(key: string, options: CacheOptions, load: () => Promise<T>): Promise<T> {
  const redis = readyRedis()
  if (!redis) return load()

  let fullKey: string
  try {
    fullKey = options.versioned === false ? `ext:${key}` : `v${await dataVersion()}:${key}`
    const [[, hit]] = options.refresh ? [[null, null]] : ((await redis.pipeline().get(fullKey).exec()) as [[Error | null, string | null]])
    if (hit !== null) {
      void redis.hincrby(STATS_KEY, "hits", 1).catch(() => {})
      return JSON.parse(hit) as T
    }
  } catch {
    return load()
  }

  const pending = inflight.get(fullKey) as Promise<T> | undefined
  if (pending) return pending

  const promise = (async () => {
    const value = await load()
    if (value !== undefined) {
      void redis
        .pipeline()
        .set(fullKey, JSON.stringify(value), "EX", options.ttl)
        .hincrby(STATS_KEY, "misses", 1)
        .exec()
        .catch(() => {})
    }
    return value
  })().finally(() => inflight.delete(fullKey))

  inflight.set(fullKey, promise)
  return promise
}

/** Call after any write to Context Layer data. */
export async function invalidateContextData(): Promise<void> {
  versionMemo = null
  const redis = await connectedRedis()
  if (!redis) return
  try {
    const value = await redis.incr(VERSION_KEY)
    versionMemo = { value: String(value), at: Date.now() }
  } catch {
    // Without Redis there is nothing to invalidate.
  }
}

export interface CacheStats {
  configured: boolean
  connected: boolean
  hits: number
  misses: number
  keys: number
  memory: string | null
}

export async function cacheStats(): Promise<CacheStats> {
  const configured = Boolean(redisClient())
  const redis = readyRedis()
  if (!redis) return { configured, connected: false, hits: 0, misses: 0, keys: 0, memory: null }
  try {
    const [stats, keys, info] = await Promise.all([redis.hgetall(STATS_KEY), redis.dbsize(), redis.info("memory")])
    return {
      configured,
      connected: true,
      hits: Number(stats.hits ?? 0),
      misses: Number(stats.misses ?? 0),
      keys,
      memory: info.match(/used_memory_human:(\S+)/)?.[1] ?? null,
    }
  } catch {
    return { configured, connected: false, hits: 0, misses: 0, keys: 0, memory: null }
  }
}

/** Ensures the connection is opened before the first request needs it. */
export async function warmCache(): Promise<void> {
  const client = redisClient()
  if (client && client.status === "wait") await client.connect().catch(() => {})
}
