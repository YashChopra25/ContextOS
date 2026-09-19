import "server-only"

import { extractSkillGroups, extractSkillsFromText, SKILL_TAXONOMY, toSearchableText } from "@/lib/skills"
import type { ActivityLevel, Membership, QueryInterpretation, RoleCategory } from "@/lib/types"
import { searchWeb } from "@/server/integrations/tavily"
import { distinctOrganizations } from "@/server/repository/community"

const DEFAULT_LIMIT = 8
const MAX_LIMIT = 25

const ROLE_PATTERNS: [RoleCategory, RegExp][] = [
  ["student", /\b(students?|undergrads?|freshers?)\b/i],
  ["intern", /\binterns?\b/i],
  ["founder", /\b(co-?founders?|founders?|ceos?|ctos?|startup builders?)\b/i],
  ["engineer", /\b(professionals?|working (?:developers?|engineers?)|sdes?|industry (?:engineers?|developers?))\b/i],
]

const HACKATHON_EXPERIENCE =
  /\b(hackathon (?:experience|winners?|participants?|veterans?)|(?:done|attended|joined|participated in|been to|competed in|won)\s+(?:a |any |some |multiple |many )?hackathons?|with hackathons?|hackers)\b/i
const AWARD = /\b(won|winners?|award(?:s|ed)?|prize|placed)\b/i

/** Words that can follow "from/at/in" but are never an organization. */
const NOT_ORG = new Set([
  "our", "the", "this", "platform", "community", "contextos", "database", "db", "india", "the platform",
  "any", "all", "a", "an", "hackathon", "hackathons", "web", "github", "linkedin",
])
const ORG_STOP = /\s+(?:who|with|and|that|having|knowing|know|knows|for|in|on|to|which|skilled|good|experienced|interested|working|building|built|can|are|is)\b.*$/i
const ACRONYM_STOPWORDS = new Set(["of", "and", "the", "for", "&", "at", "in"])

const acronym = (name: string) =>
  name
    .split(/[\s,()-]+/)
    .filter((w) => w && !ACRONYM_STOPWORDS.has(w.toLowerCase()))
    .map((w) => w[0])
    .join("")
    .toUpperCase()

const isSkillWord = (text: string) => extractSkillsFromText(toSearchableText(text)).length > 0

/** "IIIT Delhi" → "IIITD": keeps all-caps words whole, takes initials of the rest. */
const shorthand = (text: string) =>
  text
    .split(/\s+/)
    .filter((w) => w && !ACRONYM_STOPWORDS.has(w.toLowerCase()))
    .map((w) => (w === w.toUpperCase() ? w : w[0]))
    .join("")
    .toUpperCase()

/** Resolves "DTU", "IIIT Delhi" or "Maharaja Agrasen" to the organization names stored in the DB. */
async function matchOrganizations(query: string): Promise<{ matched: string[]; typed: string | null }> {
  const candidates = new Set<string>()
  for (const match of query.matchAll(/\b(?:from|at|of|studying at|studies at|working at|works at|in)\s+([A-Za-z][\w&.'-]*(?:\s+[A-Za-z][\w&.'-]*){0,6})/g)) {
    const phrase = match[1].replace(ORG_STOP, "").replace(/[?.!,]+$/, "").trim()
    if (phrase) candidates.add(phrase)
  }
  for (const token of query.match(/\b[A-Z]{2,8}\b/g) ?? []) candidates.add(token)

  const all = [...candidates]
  const usable = all.filter(
    (c) =>
      c.length >= 2 &&
      !NOT_ORG.has(c.toLowerCase()) &&
      !isSkillWord(c) &&
      // "IIIT" alone is too broad when the user wrote "IIIT Delhi".
      !all.some((other) => other !== c && other.length > c.length && other.toLowerCase().includes(c.toLowerCase())),
  )
  if (!usable.length) return { matched: [], typed: null }

  const organizations = await distinctOrganizations()
  // Union across everything the user typed, so "IIIT Delhi" also finds "IIITD" and the full name.
  const matched = new Set<string>()
  let typed: string | null = null
  for (const candidate of usable) {
    const lower = candidate.toLowerCase()
    const forms = new Set([candidate.replace(/\s+/g, "").toUpperCase(), shorthand(candidate)].filter((f) => f.length >= 2))
    const hits = organizations.filter((org) => {
      const orgLower = org.toLowerCase()
      const orgForms = [acronym(org), org.replace(/\s+/g, "").toUpperCase(), shorthand(org)]
      return orgLower === lower || (lower.length >= 4 && orgLower.includes(lower)) || orgForms.some((f) => forms.has(f))
    })
    if (hits.length) {
      hits.forEach((org) => matched.add(org))
      typed ??= candidate
    }
  }
  return { matched: [...matched], typed }
}

const FILLER = /\b(find|search|show|list|get|give|me|us|some|any|all|people|persons?|developers?|devs|engineers?|builders?|members?|folks|candidates|talent|who|which|that|can|could|would|should|will|are|is|good|great|best|top|skills?|skilled|experienced|in|on|at|of|the|a|an|and|or|with|for|my|our|their|to|from|please|need|want|looking|hire|hiring|someone|anyone)\b/gi

/** "people who can build a fintech app" → "fintech app"; "developers for my studio application" → "studio application". */
function extractConcept(query: string): string | null {
  const match = query.match(
    /\b(?:(?:build|building|make|create|develop|design|work on|working on|worked on|experience (?:in|with)|good at|skilled in|knows?|know about|interested in|into|expert in|specialize in)\s+(?:an?\s+|the\s+|some\s+)?|for\s+(?:my|our|a|an|the|their)\s+)([^?.!,]+?)(?=\s+(?:from|at|who|with|and have|having|in (?:the )?(?:platform|community))\b|[?.!,]|$)/i,
  )
  const concept = match?.[1]?.trim()
  if (!concept || concept.length < 3 || concept.split(/\s+/).length > 6) return null
  return concept
}

/** What's left of a question once filler words are removed; used when nothing else was recognized. */
function questionTopic(query: string): string | null {
  const topic = query.replace(/[?.!,]/g, " ").replace(FILLER, " ").replace(/\s+/g, " ").trim()
  return topic.length >= 3 ? topic : null
}

/** Ranks taxonomy skills by how often Tavily's answer and sources mention them. */
function skillsFromResearch(texts: string[], exclude: string[], limit: number) {
  const counts = new Map<string, number>()
  for (const text of texts) {
    for (const skill of extractSkillsFromText(toSearchableText(text))) counts.set(skill, (counts.get(skill) ?? 0) + 1)
  }
  return [...counts.entries()]
    .filter(([skill]) => !exclude.includes(skill))
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([skill]) => skill)
}

/**
 * Tavily researches what a goal needs ("concept": defines who qualifies) or, when the question already
 * names skills or an umbrella like "frontend", which skills fit the goal best ("related": ranks higher).
 */
async function researchSkills(skills: string[], groups: string[], concept: string | null) {
  if (!skills.length && !concept && !groups.length) return { tavilySkills: [], tavilyRole: null as QueryInterpretation["tavilyRole"] }
  const role: "concept" | "related" = skills.length || groups.length ? "related" : "concept"
  const query =
    role === "concept"
      ? `Which programming languages, frameworks and technologies are used to build ${concept}?`
      : concept
        ? `Which ${[...skills, ...groups].join(" and ")} technologies are best for building ${concept}?`
        : `Which technologies are most commonly used together with ${[...skills, ...groups].join(" and ")} in real projects?`
  try {
    const search = await searchWeb(query, { answer: "basic", maxResults: 5 })
    if (!search) return { tavilySkills: [], tavilyRole: null }
    const texts = [search.answer ?? "", search.answer ?? "", ...search.results.map((r) => `${r.title} ${r.content}`)]
    const known = new Set(SKILL_TAXONOMY.map((s) => s.name))
    const tavilySkills = skillsFromResearch(texts, skills, role === "concept" ? 5 : 4).filter((s) => known.has(s))
    return { tavilySkills, tavilyRole: tavilySkills.length ? role : null }
  } catch (error) {
    console.warn("[interpret] Tavily skill research failed:", (error as Error).message)
    return { tavilySkills: [], tavilyRole: null }
  }
}

const UMBRELLA_SKILLS = new Set(["Web3", "Full-stack web", "Mobile", "DevOps", "Machine Learning", "LLMs & AI agents"])
const isUmbrellaSkill = (skill: string) => UMBRELLA_SKILLS.has(skill)

export const hasStructuredFilters = (i: QueryInterpretation) =>
  Boolean(
    i.skills.length || i.groups.length || i.tavilySkills.length || i.concept || i.organizations.length || i.roles.length || i.activity || i.hackathon || i.membership,
  )

/**
 * Turns a human question about the community into DB filters.
 * Deterministic parsing handles names of things (skills, colleges, roles); Tavily handles goals.
 */
export async function interpretQuery(query: string, options: { useTavily: boolean }): Promise<QueryInterpretation> {
  const text = query.trim()
  const groups = extractSkillGroups(text)
  const grouped = new Set(groups.flatMap((g) => g.skills))
  // "blockchain developers" is the Blockchain group (any of Solana, Ethereum…), not a hard "Web3" requirement.
  const skills = extractSkillsFromText(toSearchableText(text)).filter((s) => !(grouped.has(s) && groups.length && isUmbrellaSkill(s)))
  const roles = ROLE_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([role]) => role)
  const { matched, typed } = await matchOrganizations(text)

  // A goal to research: stated explicitly, or, when nothing else was recognized, the question's topic.
  const recognized = skills.length || groups.length || matched.length || roles.length
  const concept = extractConcept(text) ?? (recognized ? null : questionTopic(text))
  const research = options.useTavily
    ? await researchSkills(skills, groups.map((g) => g.name), concept)
    : { tavilySkills: [], tavilyRole: null }

  const activity: ActivityLevel | null = /\b(highly|very|most) active\b/i.test(text) ? "high" : /\bactive\b/i.test(text) ? "medium" : null
  const hackathon = HACKATHON_EXPERIENCE.test(text) ? (AWARD.test(text) ? "award" : "any") : null
  const membership: Membership | null = /\btracked\b/i.test(text) ? "tracked" : /\bplatform (?:members?|users?)\b/i.test(text) ? "platform" : null
  const limitMatch = text.match(/\btop\s+(\d{1,2})\b/i) ?? text.match(/\b(\d{1,2})\s+(?:people|developers?|devs|engineers?|students?|candidates|builders?|members?)\b/i)
  const limit = limitMatch ? Math.min(Math.max(Number(limitMatch[1]), 1), MAX_LIMIT) : DEFAULT_LIMIT

  return {
    skills,
    groups,
    tavilySkills: research.tavilySkills,
    tavilyRole: research.tavilyRole,
    concept,
    organizations: matched,
    organizationQuery: typed,
    roles,
    activity,
    hackathon,
    membership,
    limit,
  }
}
