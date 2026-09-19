import "server-only"

import { and, eq, sql } from "drizzle-orm"

import type { ActivityLevel, ContextSignal, ContextStatus, GithubRepo, Skill, SourceStatus, SourceType } from "@/lib/types"
import { invalidateContextData } from "@/server/cache/cache"
import { db } from "@/server/db"
import { activities, githubRepos, githubStats, hackathons, people, personSkills, personSources, projects } from "@/server/db/schema"
import type { GithubSnapshot } from "@/server/context-engine/github"
import type { ExtractedProject, GithubFacts, PlatformFacts } from "@/server/context-engine/extract"

export async function setContextStatus(slug: string, status: ContextStatus) {
  await db.update(people).set({ contextStatus: status, updatedAt: new Date() }).where(eq(people.slug, slug))
  await invalidateContextData()
}

export async function upsertSource(
  slug: string,
  source: { type: SourceType; url?: string | null; handle?: string | null; status: SourceStatus; synced?: boolean },
) {
  const values = {
    personSlug: slug,
    type: source.type,
    url: source.url ?? null,
    handle: source.handle ?? null,
    status: source.status,
    lastSyncedAt: source.synced ? new Date() : null,
  }
  await db
    .insert(personSources)
    .values(values)
    .onConflictDoUpdate({
      target: [personSources.personSlug, personSources.type],
      set: { url: values.url, handle: values.handle, status: values.status, lastSyncedAt: values.lastSyncedAt },
    })
  await invalidateContextData()
}

export async function saveGithubSnapshot(slug: string, snapshot: GithubSnapshot) {
  await db.transaction(async (tx) => {
    await tx.delete(githubRepos).where(eq(githubRepos.personSlug, slug))
    if (snapshot.repos.length) {
      await tx.insert(githubRepos).values(
        snapshot.repos.map((repo) => ({
          personSlug: slug,
          name: repo.name,
          description: repo.description,
          language: repo.language,
          stars: repo.stars,
          forks: repo.forks,
          topics: repo.topics,
          url: repo.url,
          isFork: repo.isFork,
          pushedAt: repo.pushedAt ? new Date(repo.pushedAt) : null,
        })),
      )
    }
    const stats = {
      username: snapshot.user.login,
      publicRepos: snapshot.user.publicRepos,
      followers: snapshot.user.followers,
      commits90d: snapshot.commits90d,
      weeklyActivity: snapshot.weeklyActivity,
      languages: snapshot.languages,
      accountCreatedAt: new Date(snapshot.user.createdAt),
      lastEventAt: snapshot.lastEventAt ? new Date(snapshot.lastEventAt) : null,
      fetchedAt: new Date(),
    }
    await tx
      .insert(githubStats)
      .values({ personSlug: slug, ...stats })
      .onConflictDoUpdate({ target: githubStats.personSlug, set: stats })

    await tx
      .update(people)
      .set({
        avatarUrl: snapshot.user.avatarUrl,
        bio: snapshot.user.bio,
        location: snapshot.user.location,
        githubUsername: snapshot.user.login,
        portfolioUrl: sql`coalesce(${people.portfolioUrl}, ${snapshot.user.blog || null})`,
      })
      .where(eq(people.slug, slug))
  })
  await invalidateContextData()
}

/** Rehydrates previously collected facts so a context can be rebuilt without refetching. */
export async function loadFacts(slug: string): Promise<{ github: GithubFacts | null; platform: PlatformFacts }> {
  const [row] = await db.select().from(people).where(eq(people.slug, slug)).limit(1)
  const [[stats], repoRows, projectRows, activityRows] = await Promise.all([
    db.select().from(githubStats).where(eq(githubStats.personSlug, slug)).limit(1),
    db.select().from(githubRepos).where(eq(githubRepos.personSlug, slug)),
    db.select().from(projects).where(and(eq(projects.personSlug, slug), eq(projects.source, "platform"))),
    db
      .select({
        type: activities.type,
        title: activities.title,
        occurredAt: activities.occurredAt,
        isSample: activities.isSample,
        hackathon: hackathons.name,
      })
      .from(activities)
      .leftJoin(hackathons, eq(activities.hackathonSlug, hackathons.slug))
      .where(eq(activities.personSlug, slug))
      .orderBy(sql`${activities.occurredAt} desc`),
  ])

  const repos: GithubRepo[] = repoRows.map((r) => ({
    name: r.name,
    description: r.description,
    language: r.language,
    stars: r.stars,
    forks: r.forks,
    topics: r.topics,
    url: r.url,
    isFork: r.isFork,
    pushedAt: r.pushedAt?.toISOString() ?? null,
  }))

  return {
    github: stats
      ? { username: stats.username, bio: row?.bio ?? null, followers: stats.followers, repos, commits90d: stats.commits90d, externalContributions: [] }
      : null,
    platform: {
      projects: projectRows.map((p) => ({
        name: p.name,
        technologies: p.technologies,
        date: p.date?.toISOString() ?? null,
        hackathon: p.hackathon,
        isSample: p.isSample,
      })),
      activities: activityRows.map((a) => ({ ...a, occurredAt: a.occurredAt.toISOString() })),
    },
  }
}

export async function saveContext(
  slug: string,
  context: {
    skills: Skill[]
    githubProjects: ExtractedProject[]
    signals: ContextSignal[]
    activityLevel: ActivityLevel
    summary: string
    summaryModel: string
  },
) {
  await db.transaction(async (tx) => {
    await tx.delete(personSkills).where(eq(personSkills.personSlug, slug))
    if (context.skills.length) {
      await tx.insert(personSkills).values(
        context.skills.map((s) => ({
          personSlug: slug,
          name: s.name,
          category: s.category,
          confidence: s.confidence,
          score: s.score,
          evidence: s.evidence,
        })),
      )
    }

    await tx.delete(projects).where(and(eq(projects.personSlug, slug), eq(projects.source, "github")))
    if (context.githubProjects.length) {
      await tx.insert(projects).values(
        context.githubProjects.map((p) => ({
          personSlug: slug,
          name: p.name,
          description: p.description,
          technologies: p.technologies,
          source: "github" as const,
          url: p.url,
          date: p.date ? new Date(p.date) : null,
        })),
      )
    }

    const now = new Date()
    await tx
      .update(people)
      .set({
        signals: context.signals,
        activityLevel: context.activityLevel,
        summary: context.summary,
        summaryModel: context.summaryModel,
        contextStatus: "ready",
        contextBuiltAt: now,
        updatedAt: now,
      })
      .where(eq(people.slug, slug))
  })
  await invalidateContextData()
}

export async function slugIsTaken(slug: string) {
  const [row] = await db.select({ slug: people.slug }).from(people).where(eq(people.slug, slug)).limit(1)
  return Boolean(row)
}

export async function createPerson(values: typeof people.$inferInsert) {
  await db.insert(people).values(values)
  await invalidateContextData()
}

export async function updatePersonLinks(
  slug: string,
  links: { githubUsername?: string | null; linkedinUrl?: string | null; portfolioUrl?: string | null },
) {
  const set = Object.fromEntries(Object.entries(links).filter(([, value]) => value)) as typeof links
  if (Object.keys(set).length) await db.update(people).set({ ...set, updatedAt: new Date() }).where(eq(people.slug, slug))
  await invalidateContextData()
}

export async function recordActivity(values: typeof activities.$inferInsert) {
  await db.insert(activities).values(values)
  await invalidateContextData()
}
