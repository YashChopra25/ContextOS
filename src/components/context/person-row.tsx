import Link from "next/link"

import type { PersonSummary } from "@/lib/types"
import { ConfidenceMeter } from "./confidence-meter"
import { ContextStatusLabel } from "./context-status"
import { PersonAvatar } from "./person-avatar"
import { SourceStack } from "./source-icon"

/** Compact person line used in lists: identity, strongest skills, sources. */
export function PersonRow({ person }: { person: PersonSummary }) {
  const role = [person.jobTitle, person.organization].filter(Boolean).join(", ")
  return (
    <li>
      <Link href={`/people/${person.slug}`} className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted">
        <PersonAvatar name={person.fullName} src={person.avatarUrl} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{person.fullName}</p>
          <p className="truncate text-xs text-muted-foreground">{role || "Role unknown"}</p>
        </div>
        <div className="hidden min-w-0 items-center gap-3 sm:flex">
          {person.topSkills.slice(0, 2).map((skill) => (
            <span key={skill.name} className="flex items-center gap-1.5 text-xs">
              {skill.name}
              <ConfidenceMeter confidence={skill.confidence} showLabel={false} />
            </span>
          ))}
        </div>
        <div className="flex w-24 shrink-0 flex-col items-end gap-1">
          <SourceStack sources={person.sources} />
          <ContextStatusLabel status={person.contextStatus} className="text-[11px]" />
        </div>
      </Link>
    </li>
  )
}
