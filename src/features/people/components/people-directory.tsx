"use client"

import { Button } from "@/components/ui/button"
import { useTracking } from "@/features/tracking/components/tracking-provider"
import type { PersonSummary } from "@/lib/types"
import { usePeopleFilters } from "../hooks/use-people-filters"
import { PeopleFilters } from "./people-filters"
import { PeopleTable } from "./people-table"

export function PeopleDirectory({ people }: { people: PersonSummary[] }) {
  const api = usePeopleFilters(people)
  const openTracking = useTracking()

  return (
    <div className="space-y-4">
      <PeopleFilters api={api} />
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {api.total === people.length ? `${people.length.toLocaleString("en-US")} people` : `${api.total.toLocaleString("en-US")} of ${people.length.toLocaleString("en-US")} people`}
      </p>

      {api.results.length ? (
        <PeopleTable people={api.results} />
      ) : (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <p className="text-sm font-medium">No one matches these filters.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {api.filters.query ? `Track "${api.filters.query}" to build their context, or clear the filters.` : "Clear the filters to see everyone."}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="outline" onClick={api.reset}>
              Clear filters
            </Button>
            {api.filters.query ? <Button onClick={() => openTracking({ name: api.filters.query })}>Add &amp; Track</Button> : null}
          </div>
        </div>
      )}

      {api.hasMore ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={api.showMore}>
            Show more
          </Button>
        </div>
      ) : null}
    </div>
  )
}
