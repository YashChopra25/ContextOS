import "server-only"

import type { ActivityLevel, ContextSignal, Skill } from "@/lib/types"
import type { ExtractedProject } from "./extract"

export interface SummaryFacts {
  fullName: string
  firstName: string
  jobTitle: string | null
  organization: string | null
  location: string | null
  bio: string | null
  skills: Skill[]
  projects: ExtractedProject[]
  signals: ContextSignal[]
  activityLevel: ActivityLevel
  hackathonCount: number
  repoCount: number
  githubSynced: boolean
}

const ACTIVITY_SENTENCE: Record<ActivityLevel, string> = {
  high: "They have been highly active over the last 90 days.",
  medium: "They have been regularly active over the last 90 days.",
  low: "Recent public activity is light.",
}

const formatMonth = (date: string | null) =>
  date ? new Date(date).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : null

/** Deterministic summary used when no LLM is configured (or it fails). */
export function templateSummary(facts: SummaryFacts): string {
  const role = facts.jobTitle ? `${/^[aeiou]/i.test(facts.jobTitle) ? "an" : "a"} ${facts.jobTitle}` : "a developer"
  const sentences = [`${facts.fullName} is ${role}${facts.organization ? ` at ${facts.organization}` : ""}.`]

  const strong = facts.skills.filter((s) => s.confidence !== "low").slice(0, 3)
  if (facts.repoCount && strong.length) {
    const latest = facts.projects[0]
    const latestNote = latest ? `, most recently ${latest.name}${formatMonth(latest.date) ? ` (${formatMonth(latest.date)})` : ""}` : ""
    sentences.push(
      `Their public GitHub work centers on ${strong.map((s) => s.name).join(", ")} across ${facts.repoCount} original ${facts.repoCount === 1 ? "repository" : "repositories"}${latestNote}.`,
    )
  } else if (facts.skills.length) {
    sentences.push(`Early signals point to ${facts.skills.slice(0, 3).map((s) => s.name).join(", ")}.`)
  }

  if (facts.hackathonCount) {
    sentences.push(`They've taken part in ${facts.hackathonCount} ${facts.hackathonCount === 1 ? "hackathon" : "hackathons"} on the platform.`)
  }

  if (facts.repoCount || facts.hackathonCount) sentences.push(ACTIVITY_SENTENCE[facts.activityLevel])
  else if (facts.githubSynced) sentences.push("Their GitHub account has no original public repositories yet.")
  else sentences.push("Context is limited to registration data until GitHub is synced.")

  return sentences.join(" ")
}

const firstSentences = (text: string, count: number) =>
  text.split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/).slice(0, count).join(" ").trim()

/**
 * The profile overview. When Tavily returned an answer grounded in pages that mention the
 * person's GitHub handle, that web-sourced description leads; platform facts follow.
 */
export function writeSummary(facts: SummaryFacts, webAnswer: string | null): { summary: string; model: string } {
  if (!webAnswer) return { summary: templateSummary(facts), model: "template" }
  const platform = facts.hackathonCount
    ? ` On the platform they've taken part in ${facts.hackathonCount} ${facts.hackathonCount === 1 ? "hackathon" : "hackathons"}.`
    : ""
  return { summary: `${firstSentences(webAnswer, 3)}${platform}`, model: "tavily" }
}
