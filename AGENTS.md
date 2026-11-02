<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Working in this repository

This project was created from the Groundcrew template: Next.js (App Router, TypeScript) + Supabase + Vercel. Work arrives as **missions**. Each mission states its goal, scope, acceptance criteria and when to stop and ask. Follow the mission; this file sets the rules that apply to every mission.

## Commands

| Command | What it does |
| --- | --- |
| `npm ci` | Install dependencies exactly as locked |
| `npm run dev` | Start the dev server on http://localhost:3000 |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generate route types and run `tsc --noEmit` |
| `npm test` | Unit tests (Vitest, `src/**/*.test.ts`) |
| `npm run build` | Production build |
| `npm run test:e2e` | End-to-end tests (Playwright) against the production build; run `npm run build` first |
| `npm run db:start` / `db:stop` | Start or stop local Supabase (needs Docker); applies migrations on start |
| `npm run db:reset` | Recreate the local database from migrations |
| `npm run test:integration` | Database tests against local Supabase; export `npx supabase status -o env` first |

CI runs `lint`, `typecheck`, `unit`, `build`, `e2e`, `db` and `secrets` on every pull request. All must pass before merge.

## Structure

```
src/
  app/                  Routes (App Router). app/api/* are Route Handlers.
  lib/                  Shared code. Unit tests sit next to the file (*.test.ts).
    supabase/           Supabase clients: client.ts (browser), server.ts (server), proxy.ts (session refresh), env.ts
  proxy.ts              Next.js Proxy (formerly Middleware): refreshes the Supabase session
supabase/
  config.toml           Local Supabase settings
  migrations/           SQL migrations, applied in filename order
tests/
  e2e/                  Playwright specs
  integration/          Tests against a real local Supabase
.groundcrew/missions/   Mission files written by Groundcrew
```

## Rules

1. **Never push to `main`.** Work on a branch named after the mission (for example `gc-012-foundation`) and open a pull request.
2. **Every change ships with tests.** Each acceptance criterion is covered by a test, or the report says why it cannot be and how it was checked instead.
3. **Never edit a migration that has been merged.** Add a new migration instead (`npx supabase migration new <name>`).
4. **Row level security is always on.** Every new table enables RLS and gets explicit policies, plus an integration test that proves them.
5. **Never commit secrets.** Real values go in `.env.local` (ignored) or in the hosting provider. `.env.example` lists names only.
6. **Stop and ask before touching anything outside the repository:** creating accounts, keys or tokens, or changing GitHub, Vercel or Supabase settings.
7. **Stay in scope.** Do not add features, dependencies or refactors the mission did not ask for. Note them under open items instead.
8. **Never claim a check passed unless you ran it and saw it pass.** Never invent test output. If you could not run something, say so.

## Report format

Post the report as the pull request description:

1. Summary of what changed.
2. Versions or dependencies added or changed.
3. Commands you ran locally and their results.
4. Table: acceptance criterion → test or check that covers it → status.
5. What you could not verify, and why.
6. Decisions you made that the mission did not specify.
7. Open items.
