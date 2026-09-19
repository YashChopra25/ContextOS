import "server-only"

import { z } from "zod"

const optionalKey = z
  .string()
  .trim()
  .transform((value) => value || undefined)
  .optional()

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .url()
    .default("postgres://contextos:contextos@localhost:5433/contextos"),
  TAVILY_API_KEY: optionalKey,
  /** Optional: without it the app reads straight from Postgres and Tavily. */
  REDIS_URL: optionalKey,
  GITHUB_TOKEN: optionalKey,
})

/** Server-only configuration. Never import this from a Client Component. */
export const serverEnv = envSchema.parse(process.env)

export const integrations = {
  tavily: Boolean(serverEnv.TAVILY_API_KEY),
  redis: Boolean(serverEnv.REDIS_URL),
  github: Boolean(serverEnv.GITHUB_TOKEN),
}
