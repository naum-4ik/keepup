// Prints the real test counts for the README (and the CV). Never round these.
// Run from the repo root: `node scripts/count-tests.mjs`. Needs no database and no dev server:
// - pgTAP: the sum of `select plan(N)` over supabase/tests/database/*.sql (fails if a file has none);
// - Vitest: runs the suite once and reads `numTotalTests` from the JSON report;
// - Playwright: `playwright test --list` (lists, doesn't run);
// - Edge Function (Deno) tests: `deno test` when Deno is installed, printed on their own line; never in
//   `total`, so the total is the same on every machine.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { cwd: root, encoding: "utf8", ...opts });

// pgTAP
const dbDir = path.join(root, "supabase/tests/database");
const dbFiles = readdirSync(dbDir).filter((f) => f.endsWith(".sql"));
let pgtap = 0;
for (const file of dbFiles) {
  const sql = readFileSync(path.join(dbDir, file), "utf8");
  const plans = [...sql.matchAll(/select\s+plan\s*\(\s*(\d+)\s*\)/gi)].map((m) => Number(m[1]));
  if (plans.length === 0) throw new Error(`${file} has no plan(N); add one so it can be counted`);
  pgtap += plans.reduce((a, b) => a + b, 0);
}

// Vitest writes the JSON report to a file, not stdout.
const report = path.join(mkdtempSync(path.join(tmpdir(), "keepup-tests-")), "vitest.json");
try {
  run("npx", ["vitest", "run", "--reporter=json", `--outputFile=${report}`, "--silent"], { stdio: "ignore" });
} catch (error) {
  // A failing test still writes the report; the count is what matters here. No report: a real failure.
  if (!existsSync(report)) throw error;
}
const vitestReport = JSON.parse(readFileSync(report, "utf8"));
const vitest = vitestReport.numTotalTests;
if (!Number.isInteger(vitest)) throw new Error("Could not read numTotalTests from the Vitest JSON report");
if (vitestReport.numFailedTests > 0) console.error(`Warning: ${vitestReport.numFailedTests} Vitest tests failed`);

// Playwright
const e2eList = run("npx", ["playwright", "test", "--list"]);
const e2e = Number(e2eList.match(/Total: (\d+) tests? in (\d+) files?/)?.[1] ?? NaN);
if (!Number.isInteger(e2e)) throw new Error("Could not read the Playwright count from `playwright test --list`");

// Edge Function tests (Deno): counted only when Deno is installed. CI always runs them (ci.yml).
let edgeFunctions = null;
let hasDeno = true;
try {
  run("deno", ["--version"], { stdio: "ignore" });
} catch {
  hasDeno = false;
}
if (hasDeno) {
  const out = run("deno", ["test", "--no-lock", "--node-modules-dir=none", "supabase/functions"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const m = out.match(/(\d+) passed \| (\d+) failed(?: \| (\d+) ignored)?/);
  if (!m) throw new Error("Could not read the count from `deno test`");
  edgeFunctions = Number(m[1]) + Number(m[2]) + Number(m[3] ?? 0);
}

console.log(
  JSON.stringify(
    {
      pgtap,
      pgtapFiles: dbFiles.length,
      vitest,
      e2e,
      total: pgtap + vitest + e2e,
      edgeFunctions: edgeFunctions ?? "excluded (Deno not installed; CI runs them)",
    },
    null,
    2,
  ),
);
