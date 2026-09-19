"use client"

import { Search, X } from "lucide-react"

import { Segmented } from "@/components/context/segmented"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { usePeopleFilters } from "../hooks/use-people-filters"

type FiltersApi = ReturnType<typeof usePeopleFilters>

export function PeopleFilters({ api }: { api: FiltersApi }) {
  const { filters, update, toggleSkill, skillOptions, reset, isFiltered } = api
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative lg:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.query}
            onChange={(event) => update("query", event.target.value)}
            placeholder="Search name, college, skill or project"
            aria-label="Search people"
            className="h-8 pl-8"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Membership"
            value={filters.membership}
            onChange={(value) => update("membership", value)}
            options={[
              { value: "all", label: "Everyone" },
              { value: "platform", label: "Platform users" },
              { value: "tracked", label: "Tracked" },
            ]}
          />
          <Segmented
            label="Activity"
            value={filters.activity}
            onChange={(value) => update("activity", value)}
            options={[
              { value: "all", label: "Any activity" },
              { value: "high", label: "High" },
              { value: "medium", label: "Medium" },
              { value: "low", label: "Low" },
            ]}
          />
          <Segmented
            label="Context status"
            value={filters.status}
            onChange={(value) => update("status", value)}
            options={[
              { value: "all", label: "Any status" },
              { value: "ready", label: "Context ready" },
              { value: "pending", label: "Not synced" },
            ]}
          />
          {isFiltered ? (
            <button type="button" onClick={reset} className="inline-flex h-8 items-center gap-1 px-1 text-xs text-muted-foreground hover:text-foreground">
              <X className="size-3.5" />
              Clear filters
            </button>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by skill">
        {skillOptions.map(({ name, count }) => {
          const active = filters.skills.includes(name)
          return (
            <button
              key={name}
              type="button"
              aria-pressed={active}
              onClick={() => toggleSkill(name)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-full border bg-card px-2.5 text-xs text-muted-foreground hover:text-foreground",
                active && "border-signal bg-signal-soft text-signal-foreground",
              )}
            >
              {name}
              <span className="tabular-nums opacity-70">{count}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
