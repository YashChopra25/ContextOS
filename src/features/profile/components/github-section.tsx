import { ArrowUpRight, Star } from "lucide-react"

import { RelativeTime } from "@/components/context/relative-time"
import type { GithubActivity } from "@/lib/types"
import { EmptyNote, ProfileSection } from "./profile-section"
import { WeeklyActivityChart } from "./weekly-activity-chart"

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dd className="text-lg font-semibold tabular-nums leading-tight">{value.toLocaleString("en-US")}</dd>
      <dt className="text-xs text-muted-foreground">{label}</dt>
    </div>
  )
}

export function GithubSection({ github, username }: { github: GithubActivity | null; username: string | null }) {
  if (!github) {
    return (
      <ProfileSection id="github" title="GitHub activity">
        <EmptyNote>
          {username ? (
            <>
              <span className="font-mono">{username}</span> hasn&apos;t been synced yet. Use Sync context to collect repositories and activity.
            </>
          ) : (
            "No GitHub account linked."
          )}
        </EmptyNote>
      </ProfileSection>
    )
  }

  const original = github.repos.filter((r) => !r.isFork)
  const languages = github.languages.slice(0, 5)
  const otherShare = Math.max(0, 1 - languages.reduce((sum, l) => sum + l.share, 0))

  return (
    <ProfileSection
      id="github"
      title="GitHub activity"
      meta={
        <>
          Synced <RelativeTime iso={github.fetchedAt} />
        </>
      }
    >
      <div className="space-y-5 py-1">
        <dl className="grid grid-cols-4 gap-3">
          <Stat label="Public repos" value={github.publicRepos} />
          <Stat label="Original" value={original.length} />
          <Stat label="Commits, 90 days" value={github.commits90d} />
          <Stat label="Followers" value={github.followers} />
        </dl>

        <WeeklyActivityChart weeks={github.weeklyActivity} fetchedAt={github.fetchedAt} />

        {languages.length ? (
          <div>
            <p className="mb-2 text-xs text-muted-foreground">Languages across original repositories</p>
            <ul className="space-y-1.5">
              {[...languages, ...(otherShare >= 0.01 ? [{ name: "Other", share: otherShare }] : [])].map((language) => (
                <li key={language.name} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-3 text-sm">
                  <span className="truncate">{language.name}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-muted">
                    <span
                      className={language.name === "Other" ? "block h-full rounded-full bg-muted-foreground/40" : "block h-full rounded-full bg-chart-1"}
                      style={{ width: `${Math.max(language.share * 100, 2)}%` }}
                    />
                  </span>
                  <span className="text-right text-xs tabular-nums text-muted-foreground">{Math.round(language.share * 100)}%</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div>
          <p className="mb-1 text-xs text-muted-foreground">Recently pushed</p>
          <ul className="divide-y">
            {original.slice(0, 5).map((repo) => (
              <li key={repo.name} className="flex items-center gap-3 py-2">
                <a href={repo.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 font-mono text-[13px] hover:underline">
                    {repo.name}
                    <ArrowUpRight className="size-3 text-muted-foreground" />
                  </span>
                  {repo.description ? <span className="block truncate text-xs text-muted-foreground">{repo.description}</span> : null}
                </a>
                {repo.language ? <span className="text-xs text-muted-foreground">{repo.language}</span> : null}
                {repo.stars ? (
                  <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground tabular-nums">
                    <Star className="size-3" />
                    {repo.stars}
                  </span>
                ) : null}
                <RelativeTime iso={repo.pushedAt} className="w-14 text-right text-xs text-muted-foreground" />
              </li>
            ))}
            {!original.length ? <EmptyNote>No original public repositories.</EmptyNote> : null}
          </ul>
        </div>
      </div>
    </ProfileSection>
  )
}
