import type { Metadata } from "next"

import { PageHeader } from "@/components/layout/page-header"
import { PeopleDirectory } from "@/features/people/components/people-directory"
import { SyncAllButton } from "@/features/people/components/sync-all-button"
import { TrackButton } from "@/features/tracking/components/track-button"
import { listPeople } from "@/server/repository/people"
import { getSyncStatus, syncableSlugs } from "@/server/sync-job"

export const metadata: Metadata = { title: "People" }

export default async function PeoplePage() {
  const [people, syncable] = await Promise.all([listPeople(), syncableSlugs()])
  return (
    <>
      <PageHeader
        title="People"
        description="Everyone in the Context Layer: platform members from registration data and people you track. Skills carry confidence from their evidence."
        actions={
          <>
            <SyncAllButton pending={syncable.length} initialStatus={getSyncStatus()} />
            <TrackButton />
          </>
        }
      />
      <PeopleDirectory people={people} />
    </>
  )
}
