import type { TrackEvent } from "@/lib/types"
import { trackPersonSchema } from "@/lib/validation"
import { trackPerson } from "@/server/context-engine/pipeline"
import { getPeopleBySlugs } from "@/server/repository/people"
import { badRequest, ndjsonStream } from "@/server/stream"

export async function POST(request: Request) {
  const parsed = trackPersonSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid details")

  return ndjsonStream<TrackEvent>(
    async (emit) => {
      const { slug, alreadyExisted } = await trackPerson(parsed.data, emit)
      const [person] = await getPeopleBySlugs([slug])
      emit({ type: "done", person, alreadyExisted })
    },
    (message) => ({ type: "error", message }),
  )
}
