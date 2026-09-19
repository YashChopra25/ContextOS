"use client"

import { useCallback, useRef } from "react"

/**
 * POSTs JSON and yields each newline-delimited JSON event from the response as it arrives.
 * Starting a new request aborts the previous one. Requests are deliberately not aborted on unmount:
 * React's dev double-mount would otherwise cancel the first request of every page.
 */
export function useNdjsonStream<Event>() {
  const controllerRef = useRef<AbortController | null>(null)

  const stream = useCallback(async (url: string, body: unknown, onEvent: (event: Event) => void) => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!response.ok || !response.body) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      throw new Error(payload?.error ?? `Request failed (${response.status})`)
    }

    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
    let buffer = ""
    const flush = (line: string) => {
      if (!line.trim()) return
      try {
        onEvent(JSON.parse(line) as Event)
      } catch (error) {
        console.error("[stream] Skipped a malformed event:", error)
      }
    }
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += value
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""
      lines.forEach(flush)
    }
    flush(buffer)
  }, [])

  const abort = useCallback(() => controllerRef.current?.abort(), [])

  return { stream, abort }
}
