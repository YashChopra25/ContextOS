import type { AgentEvent } from "@/lib/types"
import { agentQuerySchema } from "@/lib/validation"
import { runAgent } from "@/server/agent/agent"
import { badRequest, ndjsonStream } from "@/server/stream"

export async function POST(request: Request) {
  const parsed = agentQuerySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid query")

  return ndjsonStream<AgentEvent>(
    (emit) => runAgent(parsed.data.query, emit, { focusSlug: parsed.data.focusSlug }),
    (message) => ({ type: "error", message }),
  )
}
