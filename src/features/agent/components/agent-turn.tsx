import { AlertCircle, Database, Globe, Layers } from "lucide-react"

import { InterpretationChips } from "@/components/context/interpretation-chips"
import { SourceIcon } from "@/components/context/source-icon"

import { StageList } from "@/components/context/stage-list"
import { MatchCard } from "@/features/matches/components/match-card"
import { AGENT_STAGES } from "@/lib/stages"
import type { AgentPlan } from "@/lib/types"
import type { AgentTurn as Turn } from "../hooks/use-context-agent"
import { EvidenceList, SourceList } from "./evidence-sources"
import { LookupCard } from "./lookup-card"

function RouteLabel({ plan }: { plan: AgentPlan }) {
  const both = plan.useContextOS && plan.useWeb
  const Icon = both ? Layers : plan.useWeb ? Globe : Database
  const label = both ? "ContextOS + Tavily" : plan.useWeb ? "Tavily" : "ContextOS"
  return (
    <p className="flex items-start gap-2 text-xs text-muted-foreground">
      <span className="inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 font-medium text-foreground">
        <Icon className="size-3" />
        {label}
      </span>
      <span className="pt-0.5">{plan.reason}</span>
    </p>
  )
}

export function AgentTurnView({ turn, onAsk }: { turn: Turn; onAsk: (query: string) => void }) {
  const { result } = turn
  return (
    <article className="space-y-4" aria-busy={turn.status === "running"}>
      <p className="ml-auto w-fit max-w-[85%] rounded-xl rounded-br-sm bg-secondary px-3.5 py-2 text-sm">{turn.query}</p>

      <div className="space-y-4">
        <div className="space-y-2">
          <StageList stages={AGENT_STAGES} state={turn.stages} layout="inline" />
          {turn.plan ? <RouteLabel plan={turn.plan} /> : null}
          {turn.interpretation ? <InterpretationChips interpretation={turn.interpretation} /> : null}
        </div>

        {turn.status === "error" ? (
          <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="size-4" />
            {turn.error}
          </p>
        ) : null}

        {result ? (
          <div className="space-y-4">
            {/* The not-found card already states the answer and offers the next step. */}
            {result.lookup?.status !== "not_found" ? <p className="max-w-prose text-[15px] leading-relaxed whitespace-pre-line">{result.answer}</p> : null}

            {result.webAnswer || result.webNote ? (
              <section aria-label="From the web" className="max-w-prose rounded-xl border bg-card px-4 py-3">
                <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <SourceIcon source="web" />
                  From the web, researched by Tavily
                </h3>
                {result.webAnswer ? <p className="text-sm leading-relaxed whitespace-pre-line">{result.webAnswer}</p> : null}
                {result.webNote ? <p className="mt-1.5 text-xs text-muted-foreground">{result.webNote}</p> : null}
              </section>
            ) : null}

            {result.lookup ? <LookupCard lookup={result.lookup} onAsk={onAsk} originalQuery={turn.query} webCandidates={result.webCandidates} /> : null}

            {result.matches.length ? (
              <div className="space-y-1.5">
                <ol className="divide-y rounded-xl border bg-card px-4">
                  {result.matches.map((match, index) => (
                    <MatchCard key={match.person.slug} match={match} rank={index + 1} compact />
                  ))}
                </ol>
                {result.totalMatches > result.matches.length ? (
                  <p className="text-xs text-muted-foreground">
                    Showing the top {result.matches.length} of {result.totalMatches}. Ask for &ldquo;top 20&rdquo; to see more.
                  </p>
                ) : null}
              </div>
            ) : null}

            <EvidenceList evidence={result.evidence} />
            <SourceList sources={result.sources} />
          </div>
        ) : null}
      </div>
    </article>
  )
}
