import type { Metadata } from "next"

import { PageHeader } from "@/components/layout/page-header"
import { MatchConsole } from "@/features/matches/components/match-console"

export const metadata: Metadata = { title: "Matches" }

export default function MatchesPage() {
  return (
    <>
      <PageHeader
        title="Matches"
        description="Describe who you need. Matching ranks people using their structured skills and the evidence behind them, a downstream use of the Context Layer."
      />
      <MatchConsole />
    </>
  )
}
