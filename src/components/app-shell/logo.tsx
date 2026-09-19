import { cn } from "@/lib/utils"

/** Three inputs converging into one node: data becoming context. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={cn("size-5", className)}>
      <circle cx="4" cy="5" r="2" fill="currentColor" opacity=".45" />
      <circle cx="4" cy="12" r="2" fill="currentColor" opacity=".65" />
      <circle cx="4" cy="19" r="2" fill="currentColor" opacity=".85" />
      <path d="M6 5c5 0 5 7 9 7M6 12h9M6 19c5 0 5-7 9-7" stroke="currentColor" strokeWidth="1.5" opacity=".6" />
      <rect x="15" y="8" width="8" height="8" rx="2.5" className="fill-signal" />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2 text-[15px] font-semibold tracking-tight", className)}>
      <LogoMark />
      ContextOS
    </span>
  )
}
