import Link from "next/link"

import { ConfidenceMeter } from "@/components/context/confidence-meter"
import { ContextStatusLabel } from "@/components/context/context-status"
import { PersonAvatar } from "@/components/context/person-avatar"
import { RelativeTime } from "@/components/context/relative-time"
import { SourceStack } from "@/components/context/source-icon"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { ActivityLevel, PersonSummary } from "@/lib/types"
import { cn } from "@/lib/utils"

const ACTIVITY_LABEL: Record<ActivityLevel, string> = { high: "High", medium: "Medium", low: "Low" }

function ActivityCell({ person }: { person: PersonSummary }) {
  return (
    <div className="min-w-0">
      <p className={cn("text-sm", person.activityLevel === "low" && "text-muted-foreground")}>{ACTIVITY_LABEL[person.activityLevel]}</p>
      {person.lastActivity && person.lastActivity.title !== "Registered on DevMatch" ? (
        <p className="truncate text-xs text-muted-foreground">
          <RelativeTime iso={person.lastActivity.occurredAt} />
        </p>
      ) : null}
    </div>
  )
}

function Identity({ person }: { person: PersonSummary }) {
  return (
    <Link href={`/people/${person.slug}`} className="flex min-w-0 items-center gap-3">
      <PersonAvatar name={person.fullName} src={person.avatarUrl} />
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium group-hover:underline">{person.fullName}</span>
          {person.membership === "tracked" ? <span className="rounded border px-1 text-[10px] text-muted-foreground">Tracked</span> : null}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {[person.jobTitle, person.organization].filter(Boolean).join(", ") || "Role unknown"}
        </span>
      </span>
    </Link>
  )
}

function Skills({ person }: { person: PersonSummary }) {
  if (!person.topSkills.length) return <span className="text-xs text-muted-foreground">None yet</span>
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1">
      {person.topSkills.slice(0, 3).map((skill) => (
        <span key={skill.name} className="inline-flex items-center gap-1 text-xs">
          {skill.name}
          <ConfidenceMeter confidence={skill.confidence} showLabel={false} />
        </span>
      ))}
    </span>
  )
}

/** Table on wide screens, stacked rows on narrow ones. */
export function PeopleTable({ people }: { people: PersonSummary[] }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[25%] pl-4">Name</TableHead>
              <TableHead className="w-[24%]">Skills</TableHead>
              <TableHead className="w-[14%]">Projects</TableHead>
              <TableHead className="w-[8%] text-right">Hackathons</TableHead>
              <TableHead className="w-[9%] pl-6">Activity</TableHead>
              <TableHead className="w-[10%]">Context</TableHead>
              <TableHead className="w-[10%] pr-4">Sources</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {people.map((person) => (
              <TableRow key={person.slug} className="group">
                <TableCell className="pl-4">
                  <Identity person={person} />
                </TableCell>
                <TableCell>
                  <Skills person={person} />
                </TableCell>
                <TableCell className="truncate text-xs text-muted-foreground" title={person.topProjects.join(", ")}>
                  {person.projectCount ? (
                    <>
                      <span className="text-foreground tabular-nums">{person.projectCount}</span> {person.topProjects.slice(0, 2).join(", ")}
                    </>
                  ) : (
                    "None"
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{person.hackathonCount || <span className="text-muted-foreground">0</span>}</TableCell>
                <TableCell className="pl-6">
                  <ActivityCell person={person} />
                </TableCell>
                <TableCell>
                  <ContextStatusLabel status={person.contextStatus} />
                </TableCell>
                <TableCell className="pr-4">
                  <SourceStack sources={person.sources} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="divide-y rounded-xl border bg-card px-4 md:hidden">
        {people.map((person) => (
          <li key={person.slug} className="space-y-2 py-3">
            <Identity person={person} />
            <Skills person={person} />
            <div className="flex items-center justify-between">
              <ContextStatusLabel status={person.contextStatus} />
              <SourceStack sources={person.sources} />
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
