import "server-only"

import { and, count, desc, eq, ilike, inArray, isNotNull, max, ne, or, sql } from "drizzle-orm"

import type {
  ActivityType,
  HackathonEntry,
  LayerStats,
  PersonProfile,
  PersonSummary,
  PlatformActivity,
  Skill,
  SourceType,
} from "@/lib/types"
import { cached, hashKey } from "@/server/cache/cache"
import { db } from "@/server/db"
import {
  activities,
  githubRepos,
  githubStats,
  hackathons,
  people,
  personSkills,
  personSources,
  projects,
} from "@/server/db/schema"

type PersonRow = typeof people.$inferSelect

const iso = (date: Date | null | undefined) => (date ? date.toISOString() : null)

/** Same profile twice (linkedin.com/in/x as LinkedIn and in.linkedin.com/in/x as a web page) is shown once. */
const linkKey = (url: string) => url.toLowerCase().replace(/^https?:\/\/([a-z]{2,3}\.)?(www\.)?/, "").replace(/\/$/, "")

function uniqueLinks(sources: { type: SourceType; url: string | null; handle: string | null }[]) {
  const seen = new Set<string>()
  return sources.flatMap((s) => {
    if (!s.url || s.type === "platform") return []
    const key = linkKey(s.url)
    if (seen.has(key)) return []
    seen.add(key)
    return [{ type: s.type, url: s.url, handle: s.handle }]
  })
}

/** Assembles list-friendly summaries for a set of people with a fixed number of queries. */
async function summarize(rows: PersonRow[]): Promise<PersonSummary[]> {
  if (!rows.length) return []
  const slugs = rows.map((r) => r.slug)

  const [skillRows, projectRows, hackathonRows, lastActivityRows, sourceRows] = await Promise.all([
    db
      .select({ personSlug: personSkills.personSlug, name: personSkills.name, confidence: personSkills.confidence, score: personSkills.score })
      .from(personSkills)
      .where(inArray(personSkills.personSlug, slugs))
      .orderBy(desc(personSkills.score)),
    db
      .select({ personSlug: projects.personSlug, name: projects.name })
      .from(projects)
      .where(inArray(projects.personSlug, slugs))
      .orderBy(desc(projects.date)),
    db
      .select({ personSlug: activities.personSlug, total: count() })
      .from(activities)
      .where(and(inArray(activities.personSlug, slugs), eq(activities.type, "hackathon")))
      .groupBy(activities.personSlug),
    db
      .selectDistinctOn([activities.personSlug], {
        personSlug: activities.personSlug,
        title: activities.title,
        occurredAt: activities.occurredAt,
      })
      .from(activities)
      .where(inArray(activities.personSlug, slugs))
      .orderBy(activities.personSlug, desc(activities.occurredAt)),
    db
      .select({ personSlug: personSources.personSlug, type: personSources.type, url: personSources.url, handle: personSources.handle })
      .from(personSources)
      .where(and(inArray(personSources.personSlug, slugs), eq(personSources.status, "connected"))),
  ])

  const group = <T extends { personSlug: string }>(items: T[]) => {
    const map = new Map<string, T[]>()
    for (const item of items) map.set(item.personSlug, [...(map.get(item.personSlug) ?? []), item])
    return map
  }
  const skillsBy = group(skillRows)
  const projectsBy = group(projectRows)
  const sourcesBy = group(sourceRows)
  const hackathonsBy = new Map(hackathonRows.map((r) => [r.personSlug, r.total]))
  const lastActivityBy = new Map(lastActivityRows.map((r) => [r.personSlug, r]))

  return rows.map((row) => {
    const last = lastActivityBy.get(row.slug)
    const personProjects = projectsBy.get(row.slug) ?? []
    return {
      slug: row.slug,
      fullName: row.fullName,
      jobTitle: row.jobTitle,
      organization: row.organization,
      avatarUrl: row.avatarUrl,
      membership: row.membership,
      contextStatus: row.contextStatus,
      activityLevel: row.activityLevel,
      topSkills: (skillsBy.get(row.slug) ?? []).slice(0, 4).map(({ name, confidence }) => ({ name, confidence })),
      projectCount: personProjects.length,
      topProjects: personProjects.slice(0, 3).map((p) => p.name),
      hackathonCount: hackathonsBy.get(row.slug) ?? 0,
      lastActivity: last ? { title: last.title, occurredAt: last.occurredAt.toISOString() } : null,
      sources: [...new Set((sourcesBy.get(row.slug) ?? []).map((s) => s.type))] as SourceType[],
      links: uniqueLinks(sourcesBy.get(row.slug) ?? []),
      updatedAt: row.updatedAt.toISOString(),
    }
  })
}

async function listPeopleFromDb(): Promise<PersonSummary[]> {
  const rows = await db
    .select()
    .from(people)
    .orderBy(sql`${people.contextStatus} = 'ready' desc`, desc(people.updatedAt), people.fullName)
  return summarize(rows)
}

export async function getPeopleBySlugs(slugs: string[]): Promise<PersonSummary[]> {
  if (!slugs.length) return []
  const rows = await db.select().from(people).where(inArray(people.slug, slugs))
  const bySlug = new Map((await summarize(rows)).map((p) => [p.slug, p]))
  return slugs.flatMap((slug) => bySlug.get(slug) ?? [])
}

async function recentPeopleFromDb(limit: number): Promise<PersonSummary[]> {
  const rows = await db
    .select()
    .from(people)
    .where(eq(people.contextStatus, "ready"))
    .orderBy(desc(people.contextBuiltAt))
    .limit(limit)
  return summarize(rows)
}

/** Exact full-name match first, then every name token must appear. */
async function findPeopleByNameFromDb(name: string): Promise<PersonSummary[]> {
  const cleaned = name.replace(/[^\p{L}\p{N}\s.'-]/gu, " ").replace(/\s+/g, " ").trim()
  if (!cleaned) return []
  const exact = await db.select().from(people).where(ilike(people.fullName, cleaned)).limit(10)
  if (exact.length) return summarize(exact)

  const tokens = cleaned.split(" ").filter((t) => t.length > 1)
  if (!tokens.length) return []
  // Each token must start a word in the name ("Yash" matches "Yash Sharma", not "Suyash"),
  // or be the exact GitHub username.
  const wordStart = (token: string) => `\\m${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`
  const fuzzy = await db
    .select()
    .from(people)
    .where(and(...tokens.map((token) => or(sql`${people.fullName} ~* ${wordStart(token)}`, ilike(people.githubUsername, token)))))
    .orderBy(sql`${people.contextStatus} = 'ready' desc`, people.fullName)
    .limit(10)
  return summarize(fuzzy)
}

export async function findPersonByGithub(username: string) {
  const [row] = await db.select().from(people).where(ilike(people.githubUsername, username)).limit(1)
  return row ?? null
}

export async function getPersonRow(slug: string) {
  const [row] = await db.select().from(people).where(eq(people.slug, slug)).limit(1)
  return row ?? null
}

async function getPersonProfileFromDb(slug: string): Promise<PersonProfile | null> {
  const row = await getPersonRow(slug)
  if (!row) return null

  const [[summary], skillRows, projectRows, activityRows, statsRows, repoRows, sourceRows] = await Promise.all([
    summarize([row]),
    db.select().from(personSkills).where(eq(personSkills.personSlug, slug)).orderBy(desc(personSkills.score)),
    db.select().from(projects).where(eq(projects.personSlug, slug)).orderBy(sql`${projects.date} desc nulls last`),
    db
      .select({
        id: activities.id,
        type: activities.type,
        title: activities.title,
        detail: activities.detail,
        occurredAt: activities.occurredAt,
        isSample: activities.isSample,
        hackathon: hackathons.name,
      })
      .from(activities)
      .leftJoin(hackathons, eq(activities.hackathonSlug, hackathons.slug))
      .where(eq(activities.personSlug, slug))
      .orderBy(desc(activities.occurredAt)),
    db.select().from(githubStats).where(eq(githubStats.personSlug, slug)).limit(1),
    db.select().from(githubRepos).where(eq(githubRepos.personSlug, slug)).orderBy(sql`${githubRepos.pushedAt} desc nulls last`),
    db.select().from(personSources).where(eq(personSources.personSlug, slug)),
  ])

  const activity: PlatformActivity[] = activityRows.map((a) => ({
    id: a.id,
    personSlug: slug,
    personName: row.fullName,
    type: a.type,
    title: a.title,
    detail: a.detail,
    hackathon: a.hackathon,
    occurredAt: a.occurredAt.toISOString(),
    isSample: a.isSample,
  }))

  const hackathonEntries: HackathonEntry[] = activity
    .filter((a) => a.type === "hackathon")
    .map((a) => {
      const submission = activity.find((s) => s.type === "submission" && s.hackathon === a.hackathon)
      const award = activity.find((s) => s.type === "award" && s.hackathon === a.hackathon)
      return {
        name: a.hackathon ?? a.title,
        date: a.occurredAt,
        project: submission?.detail ?? null,
        result: award?.title ?? null,
        isSample: a.isSample,
      }
    })

  const stats = statsRows[0]
  const skills: Skill[] = skillRows.map(({ name, category, confidence, score, evidence }) => ({ name, category, confidence, score, evidence }))

  return {
    ...summary,
    firstName: row.firstName,
    lastName: row.lastName,
    roleCategory: row.roleCategory,
    linkedinUrl: row.linkedinUrl,
    githubUsername: row.githubUsername,
    portfolioUrl: row.portfolioUrl,
    location: row.location,
    bio: row.bio,
    summary: row.summary,
    summaryModel: row.summaryModel,
    contextBuiltAt: iso(row.contextBuiltAt),
    skills,
    projects: projectRows.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      technologies: p.technologies,
      source: p.source,
      url: p.url,
      date: iso(p.date),
      hackathon: p.hackathon,
      isSample: p.isSample,
    })),
    activity,
    hackathons: hackathonEntries,
    github: stats
      ? {
          username: stats.username,
          publicRepos: stats.publicRepos,
          followers: stats.followers,
          commits90d: stats.commits90d,
          weeklyActivity: stats.weeklyActivity,
          languages: stats.languages,
          accountCreatedAt: iso(stats.accountCreatedAt),
          lastEventAt: iso(stats.lastEventAt),
          fetchedAt: stats.fetchedAt.toISOString(),
          repos: repoRows.map((r) => ({
            name: r.name,
            description: r.description,
            language: r.language,
            stars: r.stars,
            forks: r.forks,
            topics: r.topics,
            url: r.url,
            isFork: r.isFork,
            pushedAt: iso(r.pushedAt),
          })),
        }
      : null,
    signals: row.signals,
    connectedSources: sourceRows.map((s) => ({
      type: s.type,
      url: s.url,
      handle: s.handle,
      status: s.status,
      lastSyncedAt: iso(s.lastSyncedAt),
    })),
  }
}

async function recentActivityFromDb(options: { limit?: number; type?: ActivityType }): Promise<PlatformActivity[]> {
  const rows = await db
    .select({
      id: activities.id,
      personSlug: activities.personSlug,
      personName: people.fullName,
      type: activities.type,
      title: activities.title,
      detail: activities.detail,
      occurredAt: activities.occurredAt,
      isSample: activities.isSample,
      hackathon: hackathons.name,
    })
    .from(activities)
    .innerJoin(people, eq(activities.personSlug, people.slug))
    .leftJoin(hackathons, eq(activities.hackathonSlug, hackathons.slug))
    .where(options.type ? eq(activities.type, options.type) : ne(activities.type, "joined"))
    .orderBy(desc(activities.occurredAt))
    .limit(options.limit ?? 50)

  return rows.map((r) => ({ ...r, occurredAt: r.occurredAt.toISOString() }))
}

async function getLayerStatsFromDb(): Promise<LayerStats> {
  const [[peopleCounts], [skillCount], [repoCount], [activityCount], [signalCount], sourceRows, [hackathonCount]] = await Promise.all([
    db
      .select({
        total: count(),
        platform: sql<number>`count(*) filter (where ${people.membership} = 'platform')`.mapWith(Number),
        tracked: sql<number>`count(*) filter (where ${people.membership} = 'tracked')`.mapWith(Number),
        ready: sql<number>`count(*) filter (where ${people.contextStatus} = 'ready')`.mapWith(Number),
        lastSyncedAt: max(people.contextBuiltAt),
      })
      .from(people),
    db.select({ total: count() }).from(personSkills),
    db.select({ total: count() }).from(githubRepos),
    db.select({ total: count() }).from(activities),
    db
      .select({ total: sql<number>`coalesce(sum(jsonb_array_length(${people.signals})), 0)`.mapWith(Number) })
      .from(people)
      .where(isNotNull(people.contextBuiltAt)),
    db
      .select({ type: personSources.type, total: count() })
      .from(personSources)
      .where(eq(personSources.status, "connected"))
      .groupBy(personSources.type),
    db.select({ total: count() }).from(hackathons),
  ])

  const sources: Record<SourceType, number> = { platform: 0, github: 0, linkedin: 0, portfolio: 0, web: 0 }
  for (const row of sourceRows) sources[row.type] = row.total

  return {
    people: peopleCounts.total,
    platformMembers: peopleCounts.platform,
    trackedPeople: peopleCounts.tracked,
    readyContexts: peopleCounts.ready,
    skills: skillCount.total,
    signals: signalCount.total,
    repos: repoCount.total,
    activities: activityCount.total,
    sources,
    hackathons: hackathonCount.total,
    lastSyncedAt: iso(peopleCounts.lastSyncedAt),
  }
}

/** Skill rows (with evidence) for everyone holding any of the given skills — input to matching. */
export async function skillHolders(skillNames: string[]) {
  if (!skillNames.length) return []
  return db
    .select({
      personSlug: personSkills.personSlug,
      name: personSkills.name,
      confidence: personSkills.confidence,
      score: personSkills.score,
      evidence: personSkills.evidence,
    })
    .from(personSkills)
    .where(inArray(personSkills.name, skillNames))
}

/** Normalized edit-distance similarity between two strings (1 = identical). */
function similarity(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let diagonal = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const temp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1))
      diagonal = temp
    }
  }
  return 1 - prev[b.length] / Math.max(a.length, b.length)
}

const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim()

/**
 * Closest names to what was typed, tolerant of typos ("viksit garj") and word order.
 * Compares the whole name, each word, and the GitHub handle; returns the best matches above a threshold.
 */
export async function findSimilarPeople(name: string, limit = 5): Promise<PersonSummary[]> {
  const query = normalize(name)
  if (query.length < 3) return []
  const queryTokens = query.split(" ")
  const rows = await cached("people:name-index", { ttl: 3600 }, () =>
    db.select({ slug: people.slug, fullName: people.fullName, githubUsername: people.githubUsername }).from(people),
  )

  const scored = rows
    .map((row) => {
      const full = normalize(row.fullName)
      const tokens = full.split(" ")
      // Every typed word should resemble some word of the name.
      const tokenScore = queryTokens.reduce((sum, qt) => sum + Math.max(...tokens.map((t) => similarity(qt, t))), 0) / queryTokens.length
      const handle = row.githubUsername ? normalize(row.githubUsername).replace(/ /g, "") : ""
      const score = Math.max(similarity(query, full), tokenScore, handle ? similarity(query.replace(/ /g, ""), handle) : 0)
      return { slug: row.slug, score }
    })
    .filter((r) => r.score >= 0.72)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  return getPeopleBySlugs(scored.map((r) => r.slug))
}

/** The full directory (heavy: ~650 summaries). */
export const listPeople = () => cached("people:list", { ttl: 3600 }, listPeopleFromDb)

export const recentPeople = (limit = 6) => cached(`people:recent:${limit}`, { ttl: 3600 }, () => recentPeopleFromDb(limit))

export const findPeopleByName = (name: string) =>
  cached(`people:name:${hashKey(name.toLowerCase().trim())}`, { ttl: 3600 }, () => findPeopleByNameFromDb(name))

export const getPersonProfile = (slug: string) => cached(`person:${slug}`, { ttl: 3600 }, () => getPersonProfileFromDb(slug))

export const recentActivity = (options: { limit?: number; type?: ActivityType } = {}) =>
  cached(`activity:${options.type ?? "all"}:${options.limit ?? 50}`, { ttl: 3600 }, () => recentActivityFromDb(options))

export const getLayerStats = () => cached("stats:layer", { ttl: 3600 }, getLayerStatsFromDb)
