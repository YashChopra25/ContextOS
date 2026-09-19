"use client"

import { ArrowUp } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const EXAMPLE_QUERIES = [
  "Is Yash Chopra in our platform?",
  "Tell me about Yash Chopra",
  "Find developers with Solana experience",
  "Who has built blockchain projects?",
]

/** Entry point to the Context Agent. Submitting opens the agent with the question. */
export function AskBox({ className, autoFocus = false }: { className?: string; autoFocus?: boolean }) {
  const router = useRouter()
  const [query, setQuery] = useState("")

  const ask = (text: string) => {
    const q = text.trim()
    if (q) router.push(`/agent?q=${encodeURIComponent(q)}`)
  }

  return (
    <div className={cn("space-y-3", className)}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          ask(query)
        }}
        className="flex items-center gap-2 rounded-xl border bg-card p-1.5 pl-4 shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20"
      >
        <label htmlFor="ask-contextos" className="sr-only">
          Ask the Context Agent
        </label>
        <input
          id="ask-contextos"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ask anything about your developer community..."
          autoFocus={autoFocus}
          autoComplete="off"
          className="h-9 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground focus-visible:outline-none"
        />
        <Button type="submit" size="icon" aria-label="Ask" disabled={!query.trim()}>
          <ArrowUp />
        </Button>
      </form>
      <div className="flex flex-wrap gap-1.5">
        {EXAMPLE_QUERIES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => ask(example)}
            className="rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground hover:border-foreground/20 hover:text-foreground"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  )
}
