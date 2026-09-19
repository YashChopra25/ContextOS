import type { ContextStatus, Membership } from "@/lib/types"
import { cn } from "@/lib/utils"

const STATUS: Record<ContextStatus, { label: string; dot: string }> = {
  ready: { label: "Context ready", dot: "bg-signal" },
  pending: { label: "GitHub not synced", dot: "bg-muted-foreground/50" },
  syncing: { label: "Syncing", dot: "bg-src-web animate-pulse" },
  failed: { label: "Sync failed", dot: "bg-destructive" },
}

export function ContextStatusLabel({ status, className }: { status: ContextStatus; className?: string }) {
  const { label, dot } = STATUS[status]
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <span className={cn("size-1.5 rounded-full", dot)} aria-hidden />
      {label}
    </span>
  )
}

export function MembershipLabel({ membership }: { membership: Membership }) {
  return (
    <span className="text-xs text-muted-foreground">{membership === "platform" ? "Platform member" : "Tracked"}</span>
  )
}
