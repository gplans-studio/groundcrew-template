import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readChecks, readComments } from "./evaluate-cli.mts";
import {
  evaluateCriterion,
  evaluateMission,
  jobForTest,
  parseCreatorChecks,
  toMarkdown,
  type Criterion,
  type JobConclusion,
} from "./evaluate.mts";
import { parseMission } from "./validate.mts";

const none = new Set<string>();
const criterion = (id: string, kind: Criterion["evidence"]["kind"], ref?: string): Criterion => ({
  id,
  criterion: `criterion ${id}`,
  evidence: { kind, ref },
});

describe("jobForTest", () => {
  it("maps test files to the CI job that runs them", () => {
    expect(jobForTest("tests/e2e/smoke.spec.ts")).toBe("e2e");
    expect(jobForTest("tests/integration/notes-rls.test.ts")).toBe("db");
    expect(jobForTest("src/lib/health.test.ts")).toBe("unit");
    expect(jobForTest("scripts/missions/validate.test.ts")).toBe("unit");
    expect(jobForTest("docs/readme.md")).toBeUndefined();
  });
});

describe("evaluateCriterion", () => {
  it("corroborates a ci-job criterion when every named job passed", () => {
    const result = evaluateCriterion(criterion("CA1", "ci-job", "lint typecheck"), { lint: "success", typecheck: "success" }, none);
    expect(result).toMatchObject({ label: "corroborated", outcome: "met" });
  });

  it("flags a failed job as a correction", () => {
    const result = evaluateCriterion(criterion("CA1", "ci-job", "lint, typecheck"), { lint: "success", typecheck: "failure" }, none);
    expect(result).toMatchObject({ label: "unverified", outcome: "failed" });
    expect(result.note).toMatch(/typecheck/);
  });

  it("waits while a job is pending, skipped or missing", () => {
    const cases: Record<string, JobConclusion>[] = [{ build: "pending" }, { build: "skipped" }, {}];
    for (const checks of cases) {
      expect(evaluateCriterion(criterion("CA2", "ci-job", "build"), checks, none).outcome).toBe("waiting-check");
    }
  });

  it("corroborates a test through the job that runs its file", () => {
    expect(evaluateCriterion(criterion("CA4", "test", "tests/e2e/smoke.spec.ts"), { e2e: "success" }, none).label).toBe("corroborated");
    expect(evaluateCriterion(criterion("CA5", "test", "tests/integration/notes-rls.test.ts"), { db: "failure" }, none).outcome).toBe("failed");
  });

  it("does not trust a test that no known job runs", () => {
    const result = evaluateCriterion(criterion("CA3", "test", "manual/check.md"), { unit: "success" }, none);
    expect(result).toMatchObject({ label: "unverified", outcome: "waiting-check" });
  });

  it("needs the creator for creator-check, decision and external-source", () => {
    expect(evaluateCriterion(criterion("CA7", "creator-check"), {}, none).outcome).toBe("waiting-check");
    expect(evaluateCriterion(criterion("CA7", "creator-check"), {}, new Set(["CA7"]))).toMatchObject({ label: "declared", outcome: "met" });
    expect(evaluateCriterion(criterion("CA1", "decision", "D-03"), {}, none).outcome).toBe("waiting-decision");
    expect(evaluateCriterion(criterion("CA1", "decision", "D-03"), {}, new Set(["CA1"])).label).toBe("declared");
    expect(evaluateCriterion(criterion("CA2", "external-source"), {}, none).label).toBe("hypothesis");
    expect(evaluateCriterion(criterion("CA2", "external-source"), {}, new Set(["CA2"])).label).toBe("corroborated");
  });
});

describe("evaluateMission state", () => {
  const criteria = [criterion("CA1", "ci-job", "lint"), criterion("CA2", "creator-check"), criterion("CA3", "decision")];

  it("is a correction when any check failed, whatever else is open", () => {
    expect(evaluateMission(criteria, { lint: "failure" }, none, "2026-11-03").state).toBe("correction-needed");
  });

  it("asks for a decision before asking for checks", () => {
    expect(evaluateMission(criteria, { lint: "success" }, none, "2026-11-03").state).toBe("needs-decision");
  });

  it("asks for verification when only checks are open", () => {
    expect(evaluateMission(criteria, { lint: "success" }, new Set(["CA3"]), "2026-11-03").state).toBe("needs-verification");
  });

  it("approves when every criterion has its evidence", () => {
    expect(evaluateMission(criteria, { lint: "success" }, new Set(["CA2", "CA3"]), "2026-11-03").state).toBe("approved");
  });
});

describe("parseCreatorChecks", () => {
  it("reads /conferido and /checked lines from approvers only", () => {
    const ids = parseCreatorChecks(
      [
        { author: "fernando-m-vale", body: "Revisei.\n/conferido CA7 CA8" },
        { author: "Fernando-M-Vale", body: "/checked CA9" },
        { author: "someone-else", body: "/conferido CA1" },
        { author: "fernando-m-vale", body: "texto com /conferido CA2 no meio da linha" },
      ],
      ["fernando-m-vale"],
    );
    expect([...ids].sort()).toEqual(["CA7", "CA8", "CA9"]);
  });
});

describe("GitHub API inputs", () => {
  it("reads the check-runs response, treating unfinished runs as pending", () => {
    expect(
      readChecks({
        check_runs: [
          { name: "lint", status: "completed", conclusion: "success" },
          { name: "e2e", status: "in_progress", conclusion: null },
        ],
      }),
    ).toEqual({ lint: "success", e2e: "pending" });
  });

  it("reads issue comments", () => {
    expect(readComments([{ user: { login: "a" }, body: "/conferido CA1" }])).toEqual([{ author: "a", body: "/conferido CA1" }]);
  });
});

describe("the execution example end to end", () => {
  const root = join(import.meta.dirname, "../..");
  const { data } = parseMission(readFileSync(join(root, ".groundcrew/examples/EX-001-about-page.md"), "utf8"));
  const criteria = data.acceptance_criteria as Criterion[];

  it("waits for the creator's check, then approves", () => {
    const before = evaluateMission(criteria, { e2e: "success" }, none, "2026-11-03");
    expect(before.state).toBe("needs-verification");
    expect(toMarkdown("EX-001", before)).toContain("/conferido CA3");

    const after = evaluateMission(criteria, { e2e: "success" }, new Set(["CA3"]), "2026-11-03");
    expect(after.state).toBe("approved");
    expect(toMarkdown("EX-001", after)).toContain("**Classificação: aprovada**");
  });
});
