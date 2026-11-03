/**
 * Hosted execution cycle (GC-009): turns an issue labeled `groundcrew` into a
 * run plan for the agent, and the agent's execution log into a cost report.
 * Everything here runs before or after the agent, so it never spends tokens.
 */
import { parseMission, validateMission } from "./validate.mts";

export const DEFAULT_MAX_TURNS = 40;
export const MAX_TURNS_CAP = 100;
export const MIN_TIMEOUT_MINUTES = 15;
export const MAX_TIMEOUT_MINUTES = 60;

export type RunPlan = {
  action: "run";
  missionId: string;
  title: string;
  fileName: string;
  missionPath: string;
  branch: string;
  missionText: string;
  maxTurns: number;
  maxCostUsd: number;
  timeoutMinutes: number;
};

export type Plan = RunPlan | { action: "skip" | "reject"; comment: string };

/** Lowercase, ASCII, dash-separated: "Add an about page" → "add-an-about-page". */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "");
}

/**
 * The issue body is the mission file. A code fence around it (```markdown … ```)
 * is accepted, because that is how people paste files into GitHub.
 */
export function extractMission(body: string | null | undefined): string {
  const text = (body ?? "").replace(/\r\n/g, "\n").trim();
  const fenced = /^```[\w-]*\n([\s\S]*?)\n```$/.exec(text);
  return `${(fenced ? fenced[1] : text).trim()}\n`;
}

/** Turn limit, cost cap and timeout for the agent, from the mission's limits. */
export function runLimits(limits: { max_turns?: number; max_cost_usd: number }) {
  const maxTurns = Math.min(limits.max_turns ?? DEFAULT_MAX_TURNS, MAX_TURNS_CAP);
  const timeoutMinutes = Math.min(
    Math.max(Math.ceil(maxTurns * 1.5), MIN_TIMEOUT_MINUTES),
    MAX_TIMEOUT_MINUTES,
  );
  return { maxTurns, maxCostUsd: limits.max_cost_usd, timeoutMinutes };
}

/** Limits for a correction run, read from the mission file a pull request carries. */
export function limitsFromMission(text: string) {
  const { data } = parseMission(text);
  const limits = (data.limits ?? {}) as { max_turns?: number; max_cost_usd?: number };
  return {
    missionId: String(data.id ?? "?"),
    ...runLimits({ max_turns: limits.max_turns, max_cost_usd: limits.max_cost_usd ?? 2 }),
  };
}

const reject = (problems: string[]): Plan => ({
  action: "reject",
  comment: [
    "## Missão recusada antes da execução",
    "",
    "Nenhum token foi gasto. Corrija a missão no corpo desta issue e aplique a etiqueta `groundcrew` de novo.",
    "",
    ...problems.map((p) => `- ${p}`),
    "",
  ].join("\n"),
});

/** Decides whether an issue's mission can run, and with which limits. */
export function planRun(input: { body: string | null | undefined; hasKey: boolean }): Plan {
  if (!input.hasKey) {
    return {
      action: "skip",
      comment: [
        "## Execução pulada: falta a chave da Anthropic",
        "",
        "Este repositório não tem acesso ao secret `ANTHROPIC_API_KEY`, então o agente não foi iniciado e nada foi cobrado.",
        "Cadastre a chave como secret do repositório ou libere o secret da organização para ele, e aplique a etiqueta `groundcrew` de novo.",
        "",
      ].join("\n"),
    };
  }

  const missionText = extractMission(input.body);
  let data: Record<string, unknown>;
  try {
    data = parseMission(missionText).data;
  } catch (error) {
    return reject([(error as Error).message]);
  }

  const id = String(data.id ?? "");
  const title = String(data.title ?? "");
  const fileName = `${id}-${slugify(title)}.md`;
  const problems = validateMission(missionText, fileName);
  if (problems.length > 0) return reject(problems);

  if (data.type !== "execution") {
    return reject(["Só missões de execução rodam no ciclo hospedado; missões de decisão são respondidas pelo criador."]);
  }
  if (data.executor !== "hosted-agent") {
    return reject([`O executor desta missão é \`${String(data.executor)}\`; o ciclo hospedado só roda missões com \`executor: hosted-agent\`.`]);
  }
  const pending = (data.creator_prerequisites as { task: string; done: boolean }[])
    .filter((p) => !p.done)
    .map((p) => `Pré-requisito do criador ainda não feito: ${p.task}`);
  if (pending.length > 0) return reject(pending);

  const limits = runLimits(data.limits as { max_turns?: number; max_cost_usd: number });
  return {
    action: "run",
    missionId: id,
    title,
    fileName,
    missionPath: `.groundcrew/missions/${fileName}`,
    branch: fileName.replace(/\.md$/, "").toLowerCase(),
    missionText,
    ...limits,
  };
}

type ResultEvent = {
  type: "result";
  subtype?: string;
  total_cost_usd?: number;
  num_turns?: number;
  duration_ms?: number;
  is_error?: boolean;
};

/** The final result event of a Claude Code execution log, if the run got that far. */
export function findResult(log: unknown): ResultEvent | undefined {
  if (!Array.isArray(log)) return undefined;
  for (let i = log.length - 1; i >= 0; i--) {
    const entry = log[i] as { type?: string } | null;
    if (entry?.type === "result") return entry as ResultEvent;
  }
  return undefined;
}

const outcomeText: Record<string, string> = {
  success: "concluída",
  error_max_turns: "parou no limite de turnos",
  error_max_budget_usd: "parou no teto de custo",
  error_during_execution: "falhou durante a execução",
};

/** Markdown for the issue: what the run cost and how it ended. */
export function runReport(input: {
  missionId: string;
  log: unknown;
  maxTurns: number;
  maxCostUsd: number;
  prUrl?: string;
  runUrl?: string;
  kind?: "execution" | "correction";
}): string {
  const result = findResult(input.log);
  const heading = input.kind === "correction" ? "Correção da missão" : "Execução da missão";
  const lines = [`## ${heading} ${input.missionId}`, ""];
  if (!result) {
    lines.push("A execução terminou sem resultado final do agente, então custo e turnos não puderam ser medidos. Veja o log da execução.");
  } else {
    const cost = result.total_cost_usd ?? 0;
    const minutes = ((result.duration_ms ?? 0) / 60000).toFixed(1);
    lines.push(
      "| Medida | Valor | Limite |",
      "| --- | --- | --- |",
      `| Custo | US$ ${cost.toFixed(2)} | US$ ${input.maxCostUsd.toFixed(2)} |`,
      `| Turnos | ${result.num_turns ?? "?"} | ${input.maxTurns} |`,
      `| Duração | ${minutes} min | |`,
      "",
      `Resultado: ${outcomeText[result.subtype ?? ""] ?? result.subtype ?? "desconhecido"}.`,
    );
  }
  lines.push(
    "",
    input.prUrl ? `Pull request: ${input.prUrl}` : "Nenhum pull request foi aberto.",
  );
  if (input.runUrl) lines.push(`Log da execução: ${input.runUrl}`);
  lines.push("");
  return lines.join("\n");
}
