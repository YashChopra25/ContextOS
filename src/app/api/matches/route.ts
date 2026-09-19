import { matchQuerySchema } from "@/lib/validation"
import { findMatches } from "@/server/matching"
import { badRequest } from "@/server/stream"

export async function POST(request: Request) {
  const parsed = matchQuerySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid brief")
  return Response.json(await findMatches(parsed.data.brief, 12))
}
