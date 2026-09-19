/**
 * Seeds Postgres from the DevMatch registration dataset.
 *
 *   npm run db:seed                       # uses data/dataset_devmatch.csv
 *   npm run db:seed -- --no-sample        # registrations only, no sample platform activity
 *
 * Real data: names, job titles, organizations, LinkedIn and GitHub links from the CSV.
 * Sample data (flagged is_sample): hackathons, teams, submissions, comments, mentorship —
 * the registration export has no platform activity, so this stands in until it's connected.
 */
import { readFileSync } from "node:fs"
import path from "node:path"

import { sql } from "drizzle-orm"

import { invalidateContextData } from "@/server/cache/cache"
import { closeRedis } from "@/server/cache/redis"
import { db, pool } from "@/server/db"
import { activities, hackathons, people, personSkills, personSources, projects } from "@/server/db/schema"
import { extractContext } from "@/server/context-engine/extract"
import {
  joinName,
  normalizeLinkedinUrl,
  normalizeName,
  normalizeOrganization,
  normalizeTitle,
  parseGithubUsername,
  roleCategory,
  slugify,
} from "@/server/context-engine/normalize"
import { templateSummary } from "@/server/context-engine/summarize"
import { parseCsv } from "./lib/csv"

const DATASET = path.join(process.cwd(), "data", "dataset_devmatch.csv")
const WITH_SAMPLE = !process.argv.includes("--no-sample")
const DAY_MS = 86_400_000

/* -------------------------------- Sample data ------------------------------- */

const SAMPLE_HACKATHONS = [
  { slug: "winter-build-2026", name: "DevMatch Winter Build", theme: "open", startsAt: "2026-01-24" },
  { slug: "solana-builders-sprint", name: "Solana Builders Sprint", theme: "web3", startsAt: "2026-04-11" },
  { slug: "ai-agents-weekend", name: "AI Agents Weekend", theme: "ai", startsAt: "2026-06-20" },
  { slug: "open-source-fortnight", name: "Open Source Fortnight", theme: "oss", startsAt: "2026-08-08" },
] as const

type Theme = (typeof SAMPLE_HACKATHONS)[number]["theme"]

const PROJECT_IDEAS: Record<Theme, { name: string; description: string; technologies: string[] }[]> = {
  open: [
    { name: "CampusConnect", description: "Find project partners across college clubs.", technologies: ["React", "Node.js", "MongoDB"] },
    { name: "HostelHub", description: "Complaints, mess menus and room swaps for hostels.", technologies: ["Flutter", "Firebase"] },
    { name: "FoodBridge", description: "Routes surplus canteen food to nearby shelters.", technologies: ["Next.js", "PostgreSQL", "Tailwind CSS"] },
    { name: "RidePool", description: "Carpooling for students on the same metro line.", technologies: ["React Native", "Node.js"] },
  ],
  web3: [
    { name: "PayStream", description: "Streaming USDC salaries for remote contributors.", technologies: ["Solana", "Rust", "React"] },
    { name: "SolTickets", description: "Event tickets as compressed NFTs with QR check-in.", technologies: ["Solana", "TypeScript", "Next.js"] },
    { name: "GrantFlow", description: "Milestone-based grant escrow for student DAOs.", technologies: ["Solana", "Rust", "TypeScript"] },
    { name: "ChainQuest", description: "On-chain quests that reward open-source contributions.", technologies: ["Web3", "Solidity", "React"] },
  ],
  ai: [
    { name: "InterviewPrep Agent", description: "Mock interviews with feedback on each answer.", technologies: ["LLMs & AI agents", "Python", "FastAPI"] },
    { name: "DocuChat", description: "Ask questions across a team's docs and tickets.", technologies: ["LLMs & AI agents", "TypeScript", "Next.js"] },
    { name: "StudyBuddy", description: "Turns lecture notes into spaced-repetition quizzes.", technologies: ["LLMs & AI agents", "Python", "React"] },
    { name: "CropScan", description: "Detects leaf disease from phone photos.", technologies: ["Computer Vision", "Machine Learning", "Python"] },
  ],
  oss: [
    { name: "PR Radar", description: "Surfaces good-first-issues that match your stack.", technologies: ["TypeScript", "Node.js", "GraphQL"] },
    { name: "EnvGuard", description: "Catches leaked secrets in pre-commit hooks.", technologies: ["Go", "Docker"] },
    { name: "LogLens", description: "Structured log search for small teams.", technologies: ["Rust", "PostgreSQL"] },
    { name: "SchemaDiff", description: "Readable diffs for database migrations.", technologies: ["TypeScript", "PostgreSQL"] },
  ],
}

const TEAM_WORDS = ["Byte", "Null", "Stack", "Pixel", "Kernel", "Lambda", "Vector", "Async", "Delta", "Orbit"]
const TEAM_NOUNS = ["Pirates", "Wizards", "Builders", "Rangers", "Collective", "Labs", "Crew", "Squad"]

/** Deterministic PRNG so every seed produces the same sample data. */
function rng(seed: string) {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
  let a = (h << 13) | (h >>> 19)
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = <T,>(random: () => number, items: readonly T[]) => items[Math.floor(random() * items.length)]

/* ---------------------------------- Seed ---------------------------------- */

interface SeedPerson {
  slug: string
  firstName: string
  lastName: string | null
  fullName: string
  jobTitle: string | null
  organization: string | null
  roleCategory: string
  linkedinUrl: string | null
  githubUsername: string | null
  datasetRow: number
}

function readDataset(): { people: SeedPerson[]; skipped: number; duplicates: number } {
  const [, ...rows] = parseCsv(readFileSync(DATASET, "utf8"))
  const slugs = new Set<string>()
  const githubSeen = new Set<string>()
  const result: SeedPerson[] = []
  let skipped = 0
  let duplicates = 0

  rows.forEach((row, index) => {
    const [first, last, linkedin, github, company, title] = row
    const githubUsername = parseGithubUsername(github)
    const firstName = normalizeName(first) ?? normalizeName(last) ?? githubUsername
    if (!firstName) return void skipped++
    const lastName = normalizeName(first) ? normalizeName(last) : null

    if (githubUsername) {
      const key = githubUsername.toLowerCase()
      if (githubSeen.has(key)) return void duplicates++
      githubSeen.add(key)
    }

    const fullName = joinName(firstName, lastName)
    let slug = slugify(fullName) || "person"
    if (slugs.has(slug)) slug = githubUsername ? `${slug}-${slugify(githubUsername)}` : `${slug}-${index + 2}`
    slugs.add(slug)

    const jobTitle = normalizeTitle(title)
    result.push({
      slug,
      firstName,
      lastName,
      fullName,
      jobTitle,
      organization: normalizeOrganization(company),
      roleCategory: roleCategory(jobTitle),
      linkedinUrl: normalizeLinkedinUrl(linkedin),
      githubUsername,
      datasetRow: index + 2,
    })
  })

  return { people: result, skipped, duplicates }
}

type ActivityInsert = typeof activities.$inferInsert
type ProjectInsert = typeof projects.$inferInsert

function sampleActivity(person: SeedPerson, everyone: SeedPerson[]) {
  const random = rng(person.slug)
  const acts: ActivityInsert[] = []
  const subs: ProjectInsert[] = []
  if (random() > 0.42) return { acts, subs }

  const title = (person.jobTitle ?? "").toLowerCase()
  const preferred = /\b(ai|ml|data)\b/.test(title) ? "ai" : /blockchain|web3|solana/.test(title) ? "web3" : null
  const count = random() < 0.3 ? 2 : 1
  const events = [...SAMPLE_HACKATHONS].sort(() => random() - 0.5)
  if (preferred) events.sort((a, b) => Number(b.theme === preferred) - Number(a.theme === preferred))

  for (const hackathon of events.slice(0, count)) {
    const start = new Date(hackathon.startsAt).getTime()
    const idea = pick(random, PROJECT_IDEAS[hackathon.theme])
    const teammate = pick(random, everyone)
    const team = `${pick(random, TEAM_WORDS)} ${pick(random, TEAM_NOUNS)}`
    const at = (days: number) => new Date(start + days * DAY_MS + Math.floor(random() * 8) * 3_600_000)

    acts.push({ personSlug: person.slug, type: "hackathon", title: `Joined ${hackathon.name}`, hackathonSlug: hackathon.slug, occurredAt: at(-3), isSample: true })
    acts.push({
      personSlug: person.slug,
      type: "team",
      title: `Formed team ${team}`,
      detail: teammate.slug !== person.slug ? `With ${teammate.fullName}` : null,
      hackathonSlug: hackathon.slug,
      occurredAt: at(0),
      isSample: true,
    })
    acts.push({ personSlug: person.slug, type: "submission", title: `Submitted ${idea.name}`, detail: idea.name, hackathonSlug: hackathon.slug, occurredAt: at(2), isSample: true })
    subs.push({
      personSlug: person.slug,
      name: idea.name,
      description: idea.description,
      technologies: idea.technologies,
      source: "platform",
      date: at(2),
      hackathon: hackathon.name,
      isSample: true,
    })
    if (random() < 0.35) {
      const other = pick(random, PROJECT_IDEAS[hackathon.theme])
      acts.push({ personSlug: person.slug, type: "comment", title: `Commented on ${other.name}`, detail: "Left feedback during judging", hackathonSlug: hackathon.slug, occurredAt: at(3), isSample: true })
    }
    if (random() < 0.12) {
      acts.push({ personSlug: person.slug, type: "award", title: `${pick(random, ["Winner", "Runner-up", "Best UX", "Best use of AI"])} at ${hackathon.name}`, hackathonSlug: hackathon.slug, occurredAt: at(3), isSample: true })
    }
    if (["engineer", "founder"].includes(person.roleCategory) && random() < 0.5) {
      acts.push({ personSlug: person.slug, type: "mentorship", title: `Mentored teams at ${hackathon.name}`, hackathonSlug: hackathon.slug, occurredAt: at(1), isSample: true })
    }
  }
  return { acts, subs }
}

async function insertInChunks<T>(rows: T[], insert: (chunk: T[]) => Promise<unknown>, size = 500) {
  for (let i = 0; i < rows.length; i += size) await insert(rows.slice(i, i + size))
}

async function main() {
  const { people: seedPeople, skipped, duplicates } = readDataset()
  console.log(`Read ${seedPeople.length} people (${duplicates} duplicate GitHub accounts merged, ${skipped} empty rows skipped)`)

  await db.execute(sql`truncate table people, hackathons restart identity cascade`)
  if (WITH_SAMPLE) {
    await db.insert(hackathons).values(SAMPLE_HACKATHONS.map((h) => ({ slug: h.slug, name: h.name, theme: h.theme, startsAt: new Date(h.startsAt), isSample: true })))
  }

  const importedAt = new Date()
  const allActivities: ActivityInsert[] = []
  const allProjects: ProjectInsert[] = []
  const peopleRows: (typeof people.$inferInsert)[] = []
  const skillRows: (typeof personSkills.$inferInsert)[] = []
  const sourceRows: (typeof personSources.$inferInsert)[] = []

  for (const person of seedPeople) {
    const { acts, subs } = WITH_SAMPLE ? sampleActivity(person, seedPeople) : { acts: [], subs: [] }
    const joined: ActivityInsert = { personSlug: person.slug, type: "joined", title: "Registered on DevMatch", detail: "Imported from registration dataset", occurredAt: importedAt }
    allActivities.push(joined, ...acts)
    allProjects.push(...subs)

    const context = extractContext({
      firstName: person.firstName,
      jobTitle: person.jobTitle,
      organization: person.organization,
      github: null,
      platform: {
        projects: subs.map((s) => ({ name: s.name, technologies: s.technologies ?? [], date: s.date?.toISOString() ?? null, hackathon: s.hackathon ?? null, isSample: true })),
        activities: [...acts]
          .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
          .map((a) => ({
            type: a.type,
            title: a.title,
            occurredAt: a.occurredAt.toISOString(),
            hackathon: SAMPLE_HACKATHONS.find((h) => h.slug === a.hackathonSlug)?.name ?? null,
            isSample: true,
          })),
      },
    })

    peopleRows.push({
      ...person,
      membership: "platform",
      contextStatus: "pending",
      activityLevel: context.activityLevel,
      signals: context.signals,
      summary: templateSummary({
        ...person,
        location: null,
        bio: null,
        skills: context.skills,
        projects: [],
        signals: context.signals,
        activityLevel: context.activityLevel,
        hackathonCount: acts.filter((a) => a.type === "hackathon").length,
        repoCount: 0,
        githubSynced: false,
      }),
      summaryModel: "template",
    })
    skillRows.push(...context.skills.map((s) => ({ personSlug: person.slug, ...s })))
    sourceRows.push({ personSlug: person.slug, type: "platform", status: "connected", lastSyncedAt: importedAt, handle: `Row ${person.datasetRow}` })
    if (person.githubUsername) {
      sourceRows.push({ personSlug: person.slug, type: "github", handle: person.githubUsername, url: `https://github.com/${person.githubUsername}`, status: "pending" })
    }
    if (person.linkedinUrl) {
      sourceRows.push({ personSlug: person.slug, type: "linkedin", handle: person.linkedinUrl.split("/in/")[1], url: person.linkedinUrl, status: "connected", lastSyncedAt: importedAt })
    }
  }

  await insertInChunks(peopleRows, (chunk) => db.insert(people).values(chunk))
  await insertInChunks(sourceRows, (chunk) => db.insert(personSources).values(chunk))
  await insertInChunks(skillRows, (chunk) => db.insert(personSkills).values(chunk))
  await insertInChunks(allProjects, (chunk) => db.insert(projects).values(chunk))
  await insertInChunks(allActivities, (chunk) => db.insert(activities).values(chunk))

  console.log(
    `Seeded ${peopleRows.length} people, ${sourceRows.length} sources, ${skillRows.length} baseline skills, ` +
      `${allProjects.length} sample submissions, ${allActivities.length} activities.`,
  )
  await invalidateContextData()
  console.log("Next: `npm run context:sync -- --limit 25` to pull GitHub data and build full contexts.")
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => Promise.all([pool.end(), closeRedis()]))
