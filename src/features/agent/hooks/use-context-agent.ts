"use client"

import { useCallback, useRef, useState } from "react"

import { useNdjsonStream } from "@/hooks/use-ndjson-stream"
import { AGENT_STAGES, initialStages, type StageState } from "@/lib/stages"
import type { AgentEvent, AgentPlan, AgentResult, AgentStageId, QueryInterpretation } from "@/lib/types"

export interface AgentTurn {
  id: string
  query: string
  status: "running" | "done" | "error"
  plan: AgentPlan | null
  interpretation: QueryInterpretation | null
  stages: Record<AgentStageId, StageState>
  result: AgentResult | null
  error: string | null
}

function applyEvent(turn: AgentTurn, event: AgentEvent): AgentTurn {
  switch (event.type) {
    case "plan":
      return { ...turn, plan: event.plan }
    case "interpretation":
      return { ...turn, interpretation: event.interpretation }
    case "stage":
      return { ...turn, stages: { ...turn.stages, [event.stage]: { status: event.status, detail: event.detail } } }
    case "result":
      return { ...turn, status: "done", result: event.result }
    case "error":
      return { ...turn, status: "error", error: event.message }
  }
}

/** Conversation with the Context Agent; each turn streams its routing plan, stages and result. */
export function useContextAgent() {
  const [turns, setTurns] = useState<AgentTurn[]>([])
  const { stream } = useNdjsonStream<AgentEvent>()
  // The person the conversation is about, so follow-ups like "What has Yash built?" stay on them.
  const focusRef = useRef<string | undefined>(undefined)
  const counter = useRef(0)

  const update = useCallback((id: string, change: (turn: AgentTurn) => AgentTurn) => {
    setTurns((current) => current.map((turn) => (turn.id === id ? change(turn) : turn)))
  }, [])

  const ask = useCallback(
    async (query: string) => {
      const text = query.trim()
      if (!text) return
      const id = `turn-${++counter.current}`
      setTurns((current) => [
        ...current,
        { id, query: text, status: "running", plan: null, interpretation: null, stages: initialStages(AGENT_STAGES), result: null, error: null },
      ])

      try {
        await stream("/api/agent", { query: text, focusSlug: focusRef.current }, (event) => {
          if (event.type === "result" && event.result.lookup?.status === "found") {
            focusRef.current = event.result.lookup.person.slug
          }
          update(id, (turn) => applyEvent(turn, event))
        })
        // A stream that ends without a result means the connection dropped.
        update(id, (turn) => (turn.status === "running" ? { ...turn, status: "error", error: "The agent stopped responding. Try again." } : turn))
      } catch (error) {
        if ((error as Error).name === "AbortError") return
        update(id, (turn) => ({ ...turn, status: "error", error: (error as Error).message }))
      }
    },
    [stream, update],
  )

  const clear = useCallback(() => {
    focusRef.current = undefined
    setTurns([])
  }, [])

  const busy = turns.some((turn) => turn.status === "running")

  return { turns, ask, clear, busy }
}
