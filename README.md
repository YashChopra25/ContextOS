# ContextOS

A universal context layer for developer and hackathon communities.

**Platform data + GitHub/Web data → Context Engine → User context → AI agent, search, matching**

ContextOS turns registration data, platform activity and public developer data into structured,
evidence-backed context profiles, then lets you query them through a Context Agent, a people directory
and a matcher.

## Quick start

Requires Node 20+ and Docker.

```bash
npm install
cp .env.example .env.local        # add keys (all optional, see below)
npm run db:setup                  # Postgres (:5433) + Redis (:6380) in Docker, migrations, seed from data/dataset_devmatch.csv
npm run context:sync -- --limit 25  # pull GitHub data and build full context profiles
npm run dev
```

Put the registration export at `data/dataset_devmatch.csv` (it's git-ignored because it holds real names and profile links).

## Environment

| Variable | Needed for | Without it |
| --- | --- | --- |
| `DATABASE_URL` | Everything | Defaults to the docker-compose database on port 5433 |
| `REDIS_URL` | Caching Postgres reads and Tavily results (`redis://localhost:6380` from docker-compose) | Reads go straight to Postgres and Tavily |
| `TAVILY_API_KEY` | The agent's web research and answers, namesake-filtered person lookups, portfolio extraction and profile summaries | The agent answers from ContextOS data only |
| `GITHUB_TOKEN` | Syncing many profiles | GitHub allows 60 requests/hour (about 20 people) |

All keys are read only on the server (`src/server/env.ts`, guarded by `server-only`). None use `NEXT_PUBLIC_`.

## How it works

| Stage | Where |
| --- | --- |
| Identity resolution: cleaning names, titles, GitHub/LinkedIn links | `src/server/context-engine/normalize.ts` |
| Collecting: GitHub users, repositories, public events | `src/server/context-engine/github.ts` |
| Extracting: skills with confidence and evidence, projects, signals | `src/server/context-engine/extract.ts`, `src/lib/skills.ts` |
| Web research: Tavily search + answer, portfolio extraction | `src/server/integrations/tavily.ts`, `pipeline.ts` |
| Building: summary (Tavily answer or facts template) and persistence | `src/server/context-engine/summarize.ts`, `pipeline.ts` |
| Agent: ContextOS lookup, then Tavily research, then synthesis | `src/server/agent/planner.ts`, `agent.ts` |
| Matching | `src/server/matching.ts` |

Pipelines stream their stages to the UI as NDJSON (`/api/agent`, `/api/track`, `/api/people/[slug]/sync`).

## Caching (Redis)

`src/server/cache/` wraps reads in a read-through cache:

- **Context Layer reads** (directory, profiles, stats, activity, community search, name lookups): cache keys carry a
  data version. Every write in `context-store.ts` (and the seed) increments it, so a sync or Add & Track invalidates
  everything at once; nothing stale is served. Old versions age out under Redis's LRU policy (256 MB cap).
- **Tavily**: searches are cached for 24 hours and page extractions for 7 days, so repeated questions cost no credits.
  Explicit re-syncs bypass the cache.
- Redis is optional: if it's unset or down, the app reads straight from Postgres and Tavily. The sidebar shows the hit rate.

Typical effect: a repeated agent question drops from ~6 s to ~20 ms; the 650-person directory from ~140 ms to ~7 ms.

## Data notes

- Real data from the CSV: names, job titles, organizations, LinkedIn and GitHub links.
- The export has no platform activity, so the seed generates **sample** hackathons, teams, submissions,
  comments and mentorship, stored with `is_sample = true` and marked "Sample" everywhere in the UI.
  Run `npm run db:seed -- --no-sample` to skip them.
- Web results that don't mention the person's GitHub handle, projects, skills or developer vocabulary are
  treated as namesakes and left out.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run db:up` / `db:down` | Start or stop Postgres |
| `npm run db:migrate` | Apply Drizzle migrations in `drizzle/` |
| `npm run db:generate` | Generate a migration after editing `src/server/db/schema.ts` |
| `npm run db:seed` | Reset and seed from the CSV |
| `npm run context:sync -- --limit N` / `--slug <slug>` / `--all` | Build context profiles from GitHub (add `--web` to also research with Tavily) |
| `npm run typecheck`, `npm run lint` | Checks |
