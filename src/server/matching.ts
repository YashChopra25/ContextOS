import "server-only"

import type { MatchResult, QueryInterpretation } from "@/lib/types"
import { hasStructuredFilters, interpretQuery } from "@/server/agent/interpret"
import { integrations } from "@/server/env"
import { searchCommunity } from "@/server/repository/community"

export interface MatchResponse {
  brief: string
  interpretation: QueryInterpretation
  results: MatchResult[]
  total: number
}

/**
 * Downstream consumer of the Context Layer: the brief is interpreted into filters
 * (with Tavily researching goals), then people are fetched and ranked from Postgres.
 */
export async function findMatches(brief: string, limit = 12): Promise<MatchResponse> {
  const interpretation = await interpretQuery(brief, { useTavily: integrations.tavily })
  if (!hasStructuredFilters(interpretation)) return { brief, interpretation, results: [], total: 0 }
  const { results, total } = await searchCommunity({ ...interpretation, limit: Math.max(interpretation.limit, limit) })
  return { brief, interpretation, results, total }
}
