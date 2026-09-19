import Link from "next/link"
import { MapPin, MessagesSquare } from "lucide-react"

import { ContextStatusLabel, MembershipLabel } from "@/components/context/context-status"
import { PersonAvatar } from "@/components/context/person-avatar"
import { RelativeTime } from "@/components/context/relative-time"
import { SOURCE_LABEL, SourceIcon } from "@/components/context/source-icon"
import { Button } from "@/components/ui/button"
import type { PersonProfile } from "@/lib/types"
import { SyncContextButton } from "./sync-context-button"

export function ProfileHeader({ person }: { person: PersonProfile }) {
  const role = [person.jobTitle, person.organization].filter(Boolean).join(" at ")
  const links = person.connectedSources.filter((s) => s.url && s.type !== "platform")

  return (
    <header className="mb-6 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
      <div className="flex min-w-0 gap-4">
        <PersonAvatar name={person.fullName} src={person.avatarUrl} className="size-14 text-base" />
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">{person.fullName}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {role || "Role not provided"}
            {person.location ? (
              <span className="ml-3 inline-flex items-center gap-1">
                <MapPin className="size-3.5" />
                {person.location}
              </span>
            ) : null}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <MembershipLabel membership={person.membership} />
            <ContextStatusLabel status={person.contextStatus} />
            {person.contextBuiltAt ? (
              <span className="text-xs text-muted-foreground">
                Built <RelativeTime iso={person.contextBuiltAt} />
              </span>
            ) : null}
          </div>
          {links.length ? (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {links.map((source) => (
                <li key={source.type}>
                  <a
                    href={source.url!}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-7 items-center gap-1.5 rounded-md border bg-card px-2 text-xs hover:bg-muted"
                    title={source.status === "failed" ? "Could not be reached during the last sync" : undefined}
                  >
                    <SourceIcon source={source.type} />
                    <span className={source.type === "github" ? "font-mono" : undefined}>{source.handle ?? SOURCE_LABEL[source.type]}</span>
                    {source.status === "failed" ? <span className="text-destructive">unreachable</span> : null}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="outline" nativeButton={false} render={<Link href={`/agent?q=${encodeURIComponent(`Tell me about ${person.fullName}`)}`} />}>
          <MessagesSquare data-icon="inline-start" />
          Ask agent
        </Button>
        <SyncContextButton slug={person.slug} hasGithub={Boolean(person.githubUsername)} />
      </div>
    </header>
  )
}
