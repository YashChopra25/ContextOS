"use client"

import { Component, type ReactNode } from "react"

/**
 * Contains a render failure to one section (one agent answer, one result list) instead of
 * taking down the page. The error is logged so it reaches the dev server log.
 */
export class SectionErrorBoundary extends Component<{ children: ReactNode; label?: string }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error(`[ui] ${this.props.label ?? "Section"} failed to render:`, error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="rounded-xl border border-destructive/40 px-4 py-3 text-sm">
        <p className="font-medium text-destructive">This {this.props.label?.toLowerCase() ?? "section"} couldn&apos;t be displayed.</p>
        <p className="mt-1 text-xs text-muted-foreground">{this.state.error.message}</p>
        <button type="button" onClick={() => this.setState({ error: null })} className="mt-2 text-xs underline underline-offset-2">
          Try again
        </button>
      </div>
    )
  }
}
