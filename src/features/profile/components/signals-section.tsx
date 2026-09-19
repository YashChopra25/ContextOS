import { ConfidenceMeter } from "@/components/context/confidence-meter"
import { EvidencePopover } from "@/components/context/evidence-popover"
import type { ContextSignal } from "@/lib/types"
import { EmptyNote, ProfileSection } from "./profile-section"

export function SignalsSection({ signals }: { signals: ContextSignal[] }) {
  return (
    <ProfileSection id="signals" title="Context signals">
      {signals.length ? (
        <dl className="divide-y">
          {signals.map((signal) => (
            <div key={signal.key} className="py-3 first:pt-1">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-xs text-muted-foreground">{signal.label}</dt>
                <div className="flex items-center gap-1">
                  <ConfidenceMeter confidence={signal.strength} showLabel={false} />
                  <EvidencePopover evidence={signal.evidence} title={signal.label} />
                </div>
              </div>
              <dd className="mt-0.5">
                <p className="text-sm font-medium">{signal.value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{signal.detail}</p>
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <EmptyNote>Signals appear after the first context build.</EmptyNote>
      )}
    </ProfileSection>
  )
}
