import { ACTIVITY_META } from "@/components/context/activity-meta"
import { SampleTag } from "@/components/context/sample-tag"
import { formatDate } from "@/lib/format"
import type { HackathonEntry, PlatformActivity } from "@/lib/types"
import { EmptyNote, ProfileSection } from "./profile-section"

export function PlatformActivitySection({ activity, hackathons }: { activity: PlatformActivity[]; hackathons: HackathonEntry[] }) {
  const hasSample = activity.some((a) => a.isSample)
  return (
    <ProfileSection
      id="activity"
      title="Platform activity"
      meta={hackathons.length ? `${hackathons.length} ${hackathons.length === 1 ? "hackathon" : "hackathons"}` : undefined}
    >
      {activity.length ? (
        <ol className="relative py-1">
          {activity.map((item, index) => {
            const { icon: Icon, label } = ACTIVITY_META[item.type]
            return (
              <li key={item.id} className="relative flex gap-3 pb-4 last:pb-1">
                {index < activity.length - 1 ? <span className="absolute top-7 bottom-0 left-3 w-px bg-border" aria-hidden /> : null}
                <span className="z-10 grid size-6 shrink-0 place-items-center rounded-full border bg-card text-muted-foreground" title={label}>
                  <Icon className="size-3.5" />
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="text-sm">
                    {item.title}
                    {item.detail && item.type !== "submission" ? <span className="text-muted-foreground">, {item.detail.toLowerCase()}</span> : null}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{label}</span>
                    {item.hackathon && !item.title.includes(item.hackathon) ? <span>{item.hackathon}</span> : null}
                    <span>{formatDate(item.occurredAt)}</span>
                    {item.isSample ? <SampleTag /> : null}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      ) : (
        <EmptyNote>No platform activity yet.</EmptyNote>
      )}
      {hasSample ? (
        <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">
          Events marked Sample stand in for hackathon history until your platform&apos;s activity data is connected.
        </p>
      ) : null}
    </ProfileSection>
  )
}
