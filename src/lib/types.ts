/**
 * Domain model for the ContextOS Context Layer.
 * Shared by the server (Context Engine, agent, API) and the client (UI).
 */

export type SourceType = "platform" | "github" | "linkedin" | "portfolio" | "web"
export type SourceStatus = "connected" | "pending" | "failed"
export type Confidence = "high" | "medium" | "low"
export type ActivityLevel = "high" | "medium" | "low"
export type Membership = "platform" | "tracked"
export type ContextStatus = "pending" | "syncing" | "ready" | "failed"
export type RoleCategory = "student" | "intern" | "engineer" | "founder" | "other"
export type SkillCategory = "language" | "framework" | "web3" | "ai" | "infra" | "domain"
export type ActivityType =
  | "joined"
  | "hackathon"
  | "submission"
  | "team"
  | "comment"
  | "mentorship"
  | "award"

/** A pointer back to where a claim came from. Every important signal carries these. */
export interface Evidence {
  label: string
  source: SourceType
  url?: string
  date?: string
  isSample?: boolean
}

export interface LanguageShare {
  name: string
  share: number
}

export interface Skill {
  name: string
  category: SkillCategory
  confidence: Confidence
  score: number
  evidence: Evidence[]
}

export interface Project {
  id: number
  name: string
  description: string | null
  technologies: string[]
  source: SourceType
  url: string | null
  date: string | null
  hackathon: string | null
  isSample: boolean
}

export interface PlatformActivity {
  id: number
  personSlug: string
  personName: string
  type: ActivityType
  title: string
  detail: string | null
  hackathon: string | null
  occurredAt: string
  isSample: boolean
}

export interface GithubRepo {
  name: string
  description: string | null
  language: string | null
  stars: number
  forks: number
  topics: string[]
  url: string
  isFork: boolean
  pushedAt: string | null
}

export interface GithubActivity {
  username: string
  publicRepos: number
  followers: number
  commits90d: number
  weeklyActivity: number[]
  languages: LanguageShare[]
  accountCreatedAt: string | null
  lastEventAt: string | null
  fetchedAt: string
  repos: GithubRepo[]
}

export type SignalKey =
  | "technical_focus"
  | "collaboration"
  | "activity_level"
  | "hackathon_experience"
  | "professional_interests"

export interface ContextSignal {
  key: SignalKey
  label: string
  value: string
  detail: string
  strength: Confidence
  evidence: Evidence[]
}

export interface ConnectedSource {
  type: SourceType
  url: string | null
  handle: string | null
  status: SourceStatus
  lastSyncedAt: string | null
}

export interface HackathonEntry {
  name: string
  date: string
  project: string | null
  result: string | null
  isSample: boolean
}

/** Compact projection used by lists, search results and the agent's lookup card. */
export interface PersonSummary {
  slug: string
  fullName: string
  jobTitle: string | null
  organization: string | null
  avatarUrl: string | null
  membership: Membership
  contextStatus: ContextStatus
  activityLevel: ActivityLevel
  topSkills: Pick<Skill, "name" | "confidence">[]
  projectCount: number
  topProjects: string[]
  hackathonCount: number
  lastActivity: { title: string; occurredAt: string } | null
  sources: SourceType[]
  /** Profile links (GitHub, LinkedIn, portfolio…) the person can be found at. */
  links: { type: SourceType; url: string; handle: string | null }[]
  updatedAt: string
}

/** Full context profile for the person page. */
export interface PersonProfile extends PersonSummary {
  firstName: string
  lastName: string | null
  roleCategory: string
  linkedinUrl: string | null
  githubUsername: string | null
  portfolioUrl: string | null
  location: string | null
  bio: string | null
  summary: string | null
  summaryModel: string | null
  contextBuiltAt: string | null
  skills: Skill[]
  projects: Project[]
  activity: PlatformActivity[]
  hackathons: HackathonEntry[]
  github: GithubActivity | null
  signals: ContextSignal[]
  connectedSources: ConnectedSource[]
}

export interface LayerStats {
  people: number
  platformMembers: number
  trackedPeople: number
  readyContexts: number
  skills: number
  signals: number
  repos: number
  activities: number
  /** Connected sources per type, e.g. how many people have GitHub linked and synced. */
  sources: Record<SourceType, number>
  hackathons: number
  lastSyncedAt: string | null
}

/* ----------------------------- Streaming events ---------------------------- */

export type StageStatus = "pending" | "active" | "done" | "skipped" | "error"

export type AgentStageId = "understand" | "contextos" | "web" | "synthesis"
export type TrackStageId = "resolve" | "collect" | "extract" | "build"

export interface StageEvent<Id extends string> {
  type: "stage"
  stage: Id
  status: StageStatus
  detail?: string
}

export type AgentIntent =
  | "presence"
  | "person_profile"
  | "person_work"
  | "person_external"
  | "community_search"
  | "general"

export interface AgentPlan {
  intent: AgentIntent
  subject: string | null
  /** The question asks for someone's GitHub, LinkedIn, portfolio or "other" profiles. */
  wantsLinks: boolean
  skills: string[]
  useContextOS: boolean
  useWeb: boolean
  reason: string
}

/**
 * A natural-language community question turned into structured DB filters.
 * Tavily contributes skills when the question names a goal ("build a fintech app") instead of technologies.
 */
export interface QueryInterpretation {
  /** Technologies named in the question. People are ranked by how many of these they have. */
  skills: string[]
  /** Umbrella terms ("frontend") expanded to concrete skills; any one of them qualifies. */
  groups: { name: string; skills: string[] }[]
  /** Skills Tavily researched: for a goal/concept (required) or as related skills (a ranking bonus). */
  tavilySkills: string[]
  tavilyRole: "concept" | "related" | null
  /** The goal named in the question, e.g. "fintech app". Matched against projects and researched by Tavily. */
  concept: string | null
  /** Organization names from the DB that matched what the user typed (e.g. "DTU"). */
  organizations: string[]
  organizationQuery: string | null
  roles: RoleCategory[]
  /** Minimum activity level. */
  activity: ActivityLevel | null
  hackathon: "any" | "award" | null
  membership: Membership | null
  limit: number
}

export interface SourceRef {
  title: string
  url: string | null
  type: SourceType
  snippet?: string
}

export type PersonLookup =
  | { status: "found"; person: PersonSummary }
  | { status: "ambiguous"; name: string; candidates: PersonSummary[] }
  /** No exact name match, but close spellings exist (typos, partial names). */
  | { status: "similar"; name: string; candidates: PersonSummary[] }
  | { status: "not_found"; name: string }

export interface MatchResult {
  person: PersonSummary
  score: number
  matchedSkills: Pick<Skill, "name" | "confidence">[]
  missingSkills: string[]
  explanation: string
  evidence: Evidence[]
}

/** Profile links the agent found on the web for someone who isn't in the platform yet. */
export interface WebCandidates {
  githubUrl: string | null
  linkedinUrl: string | null
  portfolioUrl: string | null
}

export interface AgentResult {
  interpretation: QueryInterpretation | null
  /** How many people matched before the result limit. */
  totalMatches: number
  /** What ContextOS knows, composed from structured context. */
  answer: string
  /** Tavily's answer from web research anchored on that context, when it was consulted. */
  webAnswer: string | null
  /** Caveats about the web research, e.g. results about namesakes that were left out. */
  webNote: string | null
  lookup: PersonLookup | null
  matches: MatchResult[]
  evidence: Evidence[]
  sources: SourceRef[]
  webCandidates: WebCandidates | null
}

export type AgentEvent =
  | { type: "plan"; plan: AgentPlan }
  | { type: "interpretation"; interpretation: QueryInterpretation }
  | StageEvent<AgentStageId>
  | { type: "result"; result: AgentResult }
  | { type: "error"; message: string }

export type TrackEvent =
  | StageEvent<TrackStageId>
  | { type: "done"; person: PersonSummary; alreadyExisted: boolean }
  | { type: "error"; message: string }
