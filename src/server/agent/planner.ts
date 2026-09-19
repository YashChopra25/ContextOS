import { extractSkillsFromText, toSearchableText } from "@/lib/skills"
import type { AgentIntent, AgentPlan } from "@/lib/types"

const PERSON_PATTERNS: { intent: AgentIntent; pattern: RegExp }[] = [
  { intent: "presence", pattern: /^(?:is|does)\s+(.+?)\s+(?:(?:already\s+)?(?:in|on|part of|registered (?:in|on|with)|a member of|exist in))\s+(?:our|the|this)\s+(?:platform|community|database|db|contextos)/i },
  { intent: "presence", pattern: /^(?:do we have|have we got|did)\s+(.+?)(?:\s+(?:in|on)\s+(?:our|the)\s+(?:platform|community))?(?:\s+(?:sign(?:ed)? up|register(?:ed)?))?\s*\??$/i },
  { intent: "person_work", pattern: /^what\s+(?:projects?|things|apps?)\s+(?:has|have|did)\s+(.+?)\s+(?:built|build|made|make|shipped|ship|worked on|work on|created|create)/i },
  { intent: "person_work", pattern: /^what\s+(?:has|did)\s+(.+?)\s+(?:built|build|made|make|shipped|ship|worked on|work on|created|create)/i },
  { intent: "person_work", pattern: /^(?:show|list)\s+(.+?)['’]s\s+projects/i },
  { intent: "person_profile", pattern: /^(?:tell me (?:more )?about|who is|who's|who are|what do we know about|show me|find|look up|lookup|search for|summari[sz]e|give me (?:a )?(?:context|profile|details) (?:on|for|of)|profile (?:of|for)|details (?:of|for|on)|info (?:on|about))\s+(.+?)\s*\??$/i },
  // "what is viksit garg's github", "viksit garg's linkedin", "github of viksit garg"
  { intent: "person_profile", pattern: /^(?:what(?:'s| is)|give me|share|send|show me|get)?\s*(.+?)['’]s\s+(?:github|linkedin|portfolio|profiles?|links?|socials?|contact|details)/i },
  { intent: "person_profile", pattern: /^(?:what(?:'s| is)\s+)?(?:the\s+)?(?:github|linkedin|portfolio|profiles?|links?|socials?|contact|details)\s+(?:of|for)\s+(.+?)\s*\??$/i },
]

/** The question asks for someone's profiles/links, e.g. "tell me his github and other". */
const LINK_CUES = /\b(github|linkedin|portfolio|website|links?|profiles?|socials?|handles?|contact|other (?:links|profiles|accounts)|and other)\b/i

/** Where a name ends and the rest of the request begins: "viksit garg, tell me his github". */
const CLAUSE_BREAK = /\s*(?:[,;:]|\s-\s|\?|\.(?:\s|$)|\s+(?:and|&)\s+(?:tell|show|give|share|what|his|her|their|also)\b|\s+(?:tell|show|give|share|send|also|plus|with his|with her)\b)/i

/** Words that signal the answer needs the open web, not just the platform. */
const EXTERNAL_CUES = /\b(recent(?:ly)?|latest|lately|news|this (?:year|month|week)|online|on the web|twitter|linkedin posts?|blog|articles?|talks?|podcasts?|press|publicly|elsewhere|outside)\b/i

/** Capitalised words that are skills or filler, never names. */
const NOT_A_NAME = new Set(["solana", "react", "rust", "web3", "next.js", "nextjs", "ai", "ml", "the", "our", "platform", "contextos", "github", "linkedin"])
/** "Who is from DTU", "who is good at Rust": descriptions of people, not a name. */
const DESCRIPTION_START = /^(?:from|at|in|good|best|active|interested|working|studying|skilled|experienced|a|an|the|top|any|someone|anyone|available|currently|also|most|more|there)\b/i

function cleanSubject(raw: string): string | null {
  const subject = raw
    .split(CLAUSE_BREAK)[0]
    .split(/['’]s\b/)[0]
    .replace(/\b(recent|latest|web3|work|projects?|activity|context|profile)\b.*$/i, "")
    .replace(/[?.!,]+$/g, "")
    .replace(/^(?:@|mr\.?\s+|ms\.?\s+|dr\.?\s+)/i, "")
    .trim()
  if (!subject || subject.split(/\s+/).length > 4) return null
  if (NOT_A_NAME.has(subject.toLowerCase()) || DESCRIPTION_START.test(subject)) return null
  // "who is good at rust" or "who knows react" describe people; a name has no skill words.
  if (extractSkillsFromText(toSearchableText(subject)).length) return null
  if (/\b(developers?|engineers?|students?|people|someone|anyone|everyone|members?|interns?|founders?)\b/i.test(subject)) return null
  return subject
}

/** Finds a possessive or capitalised name anywhere in the query, e.g. "Yash's recent Web3 work". */
function findNameAnywhere(query: string): string | null {
  const possessive = query.match(/\b([A-Z][\p{L}.-]+(?:\s+[A-Z][\p{L}.-]+){0,2})['’]s\b/u)
  if (possessive) return cleanSubject(possessive[1])
  const about = query.match(/\babout\s+([A-Z][\p{L}.-]+(?:\s+[A-Z][\p{L}.-]+){0,2})/u)
  return about ? cleanSubject(about[1]) : null
}

/**
 * Decides which parts of the Context Layer a question needs.
 * Deterministic on purpose: routing should be explainable and cheap. Tavily does the web research.
 */
export function planQuery(query: string, options: { webAvailable: boolean }): AgentPlan {
  const text = query.trim()
  const skills = extractSkillsFromText(toSearchableText(text))
  const external = EXTERNAL_CUES.test(text)

  let intent: AgentIntent | null = null
  let subject: string | null = null
  for (const candidate of PERSON_PATTERNS) {
    const match = text.match(candidate.pattern)
    if (match) {
      subject = cleanSubject(match[1])
      if (subject) {
        intent = candidate.intent
        break
      }
    }
  }
  if (!subject) {
    subject = findNameAnywhere(text)
    if (subject) intent = "person_profile"
  }

  const wantsLinks = LINK_CUES.test(text)

  if (subject && intent) {
    if (external && intent !== "presence") {
      return {
        intent: "person_external",
        subject,
        wantsLinks,
        skills,
        useContextOS: true,
        useWeb: options.webAvailable,
        reason: `Asks about ${subject}'s recent or public work, so combine their context with Tavily web research.`,
      }
    }
    const reasons: Record<string, string> = {
      presence: `Membership is a ContextOS question. If ${subject} isn't in the platform, Tavily looks for their public profiles.`,
      person_work: `Their context profile lists projects; Tavily researches their public work for anything missing.`,
      person_profile: `Look up ${subject}'s context profile, then research their public work with Tavily.`,
    }
    const reason = wantsLinks ? `Look up ${subject} in ContextOS and list their GitHub and other profiles, then research their public work with Tavily.` : reasons[intent]
    return { intent, subject, wantsLinks, skills, useContextOS: true, useWeb: options.webAvailable, reason }
  }

  // Everything else is answered from the Context Layer first: the agent interprets the question into
  // DB filters (skills, college, role, activity, hackathons) and falls back to text search, then the web.
  return {
    intent: "community_search",
    subject: null,
    wantsLinks,
    skills,
    useContextOS: true,
    useWeb: options.webAvailable,
    reason: options.webAvailable
      ? "Searches the Context Layer: Tavily and the query parser turn the question into filters, then ContextOS fetches matching people."
      : "Searches the Context Layer: the question is turned into filters, then ContextOS fetches matching people.",
  }
}
