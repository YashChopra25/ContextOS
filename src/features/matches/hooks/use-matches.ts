"use client"

import { useCallback, useRef, useState } from "react"

import type { MatchResult, QueryInterpretation } from "@/lib/types"

interface MatchState {
  status: "idle" | "loading" | "done" | "error"
  brief: string
  interpretation: QueryInterpretation | null
  total: number
  results: MatchResult[]
  error: string | null
}

const INITIAL: MatchState = { status: "idle", brief: "", interpretation: null, total: 0, results: [], error: null }

/** Sends an organizer's brief to the matcher and keeps the latest ranking. */
export function useMatches() {
  const [state, setState] = useState<MatchState>(INITIAL)
  const requestId = useRef(0)

  const search = useCallback(async (brief: string) => {
    const text = brief.trim()
    if (!text) return
    const id = ++requestId.current
    setState((current) => ({ ...current, status: "loading", brief: text, error: null }))
    try {
      const response = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: text }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? "Matching failed")
      // Ignore responses from searches that were superseded.
      if (id === requestId.current) setState({ status: "done", brief: text, interpretation: data.interpretation, total: data.total, results: data.results, error: null })
    } catch (error) {
      if (id === requestId.current) setState((current) => ({ ...current, status: "error", error: (error as Error).message }))
    }
  }, [])

  return { ...state, search }
}
