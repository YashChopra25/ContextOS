"use client"

import { UserPlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useTracking } from "./tracking-provider"

export function TrackButton({ name, label = "Add & Track", variant = "default" }: { name?: string; label?: string; variant?: "default" | "outline" }) {
  const openTracking = useTracking()
  return (
    <Button variant={variant} onClick={() => openTracking({ name })}>
      <UserPlus data-icon="inline-start" />
      {label}
    </Button>
  )
}
