import { ArrowUpRight } from "lucide-react"

import { EvidenceItem } from "@/components/context/evidence-popover"
import { SourceIcon } from "@/components/context/source-icon"
import type { Evidence, SourceRef } from "@/lib/types"

export function EvidenceList({ evidence }: { evidence: Evidence[] }) {
  if (!evidence.length) return null
  return (
    <section aria-label="Evidence">
      <h3 className="mb-1 text-xs font-medium text-muted-foreground">Evidence</h3>
      <div className="grid gap-x-6 sm:grid-cols-2">
        {evidence.map((item, index) => (
          <EvidenceItem key={`${item.label}-${index}`} evidence={item} />
        ))}
      </div>
    </section>
  )
}

export function SourceList({ sources }: { sources: SourceRef[] }) {
  if (!sources.length) return null
  return (
    <section aria-label="Sources">
      <h3 className="mb-2 text-xs font-medium text-muted-foreground">Sources</h3>
      <ol className="flex flex-wrap gap-1.5">
        {sources.map((source, index) => {
          const external = source.url && /^https?:/.test(source.url)
          const content = (
            <>
              <span className="text-muted-foreground tabular-nums">{index + 1}</span>
              <SourceIcon source={source.type} />
              <span className="max-w-56 truncate">{source.title}</span>
              {external ? <ArrowUpRight className="size-3 text-muted-foreground" aria-hidden /> : null}
            </>
          )
          return (
            <li key={`${source.title}-${index}`}>
              {source.url ? (
                <a
                  href={source.url}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noreferrer" : undefined}
                  title={source.snippet ?? source.title}
                  className="inline-flex h-7 items-center gap-1.5 rounded-md border bg-background px-2 text-xs hover:bg-muted"
                >
                  {content}
                </a>
              ) : (
                <span className="inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs">{content}</span>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
