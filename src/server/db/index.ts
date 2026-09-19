import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { serverEnv } from "@/server/env"
import * as schema from "./schema"

export type Database = NodePgDatabase<typeof schema>

// Reuse one pool across hot reloads in development.
const globalForDb = globalThis as unknown as { contextosPool?: Pool }

const pool =
  globalForDb.contextosPool ??
  new Pool({ connectionString: serverEnv.DATABASE_URL, max: 10 })

if (process.env.NODE_ENV !== "production") globalForDb.contextosPool = pool

export const db: Database = drizzle(pool, { schema })
export { pool, schema }
