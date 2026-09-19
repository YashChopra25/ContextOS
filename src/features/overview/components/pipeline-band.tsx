import Link from "next/link"
import { Search, Target, MessagesSquare } from "lucide-react"

import { SOURCE_LABEL, SourceIcon } from "@/components/context/source-icon"
import { LogoMark } from "@/components/app-shell/logo"
import { plural } from "@/lib/format"
import type { LayerStats, SourceType } from "@/lib/types"

function Connector() {
  return (
    <svg className="hidden h-full w-10 shrink-0 self-stretch text-signal md:block" viewBox="0 0 40 100" preserveAspectRatio="none" aria-hidden>
      <path d="M0 50 H40" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" className="animate-context-flow" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function Column({ title, caption, children }: { title: string; caption: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 flex-1 py-4 md:py-0">
      <p className="text-sm font-medium">{title}</p>
      <p className="mb-3 text-xs text-muted-foreground">{caption}</p>
      {children}
    </div>
  )
}

/**
 * The product in one picture: raw sources flow into the Context Engine, which powers
 * the agent, search and matching. Numbers are live from Postgres.
 */
export function PipelineBand({ stats, webEnabled }: { stats: LayerStats; webEnabled: boolean }) {
  const dataRows: { source: SourceType; value: string }[] = [
    { source: "platform", value: `${plural(stats.platformMembers, "member")}, ${plural(stats.activities, "event")}` },
    { source: "github", value: `${plural(stats.sources.github, "account")}, ${plural(stats.repos, "repo")}` },
    { source: "linkedin", value: plural(stats.sources.linkedin, "profile") },
    { source: "web", value: webEnabled ? `Tavily, ${plural(stats.sources.web, "lookup")}` : "Tavily not configured" },
  ]

  const outputs = [
    { href: "/agent", label: "Context Agent", icon: MessagesSquare, caption: "Ask in plain language" },
    { href: "/people", label: "Search", icon: Search, caption: "Filter by skill and activity" },
    { href: "/matches", label: "Matching", icon: Target, caption: "Rank people for a brief" },
  ]

  return (
    <section aria-label="How ContextOS works" className="rounded-xl border bg-card px-5 py-4 md:flex md:gap-2 md:py-5">
      <Column title="Data" caption="Where facts come from">
        <ul className="space-y-2">
          {dataRows.map(({ source, value }) => (
            <li key={source} className="flex items-center gap-2 text-sm">
              <SourceIcon source={source} />
              <span className="w-16 shrink-0">{SOURCE_LABEL[source]}</span>
              <span className="truncate text-muted-foreground">{value}</span>
            </li>
          ))}
        </ul>
      </Column>

      <Connector />

      <Column title="Context" caption="Structured, evidence-backed profiles">
        <div className="rounded-lg border border-signal/30 bg-signal-soft p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-signal-foreground">
            <LogoMark className="size-4" />
            Context Engine
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2">
            {[
              ["Profiles", stats.readyContexts],
              ["Skills", stats.skills],
              ["Signals", stats.signals],
            ].map(([label, value]) => (
              <div key={label}>
                <dd className="text-lg font-semibold tabular-nums leading-none">{Number(value).toLocaleString("en-US")}</dd>
                <dt className="mt-1 text-xs text-muted-foreground">{label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </Column>

      <Connector />

      <Column title="Intelligence" caption="What the context powers">
        <ul className="space-y-1">
          {outputs.map(({ href, label, icon: Icon, caption }) => (
            <li key={href}>
              <Link href={href} className="-mx-2 flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted">
                <Icon className="size-4 text-muted-foreground" />
                <span className="text-sm">{label}</span>
                <span className="ml-auto truncate text-xs text-muted-foreground">{caption}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Column>
    </section>
  )
}
