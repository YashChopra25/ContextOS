"use client"

import { Button } from "@/components/ui/button"

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const database = /ECONNREFUSED|connect|relation .* does not exist/i.test(error.message)
  return (
    <div className="mx-auto max-w-lg py-16">
      <h1 className="text-lg font-semibold">ContextOS couldn&apos;t load this page</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {database
          ? "The database isn't reachable or isn't set up. Start it with npm run db:setup, then try again."
          : error.message || "An unexpected error occurred."}
      </p>
      <Button className="mt-4" onClick={reset}>
        Try again
      </Button>
    </div>
  )
}
