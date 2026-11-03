/**
 * Evaluates a mission against the evidence on its pull request.
 *
 * Usage:
 *   npm run missions:evaluate -- --mission .groundcrew/missions/GC-012-foundation.md \
 *     --checks checks.json [--comments comments.json] [--approver <github-login> ...] \
 *     [--date 2026-11-03] [--json]
 *
 * checks.json: the GitHub check-runs response for the PR head commit
 *   (gh api repos/{owner}/{repo}/commits/{sha}/check-runs), or a plain
 *   object such as {"lint": "success"}.
 * comments.json: the GitHub issue comments of the PR
 *   (gh api repos/{owner}/{repo}/issues/{n}/comments), or [{"author", "body"}].
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
  evaluateMission,
  parseCreatorChecks,
  toMarkdown,
  type Comment,
  type Criterion,
  type JobConclusion,
} from "./evaluate.mts";
import { parseMission, validateMission } from "./validate.mts";

type CheckRuns = { check_runs: { name: string; status: string; conclusion: string | null }[] };
type ApiComment = { user?: { login?: string }; author?: string; body?: string };

export function readChecks(raw: unknown): Record<string, JobConclusion> {
  if (raw && typeof raw === "object" && "check_runs" in raw) {
    const result: Record<string, JobConclusion> = {};
    for (const run of (raw as CheckRuns).check_runs) {
      result[run.name] = (run.status === "completed" ? run.conclusion ?? "neutral" : "pending") as JobConclusion;
    }
    return result;
  }
  return raw as Record<string, JobConclusion>;
}

export function readComments(raw: unknown): Comment[] {
  return (raw as ApiComment[]).map((c) => ({
    author: c.author ?? c.user?.login ?? "",
    body: c.body ?? "",
  }));
}

function main() {
  const { values } = parseArgs({
    options: {
      mission: { type: "string" },
      checks: { type: "string" },
      comments: { type: "string" },
      approver: { type: "string", multiple: true },
      date: { type: "string" },
      json: { type: "boolean", default: false },
    },
  });
  if (!values.mission || !values.checks) {
    console.error("Usage: --mission <file> --checks <file> [--comments <file>] [--approver <login>] [--date YYYY-MM-DD] [--json]");
    process.exit(2);
  }

  const text = readFileSync(values.mission, "utf8");
  const problems = validateMission(text);
  if (problems.length > 0) {
    console.error(`Mission does not follow the contract:\n- ${problems.join("\n- ")}`);
    process.exit(2);
  }
  const { data } = parseMission(text);
  const checks = readChecks(JSON.parse(readFileSync(values.checks, "utf8")));
  const comments = values.comments ? readComments(JSON.parse(readFileSync(values.comments, "utf8"))) : [];
  const creatorChecks = parseCreatorChecks(comments, values.approver ?? []);
  const date = values.date ?? new Date().toISOString().slice(0, 10);

  const evaluation = evaluateMission(data.acceptance_criteria as Criterion[], checks, creatorChecks, date);
  console.log(values.json ? JSON.stringify(evaluation, null, 2) : toMarkdown(String(data.id), evaluation));
}

// Run only when executed directly, so tests can import the helpers.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
