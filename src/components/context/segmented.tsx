"use client"

import { cn } from "@/lib/utils"

/** Small single-choice control for filters with 2–4 options. */
export function Segmented<Value extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: Value
  options: { value: Value; label: string }[]
  onChange: (value: Value) => void
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex h-8 items-center rounded-md border bg-card p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "h-full rounded-[5px] px-2.5 text-xs text-muted-foreground hover:text-foreground",
            value === option.value && "bg-muted font-medium text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
