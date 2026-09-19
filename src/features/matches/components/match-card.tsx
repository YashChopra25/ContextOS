import Link from "next/link"

import { ConfidenceMeter } from "@/components/context/confidence-meter"
import { EvidencePopover } from "@/components/context/evidence-popover"
import { PersonAvatar } from "@/components/context/person-avatar"
import { SourceStack } from "@/components/context/source-icon"
import type { MatchResult } from "@/lib/types"
import { cn } from "@/lib/utils"

/** One ranked person with the reasoning and evidence behind the ranking. */
export function MatchCard({ match, rank, compact = false }: { match: MatchResult; rank: number; compact?: boolean }) {
  const { person } = match
  return (
    <li className={cn("flex gap-3", compact ? "py-2.5" : "rounded-xl border bg-card p-4")}>
      <span className="w-5 pt-1.5 text-right text-xs text-muted-foreground tabular-nums">{rank}</span>
      <PersonAvatar name={person.fullName} src={person.avatarUrl} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link href={`/people/${person.slug}`} className="font-medium hover:underline">
            {person.fullName}
          </Link>
          <span className="truncate text-xs text-muted-foreground">
            {[person.jobTitle, person.organization].filter(Boolean).join(", ")}
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
          {match.matchedSkills.map((skill) => (
            <span key={skill.name} className="inline-flex items-center gap-1.5 text-sm">
              {skill.name}
              <ConfidenceMeter confidence={skill.confidence} showLabel={false} />
            </span>
          ))}
          {match.missingSkills.map((skill) => (
            <span key={skill} className="text-sm text-muted-foreground line-through decoration-muted-foreground/50" title={`No evidence for ${skill}`}>
              {skill}
            </span>
          ))}
        </div>
        {!compact ? <p className="mt-2 text-sm text-muted-foreground">{match.explanation}</p> : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="text-sm font-semibold tabular-nums" title="Match score out of 100">
          {match.score}
        </span>
        {compact ? <SourceStack sources={person.sources} /> : <EvidencePopover evidence={match.evidence} title="Why this match" />}
      </div>
    </li>
  )
}
