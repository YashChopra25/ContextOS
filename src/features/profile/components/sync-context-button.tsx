"use client"

import { RefreshCw } from "lucide-react"
import { useEffect } from "react"
import { toast } from "sonner"

import { StageList } from "@/components/context/stage-list"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useContextBuild } from "@/features/tracking/hooks/use-context-build"
import { SYNC_STAGES } from "@/lib/stages"

/** Re-runs Collect → Extract → Build for this person and shows the stages inline. */
export function SyncContextButton({ slug, hasGithub }: { slug: string; hasGithub: boolean }) {
  const build = useContextBuild()
  const running = build.phase === "running"

  useEffect(() => {
    if (build.phase === "done") toast.success("Context rebuilt")
    if (build.phase === "error" && build.error) toast.error("Sync failed", { description: build.error })
  }, [build.phase, build.error])

  return (
    <Popover open={running}>
      <PopoverTrigger
        render={
          <Button variant="outline" disabled={running} onClick={() => void build.resync(slug)} title={hasGithub ? undefined : "No GitHub linked: rebuilds from platform data"} />
        }
      >
        <RefreshCw data-icon="inline-start" className={running ? "animate-spin motion-reduce:animate-none" : undefined} />
        {running ? "Syncing" : "Sync context"}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-4">
        <StageList stages={SYNC_STAGES} state={build.stages} />
      </PopoverContent>
    </Popover>
  )
}
