import type { Metadata } from "next"

import { PageHeader } from "@/components/layout/page-header"
import { AgentConsole } from "@/features/agent/components/agent-console"

export const metadata: Metadata = { title: "AI Agent" }

export default async function AgentPage({ searchParams }: PageProps<"/agent">) {
  const { q } = await searchParams
  const initialQuery = typeof q === "string" ? q : undefined

  return (
    <>
      <PageHeader
        title="Context Agent"
        description="Answers from ContextOS data and, when needed, the web. Each answer shows how it was routed and the evidence behind it."
      />
      {/* Remount per query so a new ?q= from the Overview starts a fresh conversation. */}
      <AgentConsole key={initialQuery ?? "empty"} initialQuery={initialQuery} />
    </>
  )
}
