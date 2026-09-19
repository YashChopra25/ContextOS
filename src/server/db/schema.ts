import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

import type {
  ActivityLevel,
  ActivityType,
  Confidence,
  ContextSignal,
  ContextStatus,
  Evidence,
  LanguageShare,
  Membership,
  SkillCategory,
  SourceStatus,
  SourceType,
} from "@/lib/types"

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}

/** Identity + platform fields. One row per person the Context Layer knows about. */
export const people = pgTable(
  "people",
  {
    slug: text("slug").primaryKey(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name"),
    fullName: text("full_name").notNull(),
    jobTitle: text("job_title"),
    organization: text("organization"),
    roleCategory: text("role_category").notNull().default("other"),
    linkedinUrl: text("linkedin_url"),
    githubUsername: text("github_username"),
    portfolioUrl: text("portfolio_url"),
    avatarUrl: text("avatar_url"),
    location: text("location"),
    bio: text("bio"),
    membership: text("membership").$type<Membership>().notNull(),
    contextStatus: text("context_status").$type<ContextStatus>().notNull().default("pending"),
    activityLevel: text("activity_level").$type<ActivityLevel>().notNull().default("low"),
    summary: text("summary"),
    summaryModel: text("summary_model"),
    signals: jsonb("signals").$type<ContextSignal[]>().notNull().default([]),
    datasetRow: integer("dataset_row"),
    contextBuiltAt: timestamp("context_built_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("people_full_name_idx").on(t.fullName),
    uniqueIndex("people_github_idx").on(t.githubUsername),
  ],
)

export const personSources = pgTable(
  "person_sources",
  {
    id: serial("id").primaryKey(),
    personSlug: text("person_slug")
      .notNull()
      .references(() => people.slug, { onDelete: "cascade" }),
    type: text("type").$type<SourceType>().notNull(),
    url: text("url"),
    handle: text("handle"),
    status: text("status").$type<SourceStatus>().notNull().default("pending"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("person_sources_unique").on(t.personSlug, t.type)],
)

export const personSkills = pgTable(
  "person_skills",
  {
    id: serial("id").primaryKey(),
    personSlug: text("person_slug")
      .notNull()
      .references(() => people.slug, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category").$type<SkillCategory>().notNull(),
    confidence: text("confidence").$type<Confidence>().notNull(),
    score: real("score").notNull(),
    evidence: jsonb("evidence").$type<Evidence[]>().notNull().default([]),
  },
  (t) => [
    uniqueIndex("person_skills_unique").on(t.personSlug, t.name),
    index("person_skills_name_idx").on(t.name),
  ],
)

export const projects = pgTable(
  "projects",
  {
    id: serial("id").primaryKey(),
    personSlug: text("person_slug")
      .notNull()
      .references(() => people.slug, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    technologies: text("technologies").array().notNull().default([]),
    source: text("source").$type<SourceType>().notNull(),
    url: text("url"),
    date: timestamp("date", { withTimezone: true }),
    hackathon: text("hackathon"),
    isSample: boolean("is_sample").notNull().default(false),
  },
  (t) => [index("projects_person_idx").on(t.personSlug)],
)

export const githubRepos = pgTable(
  "github_repos",
  {
    id: serial("id").primaryKey(),
    personSlug: text("person_slug")
      .notNull()
      .references(() => people.slug, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    language: text("language"),
    stars: integer("stars").notNull().default(0),
    forks: integer("forks").notNull().default(0),
    topics: text("topics").array().notNull().default([]),
    url: text("url").notNull(),
    isFork: boolean("is_fork").notNull().default(false),
    pushedAt: timestamp("pushed_at", { withTimezone: true }),
  },
  (t) => [index("github_repos_person_idx").on(t.personSlug)],
)

export const githubStats = pgTable("github_stats", {
  personSlug: text("person_slug")
    .primaryKey()
    .references(() => people.slug, { onDelete: "cascade" }),
  username: text("username").notNull(),
  publicRepos: integer("public_repos").notNull().default(0),
  followers: integer("followers").notNull().default(0),
  commits90d: integer("commits_90d").notNull().default(0),
  weeklyActivity: jsonb("weekly_activity").$type<number[]>().notNull().default([]),
  languages: jsonb("languages").$type<LanguageShare[]>().notNull().default([]),
  accountCreatedAt: timestamp("account_created_at", { withTimezone: true }),
  lastEventAt: timestamp("last_event_at", { withTimezone: true }),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
})

export const hackathons = pgTable("hackathons", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  theme: text("theme").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  isSample: boolean("is_sample").notNull().default(true),
})

/** Platform activity timeline: registrations, hackathons, submissions, teams, comments, mentorship. */
export const activities = pgTable(
  "activities",
  {
    id: serial("id").primaryKey(),
    personSlug: text("person_slug")
      .notNull()
      .references(() => people.slug, { onDelete: "cascade" }),
    type: text("type").$type<ActivityType>().notNull(),
    title: text("title").notNull(),
    detail: text("detail"),
    hackathonSlug: text("hackathon_slug").references(() => hackathons.slug, {
      onDelete: "set null",
    }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    isSample: boolean("is_sample").notNull().default(false),
  },
  (t) => [
    index("activities_person_idx").on(t.personSlug),
    index("activities_occurred_idx").on(t.occurredAt),
  ],
)
