import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { approversByAssociation } from "./evaluate-cli.mts";
import {
  DEFAULT_MAX_TURNS,
  MAX_TIMEOUT_MINUTES,
  MAX_TURNS_CAP,
  MIN_TIMEOUT_MINUTES,
  extractMission,
  findResult,
  limitsFromMission,
  planRun,
  runLimits,
  runReport,
  slugify,
  type RunPlan,
} from "./issue.mts";

const root = join(import.meta.dirname, "../..");
const example = readFileSync(join(root, ".groundcrew/examples/EX-001-about-page.md"), "utf8");
const decision = readFileSync(join(root, ".groundcrew/examples/EX-002-entry-segment.md"), "utf8");

describe("planRun: before any token is spent", () => {
  it("skips with a clear message when the repository has no Anthropic key (CA7)", () => {
    const plan = planRun({ body: example, hasKey: false });
    expect(plan.action).toBe("skip");
    expect(plan.action !== "run" && plan.comment).toMatch(/ANTHROPIC_API_KEY/);
  });

  it("rejects a mission that breaks the contract, listing the problems (CA1)", () => {
    const broken = example.replace(/^objective: .*$/m, "");
    const plan = planRun({ body: broken, hasKey: true });
    expect(plan.action).toBe("reject");
    expect(plan.action !== "run" && plan.comment).toMatch(/Nenhum token foi gasto[\s\S]*objective/);
  });

  it("rejects text that is not a mission file (CA1)", () => {
    expect(planRun({ body: "Please build a login page", hasKey: true }).action).toBe("reject");
    expect(planRun({ body: null, hasKey: true }).action).toBe("reject");
  });

  it("rejects decision missions and missions for other executors (CA1)", () => {
    expect(planRun({ body: decision, hasKey: true }).action).toBe("reject");
    const local = example.replace("executor: hosted-agent", "executor: local-agent");
    const plan = planRun({ body: local, hasKey: true });
    expect(plan.action !== "run" && plan.comment).toMatch(/hosted-agent/);
  });

  it("rejects a mission whose creator prerequisites are not done (CA1)", () => {
    const pending = example.replace(/done: true/, "done: false");
    const plan = planRun({ body: pending, hasKey: true });
    expect(plan.action !== "run" && plan.comment).toMatch(/Pré-requisito do criador/);
  });

  it("plans a valid mission: file, branch and limits", () => {
    const plan = planRun({ body: example, hasKey: true }) as RunPlan;
    expect(plan).toMatchObject({
      action: "run",
      missionId: "EX-001",
      fileName: "EX-001-add-an-about-page.md",
      missionPath: ".groundcrew/missions/EX-001-add-an-about-page.md",
      branch: "ex-001-add-an-about-page",
    });
    expect(plan.missionText).toBe(example.trim() + "\n");
  });

  it("accepts the mission pasted inside a code fence", () => {
    expect(planRun({ body: "```markdown\n" + example + "```\n", hasKey: true }).action).toBe("run");
  });
});

describe("runLimits (CA2)", () => {
  it("takes the turn limit and cost cap from the mission", () => {
    expect(runLimits({ max_turns: 30, max_cost_usd: 2 })).toEqual({ maxTurns: 30, maxCostUsd: 2, timeoutMinutes: 45 });
  });

  it("uses safe defaults and caps", () => {
    expect(runLimits({ max_cost_usd: 1 }).maxTurns).toBe(DEFAULT_MAX_TURNS);
    expect(runLimits({ max_turns: 500, max_cost_usd: 1 }).maxTurns).toBe(MAX_TURNS_CAP);
    expect(runLimits({ max_turns: 2, max_cost_usd: 1 }).timeoutMinutes).toBe(MIN_TIMEOUT_MINUTES);
    expect(runLimits({ max_turns: 100, max_cost_usd: 1 }).timeoutMinutes).toBe(MAX_TIMEOUT_MINUTES);
  });
});

describe("helpers", () => {
  it("slugifies titles, including Portuguese accents", () => {
    expect(slugify("Página Sobre: versão 2!")).toBe("pagina-sobre-versao-2");
  });

  it("strips fences and normalizes line endings", () => {
    expect(extractMission("```md\r\n---\r\na: 1\r\n---\r\n```")).toBe("---\na: 1\n---\n");
  });
});

describe("runReport (CA6)", () => {
  const log = [
    { type: "system" },
    { type: "result", subtype: "success", total_cost_usd: 0.8312, num_turns: 17, duration_ms: 252000 },
  ];

  it("reports cost, turns and duration against the limits", () => {
    const text = runReport({ missionId: "EX-001", log, maxTurns: 30, maxCostUsd: 2, prUrl: "https://x/pull/7" });
    expect(text).toContain("| Custo | US$ 0.83 | US$ 2.00 |");
    expect(text).toContain("| Turnos | 17 | 30 |");
    expect(text).toContain("| Duração | 4.2 min |");
    expect(text).toContain("concluída");
    expect(text).toContain("https://x/pull/7");
  });

  it("says when the agent stopped at a limit", () => {
    const stopped = [{ type: "result", subtype: "error_max_budget_usd", total_cost_usd: 2.01, num_turns: 12 }];
    expect(runReport({ missionId: "EX-001", log: stopped, maxTurns: 30, maxCostUsd: 2 })).toContain("parou no teto de custo");
  });

  it("is honest when there is no result to measure", () => {
    expect(findResult(undefined)).toBeUndefined();
    const text = runReport({ missionId: "EX-001", log: undefined, maxTurns: 30, maxCostUsd: 2 });
    expect(text).toMatch(/não puderam ser medidos/);
    expect(text).toContain("Nenhum pull request foi aberto.");
  });
});

describe("approversByAssociation", () => {
  it("trusts only the listed associations", () => {
    const comments = [
      { user: { login: "owner" }, author_association: "OWNER", body: "/conferido CA1" },
      { user: { login: "member" }, author_association: "MEMBER", body: "/conferido CA2" },
      { user: { login: "stranger" }, author_association: "NONE", body: "/conferido CA3" },
    ];
    expect(approversByAssociation(comments, ["OWNER", "MEMBER", ""]).sort()).toEqual(["member", "owner"]);
  });
});

describe("correction cycle", () => {
  it("reads the limits of the mission a pull request carries", () => {
    expect(limitsFromMission(example)).toEqual({ missionId: "EX-001", maxTurns: 30, maxCostUsd: 2, timeoutMinutes: 45 });
  });

  it("titles the report as a correction", () => {
    const log = [{ type: "result", subtype: "success", total_cost_usd: 0.1, num_turns: 3, duration_ms: 1000 }];
    expect(runReport({ missionId: "EX-001", log, maxTurns: 30, maxCostUsd: 2, kind: "correction" })).toMatch(/^## Correção da missão EX-001/);
  });
});
