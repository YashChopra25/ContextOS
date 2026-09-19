"use client"

import { useState } from "react"

import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"

const WEEK_MS = 7 * 86_400_000

/**
 * Single-series bar chart of public GitHub events per week (oldest → newest).
 * One hue, 2px gaps, rounded data-ends on the baseline, hover readout, and a table for screen readers.
 */
export function WeeklyActivityChart({ weeks, fetchedAt }: { weeks: number[]; fetchedAt: string }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const max = Math.max(...weeks, 1)
  const end = new Date(fetchedAt).getTime()
  const weekStart = (index: number) => new Date(end - (weeks.length - index) * WEEK_MS).toISOString()
  const total = weeks.reduce((sum, n) => sum + n, 0)

  const readout =
    hovered === null
      ? `${total} events in the last ${weeks.length} weeks`
      : `Week of ${formatDate(weekStart(hovered))}: ${weeks[hovered]} ${weeks[hovered] === 1 ? "event" : "events"}`

  return (
    <figure>
      <figcaption className="mb-2 flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted-foreground">Public events per week</span>
        <span className="tabular-nums" aria-live="polite">
          {readout}
        </span>
      </figcaption>
      <div className="flex h-20 items-end gap-0.5 border-b" onMouseLeave={() => setHovered(null)} aria-hidden>
        {weeks.map((value, index) => (
          <div
            key={index}
            className="flex h-full flex-1 cursor-default items-end"
            onMouseEnter={() => setHovered(index)}
          >
            <div
              className={cn(
                "w-full rounded-t-[4px] bg-chart-1 transition-opacity",
                hovered !== null && hovered !== index && "opacity-40",
                value === 0 && "bg-border",
              )}
              style={{ height: value === 0 ? 2 : `${Math.max(6, (value / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground" aria-hidden>
        <span>{weeks.length} weeks ago</span>
        <span>This week</span>
      </div>
      <table className="sr-only">
        <caption>Public GitHub events per week</caption>
        <thead>
          <tr>
            <th>Week of</th>
            <th>Events</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((value, index) => (
            <tr key={index}>
              <td>{formatDate(weekStart(index))}</td>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
