"use client"

import { ACTIVITY_META } from "@/components/context/activity-meta"
import { ActivityRow } from "@/components/context/activity-row"
import type { ActivityType, PlatformActivity } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useActivityFeed } from "../hooks/use-activity-feed"

const TYPES: ActivityType[] = ["hackathon", "submission", "team", "comment", "mentorship", "award"]

export function ActivityFeed({ activity }: { activity: PlatformActivity[] }) {
  const { type, setType, counts, groups, total } = useActivityFeed(activity)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Activity type">
        {(["all", ...TYPES] as const).map((value) => {
          const active = type === value
          const Icon = value === "all" ? null : ACTIVITY_META[value].icon
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setType(value)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-full border bg-card px-2.5 text-xs text-muted-foreground hover:text-foreground",
                active && "border-foreground/30 bg-muted font-medium text-foreground",
              )}
            >
              {Icon ? <Icon className="size-3.5" /> : null}
              {value === "all" ? "All" : ACTIVITY_META[value].label}
              <span className="tabular-nums opacity-70">{value === "all" ? activity.length : (counts.get(value) ?? 0)}</span>
            </button>
          )
        })}
      </div>

      {total ? (
        groups.map(({ day, items }) => (
          <section key={day} aria-label={day}>
            <h2 className="mb-1 text-xs font-medium text-muted-foreground">{day}</h2>
            <ul className="divide-y rounded-xl border bg-card px-4">
              {items.map((item) => (
                <ActivityRow key={item.id} activity={item} />
              ))}
            </ul>
          </section>
        ))
      ) : (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No activity of this type yet.</p>
      )}
    </div>
  )
}
