import "server-only"

import type { StageEvent, TrackStageId } from "@/lib/types"
import type { TrackPersonInput } from "@/lib/validation"
import { serverEnv } from "@/server/env"
import { extractPages, searchWeb, tavilyEnabled } from "@/server/integrations/tavily"
import {
  createPerson,
  loadFacts,
  recordActivity,
  saveContext,
  saveGithubSnapshot,
  setContextStatus,
  slugIsTaken,
  updatePersonLinks,
  upsertSource,
} from "@/server/repository/context-store"
import { findPeopleByName, findPersonByGithub, getPersonRow } from "@/server/repository/people"
import { extractContext, type WebFacts } from "./extract"
import { fetchGithubSnapshot, GithubError, type GithubSnapshot } from "./github"
import { normalizeLinkedinUrl, normalizeName, normalizeUrl, parseGithubUsername, slugify } from "./normalize"
import { writeSummary } from "./summarize"
import { filterRelevantWeb } from "./web-relevance"

type Emit = (event: StageEvent<TrackStageId>) => void

/** Keeps each stage on screen long enough to read, without slowing real work. */
async function stage<T>(emit: Emit, id: TrackStageId, work: () => Promise<{ value: T; detail?: string }>, minMs = 450) {
  emit({ type: "stage", stage: id, status: "active" })
  const started = Date.now()
  try {
    const { value, detail } = await work()
    const elapsed = Date.now() - started
    if (elapsed < minMs) await new Promise((resolve) => setTimeout(resolve, minMs - elapsed))
    emit({ type: "stage", stage: id, status: "done", detail })
    return value
  } catch (error) {
    emit({ type: "stage", stage: id, status: "error", detail: (error as Error).message })
    throw error
  }
}

const noop: Emit = () => {}

export interface SyncOptions {
  emit?: Emit
  /** Skip the GitHub call and rebuild from stored facts. */
  offline?: boolean
  /** Use Tavily (web search, answer, portfolio extraction). On by default; bulk syncs can turn it off to save credits. */
  web?: boolean
}

/**
 * Tavily research for one person: a search anchored on their GitHub handle (with Tavily's
 * synthesized answer) and extraction of their portfolio page. Namesake results are dropped.
 */
async function collectWeb(person: { slug: string; fullName: string; githubUsername: string | null; portfolioUrl: string | null }) {
  const facts: WebFacts = { portfolio: null, mentions: [] }
  let answer: string | null = null
  if (!tavilyEnabled()) return { facts, answer, notes: [] as string[] }

  const handle = person.githubUsername
  const notes: string[] = []
  const [search, pages] = await Promise.allSettled([
    handle
      ? searchWeb(`${handle} github ${person.fullName} developer work projects`, { answer: "advanced", depth: "advanced", maxResults: 8, fresh: true })
      : searchWeb(`"${person.fullName}" software developer`, { maxResults: 6, fresh: true }),
    person.portfolioUrl ? extractPages([person.portfolioUrl], { fresh: true }) : Promise.resolve(null),
  ])

  if (search.status === "fulfilled" && search.value) {
    // Only pages that mention the handle are trusted as being about this person.
    const { kept } = filterRelevantWeb(search.value.results, { githubUsername: handle }, { strict: Boolean(handle) })
    facts.mentions = handle ? kept.filter((r) => !r.url.includes(`github.com/${handle}`)).slice(0, 4) : []
    answer = handle && kept.length ? search.value.answer : null
    if (handle && kept[0]) {
      const page = kept.find((r) => !r.url.includes("github.com")) ?? kept[0]
      await upsertSource(person.slug, { type: "web", url: page.url, handle: page.title, status: "connected", synced: true })
    }
    notes.push(`${kept.length} web ${kept.length === 1 ? "page" : "pages"} via Tavily`)
  } else if (search.status === "rejected") {
    notes.push("Tavily search failed")
    console.warn("[context-engine] Tavily search failed:", search.reason)
  }

  if (pages.status === "fulfilled" && pages.value?.[0]?.content) {
    facts.portfolio = pages.value[0]
    await upsertSource(person.slug, { type: "portfolio", url: person.portfolioUrl, status: "connected", synced: true })
    notes.push("portfolio read")
  } else if (person.portfolioUrl) {
    notes.push("portfolio unreachable")
  }
  return { facts, answer, notes }
}

/** Collect → Extract → Build for an existing person. Returns a warning when a source couldn't be reached. */
export async function syncPersonContext(slug: string, options: SyncOptions = {}) {
  const emit = options.emit ?? noop
  const person = await getPersonRow(slug)
  if (!person) throw new Error(`Unknown person: ${slug}`)
  await setContextStatus(slug, "syncing")

  let warning: string | undefined
  try {
    const { snapshot, web } = await stage(emit, "collect", async () => {
      const githubTask = async (): Promise<{ data: GithubSnapshot | null; note: string }> => {
        if (options.offline || !person.githubUsername) {
          return { data: null, note: person.githubUsername ? "stored GitHub data" : "no GitHub linked" }
        }
        try {
          const data = await fetchGithubSnapshot(person.githubUsername, serverEnv.GITHUB_TOKEN)
          await saveGithubSnapshot(slug, data)
          await upsertSource(slug, { type: "github", handle: data.user.login, url: `https://github.com/${data.user.login}`, status: "connected", synced: true })
          return { data, note: `${data.repos.length} repos, ${data.commits90d} commits in 90 days` }
        } catch (error) {
          if (!(error instanceof GithubError)) throw error
          warning = error.message
          if (error.code === "not_found") {
            await upsertSource(slug, { type: "github", handle: person.githubUsername, url: `https://github.com/${person.githubUsername}`, status: "failed" })
          }
          return { data: null, note: error.message }
        }
      }
      const [github, webResult] = await Promise.all([
        githubTask(),
        options.web === false ? Promise.resolve(null) : collectWeb(person),
      ])
      return {
        value: { snapshot: github.data, web: webResult },
        detail: [github.note, ...(webResult?.notes ?? [])].join(", "),
      }
    })

    const facts = await loadFacts(slug)
    if (snapshot && facts.github) facts.github.externalContributions = snapshot.externalContributions

    const extracted = await stage(emit, "extract", async () => {
      const result = extractContext({
        firstName: person.firstName,
        jobTitle: person.jobTitle,
        organization: person.organization,
        github: facts.github,
        platform: facts.platform,
        web: web?.facts,
      })
      return { value: result, detail: `${result.skills.length} skills, ${result.signals.length} signals` }
    })

    await stage(emit, "build", async () => {
      const { summary, model } = writeSummary({
        fullName: person.fullName,
        firstName: person.firstName,
        jobTitle: person.jobTitle,
        organization: person.organization,
        location: snapshot?.user.location ?? person.location,
        bio: snapshot?.user.bio ?? person.bio,
        skills: extracted.skills,
        projects: extracted.projects,
        signals: extracted.signals,
        activityLevel: extracted.activityLevel,
        hackathonCount: facts.platform.activities.filter((a) => a.type === "hackathon").length,
        repoCount: facts.github?.repos.filter((r) => !r.isFork).length ?? 0,
        githubSynced: Boolean(facts.github),
      }, web?.answer ?? null)
      await saveContext(slug, {
        skills: extracted.skills,
        githubProjects: extracted.projects,
        signals: extracted.signals,
        activityLevel: extracted.activityLevel,
        summary,
        summaryModel: model,
      })
      return { value: undefined, detail: model === "tavily" ? "Summary from Tavily web research" : "Summary from extracted facts" }
    })
  } catch (error) {
    await setContextStatus(slug, "failed")
    throw error
  }

  return { warning }
}

async function uniqueSlug(name: string, githubUsername: string | null) {
  const base = slugify(name) || "person"
  if (!(await slugIsTaken(base))) return base
  const withHandle = githubUsername ? `${base}-${slugify(githubUsername)}` : null
  if (withHandle && !(await slugIsTaken(withHandle))) return withHandle
  for (let n = 2; ; n++) if (!(await slugIsTaken(`${base}-${n}`))) return `${base}-${n}`
}

/** Add & Track: Resolve identity → Collect → Extract → Build. */
export async function trackPerson(input: TrackPersonInput, emit: Emit) {
  const fullName = normalizeName(input.name) ?? input.name.trim()
  const githubUsername = parseGithubUsername(input.githubUrl)
  const linkedinUrl = normalizeLinkedinUrl(input.linkedinUrl)
  const portfolioUrl = normalizeUrl(input.portfolioUrl)

  const { slug, alreadyExisted } = await stage(emit, "resolve", async () => {
    // Same GitHub account → same person. Otherwise an exact name match is only reused if it has no conflicting GitHub.
    const byGithub = githubUsername ? await findPersonByGithub(githubUsername) : null
    const byName = byGithub ? [] : await findPeopleByName(fullName)
    const nameMatch = byName.find((p) => p.fullName.toLowerCase() === fullName.toLowerCase())
    const nameRow = nameMatch ? await getPersonRow(nameMatch.slug) : null
    const existing = byGithub ?? (nameRow && (!githubUsername || !nameRow.githubUsername) ? nameRow : null)

    if (existing) {
      await updatePersonLinks(existing.slug, { githubUsername, linkedinUrl, portfolioUrl })
      return { value: { slug: existing.slug, alreadyExisted: true }, detail: `Matched existing profile ${existing.fullName}` }
    }

    const [firstName, ...rest] = fullName.split(" ")
    const newSlug = await uniqueSlug(fullName, githubUsername)
    await createPerson({
      slug: newSlug,
      firstName,
      lastName: rest.join(" ") || null,
      fullName,
      githubUsername,
      linkedinUrl,
      portfolioUrl,
      membership: "tracked",
      contextStatus: "syncing",
    })
    await recordActivity({ personSlug: newSlug, type: "joined", title: "Added to ContextOS for tracking", occurredAt: new Date() })
    return { value: { slug: newSlug, alreadyExisted: false }, detail: "New identity created" }
  })

  if (linkedinUrl) await upsertSource(slug, { type: "linkedin", url: linkedinUrl, handle: linkedinUrl.split("/in/")[1], status: "connected" })
  if (portfolioUrl) await upsertSource(slug, { type: "portfolio", url: portfolioUrl, status: "pending" })

  const { warning } = await syncPersonContext(slug, { emit })
  return { slug, alreadyExisted, warning }
}
