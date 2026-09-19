const DAY_MS = 86_400_000

/** Stable, timezone-independent date label (safe for server + client rendering). */
export function formatDate(iso: string | null | undefined, options: { month?: "short" | "long"; day?: boolean } = {}) {
  if (!iso) return "Unknown date"
  return new Date(iso).toLocaleDateString("en-US", {
    month: options.month ?? "short",
    day: options.day === false ? undefined : "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
}

export function relativeTime(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return "never"
  const diff = now - new Date(iso).getTime()
  if (diff < 60_000) return "just now"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < DAY_MS) return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 30 * DAY_MS) return `${Math.floor(diff / DAY_MS)}d ago`
  if (diff < 365 * DAY_MS) return `${Math.floor(diff / (30 * DAY_MS))}mo ago`
  return `${Math.floor(diff / (365 * DAY_MS))}y ago`
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

export const plural = (count: number, singular: string, pluralForm = `${singular}s`) =>
  `${count.toLocaleString("en-US")} ${count === 1 ? singular : pluralForm}`
