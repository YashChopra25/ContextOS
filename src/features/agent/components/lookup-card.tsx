"use client"

import Link from "next/link"
import { useState } from "react"

import { ConfidenceMeter } from "@/components/context/confidence-meter"
import { ContextStatusLabel, MembershipLabel } from "@/components/context/context-status"
import { PersonAvatar } from "@/components/context/person-avatar"
import { RelativeTime } from "@/components/context/relative-time"
import { SOURCE_LABEL, SourceIcon } from "@/components/context/source-icon"
import { Button } from "@/components/ui/button"
import { useTracking } from "@/features/tracking/components/tracking-provider"
import type { PersonLookup, PersonSummary, WebCandidates } from "@/lib/types"

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}

function FoundCard({ person }: { person: PersonSummary }) {
  const role = [person.jobTitle, person.organization].filter(Boolean).join(", ")
  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <PersonAvatar name={person.fullName} src={person.avatarUrl} className="size-9" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {person.fullName} <span className="font-normal text-muted-foreground">found in platform</span>
          </p>
          <p className="flex flex-wrap items-center gap-x-3 text-xs">
            <MembershipLabel membership={person.membership} />
            <ContextStatusLabel status={person.contextStatus} />
          </p>
        </div>
      </div>
      <dl className="divide-y px-4 py-1">
        <Fact label="Role">{role || <span className="text-muted-foreground">Not provided</span>}</Fact>
        <Fact label="Technical skills">
          {person.topSkills.length ? (
            <span className="flex flex-wrap gap-x-4 gap-y-1">
              {person.topSkills.map((skill) => (
                <span key={skill.name} className="inline-flex items-center gap-1.5">
                  {skill.name}
                  <ConfidenceMeter confidence={skill.confidence} showLabel={false} />
                </span>
              ))}
            </span>
          ) : (
            <span className="text-muted-foreground">None extracted yet</span>
          )}
        </Fact>
        <Fact label="Projects">
          {person.topProjects.length ? person.topProjects.join(", ") : <span className="text-muted-foreground">None yet</span>}
          {person.projectCount > person.topProjects.length ? <span className="text-muted-foreground"> +{person.projectCount - person.topProjects.length} more</span> : null}
        </Fact>
        <Fact label="Hackathons">{person.hackathonCount || <span className="text-muted-foreground">None on the platform</span>}</Fact>
        <Fact label="Recent activity">
          {person.lastActivity ? (
            <>
              {person.lastActivity.title} <RelativeTime iso={person.lastActivity.occurredAt} className="text-muted-foreground" />
            </>
          ) : (
            <span className="text-muted-foreground">None</span>
          )}
        </Fact>
        <Fact label="Profiles">
          {person.links.length ? (
            <span className="flex flex-wrap gap-x-4 gap-y-1">
              {person.links.map((link) => (
                <a
                  key={`${link.type}-${link.url}`}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 hover:underline"
                  title={link.url}
                >
                  <SourceIcon source={link.type} />
                  <span className={link.type === "github" ? "font-mono text-[13px]" : undefined}>
                    {link.type === "github" || link.type === "linkedin" ? (link.handle ?? SOURCE_LABEL[link.type]) : SOURCE_LABEL[link.type]}
                  </span>
                </a>
              ))}
            </span>
          ) : (
            <span className="text-muted-foreground">None linked</span>
          )}
        </Fact>
      </dl>
      <div className="border-t px-4 py-3">
        <Button nativeButton={false} render={<Link href={`/people/${person.slug}`} />}>
          View Context Profile
        </Button>
      </div>
    </div>
  )
}

function NotFoundCard({
  name,
  onTracked,
  candidates,
}: {
  name: string
  onTracked: (person: PersonSummary) => void
  candidates: WebCandidates | null
}) {
  const openTracking = useTracking()
  const [dismissed, setDismissed] = useState(false)
  const first = name.split(/\s+/)[0]

  return (
    <div className="rounded-xl border border-dashed bg-card px-4 py-4">
      <p className="font-medium">{name} isn&apos;t currently in your platform.</p>
      {dismissed ? (
        <p className="mt-1 text-sm text-muted-foreground">Not tracked. You can add {first} any time from People.</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            Would you like to add and track {first}? ContextOS will build a context profile from their GitHub, LinkedIn or portfolio.
          </p>
          {candidates ? (
            <div className="mt-3 rounded-lg border bg-background px-3 py-2">
              <p className="text-xs text-muted-foreground">Tavily found these public profiles. Confirm they&apos;re the right person:</p>
              <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {candidates.githubUrl ? (
                  <li className="inline-flex items-center gap-1.5">
                    <SourceIcon source="github" />
                    <a href={candidates.githubUrl} target="_blank" rel="noreferrer" className="font-mono text-[13px] hover:underline">
                      {candidates.githubUrl.replace(/^https?:\/\/(www\.)?/, "")}
                    </a>
                  </li>
                ) : null}
                {candidates.linkedinUrl ? (
                  <li className="inline-flex items-center gap-1.5">
                    <SourceIcon source="linkedin" />
                    <a href={candidates.linkedinUrl} target="_blank" rel="noreferrer" className="hover:underline">
                      {candidates.linkedinUrl.replace(/^https?:\/\/([a-z]{2,3}\.)?/, "")}
                    </a>
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}
          <div className="mt-3 flex gap-2">
            <Button
              onClick={() =>
                openTracking({
                  name,
                  onTracked,
                  prefill: { githubUrl: candidates?.githubUrl ?? "", linkedinUrl: candidates?.linkedinUrl ?? "" },
                })
              }
            >
              Add &amp; Track
            </Button>
            <Button variant="outline" onClick={() => setDismissed(true)}>
              Cancel
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

function AmbiguousCard({
  name,
  candidates,
  onPick,
  similar = false,
}: {
  name: string
  candidates: PersonSummary[]
  onPick: (person: PersonSummary) => void
  similar?: boolean
}) {
  const openTracking = useTracking()
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <p className="text-sm font-medium">{similar ? "Did you mean one of these?" : <>Which &ldquo;{name}&rdquo; do you mean?</>}</p>
      {similar ? <p className="mt-0.5 text-xs text-muted-foreground">No exact match for &ldquo;{name}&rdquo;. These names are the closest in your platform.</p> : null}
      <ul className="mt-2 divide-y">
        {candidates.map((person) => (
          <li key={person.slug}>
            <button type="button" onClick={() => onPick(person)} className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-muted">
              <PersonAvatar name={person.fullName} src={person.avatarUrl} className="size-7" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{person.fullName}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {[person.jobTitle, person.organization].filter(Boolean).join(", ") || "Role unknown"}
                </span>
              </span>
              <ContextStatusLabel status={person.contextStatus} />
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => openTracking({ name })} className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
        None of these. Add &amp; track {name}
      </button>
    </div>
  )
}

/** Swaps the name in the original question, e.g. "Tell me about Yash" → "Tell me about Yash Chopra". */
const withName = (query: string, from: string, to: string) =>
  query.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), to)

export function LookupCard({
  lookup,
  onAsk,
  originalQuery,
  webCandidates,
}: {
  lookup: PersonLookup
  onAsk: (query: string) => void
  originalQuery: string
  webCandidates: WebCandidates | null
}) {
  if (lookup.status === "found") return <FoundCard person={lookup.person} />
  if (lookup.status === "ambiguous" || lookup.status === "similar") {
    return (
      <AmbiguousCard
        name={lookup.name}
        candidates={lookup.candidates}
        similar={lookup.status === "similar"}
        onPick={(p) => onAsk(withName(originalQuery, lookup.name, p.fullName))}
      />
    )
  }
  // Once tracked, ask again: the same question now resolves to the new profile.
  return (
    <NotFoundCard
      name={lookup.name}
      candidates={webCandidates}
      onTracked={(person) => onAsk(withName(originalQuery, lookup.name, person.fullName))}
    />
  )
}
