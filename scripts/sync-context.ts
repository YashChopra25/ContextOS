/**
 * Pulls GitHub data for platform members and rebuilds their context profiles.
 *
 *   npm run context:sync -- --limit 25          # next 25 people still pending
 *   npm run context:sync -- --slug ashwin-gupta # one person
 *   npm run context:sync -- --all               # everyone (set GITHUB_TOKEN first)
 *   npm run context:sync -- --limit 25 --web    # also research each person with Tavily (uses credits)
 *
 * Without GITHUB_TOKEN, GitHub allows 60 requests/hour (~20 people). The script stops
 * cleanly when the limit is hit; rerun it later to continue where it left off.
 */
import { and, asc, eq, isNotNull } from "drizzle-orm"

import { closeRedis } from "@/server/cache/redis"
import { db, pool } from "@/server/db"
import { people } from "@/server/db/schema"
import { syncPersonContext } from "@/server/context-engine/pipeline"

const args = process.argv.slice(2)
const flag = (name: string) => {
  const index = args.indexOf(`--${name}`)
  return index === -1 ? undefined : args[index + 1]
}

async function main() {
  const slug = flag("slug")
  const limit = args.includes("--all") ? 10_000 : Number(flag("limit") ?? 20)

  const targets = slug
    ? [{ slug }]
    : await db
        .select({ slug: people.slug })
        .from(people)
        .where(and(eq(people.contextStatus, "pending"), isNotNull(people.githubUsername)))
        .orderBy(asc(people.datasetRow))
        .limit(limit)

  console.log(`Syncing ${targets.length} ${targets.length === 1 ? "person" : "people"}…`)
  let synced = 0
  for (const target of targets) {
    const { warning } = await syncPersonContext(target.slug, { web: args.includes("--web") })
    if (warning?.includes("rate limit")) {
      // Leave the person pending so the next run retries them.
      await db.update(people).set({ contextStatus: "pending" }).where(eq(people.slug, target.slug))
      console.warn(`Stopped: ${warning}`)
      break
    }
    synced++
    console.log(`  ✓ ${target.slug}${warning ? ` (${warning})` : ""}`)
  }
  console.log(`Done. ${synced} context ${synced === 1 ? "profile" : "profiles"} built.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => Promise.all([pool.end(), closeRedis()]))
