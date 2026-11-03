/**
 * Evidence rubric (rule D-04): turns a mission's acceptance criteria, the CI
 * results of its pull request and the creator's recorded checks into an
 * evaluation, with one label per criterion and a state for the mission.
 */

export type EvidenceKind =
  | "ci-job"
  | "test"
  | "creator-check"
  | "decision"
  | "external-source";

export type Criterion = {
  id: string;
  criterion: string;
  evidence: { kind: EvidenceKind; ref?: string };
};

/** Conclusion of a CI job, as GitHub reports it. Missing means it has not run. */
export type JobConclusion =
  | "success"
  | "failure"
  | "cancelled"
  | "timed_out"
  | "skipped"
  | "neutral"
  | "action_required"
  | "pending";

export type Label = "declared" | "corroborated" | "hypothesis" | "unverified";

export type State =
  | "approved"
  | "correction-needed"
  | "needs-verification"
  | "needs-decision";

export type CriterionResult = {
  id: string;
  criterion: string;
  label: Label;
  outcome: "met" | "failed" | "waiting-check" | "waiting-decision";
  note: string;
};

export type Evaluation = {
  state: State;
  date: string;
  criteria: CriterionResult[];
};

/**
 * Which CI job runs a test file. Follows the template's layout:
 * tests/e2e → e2e, tests/integration → db, other *.test.ts → unit.
 */
export function jobForTest(path: string): string | undefined {
  if (path.startsWith("tests/e2e/")) return "e2e";
  if (path.startsWith("tests/integration/")) return "db";
  if (/\.test\.(ts|mts|tsx)$/.test(path)) return "unit";
  return undefined;
}

/** Splits a ref such as "lint typecheck" or "lint, typecheck" into job names. */
function jobNames(ref: string | undefined): string[] {
  return (ref ?? "").split(/[\s,]+/).filter(Boolean);
}

function fromJobs(
  base: Omit<CriterionResult, "label" | "outcome" | "note">,
  jobs: string[],
  checks: Record<string, JobConclusion>,
  source: string,
): CriterionResult {
  if (jobs.length === 0) {
    return { ...base, label: "unverified", outcome: "waiting-check", note: `${source}: nenhum job de CI indicado` };
  }
  const failed = jobs.filter((job) => {
    const result = checks[job];
    return result !== undefined && result !== "success" && result !== "pending" && result !== "skipped";
  });
  if (failed.length > 0) {
    return { ...base, label: "unverified", outcome: "failed", note: `${source}: o job ${failed.join(", ")} falhou` };
  }
  const notDone = jobs.filter((job) => checks[job] !== "success");
  if (notDone.length > 0) {
    return { ...base, label: "unverified", outcome: "waiting-check", note: `${source}: o job ${notDone.join(", ")} ainda não passou` };
  }
  return { ...base, label: "corroborated", outcome: "met", note: `${source}: o job ${jobs.join(", ")} passou` };
}

/** Applies the rubric to one criterion. */
export function evaluateCriterion(
  criterion: Criterion,
  checks: Record<string, JobConclusion>,
  creatorChecks: ReadonlySet<string>,
): CriterionResult {
  const base = { id: criterion.id, criterion: criterion.criterion };
  const { kind, ref } = criterion.evidence;
  const recorded = creatorChecks.has(criterion.id);

  switch (kind) {
    case "ci-job":
      return fromJobs(base, jobNames(ref), checks, "CI");
    case "test": {
      const job = ref ? jobForTest(ref) : undefined;
      if (!job) {
        return {
          ...base,
          label: "unverified",
          outcome: "waiting-check",
          note: `o teste ${ref ?? "(nenhum arquivo indicado)"} não roda em nenhum job de CI conhecido`,
        };
      }
      return fromJobs(base, [job], checks, `teste ${ref}`);
    }
    case "creator-check":
      return recorded
        ? { ...base, label: "declared", outcome: "met", note: "conferido pelo criador" }
        : { ...base, label: "unverified", outcome: "waiting-check", note: "aguardando a conferência do criador" };
    case "external-source":
      return recorded
        ? { ...base, label: "corroborated", outcome: "met", note: `fonte registrada pelo criador${ref ? `: ${ref}` : ""}` }
        : { ...base, label: "hypothesis", outcome: "waiting-check", note: `aguardando a fonte externa${ref ? `: ${ref}` : ""}` };
    case "decision":
      return recorded
        ? { ...base, label: "declared", outcome: "met", note: `decidido pelo criador${ref ? ` (${ref})` : ""}` }
        : { ...base, label: "unverified", outcome: "waiting-decision", note: "aguardando a decisão do criador" };
  }
}

/**
 * The mission state follows the most serious open item:
 * a failed check, then a missing decision, then a missing check.
 */
export function stateFor(results: CriterionResult[]): State {
  if (results.some((r) => r.outcome === "failed")) return "correction-needed";
  if (results.some((r) => r.outcome === "waiting-decision")) return "needs-decision";
  if (results.some((r) => r.outcome === "waiting-check")) return "needs-verification";
  return "approved";
}

export function evaluateMission(
  criteria: Criterion[],
  checks: Record<string, JobConclusion>,
  creatorChecks: ReadonlySet<string>,
  date: string,
): Evaluation {
  const results = criteria.map((c) => evaluateCriterion(c, checks, creatorChecks));
  return { state: stateFor(results), date, criteria: results };
}

export type Comment = { author: string; body: string };

const checkCommand = /^\/(?:conferido|checked)\s+((?:CA\d+[\s,]*)+)\s*$/gim;

/**
 * Reads creator checks from pull request comments. A line such as
 * "/conferido CA7 CA8" (or "/checked CA7, CA8") records those criteria.
 * Only comments written by an approver count.
 */
export function parseCreatorChecks(
  comments: Comment[],
  approvers: string[],
): Set<string> {
  const allowed = new Set(approvers.map((a) => a.toLowerCase()));
  const ids = new Set<string>();
  for (const comment of comments) {
    if (!allowed.has(comment.author.toLowerCase())) continue;
    for (const match of comment.body.matchAll(checkCommand)) {
      for (const id of match[1].match(/CA\d+/gi) ?? []) ids.add(id.toUpperCase());
    }
  }
  return ids;
}

const stateText: Record<State, string> = {
  approved: "Aprovada",
  "correction-needed": "Correção necessária",
  "needs-verification": "Verificação adicional",
  "needs-decision": "Decisão humana",
};

const labelText: Record<Label, string> = {
  declared: "Declarado",
  corroborated: "Corroborado",
  hypothesis: "Hipótese",
  unverified: "Não verificado",
};

/** Markdown ready to post as a pull request comment. */
export function toMarkdown(missionId: string, evaluation: Evaluation): string {
  const rows = evaluation.criteria
    .map((r) => `| ${r.id} | ${r.criterion.replace(/\|/g, "\\|")} | ${labelText[r.label]} | ${r.note.replace(/\|/g, "\\|")} |`)
    .join("\n");
  const pending = evaluation.criteria.filter((r) => r.outcome !== "met").map((r) => r.id);
  const next =
    evaluation.state === "approved"
      ? "Todos os critérios têm evidência. A missão pode ser aprovada."
      : evaluation.state === "correction-needed"
        ? `Corrigir antes de seguir: ${pending.join(", ")}.`
        : `Pendente: ${pending.join(", ")}. Para registrar uma verificação sua, comente \`/conferido ${pending.join(" ")}\`.`;
  return [
    `## Avaliação da missão ${missionId} (rúbrica D-04)`,
    "",
    `**Classificação: ${stateText[evaluation.state].toLowerCase()}** · ${evaluation.date}`,
    "",
    "| # | Critério | Rótulo | Evidência |",
    "| --- | --- | --- | --- |",
    rows,
    "",
    next,
    "",
  ].join("\n");
}
