/**
 * Validates every mission in .groundcrew/missions/ against the contract.
 * Usage: npm run missions:check
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validateMission } from "./validate.mts";

const dir = join(import.meta.dirname, "../../.groundcrew/missions");
const files = readdirSync(dir).filter((name) => name.endsWith(".md"));
let failed = 0;

for (const file of files) {
  const problems = validateMission(readFileSync(join(dir, file), "utf8"), file);
  if (problems.length > 0) {
    failed += 1;
    console.error(`✗ ${file}`);
    for (const problem of problems) console.error(`  - ${problem}`);
  } else {
    console.log(`✓ ${file}`);
  }
}

console.log(
  files.length === 0
    ? "No missions yet in .groundcrew/missions/."
    : `${files.length - failed} of ${files.length} missions valid.`,
);
process.exit(failed > 0 ? 1 : 0);
