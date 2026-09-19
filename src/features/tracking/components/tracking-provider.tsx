"use client"

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react"

import type { PersonSummary } from "@/lib/types"
import { AddTrackDialog } from "./add-track-dialog"

export interface TrackPrefill {
  githubUrl?: string
  linkedinUrl?: string
  portfolioUrl?: string
}

interface OpenOptions {
  name?: string
  prefill?: TrackPrefill
  onTracked?: (person: PersonSummary) => void
}

const TrackingContext = createContext<((options?: OpenOptions) => void) | null>(null)

/** Lets any screen (agent, people, overview) open the Add & Track wizard. */
export function TrackingProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [prefill, setPrefill] = useState<TrackPrefill>({})
  const [session, setSession] = useState(0)
  const onTrackedRef = useRef<OpenOptions["onTracked"]>(undefined)

  const openTracking = useCallback((options: OpenOptions = {}) => {
    onTrackedRef.current = options.onTracked
    setName(options.name ?? "")
    setPrefill(options.prefill ?? {})
    setSession((n) => n + 1)
    setOpen(true)
  }, [])

  const value = useMemo(() => openTracking, [openTracking])

  return (
    <TrackingContext value={value}>
      {children}
      <AddTrackDialog
        key={session}
        open={open}
        onOpenChange={setOpen}
        initialName={name}
        prefill={prefill}
        onTracked={(person) => onTrackedRef.current?.(person)}
      />
    </TrackingContext>
  )
}

export function useTracking() {
  const openTracking = useContext(TrackingContext)
  if (!openTracking) throw new Error("useTracking must be used inside TrackingProvider")
  return openTracking
}
