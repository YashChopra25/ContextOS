"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type { TrackErrors, TrackField, TrackValues } from "../hooks/use-track-form"

const FIELDS: { field: TrackField; label: string; placeholder: string; type?: string; hint?: string }[] = [
  { field: "name", label: "Name", placeholder: "Yash Chopra" },
  { field: "githubUrl", label: "GitHub URL", placeholder: "github.com/username", hint: "Repositories, languages and recent activity" },
  { field: "linkedinUrl", label: "LinkedIn URL", placeholder: "linkedin.com/in/name", hint: "Linked for identity; not scraped" },
  { field: "portfolioUrl", label: "Portfolio URL", placeholder: "yourname.dev" },
]

export function TrackForm({
  id,
  values,
  errors,
  onChange,
  onSubmit,
}: {
  id: string
  values: TrackValues
  errors: TrackErrors
  onChange: (field: TrackField, value: string) => void
  onSubmit: () => void
}) {
  return (
    <form
      id={id}
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
      className="space-y-4"
    >
      {FIELDS.map(({ field, label, placeholder, hint }, index) => {
        const error = errors[field]
        const inputId = `${id}-${field}`
        return (
          <div key={field} className={cn("space-y-1.5", index === 1 && "border-t pt-4")}>
            {index === 1 ? (
              <p id={`${id}-sources`} role={errors.sources ? "alert" : undefined} className={cn("text-xs", errors.sources ? "text-destructive" : "text-muted-foreground")}>
                Add at least one professional source.
              </p>
            ) : null}
            <Label htmlFor={inputId}>{label}</Label>
            <Input
              id={inputId}
              value={values[field]}
              placeholder={placeholder}
              autoComplete="off"
              autoFocus={index === 0 && !values.name}
              inputMode={field === "name" ? "text" : "url"}
              aria-invalid={Boolean(error) || (index > 0 && Boolean(errors.sources))}
              aria-describedby={error || hint ? `${inputId}-note` : undefined}
              onChange={(event) => onChange(field, event.target.value)}
            />
            {error || hint ? (
              <p id={`${inputId}-note`} className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}>
                {error ?? hint}
              </p>
            ) : null}
          </div>
        )
      })}
    </form>
  )
}
