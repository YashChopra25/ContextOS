import Link from "next/link"

import { ActivityRow } from "@/components/context/activity-row"
import { PersonRow } from "@/components/context/person-row"
import { PageHeader, SectionHeading } from "@/components/layout/page-header"
import { AskBox } from "@/features/overview/components/ask-box"
import { PipelineBand } from "@/features/overview/components/pipeline-band"
import { TrackButton } from "@/features/tracking/components/track-button"
import { integrations } from "@/server/env"
import { getLayerStats, recentActivity, recentPeople } from "@/server/repository/people"

export default async function OverviewPage() {
  const [stats, people, activity] = await Promise.all([getLayerStats(), recentPeople(6), recentActivity({ limit: 8 })])

  return (
    <div className="space-y-8">
      <PageHeader
        title="Overview"
        description="Platform activity and public developer data, turned into structured context you can query."
        actions={<TrackButton variant="outline" />}
      />

      <PipelineBand stats={stats} webEnabled={integrations.tavily} />

      <AskBox />

      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        <section>
          <SectionHeading
            title="Recently built contexts"
            action={
              <Link href="/people" className="text-xs text-muted-foreground hover:text-foreground">
                All people
              </Link>
            }
          />
          {people.length ? (
            <ul className="rounded-xl border bg-card px-4 py-2">
              {people.map((person) => (
                <PersonRow key={person.slug} person={person} />
              ))}
            </ul>
          ) : (
            <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
              No context profiles built yet. Run <code className="font-mono text-xs">npm run context:sync</code> or track someone
              to build the first one.
            </div>
          )}
        </section>

        <section>
          <SectionHeading
            title="Recent platform activity"
            action={
              <Link href="/activity" className="text-xs text-muted-foreground hover:text-foreground">
                All activity
              </Link>
            }
          />
          <ul className="divide-y rounded-xl border bg-card px-4">
            {activity.map((item) => (
              <ActivityRow key={item.id} activity={item} />
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
