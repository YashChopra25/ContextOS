"use client"

import { useCallback, useMemo, useState } from "react"

import { useDebouncedValue } from "@/hooks/use-debounced-value"
import type { ActivityLevel, ContextStatus, Membership, PersonSummary } from "@/lib/types"

export type MembershipFilter = Membership | "all"
export type ActivityFilter = ActivityLevel | "all"
export type StatusFilter = ContextStatus | "all"
export type SortKey = "context" | "name" | "activity" | "projects"

export interface PeopleFilters {
  query: string
  skills: string[]
  membership: MembershipFilter
  activity: ActivityFilter
  status: StatusFilter
  sort: SortKey
}

const DEFAULTS: PeopleFilters = { query: "", skills: [], membership: "all", activity: "all", status: "all", sort: "context" }
const PAGE_SIZE = 40
const ACTIVITY_RANK: Record<ActivityLevel, number> = { high: 3, medium: 2, low: 1 }
const STATUS_RANK: Record<ContextStatus, number> = { ready: 3, syncing: 2, pending: 1, failed: 0 }

function matchesQuery(person: PersonSummary, query: string) {
  if (!query) return true
  const haystack = [
    person.fullName,
    person.jobTitle,
    person.organization,
    ...person.topSkills.map((s) => s.name),
    ...person.topProjects,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
  return query
    .toLowerCase()
    .split(/\s+/)
    .every((token) => haystack.includes(token))
}

/** Client-side search, filtering, sorting and incremental paging for the people directory. */
export function usePeopleFilters(people: PersonSummary[]) {
  const [filters, setFilters] = useState<PeopleFilters>(DEFAULTS)
  const [visible, setVisible] = useState(PAGE_SIZE)
  const query = useDebouncedValue(filters.query.trim())

  const update = useCallback(<K extends keyof PeopleFilters>(key: K, value: PeopleFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }))
    setVisible(PAGE_SIZE)
  }, [])

  const toggleSkill = useCallback((skill: string) => {
    setFilters((current) => ({
      ...current,
      skills: current.skills.includes(skill) ? current.skills.filter((s) => s !== skill) : [...current.skills, skill],
    }))
    setVisible(PAGE_SIZE)
  }, [])

  const reset = useCallback(() => {
    setFilters(DEFAULTS)
    setVisible(PAGE_SIZE)
  }, [])

  /** Most common skills across the community, used as filter chips. */
  const skillOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const person of people) for (const skill of person.topSkills) counts.set(skill.name, (counts.get(skill.name) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([name, count]) => ({ name, count }))
  }, [people])

  const results = useMemo(() => {
    const filtered = people.filter(
      (person) =>
        matchesQuery(person, query) &&
        (filters.membership === "all" || person.membership === filters.membership) &&
        (filters.activity === "all" || person.activityLevel === filters.activity) &&
        (filters.status === "all" || person.contextStatus === filters.status) &&
        filters.skills.every((skill) => person.topSkills.some((s) => s.name === skill)),
    )
    const sorters: Record<SortKey, (a: PersonSummary, b: PersonSummary) => number> = {
      context: (a, b) => STATUS_RANK[b.contextStatus] - STATUS_RANK[a.contextStatus] || b.topSkills.length - a.topSkills.length,
      name: (a, b) => a.fullName.localeCompare(b.fullName),
      activity: (a, b) => ACTIVITY_RANK[b.activityLevel] - ACTIVITY_RANK[a.activityLevel],
      projects: (a, b) => b.projectCount - a.projectCount,
    }
    return filtered.sort(sorters[filters.sort])
  }, [people, query, filters])

  const isFiltered = JSON.stringify({ ...filters, sort: "context" }) !== JSON.stringify(DEFAULTS)

  return {
    filters,
    update,
    toggleSkill,
    reset,
    skillOptions,
    results: results.slice(0, visible),
    total: results.length,
    hasMore: visible < results.length,
    showMore: () => setVisible((n) => n + PAGE_SIZE),
    isFiltered,
  }
}
