import { getSyncStatus, startSyncAll, stopSyncAll } from "@/server/sync-job"

export async function GET() {
  return Response.json(getSyncStatus())
}

/** Starts syncing every pending GitHub profile in the background. */
export async function POST() {
  const started = await startSyncAll()
  return Response.json({ started, status: getSyncStatus() }, { status: started ? 202 : 409 })
}

export async function DELETE() {
  stopSyncAll()
  return Response.json(getSyncStatus())
}
