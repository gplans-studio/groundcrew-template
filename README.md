# Groundcrew Template

Starting point for every project built with [Groundcrew](https://gplansstudio.com/groundcrew): Next.js (App Router, TypeScript) + Supabase + Vercel, with tests and CI that prove it works from day one.

## Set up in 5 steps

You need Node.js 24 (see `.nvmrc`) and Docker (for local Supabase).

1. **Create your repository** from this template ("Use this template" on GitHub) and clone it.
2. **Install dependencies:** `npm ci`
3. **Start local Supabase:** `npm run db:start`. It applies the migrations in `supabase/migrations/` and prints the local URL and keys.
4. **Configure the app:** `cp .env.example .env.local`, then fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` with the values from step 3.
5. **Run it:** `npm run dev` and open http://localhost:3000. `GET /api/health` should return `{"status":"ok"}`.

To deploy, import the repository in Vercel and set the same two variables with the values from your Supabase project.

## What is included

| Area | What you get |
| --- | --- |
| App | Next.js App Router, TypeScript strict, Tailwind CSS, ESLint |
| Supabase | Browser and server clients, session refresh in `src/proxy.ts`, migrations folder |
| Security defaults | Example `notes` table with row level security and per-user policies; secret scanning in CI |
| Tests | Vitest (unit), Playwright (end-to-end), integration tests against a real local Supabase |
| CI | GitHub Actions jobs: `lint`, `typecheck`, `unit`, `build`, `e2e`, `db`, `secrets` |
| Missions | Contract, validator and evidence rubric in `.groundcrew/` and `scripts/missions/`; hosted execution from a labeled issue |
| Agents | `AGENTS.md` with the rules and report format every coding agent follows |

## Running missions with Claude

Open an issue whose body is a mission file (see `.groundcrew/MISSION_TEMPLATE.md`) and apply the `groundcrew` label. Claude implements it on a branch, opens a pull request, and the evidence rubric comments its evaluation when CI finishes. This needs the [Claude GitHub App](https://github.com/apps/claude) on the repository and an `ANTHROPIC_API_KEY` secret; without the secret the run is skipped and nothing is charged. Details in [`AGENTS.md`](AGENTS.md#how-a-mission-runs-hosted-cycle).

## Commands

See [`AGENTS.md`](AGENTS.md#commands) for the full list.

## Removing the example

The `notes` table exists to show the security pattern and to keep the database tests honest. When you add your first real table, add a new migration that drops `notes` and replace `tests/integration/notes-rls.test.ts` with tests for your own tables.
