import type { AgentStageId, StageStatus, TrackStageId } from "@/lib/types"

export interface StageDefinition<Id extends string> {
  id: Id
  label: string
}

export interface StageState {
  status: StageStatus
  detail?: string
}

export const TRACK_STAGES: StageDefinition<TrackStageId>[] = [
  { id: "resolve", label: "Resolving identity" },
  { id: "collect", label: "Collecting data" },
  { id: "extract", label: "Extracting signals" },
  { id: "build", label: "Building context profile" },
]

export const SYNC_STAGES = TRACK_STAGES.filter((stage) => stage.id !== "resolve")

export const AGENT_STAGES: StageDefinition<AgentStageId>[] = [
  { id: "understand", label: "Understanding query" },
  { id: "contextos", label: "Searching ContextOS" },
  { id: "web", label: "Searching web" },
  { id: "synthesis", label: "Synthesizing context" },
]

export function initialStages<Id extends string>(stages: StageDefinition<Id>[]): Record<Id, StageState> {
  return Object.fromEntries(stages.map((stage) => [stage.id, { status: "pending" }])) as Record<Id, StageState>
}
