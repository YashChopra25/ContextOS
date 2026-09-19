import Link from "next/link"
import { CircleCheck } from "lucide-react"

import { ConfidenceMeter } from "@/components/context/confidence-meter"
import { PersonAvatar } from "@/components/context/person-avatar"
import { SourceStack } from "@/components/context/source-icon"
import { Button } from "@/components/ui/button"
import type { PersonSummary } from "@/lib/types"

export function TrackResult({
  person,
  alreadyExisted,
  onClose,
}: {
  person: PersonSummary
  alreadyExisted: boolean
  onClose: () => void
}) {
  return (
    <div className="space-y-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <CircleCheck className="size-4 text-signal" />
        {alreadyExisted ? "Context profile updated successfully." : "Context profile created successfully."}
      </p>
      {alreadyExisted ? (
        <p className="text-sm text-muted-foreground">{person.fullName} was already in ContextOS, so their existing profile was refreshed.</p>
      ) : null}
      <div className="rounded-lg border p-3">
        <div className="flex items-center gap-3">
          <PersonAvatar name={person.fullName} src={person.avatarUrl} className="size-9" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{person.fullName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {person.projectCount} {person.projectCount === 1 ? "project" : "projects"}
              {person.topSkills.length ? ", strongest skills below" : ", no skills extracted yet"}
            </p>
          </div>
          <SourceStack sources={person.sources} />
        </div>
        {person.topSkills.length ? (
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t pt-3">
            {person.topSkills.map((skill) => (
              <li key={skill.name} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{skill.name}</span>
                <ConfidenceMeter confidence={skill.confidence} showLabel={false} />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onClose}>
          Done
        </Button>
        <Button nativeButton={false} render={<Link href={`/people/${person.slug}`} onClick={onClose} />}>
          View Context Profile
        </Button>
      </div>
    </div>
  )
}
