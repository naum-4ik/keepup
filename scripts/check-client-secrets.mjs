// Fails if the built app hands the browser a secret: run after `next build` (CI: the sanity e2e
// job and the full e2e after merge). Scans what a browser can download: .next/static (client
// chunks, CSS, media), the prerendered pages and RSC payloads in .next/server/app, and public/.
// Prints the file and the variable NAME or the kind of secret, never the value.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { findSecrets, parseDotenv, serverOnlyValues } from "../lib/client-secrets.mts";

const root = process.cwd();
// The .env files `next build` loads for production, later ones winning.
const fileEnv = {};
for (const name of [".env", ".env.production", ".env.local", ".env.production.local"]) {
  const path = join(root, name);
  if (existsSync(path)) Object.assign(fileEnv, parseDotenv(readFileSync(path, "utf8")));
}
const secrets = serverOnlyValues(process.env, fileEnv);

function* walk(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

const targets = [
  { dir: ".next/static", keep: () => true },
  // Server code (.js, manifests) stays on the server; the rest of this folder is sent as is.
  { dir: ".next/server/app", keep: (p) => /\.(html|rsc|body|meta)$/.test(p) },
  { dir: "public", keep: () => true },
];

let scanned = 0;
const problems = [];
for (const { dir, keep } of targets) {
  for (const path of walk(join(root, dir))) {
    if (!keep(path) || statSync(path).size > 20 * 1024 * 1024) continue;
    scanned++;
    for (const what of findSecrets(readFileSync(path, "latin1"), secrets)) problems.push(`${relative(root, path)}: ${what}`);
  }
}

if (!existsSync(join(root, ".next/static")) || scanned === 0) {
  console.error("check-client-secrets: no build output in .next/static. Run `next build` first.");
  process.exit(1);
}
if (problems.length) {
  console.error(`check-client-secrets: secrets in the client output (${problems.length}):`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(`check-client-secrets: ${scanned} files, ${secrets.size} server-only values checked, nothing found.`);
