import {
  confidenceFromScore,
  extractSkillsFromText,
  skillDefinition,
  skillForLanguage,
  toSearchableText,
} from "@/lib/skills"
import type {
  ActivityLevel,
  ActivityType,
  Confidence,
  ContextSignal,
  Evidence,
  GithubRepo,
  Skill,
  SkillCategory,
} from "@/lib/types"

const DAY_MS = 86_400_000
const MAX_EVIDENCE = 4
const MAX_SKILLS = 12

export interface GithubFacts {
  username: string
  bio: string | null
  followers: number
  repos: GithubRepo[]
  commits90d: number
  externalContributions: { repo: string; type: string; date: string }[]
}

export interface PlatformFacts {
  projects: { name: string; technologies: string[]; date: string | null; hackathon: string | null; isSample: boolean }[]
  activities: { type: ActivityType; title: string; occurredAt: string; hackathon: string | null; isSample: boolean }[]
}

/** Pages read through Tavily: the person's portfolio and web pages that mention them. */
export interface WebFacts {
  portfolio: { url: string; content: string } | null
  mentions: { title: string; url: string; content: string }[]
}

export interface ExtractionInput {
  firstName: string
  jobTitle: string | null
  organization: string | null
  github: GithubFacts | null
  platform: PlatformFacts
  web?: WebFacts
  now?: number
}

export interface ExtractedProject {
  name: string
  description: string | null
  technologies: string[]
  url: string
  date: string | null
}

export interface ExtractionResult {
  skills: Skill[]
  projects: ExtractedProject[]
  signals: ContextSignal[]
  activityLevel: ActivityLevel
}

const isRecent = (date: string | null | undefined, days: number, now: number) =>
  Boolean(date && now - new Date(date).getTime() <= days * DAY_MS)

class SkillAccumulator {
  private readonly entries = new Map<string, { score: number; evidence: Evidence[] }>()

  add(name: string, points: number, evidence: Evidence) {
    const entry = this.entries.get(name) ?? { score: 0, evidence: [] }
    entry.score += points
    if (!entry.evidence.some((e) => e.label === evidence.label)) entry.evidence.push(evidence)
    this.entries.set(name, entry)
  }

  toSkills(): Skill[] {
    return [...this.entries.entries()]
      .map(([name, { score, evidence }]) => ({
        name,
        category: skillDefinition(name)?.category ?? ("domain" as SkillCategory),
        score: Math.round(score * 10) / 10,
        confidence: confidenceFromScore(score),
        evidence: evidence
          .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
          .slice(0, MAX_EVIDENCE),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_SKILLS)
  }
}

export function extractSkills(input: ExtractionInput): Skill[] {
  const now = input.now ?? Date.now()
  const acc = new SkillAccumulator()

  for (const repo of input.github?.repos ?? []) {
    if (repo.isFork) continue
    const recencyBonus = isRecent(repo.pushedAt, 180, now) ? 0.6 : 0
    const evidence: Evidence = {
      label: `Repository ${repo.name}`,
      source: "github",
      url: repo.url,
      date: repo.pushedAt ?? undefined,
    }
    const languageSkill = skillForLanguage(repo.language)
    if (languageSkill) acc.add(languageSkill.name, 1.2 + recencyBonus, evidence)

    const text = toSearchableText(repo.name, repo.description, repo.topics.join(" "))
    for (const skill of extractSkillsFromText(text)) {
      if (skill !== languageSkill?.name) acc.add(skill, 1.5 + recencyBonus, evidence)
    }
  }

  for (const project of input.platform.projects) {
    for (const technology of project.technologies) {
      acc.add(technology, 2, {
        label: `Submitted ${project.name}${project.hackathon ? ` at ${project.hackathon}` : ""}`,
        source: "platform",
        date: project.date ?? undefined,
        isSample: project.isSample,
      })
    }
  }

  if (input.web?.portfolio?.content) {
    const { url, content } = input.web.portfolio
    for (const skill of extractSkillsFromText(toSearchableText(content.slice(0, 20_000)))) {
      acc.add(skill, 1.2, { label: "Listed on their portfolio", source: "portfolio", url })
    }
  }

  for (const mention of input.web?.mentions ?? []) {
    for (const skill of extractSkillsFromText(toSearchableText(mention.title, mention.content))) {
      acc.add(skill, 0.8, { label: `Mentioned in "${mention.title}"`, source: "web", url: mention.url })
    }
  }

  if (input.jobTitle) {
    for (const skill of extractSkillsFromText(toSearchableText(input.jobTitle))) {
      acc.add(skill, 1, { label: `Job title: ${input.jobTitle}`, source: "platform" })
    }
  }

  if (input.github?.bio) {
    for (const skill of extractSkillsFromText(toSearchableText(input.github.bio))) {
      acc.add(skill, 1, {
        label: "Mentioned in GitHub bio",
        source: "github",
        url: `https://github.com/${input.github.username}`,
      })
    }
  }

  return acc.toSkills()
}

export function extractProjects(github: GithubFacts | null, now = Date.now()): ExtractedProject[] {
  if (!github) return []
  const rank = (repo: GithubRepo) =>
    repo.stars * 3 + repo.forks * 2 + (repo.description ? 2 : 0) + (isRecent(repo.pushedAt, 180, now) ? 3 : 0) + repo.topics.length * 0.5

  return github.repos
    .filter((repo) => !repo.isFork && repo.name.toLowerCase() !== github.username.toLowerCase())
    .sort((a, b) => rank(b) - rank(a))
    .slice(0, 6)
    .map((repo) => {
      const technologies = new Set<string>()
      const languageSkill = skillForLanguage(repo.language)
      if (languageSkill) technologies.add(languageSkill.name)
      else if (repo.language) technologies.add(repo.language)
      for (const skill of extractSkillsFromText(toSearchableText(repo.name, repo.description, repo.topics.join(" ")))) {
        technologies.add(skill)
      }
      return {
        name: repo.name,
        description: repo.description,
        technologies: [...technologies].slice(0, 5),
        url: repo.url,
        date: repo.pushedAt,
      }
    })
}

const CATEGORY_LABEL: Record<SkillCategory, string> = {
  web3: "Web3",
  ai: "AI & ML",
  framework: "Web frameworks",
  language: "Programming languages",
  infra: "Infrastructure",
  domain: "Product engineering",
}

function strengthFromCount(count: number, high: number, medium: number): Confidence {
  if (count >= high) return "high"
  if (count >= medium) return "medium"
  return "low"
}

export function computeActivityLevel(input: ExtractionInput): ActivityLevel {
  const now = input.now ?? Date.now()
  const commits = input.github?.commits90d ?? 0
  const recentEvents = input.platform.activities.filter(
    (a) => a.type !== "joined" && isRecent(a.occurredAt, 90, now),
  ).length
  if (commits >= 40 || recentEvents >= 4) return "high"
  if (commits >= 8 || recentEvents >= 2) return "medium"
  return "low"
}

export function extractSignals(input: ExtractionInput, skills: Skill[]): ContextSignal[] {
  const now = input.now ?? Date.now()
  const { github, platform } = input
  const signals: ContextSignal[] = []

  // Technical focus: which categories carry the most skill weight.
  const categoryScores = new Map<SkillCategory, number>()
  for (const skill of skills) categoryScores.set(skill.category, (categoryScores.get(skill.category) ?? 0) + skill.score)
  const topCategories = [...categoryScores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2)
  const leadSkills = skills.slice(0, 3)
  signals.push({
    key: "technical_focus",
    label: "Technical focus",
    value: topCategories.length ? topCategories.map(([c]) => CATEGORY_LABEL[c]).join(" and ") : "Not enough data yet",
    detail: leadSkills.length
      ? `Strongest evidence for ${leadSkills.map((s) => s.name).join(", ")}.`
      : "Connect GitHub or add platform activity to infer a focus.",
    strength: leadSkills[0]?.confidence ?? "low",
    evidence: leadSkills.flatMap((s) => s.evidence.slice(0, 1)),
  })

  // Collaboration: platform teams plus contributions to repositories they don't own.
  const teams = platform.activities.filter((a) => a.type === "team" || a.type === "mentorship")
  const externalRepos = [...new Set((github?.externalContributions ?? []).map((c) => c.repo))]
  const collaborationCount = teams.length + externalRepos.length
  signals.push({
    key: "collaboration",
    label: "Collaboration",
    value:
      collaborationCount >= 3 ? "Frequent collaborator" : collaborationCount >= 1 ? "Some collaboration" : "Mostly independent work",
    detail: `${teams.length} team or mentorship ${teams.length === 1 ? "event" : "events"} on the platform, contributions to ${externalRepos.length} external ${externalRepos.length === 1 ? "repository" : "repositories"}.`,
    strength: strengthFromCount(collaborationCount, 3, 1),
    evidence: [
      ...teams.slice(0, 2).map((t) => ({ label: t.title, source: "platform" as const, date: t.occurredAt, isSample: t.isSample })),
      ...externalRepos.slice(0, 2).map((repo) => ({ label: `Contributed to ${repo}`, source: "github" as const, url: `https://github.com/${repo}` })),
    ],
  })

  // Activity level.
  const activityLevel = computeActivityLevel(input)
  const recentPlatform = platform.activities.filter((a) => a.type !== "joined" && isRecent(a.occurredAt, 90, now))
  signals.push({
    key: "activity_level",
    label: "Activity level",
    value: activityLevel === "high" ? "Highly active" : activityLevel === "medium" ? "Regularly active" : "Low recent activity",
    detail: `${github?.commits90d ?? 0} public commits and ${recentPlatform.length} platform events in the last 90 days.`,
    strength: activityLevel,
    evidence: [
      ...(github ? [{ label: `${github.commits90d} commits in 90 days`, source: "github" as const, url: `https://github.com/${github.username}` }] : []),
      ...recentPlatform.slice(0, 2).map((a) => ({ label: a.title, source: "platform" as const, date: a.occurredAt, isSample: a.isSample })),
    ],
  })

  // Hackathon experience.
  const hackathons = platform.activities.filter((a) => a.type === "hackathon")
  const awards = platform.activities.filter((a) => a.type === "award")
  signals.push({
    key: "hackathon_experience",
    label: "Hackathon experience",
    value: hackathons.length
      ? `${hackathons.length} ${hackathons.length === 1 ? "hackathon" : "hackathons"}${awards.length ? `, ${awards.length} ${awards.length === 1 ? "award" : "awards"}` : ""}`
      : "No hackathons on the platform yet",
    detail: hackathons.length ? `Most recent: ${hackathons[0].hackathon ?? hackathons[0].title}.` : "Participation will appear here once they join an event.",
    strength: strengthFromCount(hackathons.length + awards.length, 3, 1),
    evidence: [...awards, ...hackathons].slice(0, 3).map((a) => ({
      label: a.title,
      source: "platform" as const,
      date: a.occurredAt,
      isSample: a.isSample,
    })),
  })

  // Professional interests: repo topics plus role and organization.
  const topicCounts = new Map<string, number>()
  for (const repo of github?.repos ?? []) {
    for (const topic of repo.topics) topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1)
  }
  const topTopics = [...topicCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t.replace(/-/g, " "))
  const interests = topTopics.length ? topTopics : skills.filter((s) => s.category !== "language").slice(0, 3).map((s) => s.name)
  signals.push({
    key: "professional_interests",
    label: "Professional interests",
    value: interests.length ? interests.join(", ") : input.jobTitle ?? "Unknown",
    detail: [input.jobTitle, input.organization].filter(Boolean).join(" at ") || "Role not provided at registration.",
    strength: topTopics.length >= 2 ? "medium" : "low",
    evidence: [
      ...(input.jobTitle ? [{ label: `Registered as ${input.jobTitle}`, source: "platform" as const }] : []),
      ...topTopics.slice(0, 2).map((topic) => ({
        label: `GitHub topic "${topic}"`,
        source: "github" as const,
        url: github ? `https://github.com/${github.username}?tab=repositories&q=topic%3A${encodeURIComponent(topic.replace(/ /g, "-"))}` : undefined,
      })),
    ],
  })

  return signals
}

export function extractContext(input: ExtractionInput): ExtractionResult {
  const skills = extractSkills(input)
  return {
    skills,
    projects: extractProjects(input.github, input.now),
    signals: extractSignals(input, skills),
    activityLevel: computeActivityLevel(input),
  }
}
