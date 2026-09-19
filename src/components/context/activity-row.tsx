import Link from "next/link"

import type { PlatformActivity } from "@/lib/types"
import { ACTIVITY_META } from "./activity-meta"
import { RelativeTime } from "./relative-time"
import { SampleTag } from "./sample-tag"

/** One platform event: who did what, where, and when. */
export function ActivityRow({ activity, showPerson = true }: { activity: PlatformActivity; showPerson?: boolean }) {
  const { icon: Icon, label } = ACTIVITY_META[activity.type]
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border bg-background text-muted-foreground" title={label}>
        <Icon className="size-3.5" />
        <span className="sr-only">{label}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">
          {showPerson ? (
            <>
              <Link href={`/people/${activity.personSlug}`} className="font-medium hover:underline">
                {activity.personName}
              </Link>{" "}
            </>
          ) : null}
          <span className={showPerson ? "text-muted-foreground" : undefined}>{showPerson ? lowerFirst(activity.title) : activity.title}</span>
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {activity.detail && activity.type !== "submission" ? <span>{activity.detail}</span> : null}
          {activity.hackathon && !activity.title.includes(activity.hackathon) ? <span>{activity.hackathon}</span> : null}
          <RelativeTime iso={activity.occurredAt} />
          {activity.isSample ? <SampleTag /> : null}
        </p>
      </div>
    </li>
  )
}

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1)
