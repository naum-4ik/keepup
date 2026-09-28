// Writes .env.local with the keys of the running local Supabase stack.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

let status;
try {
  const raw = execFileSync("npx", ["supabase", "status", "-o", "json"], { encoding: "utf8" });
  status = JSON.parse(raw.slice(raw.indexOf("{")));
} catch {
  console.error("Could not read the local Supabase status. Is `npx supabase start` running?");
  process.exit(1);
}

const url = status.API_URL;
const key = status.PUBLISHABLE_KEY ?? status.ANON_KEY;

if (!url || !key) {
  console.error("Could not read API_URL / publishable key. Is `npx supabase start` running?");
  process.exit(1);
}

writeFileSync(
  ".env.local",
  [
    `NEXT_PUBLIC_SUPABASE_URL=${url}`,
    `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${key}`,
    "NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false",
    "",
  ].join("\n"),
);
console.log("Wrote .env.local");
