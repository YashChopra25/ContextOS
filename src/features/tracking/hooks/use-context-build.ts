"use client"

import { useRouter } from "next/navigation"
import { useCallback, useReducer } from "react"

import { useNdjsonStream } from "@/hooks/use-ndjson-stream"
import { initialStages, TRACK_STAGES, type StageState } from "@/lib/stages"
import type { PersonSummary, TrackEvent, TrackStageId } from "@/lib/types"
import type { TrackPersonInput } from "@/lib/validation"

export type BuildPhase = "idle" | "running" | "done" | "error"

interface BuildState {
  phase: BuildPhase
  stages: Record<TrackStageId, StageState>
  person: PersonSummary | null
  alreadyExisted: boolean
  error: string | null
}

type Action = { type: "start" } | { type: "event"; event: TrackEvent } | { type: "fail"; message: string } | { type: "reset" }

const initialState: BuildState = {
  phase: "idle",
  stages: initialStages(TRACK_STAGES),
  person: null,
  alreadyExisted: false,
  error: null,
}

function reducer(state: BuildState, action: Action): BuildState {
  switch (action.type) {
    case "start":
      return { ...initialState, phase: "running" }
    case "reset":
      return initialState
    case "fail":
      return { ...state, phase: "error", error: action.message }
    case "event": {
      const { event } = action
      if (event.type === "stage") {
        return { ...state, stages: { ...state.stages, [event.stage]: { status: event.status, detail: event.detail } } }
      }
      if (event.type === "done") return { ...state, phase: "done", person: event.person, alreadyExisted: event.alreadyExisted }
      return { ...state, phase: "error", error: event.message }
    }
  }
}

/**
 * Drives a Context Engine run (Add & Track, or a resync of an existing person)
 * and exposes each pipeline stage as it streams in.
 */
export function useContextBuild() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const { stream } = useNdjsonStream<TrackEvent>()
  const router = useRouter()

  const run = useCallback(
    async (url: string, body: unknown) => {
      dispatch({ type: "start" })
      try {
        let finished = false
        await stream(url, body, (event) => {
          if (event.type === "done") finished = true
          dispatch({ type: "event", event })
        })
        // Server components (lists, stats, profile) read from Postgres; refresh them.
        if (finished) router.refresh()
      } catch (error) {
        if ((error as Error).name !== "AbortError") dispatch({ type: "fail", message: (error as Error).message })
      }
    },
    [router, stream],
  )

  const track = useCallback((input: TrackPersonInput) => run("/api/track", input), [run])
  const resync = useCallback((slug: string) => run(`/api/people/${encodeURIComponent(slug)}/sync`, {}), [run])
  const reset = useCallback(() => dispatch({ type: "reset" }), [])

  return { ...state, track, resync, reset }
}
