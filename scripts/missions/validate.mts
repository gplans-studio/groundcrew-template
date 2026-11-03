import { readFileSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020.js";
import { parse as parseYaml } from "yaml";

const schemaUrl = new URL("../../.groundcrew/mission.schema.json", import.meta.url);
export const missionSchema = JSON.parse(readFileSync(schemaUrl, "utf8"));

// strictRequired is off because the if/then blocks require fields defined at the top level.
const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
ajv.addFormat("date", /^\d{4}-\d{2}-\d{2}$/);
const validateContract = ajv.compile(missionSchema);

export type ParsedMission = {
  data: Record<string, unknown>;
  body: string;
};

const frontMatter = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

/** Splits a mission file into its YAML front matter and Markdown body. */
export function parseMission(text: string): ParsedMission {
  const match = frontMatter.exec(text);
  if (!match) {
    throw new Error("Mission file must start with YAML front matter between --- lines.");
  }
  const data = parseYaml(match[1]);
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Mission front matter must be a YAML mapping.");
  }
  return { data: data as Record<string, unknown>, body: match[2] };
}

/** Returns a list of problems; an empty list means the mission is valid. */
export function validateMission(text: string, fileName?: string): string[] {
  let parsed: ParsedMission;
  try {
    parsed = parseMission(text);
  } catch (error) {
    return [(error as Error).message];
  }

  const problems: string[] = [];
  if (!validateContract(parsed.data)) {
    for (const error of validateContract.errors ?? []) {
      const where = error.instancePath || "(root)";
      problems.push(`${where}: ${error.message}`);
    }
  }

  const { id, type } = parsed.data;
  if (fileName && typeof id === "string" && !fileName.startsWith(`${id}`)) {
    problems.push(`file name "${fileName}" must start with the mission id "${id}"`);
  }
  if (type === "execution" && !/^##\s+Instructions/m.test(parsed.body)) {
    problems.push('execution missions need an "## Instructions" section for the agent');
  }
  return problems;
}
