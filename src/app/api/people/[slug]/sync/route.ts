import type { TrackEvent } from "@/lib/types"
import { syncPersonContext } from "@/server/context-engine/pipeline"
import { getPeopleBySlugs } from "@/server/repository/people"
import { ndjsonStream } from "@/server/stream"

export async function POST(_request: Request, ctx: RouteContext<"/api/people/[slug]/sync">) {
  const { slug } = await ctx.params
  const [existing] = await getPeopleBySlugs([slug])
  if (!existing) return Response.json({ error: "Person not found" }, { status: 404 })

  return ndjsonStream<TrackEvent>(
    async (emit) => {
      const { warning } = await syncPersonContext(slug, { emit })
      if (warning?.includes("rate limit")) throw new Error(warning)
      const [person] = await getPeopleBySlugs([slug])
      emit({ type: "done", person, alreadyExisted: true })
    },
    (message) => ({ type: "error", message }),
  )
}
