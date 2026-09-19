"use client"

import { useMemo, useState } from "react"

import { formatDate } from "@/lib/format"
import type { ActivityType, PlatformActivity } from "@/lib/types"

export type ActivityFilter = ActivityType | "all"

/** Filters platform activity by type and groups it by day for the timeline. */
export function useActivityFeed(activity: PlatformActivity[]) {
  const [type, setType] = useState<ActivityFilter>("all")

  const counts = useMemo(() => {
    const map = new Map<ActivityType, number>()
    for (const item of activity) map.set(item.type, (map.get(item.type) ?? 0) + 1)
    return map
  }, [activity])

  const groups = useMemo(() => {
    const filtered = type === "all" ? activity : activity.filter((item) => item.type === type)
    const byDay = new Map<string, PlatformActivity[]>()
    for (const item of filtered) {
      const day = formatDate(item.occurredAt, { month: "long" })
      byDay.set(day, [...(byDay.get(day) ?? []), item])
    }
    return [...byDay.entries()].map(([day, items]) => ({ day, items }))
  }, [activity, type])

  return { type, setType, counts, groups, total: groups.reduce((sum, g) => sum + g.items.length, 0) }
}
