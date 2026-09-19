import "server-only"

import { cached, hashKey } from "@/server/cache/cache"
import { serverEnv } from "@/server/env"

const TAVILY_API = "https://api.tavily.com"

export interface WebResult {
  title: string
  url: string
  content: string
  score: number
  publishedDate: string | null
}

export interface WebSearch {
  /** Tavily's synthesized answer across the results (when requested). */
  answer: string | null
  results: WebResult[]
}

export interface SearchOptions {
  maxResults?: number
  /** "advanced" reads more of each page; slower but better for answers. */
  depth?: "basic" | "advanced"
  /** Ask Tavily to write an answer from the results. */
  answer?: false | "basic" | "advanced"
  topic?: "general" | "news"
  timeRange?: "day" | "week" | "month" | "year"
  includeDomains?: string[]
  /** Bypass the cached result (used when explicitly re-syncing a person). */
  fresh?: boolean
}

interface TavilySearchResponse {
  answer?: string | null
  results: { title: string; url: string; content: string; score: number; published_date?: string }[]
}

interface TavilyExtractResponse {
  results: { url: string; raw_content: string }[]
  failed_results?: { url: string; error: string }[]
}

async function tavily<T>(path: string, body: Record<string, unknown>, timeoutMs: number): Promise<T> {
  const response = await fetch(`${TAVILY_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serverEnv.TAVILY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  })
  if (!response.ok) {
    const text = await response.text().catch(() => "")
    throw new Error(`Tavily ${path} failed (${response.status}): ${text.slice(0, 200)}`)
  }
  return (await response.json()) as T
}

export const tavilyEnabled = () => Boolean(serverEnv.TAVILY_API_KEY)

const SEARCH_TTL = 24 * 3600
const EXTRACT_TTL = 7 * 24 * 3600

/**
 * Tavily search, optionally with a synthesized answer. Returns null when TAVILY_API_KEY isn't configured.
 * Results are cached for a day: identical questions don't spend credits or wait on the web twice.
 */
export async function searchWeb(query: string, options: SearchOptions = {}): Promise<WebSearch | null> {
  if (!serverEnv.TAVILY_API_KEY) return null
  const { fresh, ...params } = options
  return cached(`tavily:search:${hashKey([query, params])}`, { ttl: SEARCH_TTL, versioned: false, refresh: fresh }, () =>
    searchWebUncached(query, params),
  )
}

async function searchWebUncached(query: string, options: SearchOptions): Promise<WebSearch> {
  const data = await tavily<TavilySearchResponse>(
    "/search",
    {
      query: query.slice(0, 400),
      max_results: options.maxResults ?? 5,
      search_depth: options.depth ?? "basic",
      topic: options.topic ?? "general",
      include_answer: options.answer ?? false,
      ...(options.timeRange ? { time_range: options.timeRange } : {}),
      ...(options.includeDomains?.length ? { include_domains: options.includeDomains } : {}),
    },
    options.answer === "advanced" || options.depth === "advanced" ? 45_000 : 25_000,
  )
  return {
    answer: data.answer?.trim() || null,
    results: data.results.map((r) => ({
      title: r.title,
      url: r.url,
      content: r.content,
      score: r.score,
      publishedDate: r.published_date ?? null,
    })),
  }
}

/** Reads the main content of pages (portfolio sites, blogs). Returns null when not configured. Cached for a week. */
export async function extractPages(urls: string[], options: { fresh?: boolean } = {}): Promise<{ url: string; content: string }[] | null> {
  if (!serverEnv.TAVILY_API_KEY || !urls.length) return null
  return cached(`tavily:extract:${hashKey(urls)}`, { ttl: EXTRACT_TTL, versioned: false, refresh: options.fresh }, () => extractPagesUncached(urls))
}

async function extractPagesUncached(urls: string[]): Promise<{ url: string; content: string }[]> {
  const data = await tavily<TavilyExtractResponse>("/extract", { urls, extract_depth: "basic", format: "text" }, 30_000)
  return data.results.map((r) => ({ url: r.url, content: r.raw_content ?? "" }))
}
