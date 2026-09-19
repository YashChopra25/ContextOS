"use client"

import { useEffect, useId } from "react"
import { toast } from "sonner"

import { StageList } from "@/components/context/stage-list"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { TRACK_STAGES } from "@/lib/stages"
import type { PersonSummary } from "@/lib/types"
import type { TrackPrefill } from "./tracking-provider"
import { useContextBuild } from "../hooks/use-context-build"
import { useTrackForm } from "../hooks/use-track-form"
import { TrackForm } from "./track-form"
import { TrackResult } from "./track-result"

const firstName = (name: string) => name.trim().split(/\s+/)[0]

export function AddTrackDialog({
  open,
  onOpenChange,
  initialName,
  prefill,
  onTracked,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialName: string
  prefill: TrackPrefill
  onTracked: (person: PersonSummary) => void
}) {
  const formId = useId()
  const form = useTrackForm(initialName, prefill)
  const build = useContextBuild()
  const running = build.phase === "running"

  useEffect(() => {
    if (build.phase === "done" && build.person) {
      toast.success(`${build.person.fullName} is now tracked`, { description: "Context profile created." })
      onTracked(build.person)
    }
    // Only react to the run finishing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [build.phase])

  const submit = () => {
    const input = form.validate()
    if (input) void build.track(input)
  }

  const name = form.values.name.trim()
  const title = name ? `Build ${firstName(name)}'s Context` : "Build a context profile"

  return (
    <Dialog open={open} onOpenChange={(next) => (!running || next) && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md" showCloseButton={!running}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {build.phase === "idle"
              ? "ContextOS resolves who they are, collects public data and extracts skills and signals with evidence."
              : `Tracking ${name || "this person"} across their connected sources.`}
          </DialogDescription>
        </DialogHeader>

        {build.phase === "idle" ? (
          <>
            <TrackForm
              id={formId}
              values={form.values}
              errors={form.errors}
              onChange={form.setField}
              onSubmit={submit}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" form={formId}>
                Start Tracking
              </Button>
            </DialogFooter>
          </>
        ) : null}

        {build.phase === "running" || build.phase === "error" ? (
          <div className="space-y-4">
            <StageList stages={TRACK_STAGES} state={build.stages} className="rounded-lg border p-4" />
            {build.phase === "error" ? (
              <div className="space-y-3">
                <p className="text-sm text-destructive" role="alert">
                  {build.error}
                </p>
                <DialogFooter>
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Close
                  </Button>
                  <Button onClick={build.reset}>Edit details</Button>
                </DialogFooter>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground" aria-live="polite">
                This usually takes a few seconds.
              </p>
            )}
          </div>
        ) : null}

        {build.phase === "done" && build.person ? (
          <TrackResult person={build.person} alreadyExisted={build.alreadyExisted} onClose={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
