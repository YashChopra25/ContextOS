"use client"

import { ArrowUp, Database, Globe, Layers, RotateCcw } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { EXAMPLE_QUERIES } from "@/features/overview/components/ask-box"
import { SectionErrorBoundary } from "@/components/context/section-error-boundary"
import { useContextAgent } from "../hooks/use-context-agent"
import { AgentTurnView } from "./agent-turn"

const ROUTES = [
  { icon: Database, title: "ContextOS", body: "Membership, skills, projects and platform activity." },
  { icon: Globe, title: "Tavily web research", body: "Public work, anchored on what ContextOS knows, so namesakes are filtered out." },
  { icon: Layers, title: "Both, combined", body: "Context first, then Tavily's answer alongside. Every claim cites its source." },
]

function EmptyState({ onAsk }: { onAsk: (query: string) => void }) {
  return (
    <div className="mx-auto max-w-2xl py-6">
      <h2 className="text-lg font-semibold tracking-tight">Ask the Context Agent</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        The agent queries the Context Layer first, then uses Tavily to research the web. It decides per question what to look for.
      </p>
      <ul className="mt-5 grid gap-3 sm:grid-cols-3">
        {ROUTES.map(({ icon: Icon, title, body }) => (
          <li key={title} className="rounded-lg border bg-card p-3">
            <Icon className="size-4 text-signal" />
            <p className="mt-2 text-sm font-medium">{title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{body}</p>
          </li>
        ))}
      </ul>
      <p className="mt-6 mb-2 text-xs text-muted-foreground">Try one of these</p>
      <ul className="space-y-1">
        {[...EXAMPLE_QUERIES, "What projects has Yash built?", "Tell me about Yash's recent Web3 work."].map((query) => (
          <li key={query}>
            <button type="button" onClick={() => onAsk(query)} className="-mx-2 w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted">
              {query}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function AgentConsole({ initialQuery }: { initialQuery?: string }) {
  const { turns, ask, clear, busy } = useContextAgent()
  const [draft, setDraft] = useState("")
  const endRef = useRef<HTMLDivElement>(null)
  const asked = useRef(false)

  useEffect(() => {
    if (initialQuery && !asked.current) {
      asked.current = true
      void ask(initialQuery)
    }
  }, [ask, initialQuery])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [turns])

  const submit = () => {
    if (!draft.trim() || busy) return
    void ask(draft)
    setDraft("")
  }

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col">
      <div className="flex-1 space-y-10 pb-6">
        {turns.length ? (
          turns.map((turn) => (
            <SectionErrorBoundary key={turn.id} label="Answer">
              <AgentTurnView turn={turn} onAsk={ask} />
            </SectionErrorBoundary>
          ))
        ) : (
          <EmptyState onAsk={ask} />
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
        className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8"
      >
        <div className="flex items-end gap-2 rounded-xl border bg-card p-1.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20">
          <label htmlFor="agent-input" className="sr-only">
            Ask the Context Agent
          </label>
          <Textarea
            id="agent-input"
            value={draft}
            rows={1}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault()
                submit()
              }
            }}
            placeholder="Ask anything about your developer community..."
            className="max-h-40 min-h-9 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          {turns.length ? (
            <Button type="button" variant="ghost" size="icon" aria-label="Clear conversation" onClick={clear} disabled={busy}>
              <RotateCcw />
            </Button>
          ) : null}
          <Button type="submit" size="icon" aria-label="Send" disabled={!draft.trim() || busy}>
            <ArrowUp />
          </Button>
        </div>
      </form>
    </div>
  )
}
