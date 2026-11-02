import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { missionSchema, parseMission, validateMission } from "./validate.mts";

const root = join(import.meta.dirname, "../..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const executionExample = read(".groundcrew/examples/EX-001-about-page.md");
const decisionExample = read(".groundcrew/examples/EX-002-entry-segment.md");

/** Rebuilds a mission file with some front matter fields changed or removed. */
function withChanges(text: string, changes: Record<string, unknown>): string {
  const { data, body } = parseMission(text);
  const next: Record<string, unknown> = { ...data };
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) delete next[key];
    else next[key] = value;
  }
  return `---\n${JSON.stringify(next, null, 2)}\n---\n${body}`;
}

describe("mission contract v2 schema", () => {
  it("has the v1.0 fields and the five fields added by the pilot", () => {
    const fields = Object.keys(missionSchema.properties);
    expect(fields).toEqual(
      expect.arrayContaining([
        // v1.0
        "id",
        "objective",
        "context",
        "scope",
        "acceptance_criteria",
        "escalation",
        // added by the pilot
        "depends_on",
        "writes_to_memory",
        "executor",
        "creator_prerequisites",
        "limits",
      ]),
    );
  });

  it("asks every acceptance criterion for its evidence", () => {
    expect(missionSchema.$defs.criterion.required).toContain("evidence");
  });
});

describe("validateMission", () => {
  it("accepts the execution and decision examples", () => {
    expect(validateMission(executionExample, "EX-001-about-page.md")).toEqual([]);
    expect(validateMission(decisionExample, "EX-002-entry-segment.md")).toEqual([]);
  });

  it("rejects an execution mission without limits", () => {
    const problems = validateMission(withChanges(executionExample, { limits: undefined }));
    expect(problems.join("\n")).toMatch(/limits/);
  });

  it("rejects an execution mission without creator prerequisites", () => {
    const problems = validateMission(
      withChanges(executionExample, { creator_prerequisites: undefined }),
    );
    expect(problems.join("\n")).toMatch(/creator_prerequisites/);
  });

  it("accepts a decision mission without limits", () => {
    expect(decisionExample).not.toMatch(/^limits:/m);
    expect(validateMission(decisionExample)).toEqual([]);
  });

  it("rejects decision evidence on an execution mission", () => {
    const problems = validateMission(
      withChanges(executionExample, {
        acceptance_criteria: [
          { id: "CA1", criterion: "Founder likes it", evidence: { kind: "decision" } },
        ],
      }),
    );
    expect(problems).not.toEqual([]);
  });

  it("rejects a hosted agent as executor of a decision mission", () => {
    const problems = validateMission(withChanges(decisionExample, { executor: "hosted-agent" }));
    expect(problems).not.toEqual([]);
  });

  it("rejects an execution mission without agent instructions", () => {
    const problems = validateMission(executionExample.replace("## Instructions", "## Notes"));
    expect(problems.join("\n")).toMatch(/Instructions/);
  });

  it("rejects a file whose name does not start with the mission id", () => {
    const problems = validateMission(executionExample, "about-page.md");
    expect(problems.join("\n")).toMatch(/file name/);
  });

  it("rejects a file without front matter", () => {
    expect(validateMission("# Just a title\n")).toEqual([
      "Mission file must start with YAML front matter between --- lines.",
    ]);
  });
});

describe(".groundcrew/missions", () => {
  const dir = join(root, ".groundcrew/missions");
  const files = readdirSync(dir).filter((name) => name.endsWith(".md"));

  it.each(files.length > 0 ? files : ["(no missions yet)"])("%s follows the contract", (file) => {
    if (file === "(no missions yet)") return;
    expect(validateMission(readFileSync(join(dir, file), "utf8"), file)).toEqual([]);
  });
});
