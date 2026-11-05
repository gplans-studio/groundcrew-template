/**
 * Command line used by .github/workflows/mission.yml.
 *
 *   node scripts/missions/issue-cli.mts plan [--write] [--comment-file <file>]
 *     Reads ISSUE_BODY and HAS_KEY from the environment, prints the plan and,
 *     inside GitHub Actions, writes it to GITHUB_OUTPUT. With --write, saves the
 *     mission file under .groundcrew/missions/. With --comment-file, saves the
 *     comment for a skipped or rejected mission.
 *
 *   node scripts/missions/issue-cli.mts limits --mission <file>
 *     Prints the turn limit, cost cap and timeout of a mission file and, inside
 *     GitHub Actions, writes them to GITHUB_OUTPUT (used by the correction cycle).
 *
 *   node scripts/missions/issue-cli.mts report --mission-id <id> --max-turns <n>
 *     --max-cost <usd> [--execution-file <file>] [--pr-url <url>] [--run-url <url>]
 *     [--kind correction] Prints the cost report (on the issue, or on the PR for a correction).
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { limitsFromMission, planRun, runReport } from "./issue.mts";

function plan(args: string[]) {
  const { values } = parseArgs({
    args,
    options: { write: { type: "boolean", default: false }, "comment-file": { type: "string" } },
  });
  const result = planRun({ body: process.env.ISSUE_BODY, hasKey: process.env.HAS_KEY === "true" });

  const outputs: Record<string, string | number> = { action: result.action };
  if (result.action === "run") {
    Object.assign(outputs, {
      mission_id: result.missionId,
      title: result.title,
      mission_path: result.missionPath,
      branch: result.branch,
      max_turns: result.maxTurns,
      max_cost_usd: result.maxCostUsd,
      timeout_minutes: result.timeoutMinutes,
    });
    if (values.write) {
      mkdirSync(dirname(result.missionPath), { recursive: true });
      writeFileSync(result.missionPath, result.missionText);
    }
  } else if (values["comment-file"]) {
    writeFileSync(values["comment-file"], result.comment);
  }

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      Object.entries(outputs).map(([k, v]) => `${k}=${String(v).replace(/\n/g, " ")}\n`).join(""),
    );
  }
  console.log(JSON.stringify(outputs, null, 2));
}

function limits(args: string[]) {
  const { values } = parseArgs({ args, options: { mission: { type: "string" } } });
  if (!values.mission) throw new Error("limits needs --mission <file>");
  const result = limitsFromMission(readFileSync(values.mission, "utf8"));
  const outputs = {
    mission_id: result.missionId,
    max_turns: result.maxTurns,
    max_cost_usd: result.maxCostUsd,
    timeout_minutes: result.timeoutMinutes,
  };
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(outputs).map(([k, v]) => `${k}=${v}\n`).join(""));
  }
  console.log(JSON.stringify(outputs, null, 2));
}

function report(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      "mission-id": { type: "string" },
      "max-turns": { type: "string" },
      "max-cost": { type: "string" },
      "execution-file": { type: "string" },
      "pr-url": { type: "string" },
      "run-url": { type: "string" },
      kind: { type: "string" },
    },
  });
  const file = values["execution-file"];
  let log: unknown = undefined;
  if (file && existsSync(file)) {
    try {
      log = JSON.parse(readFileSync(file, "utf8"));
    } catch {
      log = undefined;
    }
  }
  console.log(
    runReport({
      missionId: values["mission-id"] ?? "?",
      log,
      maxTurns: Number(values["max-turns"]),
      maxCostUsd: Number(values["max-cost"]),
      prUrl: values["pr-url"] || undefined,
      runUrl: values["run-url"] || undefined,
      kind: values.kind === "correction" ? "correction" : "execution",
    }),
  );
}

const [command, ...rest] = process.argv.slice(2);
if (command === "plan") plan(rest);
else if (command === "limits") limits(rest);
else if (command === "report") report(rest);
else {
  console.error("Usage: issue-cli.mts plan|limits|report [options]");
  process.exit(2);
}
