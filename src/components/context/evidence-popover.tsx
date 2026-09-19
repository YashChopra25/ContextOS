"use client"

import { ArrowUpRight } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { formatDate } from "@/lib/format"
import type { Evidence, SourceType } from "@/lib/types"
import { cn } from "@/lib/utils"
import { SampleTag } from "./sample-tag"
import { SOURCE_LABEL, SourceIcon } from "./source-icon"

export function EvidenceItem({ evidence }: { evidence: Evidence }) {
  const external = evidence.url && /^https?:/.test(evidence.url)
  const body = (
    <>
      <SourceIcon source={evidence.source} className="mt-0.5" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm leading-snug">{evidence.label}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          {SOURCE_LABEL[evidence.source]}
          {evidence.date ? <span>{formatDate(evidence.date)}</span> : null}
          {evidence.isSample ? <SampleTag /> : null}
        </span>
      </span>
      {evidence.url ? <ArrowUpRight className="mt-0.5 size-3.5 text-muted-foreground" aria-hidden /> : null}
    </>
  )
  if (!evidence.url) return <div className="flex items-start gap-2.5 py-2">{body}</div>
  return (
    <a
      href={evidence.url}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="-mx-2 flex items-start gap-2.5 rounded-md px-2 py-2 hover:bg-muted"
    >
      {body}
    </a>
  )
}

/** Small "n sources" trigger that reveals the evidence behind a claim. */
export function EvidencePopover({
  evidence,
  title = "Evidence",
  className,
}: {
  evidence: Evidence[]
  title?: string
  className?: string
}) {
  if (!evidence.length) return null
  const sources = [...new Set(evidence.map((e) => e.source))] as SourceType[]

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "inline-flex h-6 items-center gap-1.5 rounded-md border border-transparent px-1.5 text-xs text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground",
          className,
        )}
        aria-label={`${title}: ${evidence.length} ${evidence.length === 1 ? "source" : "sources"}`}
      >
        <span className="flex items-center gap-1">
          {sources.slice(0, 3).map((source) => (
            <SourceIcon key={source} source={source} className="size-3" />
          ))}
        </span>
        {evidence.length}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3">
        <p className="mb-1 text-xs font-medium text-muted-foreground">{title}</p>
        <div className="divide-y">
          {evidence.map((item, index) => (
            <EvidenceItem key={`${item.label}-${index}`} evidence={item} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
