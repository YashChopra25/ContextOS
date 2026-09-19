"use client"

import { Loader2 } from "lucide-react"
import { useState } from "react"

import { InterpretationChips } from "@/components/context/interpretation-chips"
import { SectionErrorBoundary } from "@/components/context/section-error-boundary"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useMatches } from "../hooks/use-matches"
import { MatchCard } from "./match-card"

const EXAMPLES = [
  "Find developers for a Solana hackathon with React experience.",
  "Students from DTU who can build a fintech app",
  "Who could build an AI chatbot for customer support?",
  "Active Python developers with hackathon experience",
]

export function MatchConsole() {
  const [brief, setBrief] = useState("")
  const { status, results, interpretation, total, error, search } = useMatches()

  const run = (text: string) => {
    setBrief(text)
    void search(text)
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          run(brief)
        }}
        className="space-y-3 rounded-xl border bg-card p-4"
      >
        <label htmlFor="match-brief" className="text-sm font-medium">
          Who are you looking for?
        </label>
        <Textarea
          id="match-brief"
          value={brief}
          onChange={(event) => setBrief(event.target.value)}
          placeholder="Find developers for a Solana hackathon with React experience."
          rows={2}
          onKeyDown={(event) => {
            // Enter searches; Shift+Enter adds a new line.
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              if (brief.trim() && status !== "loading") run(brief)
            }
          }}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((example) => (
              <button key={example} type="button" onClick={() => run(example)} className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground">
                {example}
              </button>
            ))}
          </div>
          <Button type="submit" disabled={!brief.trim() || status === "loading"} className="shrink-0">
            {status === "loading" ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
            Find matches
          </Button>
        </div>
      </form>

      {status === "error" ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {status === "done" ? (
        <SectionErrorBoundary label="Results">
        <section aria-live="polite" className="space-y-3">
          {interpretation ? <InterpretationChips interpretation={interpretation} /> : null}
          <p className="text-sm text-muted-foreground">
            {results.length
              ? `${total} ${total === 1 ? "person matches" : "people match"} in ContextOS, ranked by skill evidence, activity and hackathon history.`
              : "Describe skills, a goal (\u201cwho could build a fintech app\u201d), a college, a role or hackathon experience."}
          </p>
          {results.length ? (
            <ol className="space-y-3">
              {results.map((match, index) => (
                <MatchCard key={match.person.slug} match={match} rank={index + 1} />
              ))}
            </ol>
          ) : interpretation && (interpretation.skills.length || interpretation.tavilySkills.length || interpretation.organizations.length) ? (
            <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
              No one matches all of these yet. Remove a filter, or sync more GitHub profiles to widen the pool.
            </p>
          ) : null}
        </section>
        </SectionErrorBoundary>
      ) : null}
    </div>
  )
}
