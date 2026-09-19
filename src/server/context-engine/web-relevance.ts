import type { WebResult } from "@/server/integrations/tavily"

const DEVELOPER_TERMS = /\b(developer|engineer|programmer|github|open[- ]source|hackathon|software|web3|blockchain|repository|full[- ]stack|frontend|backend|devfolio|dev\.to|hashnode|portfolio)\b/i

/**
 * Keeps web results that plausibly describe *this* developer, not a namesake.
 * A result must mention their GitHub handle, a project, one of their skills, or developer vocabulary.
 */
export function filterRelevantWeb(
  results: WebResult[],
  person: { githubUsername?: string | null; skills?: string[]; projects?: string[] },
  options: { strict?: boolean } = {},
): { kept: WebResult[]; excluded: number } {
  const handle = person.githubUsername?.toLowerCase()
  const terms = [...(person.skills ?? []), ...(person.projects ?? [])].filter((t) => t.length > 2).map((t) => t.toLowerCase())

  const kept = results.filter((result) => {
    const text = `${result.title} ${result.url} ${result.content}`.toLowerCase()
    if (handle && text.includes(handle)) return true
    // Strict mode (used when attaching a source to a profile) accepts only a handle match.
    if (options.strict) return false
    if (terms.some((term) => text.includes(term))) return true
    return DEVELOPER_TERMS.test(text)
  })
  return { kept, excluded: results.length - kept.length }
}
