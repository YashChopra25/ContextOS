import type { Metadata } from "next"

import { PageHeader } from "@/components/layout/page-header"
import { ActivityFeed } from "@/features/activity/components/activity-feed"
import { recentActivity } from "@/server/repository/people"

export const metadata: Metadata = { title: "Activity" }

export default async function ActivityPage() {
  const activity = await recentActivity({ limit: 300 })
  return (
    <>
      <PageHeader
        title="Activity"
        description="Hackathons, submissions, teams, comments and mentorship across the platform. Every event feeds the Context Engine."
      />
      <p className="mb-4 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
        Your registration dataset has no activity history, so hackathon events here are sample data marked Sample. Connect platform
        events to the <code className="font-mono">activities</code> table to replace them.
      </p>
      <ActivityFeed activity={activity} />
    </>
  )
}
