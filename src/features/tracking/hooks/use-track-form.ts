"use client"

import { useCallback, useState } from "react"

import { SOURCE_REQUIRED, trackPersonSchema, type TrackPersonInput } from "@/lib/validation"

export type TrackField = keyof TrackPersonInput
export type TrackValues = Record<TrackField, string>
export type TrackErrors = Partial<Record<TrackField | "sources", string>>

const EMPTY: TrackValues = { name: "", githubUrl: "", linkedinUrl: "", portfolioUrl: "" }

/** Form state + validation for Add & Track, using the same schema as the API. */
export function useTrackForm(initialName = "", prefill: Partial<Omit<TrackValues, "name">> = {}) {
  const [values, setValues] = useState<TrackValues>(() => ({ ...EMPTY, ...prefill, name: initialName }))
  const [errors, setErrors] = useState<TrackErrors>({})

  const setField = useCallback((field: TrackField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => (current[field] || current.sources ? { ...current, [field]: undefined, sources: undefined } : current))
  }, [])

  const validate = useCallback((): TrackPersonInput | null => {
    const result = trackPersonSchema.safeParse(values)
    if (result.success) {
      setErrors({})
      return result.data
    }
    const next: TrackErrors = {}
    for (const issue of result.error.issues) {
      const field = issue.path[0] as TrackField
      // The schema reports the "no source at all" rule on githubUrl; treat it as a group error.
      const key = issue.message === SOURCE_REQUIRED ? "sources" : field
      next[key] ??= issue.message
    }
    setErrors(next)
    return null
  }, [values])

  const reset = useCallback((name = "") => {
    setValues({ ...EMPTY, name })
    setErrors({})
  }, [])

  return { values, errors, setField, validate, reset }
}
