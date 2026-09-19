import "server-only"

/**
 * Streams events as newline-delimited JSON so the UI can show each pipeline stage as it happens.
 * `run` receives an `emit` function; any thrown error becomes a final `{ type: "error" }` event.
 * If the browser disconnects (navigates away, closes the tab), emitting becomes a no-op and the
 * work finishes quietly instead of throwing "Controller is already closed".
 */
export function ndjsonStream<Event extends { type: string }>(
  run: (emit: (event: Event) => void) => Promise<void>,
  toErrorEvent: (message: string) => Event,
): Response {
  const encoder = new TextEncoder()
  let open = true

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: Event) => {
        if (!open) return
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
        } catch {
          open = false
        }
      }
      try {
        await run(emit)
      } catch (error) {
        console.error("[stream]", error)
        emit(toErrorEvent(error instanceof Error ? error.message : "Something went wrong"))
      } finally {
        if (open) {
          open = false
          try {
            controller.close()
          } catch {
            // Already closed by a disconnect.
          }
        }
      }
    },
    cancel() {
      open = false
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}

export function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 })
}
