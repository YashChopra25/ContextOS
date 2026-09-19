import { cn } from "@/lib/utils"

/** Marks records generated as stand-ins for platform activity the dataset doesn't include. */
export function SampleTag({ className }: { className?: string }) {
  return (
    <span
      title="Sample platform data. The registration dataset has no activity history yet."
      className={cn("rounded border border-dashed px-1 py-px text-[10px] leading-none text-muted-foreground", className)}
    >
      Sample
    </span>
  )
}
