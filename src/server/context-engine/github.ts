import type { LanguageShare } from "@/lib/types"

const GITHUB_API = "https://api.github.com"
const WEEKS_TRACKED = 12
const DAY_MS = 86_400_000

export class GithubError extends Error {
  constructor(
    message: string,
    readonly code: "not_found" | "rate_limited" | "network" | "unexpected",
  ) {
    super(message)
    this.name = "GithubError"
  }
}

interface GithubUserResponse {
  login: string
  name: string | null
  avatar_url: string
  bio: string | null
  company: string | null
  blog: string | null
  location: string | null
  public_repos: number
  followers: number
  created_at: string
}

interface GithubRepoResponse {
  name: string
  description: string | null
  language: string | null
  stargazers_count: number
  forks_count: number
  topics?: string[]
  html_url: string
  fork: boolean
  pushed_at: string | null
}

interface GithubEventResponse {
  type: string
  created_at: string
  repo: { name: string }
  payload?: { size?: number; commits?: unknown[]; action?: string }
}

export interface GithubSnapshot {
  user: {
    login: string
    name: string | null
    avatarUrl: string
    bio: string | null
    company: string | null
    blog: string | null
    location: string | null
    publicRepos: number
    followers: number
    createdAt: string
  }
  repos: {
    name: string
    description: string | null
    language: string | null
    stars: number
    forks: number
    topics: string[]
    url: string
    isFork: boolean
    pushedAt: string | null
  }[]
  languages: LanguageShare[]
  commits90d: number
  weeklyActivity: number[]
  lastEventAt: string | null
  /** Events on repositories the person doesn't own — a collaboration signal. */
  externalContributions: { repo: string; type: string; date: string }[]
}

async function githubFetch<T>(path: string, token?: string): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${GITHUB_API}${path}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "ContextOS-Context-Engine",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    })
  } catch (error) {
    throw new GithubError(`GitHub request failed: ${(error as Error).message}`, "network")
  }

  if (response.status === 404) throw new GithubError("GitHub user not found", "not_found")
  if (response.status === 403 || response.status === 429) {
    const reset = Number(response.headers.get("x-ratelimit-reset"))
    const when = reset ? ` Resets at ${new Date(reset * 1000).toLocaleTimeString()}.` : ""
    throw new GithubError(`GitHub API rate limit reached.${when} Add GITHUB_TOKEN to raise it.`, "rate_limited")
  }
  if (!response.ok) throw new GithubError(`GitHub responded with ${response.status}`, "unexpected")
  return (await response.json()) as T
}

function languageShares(repos: GithubSnapshot["repos"]): LanguageShare[] {
  const counts = new Map<string, number>()
  for (const repo of repos) {
    if (repo.isFork || !repo.language) continue
    counts.set(repo.language, (counts.get(repo.language) ?? 0) + 1)
  }
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0)
  return [...counts.entries()]
    .map(([name, count]) => ({ name, share: total ? Math.round((count / total) * 100) / 100 : 0 }))
    .sort((a, b) => b.share - a.share)
}

function summarizeEvents(events: GithubEventResponse[], login: string, now = Date.now()) {
  const weekly = Array.from({ length: WEEKS_TRACKED }, () => 0)
  let commits90d = 0
  const externalContributions: GithubSnapshot["externalContributions"] = []

  for (const event of events) {
    const age = now - new Date(event.created_at).getTime()
    const commits =
      event.type === "PushEvent" ? Math.max(event.payload?.size ?? event.payload?.commits?.length ?? 1, 1) : 0
    const weight = commits || 1
    const week = Math.floor(age / (7 * DAY_MS))
    if (week >= 0 && week < WEEKS_TRACKED) weekly[WEEKS_TRACKED - 1 - week] += weight
    if (age <= 90 * DAY_MS) commits90d += commits

    const owner = event.repo.name.split("/")[0]
    const isContribution = ["PullRequestEvent", "PushEvent", "IssuesEvent", "PullRequestReviewEvent"].includes(event.type)
    if (isContribution && owner.toLowerCase() !== login.toLowerCase()) {
      externalContributions.push({ repo: event.repo.name, type: event.type, date: event.created_at })
    }
  }

  return {
    weeklyActivity: weekly,
    commits90d,
    lastEventAt: events[0]?.created_at ?? null,
    externalContributions,
  }
}

/** Collects the public GitHub footprint for a username (3 API calls). */
export async function fetchGithubSnapshot(username: string, token?: string): Promise<GithubSnapshot> {
  const user = await githubFetch<GithubUserResponse>(`/users/${encodeURIComponent(username)}`, token)
  const [repoResponse, events] = await Promise.all([
    githubFetch<GithubRepoResponse[]>(`/users/${encodeURIComponent(user.login)}/repos?sort=pushed&per_page=60&type=owner`, token),
    githubFetch<GithubEventResponse[]>(`/users/${encodeURIComponent(user.login)}/events/public?per_page=100`, token).catch(
      () => [] as GithubEventResponse[],
    ),
  ])

  const repos = repoResponse.map((repo) => ({
    name: repo.name,
    description: repo.description,
    language: repo.language,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    topics: repo.topics ?? [],
    url: repo.html_url,
    isFork: repo.fork,
    pushedAt: repo.pushed_at,
  }))

  return {
    user: {
      login: user.login,
      name: user.name,
      avatarUrl: user.avatar_url,
      bio: user.bio,
      company: user.company,
      blog: user.blog,
      location: user.location,
      publicRepos: user.public_repos,
      followers: user.followers,
      createdAt: user.created_at,
    },
    repos,
    languages: languageShares(repos),
    ...summarizeEvents(events, user.login),
  }
}
