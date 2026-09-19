import { Check, ChevronRight, Loader2, Minus, X } from "lucide-react"

import type { StageDefinition, StageState } from "@/lib/stages"
import type { StageStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

function StageIcon({ status }: { status: StageStatus }) {
  const base = "grid size-5 shrink-0 place-items-center rounded-full border"
  switch (status) {
    case "active":
      return (
        <span className={cn(base, "border-signal text-signal")}>
          <Loader2 className="size-3 animate-spin motion-reduce:animate-none" />
        </span>
      )
    case "done":
      return (
        <span className={cn(base, "border-signal bg-signal text-background")}>
          <Check className="size-3" strokeWidth={3} />
        </span>
      )
    case "skipped":
      return (
        <span className={cn(base, "border-dashed text-muted-foreground")}>
          <Minus className="size-3" />
        </span>
      )
    case "error":
      return (
        <span className={cn(base, "border-destructive text-destructive")}>
          <X className="size-3" />
        </span>
      )
    default:
      return <span className={cn(base, "border-border")} />
  }
}

const STATUS_TEXT: Record<StageStatus, string> = {
  pending: "Waiting",
  active: "In progress",
  done: "Done",
  skipped: "Skipped",
  error: "Failed",
}

/** A pipeline's stages as a vertical checklist (tracking) or an inline chain (agent). */
export function StageList<Id extends string>({
  stages,
  state,
  layout = "vertical",
  className,
}: {
  stages: StageDefinition<Id>[]
  state: Record<Id, StageState>
  layout?: "vertical" | "inline"
  className?: string
}) {
  if (layout === "inline") {
    return (
      <ol className={cn("flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs", className)} aria-label="Processing steps">
        {stages.map((stage, index) => {
          const { status, detail } = state[stage.id]
          return (
            <li key={stage.id} className="flex items-center gap-1.5" title={detail}>
              {index > 0 ? <ChevronRight className="size-3 text-muted-foreground/60" aria-hidden /> : null}
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full py-0.5 pr-2 pl-0.5",
                  status === "active" && "text-foreground",
                  status === "done" && "text-foreground",
                  (status === "pending" || status === "skipped") && "text-muted-foreground",
                  status === "skipped" && "line-through decoration-muted-foreground/40",
                  status === "error" && "text-destructive",
                )}
              >
                <StageIcon status={status} />
                {stage.label}
                <span className="sr-only">: {STATUS_TEXT[status]}</span>
              </span>
            </li>
          )
        })}
      </ol>
    )
  }

  return (
    <ol className={cn("space-y-0", className)} aria-label="Progress">
      {stages.map((stage, index) => {
        const { status, detail } = state[stage.id]
        return (
          <li key={stage.id} className="relative flex gap-3 pb-4 last:pb-0">
            {index < stages.length - 1 ? (
              <span className={cn("absolute top-6 bottom-1 left-2.5 w-px", status === "done" ? "bg-signal" : "bg-border")} aria-hidden />
            ) : null}
            <StageIcon status={status} />
            <div className="min-w-0 pt-px">
              <p className={cn("text-sm", status === "pending" ? "text-muted-foreground" : "font-medium")}>
                {index + 1}. {stage.label}
                <span className="sr-only">: {STATUS_TEXT[status]}</span>
              </p>
              {detail ? <p className={cn("mt-0.5 text-xs", status === "error" ? "text-destructive" : "text-muted-foreground")}>{detail}</p> : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
