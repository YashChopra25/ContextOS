import "server-only"

import { and, eq, exists, ilike, inArray, isNotNull, or, sql, type SQL } from "drizzle-orm"

import { CONFIDENCE_WEIGHT } from "@/lib/skills"
import type { Evidence, MatchResult, PersonSummary, QueryInterpretation } from "@/lib/types"
import { cached, hashKey } from "@/server/cache/cache"
import { db } from "@/server/db"
import { activities, githubRepos, people, personSkills, projects } from "@/server/db/schema"
import { getPeopleBySlugs } from "./people"

// Above the size of the community, so match counts are exact.
const CANDIDATE_CAP = 2000
const ACTIVITY_BONUS = { high: 6, medium: 3, low: 0 } as const

async function distinctOrganizationsFromDb(): Promise<string[]> {
  const rows = await db.selectDistinct({ organization: people.organization }).from(people).where(isNotNull(people.organization))
  return rows.flatMap((r) => (r.organization ? [r.organization] : []))
}

const list = (items: string[]) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`

const CONCEPT_STOP = new Set(["app", "apps", "application", "platform", "project", "projects", "tool", "tools", "system", "a", "an", "the", "for", "and", "of", "on", "with", "using", "based"])

/**
 * People whose own projects or repositories are about the goal, e.g. a repo named
 * "prediction-market" for "prediction market". Direct evidence beats inferred skills.
 */
async function conceptBuilders(concept: string): Promise<Map<string, string>> {
  const words = concept.toLowerCase().match(/[a-z0-9+#.]{3,}/g)?.filter((w) => !CONCEPT_STOP.has(w)) ?? []
  if (!words.length) return new Map()
  const pattern = `%${words.join("%")}%`
  const [projectRows, repoRows] = await Promise.all([
    db
      .select({ slug: projects.personSlug, name: projects.name })
      .from(projects)
      .where(or(ilike(sql`replace(replace(${projects.name}, '-', ' '), '_', ' ')`, pattern), ilike(projects.description, pattern))),
    db
      .select({ slug: githubRepos.personSlug, name: githubRepos.name })
      .from(githubRepos)
      .where(or(ilike(sql`replace(replace(${githubRepos.name}, '-', ' '), '_', ' ')`, pattern), ilike(githubRepos.description, pattern))),
  ])
  const builders = new Map<string, string>()
  for (const row of [...repoRows, ...projectRows]) if (!builders.has(row.slug)) builders.set(row.slug, row.name)
  return builders
}

/** Hard filters from the interpretation, as SQL over the people table. */
function filterConditions(i: QueryInterpretation, options: { skipSkills?: boolean } = {}): SQL[] {
  const conditions: SQL[] = []
  if (i.organizations.length) conditions.push(inArray(people.organization, i.organizations))
  if (i.roles.length) conditions.push(inArray(people.roleCategory, i.roles))
  if (i.activity === "high") conditions.push(eq(people.activityLevel, "high"))
  if (i.activity === "medium") conditions.push(inArray(people.activityLevel, ["high", "medium"]))
  if (i.membership) conditions.push(eq(people.membership, i.membership))
  if (i.hackathon) {
    conditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(activities)
          .where(and(eq(activities.personSlug, people.slug), eq(activities.type, i.hackathon === "award" ? "award" : "hackathon"))),
      ),
    )
  }
  // Someone must hold at least one of the skills that define the search.
  const defining = [...i.skills, ...anyOfSkills(i)]
  if (defining.length && !options.skipSkills) {
    conditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(personSkills)
          .where(and(eq(personSkills.personSlug, people.slug), inArray(personSkills.name, defining))),
      ),
    )
  }
  return conditions
}

/** Skills where having any one is enough: umbrella groups and Tavily's skills for a goal. */
function anyOfSkills(i: QueryInterpretation) {
  return [...new Set([...i.groups.flatMap((g) => g.skills), ...(i.tavilyRole === "concept" ? i.tavilySkills : [])])].filter((s) => !i.skills.includes(s))
}

function describe(i: QueryInterpretation, person: PersonSummary, matched: string[], missing: string[]) {
  const parts: string[] = []
  if (matched.length) parts.push(`Has ${list(matched)}.`)
  if (i.organizations.length && person.organization) parts.push(`At ${person.organization}.`)
  if (i.roles.length && person.jobTitle) parts.push(`${person.jobTitle}.`)
  if (person.hackathonCount) parts.push(`${person.hackathonCount} ${person.hackathonCount === 1 ? "hackathon" : "hackathons"} on the platform.`)
  if (person.activityLevel === "high") parts.push("Highly active recently.")
  if (missing.length) parts.push(`No evidence yet for ${list(missing)}.`)
  return parts.join(" ") || "Matches the filters."
}

/**
 * Structured search over the Context Layer: filters narrow the set in SQL, then people are ranked
 * by skill evidence (real sources count more than sample data), activity and hackathon history.
 */
async function searchCommunityFromDb(i: QueryInterpretation): Promise<{ results: MatchResult[]; total: number }> {
  const conditions = filterConditions(i)
  const builders = i.concept ? await conceptBuilders(i.concept) : new Map<string, string>()
  const [candidates, builderRows] = await Promise.all([
    db
      .select({ slug: people.slug })
      .from(people)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(sql`${people.contextStatus} = 'ready' desc`, people.fullName)
      .limit(CANDIDATE_CAP),
    // Builders qualify through their project even without the inferred skills, but other filters still apply.
    builders.size
      ? db
          .select({ slug: people.slug })
          .from(people)
          .where(and(inArray(people.slug, [...builders.keys()]), ...filterConditions(i, { skipSkills: true })))
      : Promise.resolve([]),
  ])
  const slugs = [...new Set([...builderRows.map((r) => r.slug), ...candidates.map((c) => c.slug)])]
  if (!slugs.length) return { results: [], total: 0 }
  // "all" skills: coverage matters. "any" skills: the best few matches count.
  const required = i.skills
  const anyOf = anyOfSkills(i)
  const bonus = i.tavilyRole === "related" ? i.tavilySkills : []
  const scored = [...new Set([...required, ...anyOf, ...bonus])]

  const [summaries, skillRows] = await Promise.all([
    getPeopleBySlugs(slugs),
    scored.length
      ? db
          .select({
            personSlug: personSkills.personSlug,
            name: personSkills.name,
            confidence: personSkills.confidence,
            score: personSkills.score,
            evidence: personSkills.evidence,
          })
          .from(personSkills)
          .where(and(inArray(personSkills.personSlug, slugs), inArray(personSkills.name, scored)))
      : Promise.resolve([]),
  ])

  const skillsBy = new Map<string, typeof skillRows>()
  for (const row of skillRows) skillsBy.set(row.personSlug, [...(skillsBy.get(row.personSlug) ?? []), row])
  const strength = (row: (typeof skillRows)[number]) => CONFIDENCE_WEIGHT[row.confidence] * (row.evidence.some((e) => !e.isSample) ? 1 : 0.6)

  // Tie-break for people at the score ceiling: total strength of their relevant skill evidence.
  const depth = new Map<string, number>()
  const results = summaries.map((person): MatchResult => {
    const rows = (skillsBy.get(person.slug) ?? []).sort((a, b) => b.score - a.score)
    const requiredRows = rows.filter((r) => required.includes(r.name))
    const anyRows = rows.filter((r) => anyOf.includes(r.name))
    const bonusRows = rows.filter((r) => bonus.includes(r.name))
    const allFit = required.length ? requiredRows.reduce((s, r) => s + strength(r), 0) / (3 * required.length) : null
    const bestThree = anyRows.map(strength).sort((a, b) => b - a).slice(0, 3)
    const anyFit = anyOf.length ? Math.min(1, bestThree.reduce((s, v) => s + v, 0) / 7) : null
    const fit = allFit !== null && anyFit !== null ? allFit * 0.6 + anyFit * 0.4 : (allFit ?? anyFit)
    const skillScore = fit === null ? 40 : fit * 70
    const bonusScore = bonus.length ? (bonusRows.reduce((s, r) => s + strength(r), 0) / (3 * bonus.length)) * 12 : 0
    depth.set(person.slug, rows.reduce((sum, r) => sum + r.score, 0))
    const built = builders.get(person.slug)
    const score = Math.min(
      99,
      Math.round(
        (built ? 35 : 0) +
          skillScore +
          bonusScore +
          ACTIVITY_BONUS[person.activityLevel] +
          Math.min(person.hackathonCount * 3, 9) +
          (person.contextStatus === "ready" ? 5 : 0),
      ),
    )
    const matchedSkills = rows.length ? rows.map(({ name, confidence }) => ({ name, confidence })) : person.topSkills.slice(0, 3)
    const missingSkills = required.filter((s) => !requiredRows.some((r) => r.name === s))
    const evidence: Evidence[] = rows.flatMap((r) => r.evidence.slice(0, 2))
    return {
      person,
      score,
      matchedSkills,
      missingSkills,
      explanation: `${built ? `Built ${built}. ` : ""}${describe(i, person, rows.map((r) => r.name), built ? [] : missingSkills)}`,
      evidence,
    }
  })

  results.sort((a, b) => b.score - a.score || (depth.get(b.person.slug) ?? 0) - (depth.get(a.person.slug) ?? 0))
  return { results: results.slice(0, i.limit), total: results.length }
}

/** Free-text fallback: words in the question matched against names, colleges, titles, skills, projects and repos. */
async function searchTextFromDb(query: string, limit: number): Promise<{ results: MatchResult[]; total: number; terms: string[] }> {
  const STOP = new Set(["who", "what", "which", "where", "when", "how", "the", "and", "for", "with", "from", "that", "this", "are", "is", "was", "has", "have", "had", "any", "all", "our", "your", "their", "people", "person", "developers", "developer", "show", "find", "list", "tell", "about", "someone", "anyone", "platform", "community", "does", "did", "can", "could", "would", "should", "there", "into", "been", "some", "many", "much", "more", "most", "give", "want", "need", "looking", "search"])
  const terms = [...new Set(query.toLowerCase().match(/[a-z0-9][a-z0-9.+#-]{2,}/g) ?? [])].filter((t) => !STOP.has(t)).slice(0, 6)
  if (!terms.length) return { results: [], total: 0, terms }

  const hits = new Map<string, number>()
  const bump = (slugs: { slug: string }[], weight: number) => {
    for (const { slug } of slugs) hits.set(slug, (hits.get(slug) ?? 0) + weight)
  }

  for (const term of terms) {
    const pattern = `%${term}%`
    const [byPerson, bySkill, byProject, byRepo] = await Promise.all([
      db
        .select({ slug: people.slug })
        .from(people)
        .where(or(ilike(people.fullName, pattern), ilike(people.organization, pattern), ilike(people.jobTitle, pattern), ilike(people.bio, pattern))),
      db.selectDistinct({ slug: personSkills.personSlug }).from(personSkills).where(ilike(personSkills.name, pattern)),
      db.selectDistinct({ slug: projects.personSlug }).from(projects).where(or(ilike(projects.name, pattern), ilike(projects.description, pattern))),
      db.selectDistinct({ slug: githubRepos.personSlug }).from(githubRepos).where(or(ilike(githubRepos.name, pattern), ilike(githubRepos.description, pattern))),
    ])
    bump(byPerson, 3)
    bump(bySkill, 3)
    bump(byProject, 2)
    bump(byRepo, 2)
  }

  const ranked = [...hits.entries()].sort((a, b) => b[1] - a[1])
  const people_ = await getPeopleBySlugs(ranked.slice(0, limit).map(([slug]) => slug))
  const results = people_.map((person): MatchResult => {
    const visible = [person.fullName, person.organization, person.jobTitle, ...person.topProjects, ...person.topSkills.map((s) => s.name)]
      .join(" ")
      .toLowerCase()
    const matchedTerms = terms.filter((t) => visible.includes(t))
    return {
      person,
      score: Math.min(99, 30 + (hits.get(person.slug) ?? 0) * 6),
      matchedSkills: person.topSkills.slice(0, 3),
      missingSkills: [],
      explanation: matchedTerms.length ? `Mentions ${list(matchedTerms)}.` : "Matches words in their projects or repositories.",
      evidence: [],
    }
  })
  return { results, total: ranked.length, terms }
}

export const distinctOrganizations = () => cached("orgs:distinct", { ttl: 3600 }, distinctOrganizationsFromDb)

/** Same interpretation → same ranking until the data changes. */
export const searchCommunity = (i: QueryInterpretation) => cached(`community:${hashKey(i)}`, { ttl: 1800 }, () => searchCommunityFromDb(i))

export const searchText = (query: string, limit = 8) =>
  cached(`text:${hashKey([query.toLowerCase().trim(), limit])}`, { ttl: 1800 }, () => searchTextFromDb(query, limit))
