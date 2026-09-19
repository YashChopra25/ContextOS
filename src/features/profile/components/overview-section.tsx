import type { PersonProfile } from "@/lib/types"
import { ProfileSection } from "./profile-section"

export function OverviewSection({ person }: { person: PersonProfile }) {
  const author = person.summaryModel === "tavily" ? "From Tavily web research on their GitHub handle" : "Composed from extracted facts"
  return (
    <ProfileSection id="overview" title="Overview" meta={author}>
      <p className="max-w-prose py-1 text-[15px] leading-relaxed">{person.summary ?? "No summary yet. Sync context to build one."}</p>
      {person.bio ? <p className="mt-2 max-w-prose text-sm text-muted-foreground">GitHub bio: {person.bio}</p> : null}
    </ProfileSection>
  )
}
