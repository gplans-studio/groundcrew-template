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
| `npm test` | Unit tests (Vitest: `src/**/*.test.ts` and `scripts/**/*.test.ts`), including the mission contract checks |
| `npm run build` | Production build |
| `npm run test:e2e` | End-to-end tests (Playwright) against the production build; run `npm run build` first |
| `npm run db:start` / `db:stop` | Start or stop local Supabase (needs Docker); applies migrations on start |
| `npm run db:reset` | Recreate the local database from migrations |
| `npm run test:integration` | Database tests against local Supabase; export `npx supabase status -o env` first |
| `npm run missions:check` | Validate every mission in `.groundcrew/missions/` against the contract |
| `npm run missions:evaluate -- --mission <file> --checks <file> [--comments <file>] --approver <login>` | Apply the evidence rubric to a mission and its PR (see below) |
| `node scripts/missions/issue-cli.mts plan` | Check the mission in `ISSUE_BODY` and print the run plan (used by the Mission workflow) |
| `node scripts/missions/issue-cli.mts limits --mission <file>` | Print a mission's turn limit, cost cap and timeout (used by the Mission correction workflow) |

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
.groundcrew/
  missions/             Mission files written by Groundcrew (one file per mission)
  mission.schema.json   The mission contract (version 2)
  MISSION_TEMPLATE.md   Commented template for a new mission
  examples/             One execution and one decision mission
scripts/missions/       Mission validator and evidence rubric (tests run inside `npm test`)
```

## Missions

A mission is a Markdown file in `.groundcrew/missions/`, named after its id (for example `GC-012-foundation.md`). The YAML front matter is the contract, defined by `.groundcrew/mission.schema.json`; the body holds the instructions for the agent.

| Field | What it means for you |
| --- | --- |
| `objective` | The outcome the creator expects, in business language |
| `context`, `depends_on` | Decisions and missions you must respect; do not reopen them |
| `executor` | Who runs the mission: `hosted-agent`, `local-agent`, `creator` or `groundcrew` |
| `scope.authorized` / `scope.out_of_scope` | The only things you may change, and what you must not touch |
| `acceptance_criteria` | Each criterion and the evidence that proves it (`ci-job`, `test`, `creator-check`, `external-source`, `decision`) |
| `writes_to_memory` | Facts that become part of the product's memory once the mission is approved |
| `escalation` | When to stop and ask instead of guessing |
| `creator_prerequisites` | Human steps that must be done first; if one is `done: false`, stop and report it |
| `limits` | Token budget, turn limit and hard rules for the run |
| `status`, `evaluation` | Set by Groundcrew after review; do not edit them |

Execution missions must have `limits`, `creator_prerequisites` and an `## Instructions` section. Decision missions are answered by the creator and need neither. Start a new mission from `.groundcrew/MISSION_TEMPLATE.md` and run `npm run missions:check` before opening the pull request.

### How a mission is evaluated (rule D-04)

`npm run missions:evaluate` applies the evidence rubric to a mission and its pull request. Know it before you write a report: a criterion only counts as met when its evidence exists.

| Evidence kind | Met when | Otherwise |
| --- | --- | --- |
| `ci-job` | Every job named in `ref` passed | A failed job → correction needed; not run yet → waiting |
| `test` | The CI job that runs the file passed (`tests/e2e/` → `e2e`, `tests/integration/` → `db`, other `*.test.ts` → `unit`) | Same as `ci-job`; a file no job runs is never trusted |
| `creator-check` | The creator commented `/conferido CA<n>` (or `/checked CA<n>`) on the PR | Waiting for the creator |
| `external-source` | The creator recorded the source with `/conferido CA<n>` | Stays a hypothesis |
| `decision` | The creator recorded the decision with `/conferido CA<n>` | Waiting for a decision |

The mission's state follows its most serious open item: any failed job → correction needed; then any missing decision → needs decision; then any missing check → needs verification; otherwise approved. The rubric only comments on the pull request; it never edits the mission file.

The **Mission evaluation** workflow runs the rubric for you: whenever CI finishes on a pull request that carries a file in `.groundcrew/missions/`, and whenever someone comments `/conferido`, it updates a single evaluation comment on the pull request. Checks count only from commenters with write access to the repository.

### How a mission runs (hosted cycle)

The creator opens an issue whose body is the mission file and applies the `groundcrew` label. The **Mission** workflow then:

1. Checks the contract before spending any token. A broken contract, a decision mission, an executor other than `hosted-agent`, a creator prerequisite with `done: false` or a missing `ANTHROPIC_API_KEY` secret ends the run with a comment on the issue.
2. Creates the branch named after the mission file (for example `gc-012-foundation`) and saves the mission in `.groundcrew/missions/`.
3. Runs Claude (`anthropics/claude-code-action`) with the mission's `limits`: `max_turns` (default 40, at most 100) and `max_cost_usd` as a hard spending cap. The job timeout follows the turn limit (15 to 60 minutes).
4. The agent commits the mission file with its work, pushes the branch and opens the pull request with the report below.
5. The workflow records cost, turns and duration on the issue.

To ask for a correction, comment on the pull request mentioning `@claude` with what to fix. The **Mission correction** workflow runs Claude on the same branch, within the same mission `limits`, and records the correction's cost, turns and duration on the pull request. CI and the evaluation then run again on the new commits.

When a mission asks the creator to check screens, save them from the e2e tests with `page.screenshot({ path: "test-results/screens/<name>.png", fullPage: true })`. CI attaches that folder to the run as the `screens` artifact, which the creator can open without a deployed preview.

If you are the hosted agent: local Supabase (with its test mailbox) is already running and its settings are in the environment, so run `npm run test:integration`, `npm run build` and `npm run test:e2e` before handing over, like CI does. You cannot change files in `.github/workflows/`.

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
