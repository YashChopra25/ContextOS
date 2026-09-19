import "server-only"

import { skillDefinition } from "@/lib/skills"
import type {
  AgentEvent,
  AgentPlan,
  AgentResult,
  Evidence,
  LayerStats,
  MatchResult,
  PersonLookup,
  PersonProfile,
  QueryInterpretation,
  SourceRef,
  WebCandidates,
} from "@/lib/types"
import { filterRelevantWeb } from "@/server/context-engine/web-relevance"
import { integrations } from "@/server/env"
import { searchWeb, type WebResult } from "@/server/integrations/tavily"
import { searchCommunity, searchText } from "@/server/repository/community"
import { findPeopleByName, findSimilarPeople, getLayerStats, getPersonProfile } from "@/server/repository/people"
import { hasStructuredFilters, interpretQuery } from "./interpret"
import { planQuery } from "./planner"

type Emit = (event: AgentEvent) => void

interface Gathered {
  lookup: PersonLookup | null
  profile: PersonProfile | null
  interpretation: QueryInterpretation | null
  /** People fetched from the Context Layer for a community question. */
  matches: MatchResult[]
  totalMatches: number
  /** Set when structured filters found nothing and the words of the question were searched instead. */
  textTerms: string[] | null
  stats: LayerStats | null
  web: WebResult[]
  webAnswer: string | null
  webNote: string | null
  webCandidates: WebCandidates | null
}

const list = (items: string[]) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`

/**
 * Person lookup cascade: exact name → names containing every typed word → close spellings
 * (typos, partial names) → not found.
 */
async function lookupPerson(name: string, focusSlug?: string): Promise<{ lookup: PersonLookup; profile: PersonProfile | null }> {
  const candidates = await findPeopleByName(name)
  const exact = candidates.filter((c) => c.fullName.toLowerCase() === name.toLowerCase())
  const inFocus = focusSlug ? candidates.find((c) => c.slug === focusSlug) : undefined
  const chosen = exact.length === 1 ? exact[0] : (inFocus ?? (candidates.length === 1 ? candidates[0] : null))
  if (chosen) return { lookup: { status: "found", person: chosen }, profile: await getPersonProfile(chosen.slug) }
  if (candidates.length) return { lookup: { status: "ambiguous", name, candidates: candidates.slice(0, 6) }, profile: null }

  const similar = await findSimilarPeople(name)
  if (similar.length) return { lookup: { status: "similar", name, candidates: similar }, profile: null }
  return { lookup: { status: "not_found", name }, profile: null }
}

const LINK_LABEL: Record<string, string> = { github: "GitHub", linkedin: "LinkedIn", portfolio: "Portfolio", web: "Web" }

/** "GitHub: github.com/VIKSIT-GARG. LinkedIn: linkedin.com/in/viksit-garg." */
function describeLinks(profile: PersonProfile): string {
  const seen = new Set<string>()
  const key = (url: string) => url.toLowerCase().replace(/^https?:\/\/([a-z]{2,3}\.)?(www\.)?/, "").replace(/\/$/, "")
  const order = ["github", "linkedin", "portfolio", "web"]
  const links = profile.connectedSources
    .filter((s) => s.url && s.type !== "platform" && s.status !== "failed")
    .sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type))
    .filter((s) => (seen.has(key(s.url!)) ? false : (seen.add(key(s.url!)), true)))
  if (!links.length) return `No GitHub, LinkedIn or portfolio is linked for ${profile.fullName} yet.`
  return links
    .map((s) => {
      const url = s.url!.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")
      const extra = s.type === "github" && profile.github ? ` (${profile.github.publicRepos} public repos, ${profile.github.followers} followers)` : ""
      return `${LINK_LABEL[s.type] ?? s.type}: ${url}${extra}.`
    })
    .join(" ")
}

/* ------------------------------- Tavily research ------------------------------ */

type WebStep = { detail: string } | null

/** Web research for a person in the platform, anchored on their GitHub handle and focus skills. */
async function researchPerson(plan: AgentPlan, profile: PersonProfile, g: Gathered): Promise<WebStep> {
  const handle = profile.githubUsername
  const focus = plan.skills.length ? plan.skills.join(" ") : plan.intent === "person_work" ? "projects built" : "developer work"
  const query = `${handle ? `${handle} github` : `"${profile.fullName}"`} ${profile.fullName} ${focus}`
  const search = await searchWeb(query, {
    answer: "advanced",
    depth: "advanced",
    maxResults: 8,
    ...(plan.intent === "person_external" ? { timeRange: "year" as const } : {}),
  })
  if (!search) return null

  const { kept, excluded } = filterRelevantWeb(
    search.results,
    { githubUsername: handle, skills: profile.skills.map((s) => s.name), projects: profile.projects.map((p) => p.name) },
    { strict: Boolean(handle) },
  )
  g.web = kept.slice(0, 5)
  // Only trust Tavily's answer when it was built from pages that are clearly about this person.
  g.webAnswer = kept.length ? search.answer : null
  if (excluded) g.webNote = `${excluded} web ${excluded === 1 ? "result was" : "results were"} about someone else with the same name and ${excluded === 1 ? "was" : "were"} left out.`
  if (!kept.length) g.webNote = `The web had nothing that clearly refers to this ${profile.fullName}${handle ? ` (GitHub ${handle})` : ""}.`
  return { detail: `${kept.length} relevant ${kept.length === 1 ? "page" : "pages"}${excluded ? `, ${excluded} namesakes excluded` : ""}` }
}

/** Someone outside the platform: find their public profiles so Add & Track can be prefilled. */
async function discoverPerson(name: string, g: Gathered): Promise<WebStep> {
  const search = await searchWeb(`"${name}" developer github linkedin`, { maxResults: 8, answer: "basic" })
  if (!search) return null
  const tokens = name.toLowerCase().split(/\s+/).filter((t) => t.length > 1)
  const about = (r: WebResult) => tokens.every((t) => `${r.title} ${r.content} ${r.url}`.toLowerCase().includes(t))
  const relevant = filterRelevantWeb(search.results.filter(about), {}).kept

  const pick = (pattern: RegExp) => {
    for (const r of relevant) {
      const match = r.url.match(pattern)
      if (match) return match[0]
    }
    return null
  }
  const githubUrl = pick(/https?:\/\/(?:www\.)?github\.com\/[A-Za-z0-9-]{1,39}(?=\/|$|\?)/)
  const linkedinUrl = pick(/https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[^/?#]+/)
  g.webCandidates = githubUrl || linkedinUrl ? { githubUrl, linkedinUrl, portfolioUrl: null } : null
  g.web = relevant.slice(0, 4)
  g.webAnswer = relevant.length ? search.answer : null
  if (g.webAnswer) g.webNote = "Web results may describe a different person with the same name. Check before tracking."
  const found = [githubUrl && "GitHub", linkedinUrl && "LinkedIn"].filter(Boolean) as string[]
  return { detail: found.length ? `Found possible ${list(found)} profiles` : `${relevant.length} developer pages` }
}

const firstSentences = (text: string, count: number) =>
  text.split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/).slice(0, count).join(" ").trim()

/** Researches the top candidates' public work with Tavily so rankings carry web evidence too. */
async function verifyCandidates(g: Gathered): Promise<WebStep> {
  const focus = [...(g.interpretation?.skills ?? []), ...(g.interpretation?.tavilySkills ?? [])].slice(0, 3)
  const top = g.matches.slice(0, 3)
  const profiles = await Promise.all(top.map((m) => getPersonProfile(m.person.slug)))
  const checkable = profiles.filter((p) => p?.githubUsername).length
  if (!checkable) return { detail: "Top candidates have no GitHub to research" }

  const findings = await Promise.allSettled(
    profiles.map(async (profile, index) => {
      const handle = profile?.githubUsername
      if (!profile || !handle) return null
      const search = await searchWeb(`${handle} GitHub profile repositories ${focus.join(" ")}`, {
        depth: "advanced",
        answer: "basic",
        maxResults: 5,
      })
      const { kept } = filterRelevantWeb(search?.results ?? [], { githubUsername: handle }, { strict: true })
      if (!kept.length) return null
      top[index].evidence.push(...kept.slice(0, 2).map((r): Evidence => ({ label: `Web: ${r.title}`, source: "web", url: r.url })))
      g.web.push(...kept.slice(0, 1))
      return search?.answer ? `${profile.fullName}: ${firstSentences(search.answer, 2)}` : null
    }),
  )
  const lines = findings.flatMap((f) => (f.status === "fulfilled" && f.value ? [f.value] : []))
  g.webAnswer = lines.length ? lines.join("\n\n") : null
  g.webNote = `Researched the top ${checkable} ${checkable === 1 ? "candidate" : "candidates"} with GitHub on the web; public work confirmed for ${lines.length}.`
  return { detail: `Researched ${checkable} top ${checkable === 1 ? "candidate" : "candidates"}, ${lines.length} confirmed` }
}

async function researchGeneral(query: string, g: Gathered): Promise<WebStep> {
  const search = await searchWeb(query, { answer: "advanced", depth: "advanced", maxResults: 5 })
  if (!search) return null
  g.web = search.results
  g.webAnswer = search.answer
  return { detail: `${search.results.length} results` }
}

/* ------------------------------ Evidence & sources ----------------------------- */

function collectEvidence(g: Gathered, plan: AgentPlan): Evidence[] {
  if (g.profile) {
    const focus = plan.skills.length ? g.profile.skills.filter((s) => plan.skills.includes(s.name)) : []
    const skills = (focus.length ? focus : g.profile.skills).slice(0, 3).filter((s) => s.evidence[0])
    return [
      ...skills.map((s) => ({ ...s.evidence[0], label: `${s.name} (${s.confidence}): ${s.evidence[0].label}` })),
      ...g.profile.projects.slice(0, 2).map((p) => ({
        label: `Project ${p.name}${p.technologies.length ? ` using ${p.technologies.slice(0, 3).join(", ")}` : ""}`,
        source: p.source,
        url: p.url ?? undefined,
        date: p.date ?? undefined,
        isSample: p.isSample,
      })),
      ...g.profile.activity
        .filter((a) => a.type !== "joined")
        .slice(0, 2)
        .map((a) => ({ label: a.title, source: "platform" as const, date: a.occurredAt, isSample: a.isSample })),
    ]
  }
  return g.matches.slice(0, 4).flatMap((m) => m.evidence.slice(0, 1).map((e) => ({ ...e, label: `${m.person.fullName}: ${e.label}` })))
}

function collectSources(g: Gathered): SourceRef[] {
  const sources: SourceRef[] = []
  if (g.profile) {
    sources.push({ title: `${g.profile.fullName} in ContextOS`, url: `/people/${g.profile.slug}`, type: "platform" })
    for (const s of g.profile.connectedSources) {
      if (s.url && s.status === "connected" && s.type !== "platform") sources.push({ title: s.handle ?? s.url, url: s.url, type: s.type })
    }
  }
  if (g.matches.length) sources.push({ title: `${g.totalMatches} matching people in ContextOS`, url: "/people", type: "platform" })
  if (g.stats) sources.push({ title: "ContextOS community data", url: "/", type: "platform" })
  const seen = new Set(sources.map((s) => s.url))
  for (const w of g.web) {
    if (seen.has(w.url)) continue
    seen.add(w.url)
    sources.push({ title: w.title, url: w.url, type: "web", snippet: w.content.slice(0, 180) })
  }
  return sources
}

/* ------------------------------ ContextOS answer ------------------------------ */

const month = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }) : null

function contextAnswer(plan: AgentPlan, g: Gathered): string {
  const { lookup, profile } = g

  if (lookup?.status === "not_found") return `${lookup.name} isn't currently in your platform.`
  if (lookup?.status === "similar") {
    return `No one named "${lookup.name}" is in your platform. Closest ${lookup.candidates.length === 1 ? "match" : "matches"}: ${list(lookup.candidates.map((c) => c.fullName))}.`
  }
  if (lookup?.status === "ambiguous") {
    return `${lookup.candidates.length} people match "${lookup.name}": ${list(lookup.candidates.map((c) => c.fullName))}. Pick one to see their context.`
  }

  if (profile) {
    const where = profile.membership === "platform" ? "a platform member" : "a tracked person"
    const skills = profile.skills.filter((s) => s.confidence !== "low").slice(0, 4).map((s) => s.name)
    switch (plan.intent) {
      case "presence":
        return `Yes. ${profile.fullName} is in your platform as ${where}${profile.jobTitle ? ` (${profile.jobTitle}${profile.organization ? `, ${profile.organization}` : ""})` : ""}.${skills.length ? ` Strongest skills: ${list(skills)}.` : ""}`
      case "person_work": {
        if (!profile.projects.length) return `${profile.fullName} has no projects in their context yet.${profile.contextStatus === "pending" ? " Sync their GitHub to collect repositories." : ""}`
        const projects = profile.projects.slice(0, 4).map((p) => `${p.name}${p.technologies.length ? ` (${p.technologies.slice(0, 3).join(", ")})` : ""}`)
        return `${profile.fullName} has ${profile.projects.length} ${profile.projects.length === 1 ? "project" : "projects"} in their context, including ${list(projects)}.`
      }
      case "person_external": {
        if (!plan.skills.length) return profile.summary ?? `${profile.fullName} is ${where}.`
        // "Web3 work" covers Solana or Ethereum projects: umbrella skills include their category.
        const umbrella = new Set(plan.skills.filter((s) => s === "Web3" || s === "LLMs & AI agents").map((s) => skillDefinition(s)?.category))
        const relevant = (tech: string) => plan.skills.includes(tech) || umbrella.has(skillDefinition(tech)?.category)
        const focused = profile.projects.filter((p) => p.technologies.some(relevant))
        return focused.length
          ? `In ContextOS, ${profile.fullName}'s ${list(plan.skills)} work includes ${list(focused.slice(0, 4).map((p) => `${p.name}${month(p.date) ? ` (${month(p.date)})` : ""}`))}.`
          : `ContextOS has no ${list(plan.skills)} projects for ${profile.fullName} yet.`
      }
      default: {
        const summary = profile.summary ?? `${profile.fullName} is ${where}.`
        return plan.wantsLinks ? `${summary}\n\n${describeLinks(profile)}` : summary
      }
    }
  }

  if (g.interpretation) {
    const top = g.matches.slice(0, 3).map((r) => r.person.fullName)
    if (g.textTerms) {
      return g.matches.length
        ? `No structured filters in that question, so I searched the Context Layer for ${list(g.textTerms.map((t) => `"${t}"`))}. ${g.totalMatches} ${g.totalMatches === 1 ? "person matches" : "people match"}, led by ${list(top)}.`
        : `Nothing in the Context Layer matches that question.`
    }
    const what = describeInterpretation(g.interpretation)
    if (!g.matches.length) return `No one in the Context Layer matches ${what} yet.`
    return `${g.totalMatches} ${g.totalMatches === 1 ? "person matches" : "people match"} ${what}. Strongest: ${list(top)}.`
  }

  if (g.stats) {
    return `ContextOS knows ${g.stats.people} people (${g.stats.platformMembers} platform members, ${g.stats.trackedPeople} tracked), with ${g.stats.readyContexts} full context profiles and ${g.stats.skills} extracted skills.`
  }
  return "I couldn't find anything for that question."
}

/** "students at Delhi Technological University with React and hackathon experience" */
export function describeInterpretation(i: QueryInterpretation): string {
  const who = [
    i.activity === "high" ? "highly active" : i.activity === "medium" ? "active" : "",
    i.membership === "tracked" ? "tracked" : "",
    i.groups.length ? list(i.groups.map((g) => g.name.toLowerCase())) : "",
    i.roles.length ? list(i.roles.map((r) => (r === "engineer" ? "professionals" : `${r}s`))) : i.groups.length ? "developers" : "people",
  ]
    .filter(Boolean)
    .join(" ")
  const where = i.organizations.length ? ` at ${i.organizationQuery && i.organizations.length > 1 ? i.organizationQuery : i.organizations[0]}` : ""
  const skills = [
    i.skills.length ? ` with ${list(i.skills)}` : "",
    !i.skills.length && i.tavilyRole === "concept" && i.concept ? ` suited to ${i.concept} (${list(i.tavilySkills)})` : "",
  ].join("")
  const hackathon = i.hackathon === "award" ? " who have won hackathon awards" : i.hackathon ? " with hackathon experience" : ""
  return `${who}${where}${skills}${hackathon}`
}

/* ---------------------------------- Runner ---------------------------------- */

export async function runAgent(query: string, emit: Emit, options: { focusSlug?: string } = {}): Promise<void> {
  const plan = planQuery(query, { webAvailable: integrations.tavily })
  emit({ type: "plan", plan })

  const g: Gathered = {
    lookup: null,
    profile: null,
    interpretation: null,
    matches: [],
    totalMatches: 0,
    textTerms: null,
    stats: null,
    web: [],
    webAnswer: null,
    webNote: null,
    webCandidates: null,
  }

  // 1. Understand the question.
  if (plan.subject) {
    emit({ type: "stage", stage: "understand", status: "done", detail: `Person lookup: ${plan.subject}` })
  } else {
    emit({ type: "stage", stage: "understand", status: "active" })
    g.interpretation = await interpretQuery(query, { useTavily: integrations.tavily })
    emit({ type: "interpretation", interpretation: g.interpretation })
    const i = g.interpretation
    emit({
      type: "stage",
      stage: "understand",
      status: "done",
      detail:
        i.tavilyRole === "concept"
          ? `Tavily mapped "${i.concept}" to ${list(i.tavilySkills)}`
          : hasStructuredFilters(i)
            ? `Filters: ${describeInterpretation(i)}`
            : "No filters found; searching the text of profiles",
    })
  }

  // 2. Query the Context Layer.
  emit({ type: "stage", stage: "contextos", status: "active" })
  if (plan.subject) {
    const { lookup, profile } = await lookupPerson(plan.subject, options.focusSlug)
    g.lookup = lookup
    g.profile = profile
    const detail =
      lookup.status === "found"
        ? `Found ${lookup.person.fullName}`
        : lookup.status === "ambiguous"
          ? `${lookup.candidates.length} people match "${lookup.name}"`
          : lookup.status === "similar"
            ? `No exact match; ${lookup.candidates.length} similar ${lookup.candidates.length === 1 ? "name" : "names"}`
            : `No one named "${lookup.name}", and no similar names`
    emit({ type: "stage", stage: "contextos", status: "done", detail })
  } else if (g.interpretation) {
    if (hasStructuredFilters(g.interpretation)) {
      const { results, total } = await searchCommunity(g.interpretation)
      g.matches = results
      g.totalMatches = total
    } else {
      const { results, total, terms } = await searchText(query, g.interpretation.limit)
      g.matches = results
      g.totalMatches = total
      g.textTerms = terms
    }
    if (!g.matches.length) g.stats = await getLayerStats()
    emit({ type: "stage", stage: "contextos", status: "done", detail: `${g.totalMatches} ${g.totalMatches === 1 ? "person" : "people"} matched in Postgres` })
  }

  // 3. Tavily web research, shaped by what ContextOS found.
  const skipReason = !integrations.tavily
    ? "TAVILY_API_KEY not set"
    : g.lookup?.status === "ambiguous" || g.lookup?.status === "similar"
      ? "Pick a person first"
      : plan.intent === "presence" && g.lookup?.status === "found"
        ? "Answered by ContextOS"
        : null

  if (skipReason) {
    emit({ type: "stage", stage: "web", status: "skipped", detail: skipReason })
  } else {
    emit({ type: "stage", stage: "web", status: "active" })
    try {
      const step = g.profile
        ? await researchPerson(plan, g.profile, g)
        : g.lookup?.status === "not_found"
          ? await discoverPerson(g.lookup.name, g)
          : g.matches.length
            ? await verifyCandidates(g)
            : await researchGeneral(query, g)
      emit({ type: "stage", stage: "web", status: "done", detail: step?.detail })
    } catch (error) {
      console.warn("[agent] Tavily research failed:", (error as Error).message)
      emit({ type: "stage", stage: "web", status: "error", detail: "Tavily didn't respond. Showing ContextOS data only." })
    }
  }

  // 4. Synthesis: ContextOS facts first, Tavily's web answer alongside.
  emit({ type: "stage", stage: "synthesis", status: "active" })
  const result: AgentResult = {
    answer: contextAnswer(plan, g),
    interpretation: g.interpretation,
    totalMatches: g.totalMatches,
    webAnswer: g.webAnswer,
    webNote: g.webNote,
    lookup: g.lookup,
    matches: g.matches,
    evidence: collectEvidence(g, plan),
    sources: collectSources(g),
    webCandidates: g.webCandidates,
  }
  emit({
    type: "stage",
    stage: "synthesis",
    status: "done",
    detail: g.webAnswer ? "Combined ContextOS with Tavily's answer" : "Composed from ContextOS",
  })
  emit({ type: "result", result })
}
