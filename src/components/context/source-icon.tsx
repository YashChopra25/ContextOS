import { Globe, LayoutGrid, Search } from "lucide-react"

import type { SourceType } from "@/lib/types"
import { cn } from "@/lib/utils"

export const SOURCE_LABEL: Record<SourceType, string> = {
  platform: "Platform",
  github: "GitHub",
  linkedin: "LinkedIn",
  portfolio: "Portfolio",
  web: "Web",
}

/** Text colour per source; paired with an icon so colour is never the only cue. */
export const SOURCE_TEXT: Record<SourceType, string> = {
  platform: "text-src-platform",
  github: "text-src-github",
  linkedin: "text-src-linkedin",
  portfolio: "text-src-portfolio",
  web: "text-src-web",
}

function GithubMark(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.82-.26.82-.57v-2c-3.34.72-4.04-1.61-4.04-1.61a3.18 3.18 0 0 0-1.34-1.76c-1.08-.74.09-.73.09-.73a2.52 2.52 0 0 1 1.84 1.24 2.56 2.56 0 0 0 3.5 1 2.56 2.56 0 0 1 .76-1.6c-2.67-.3-5.47-1.34-5.47-5.93a4.64 4.64 0 0 1 1.24-3.22 4.3 4.3 0 0 1 .1-3.18s1-.32 3.3 1.23a11.38 11.38 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23a4.3 4.3 0 0 1 .12 3.18 4.64 4.64 0 0 1 1.23 3.22c0 4.61-2.8 5.62-5.48 5.92a2.87 2.87 0 0 1 .82 2.22v3.29c0 .32.21.69.82.57A12 12 0 0 0 12 .3" />
    </svg>
  )
}

function LinkedinMark(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05a3.74 3.74 0 0 1 3.37-1.85c3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45Z" />
    </svg>
  )
}

const ICONS: Record<SourceType, React.ComponentType<{ className?: string }>> = {
  platform: LayoutGrid,
  github: GithubMark,
  linkedin: LinkedinMark,
  portfolio: Globe,
  web: Search,
}

export function SourceIcon({ source, className }: { source: SourceType; className?: string }) {
  // Unknown values (older data, new source types) fall back to the web icon instead of crashing.
  const Icon = ICONS[source] ?? ICONS.web
  return <Icon className={cn("size-3.5 shrink-0", SOURCE_TEXT[source], className)} />
}

/** Compact row of connected-source icons with an accessible label. */
export function SourceStack({ sources, className }: { sources: SourceType[]; className?: string }) {
  if (!sources.length) return <span className="text-xs text-muted-foreground">None</span>
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} aria-label={`Sources: ${sources.map((s) => SOURCE_LABEL[s]).join(", ")}`}>
      {sources.map((source) => (
        <SourceIcon key={source} source={source} />
      ))}
    </span>
  )
}
