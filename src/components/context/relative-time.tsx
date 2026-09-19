"use client"

import { formatDate, relativeTime } from "@/lib/format"

/** Relative time that tolerates the server/client clock difference. */
export function RelativeTime({ iso, className }: { iso: string | null; className?: string }) {
  return (
    <time dateTime={iso ?? undefined} title={formatDate(iso)} className={className} suppressHydrationWarning>
      {relativeTime(iso)}
    </time>
  )
}
