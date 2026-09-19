import type { Confidence } from "@/lib/types"
import { cn } from "@/lib/utils"

const LEVEL: Record<Confidence, number> = { low: 1, medium: 2, high: 3 }
const LABEL: Record<Confidence, string> = { low: "Low", medium: "Medium", high: "High" }

/** Three-step meter plus a text label, so confidence never relies on colour alone. */
export function ConfidenceMeter({
  confidence,
  showLabel = true,
  className,
}: {
  confidence: Confidence
  showLabel?: boolean
  className?: string
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} title={`${LABEL[confidence]} confidence`}>
      <span className="flex items-end gap-0.5" aria-hidden>
        {[1, 2, 3].map((step) => (
          <span
            key={step}
            className={cn("w-1 rounded-full", step <= LEVEL[confidence] ? "bg-signal" : "bg-border")}
            style={{ height: 4 + step * 3 }}
          />
        ))}
      </span>
      {showLabel ? <span className="text-xs text-muted-foreground">{LABEL[confidence]}</span> : <span className="sr-only">{LABEL[confidence]} confidence</span>}
    </span>
  )
}
