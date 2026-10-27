import { readFileSync } from "node:fs";

const master = readFileSync("PRIVATE_VTT_CODEX_MASTER_PLAN.md", "utf8");
const matrix = readFileSync("docs/FEATURE_MATRIX.md", "utf8");
const required = [...master.matchAll(/\*\*([A-Z]+-\d+) P[0-3]:\*\*/g)].map((match) => match[1]);
const rows = matrix.split("\n").filter((line) => /^\|\s*[A-Z]+-\d+\s*\|/.test(line));
const actual = rows.map((line) => line.split("|")[1].trim());
const states = new Set([
  "NOT_STARTED",
  "SCAFFOLDED",
  "IN_PROGRESS",
  "FUNCTIONAL",
  "VERIFIED",
  "DEFERRED",
  "BLOCKED",
]);
for (const id of required) if (!actual.includes(id)) throw new Error(`Missing feature: ${id}`);
if (new Set(actual).size !== actual.length || actual.some((id) => !required.includes(id)))
  throw new Error("Duplicate or unknown feature IDs");
for (const row of rows) {
  const cells = row
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
  if (cells.length !== 9 || !states.has(cells[3]))
    throw new Error(`Invalid feature row: ${cells[0]}`);
  if (cells[3] === "VERIFIED" && (!cells[4] || cells[4] === "—"))
    throw new Error(`No evidence for VERIFIED feature ${cells[0]}`);
}
console.log(
  `Feature inventory: ${required.length}/${required.length} master-plan IDs preserved; states valid.`,
);
