// What must never reach the browser: the matcher behind scripts/check-client-secrets.mjs, which
// scans the built client output in CI. Node runs this file directly (type stripping), so: no `@/`
// imports and only erasable TypeScript.

type Env = Record<string, string | undefined>;

// Inlined into the client on purpose (next.config.ts env: APP_COMMIT_SHA), or plain runner and
// shell settings that aren't secrets and can turn up in a bundle by coincidence.
const NOT_SECRET = new Set([
  "APP_COMMIT_SHA",
  "GITHUB_SHA",
  "VERCEL_GIT_COMMIT_SHA",
  "VERCEL_PROJECT_PRODUCTION_URL",
  "VERCEL_URL",
  "VERCEL_BRANCH_URL",
  "NODE_ENV",
  "KEEPUP_LOCALES",
]);
// Only these names count when they come from the process env: CI runners and shells carry dozens
// of harmless values (paths, repo names, URLs). Everything in a .env file counts.
const SECRET_NAME = /KEY|SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE|CREDENTIAL|HEADERS|DSN|AUTH|COOKIE|SALT/i;
// Short values ("true", "3000") match anything.
const MIN_LENGTH = 12;

/**
 * Values the build had that the browser must not see: every server-only (not `NEXT_PUBLIC_`)
 * variable from the .env files, and the secret-looking ones from the process env. A value that is
 * also public (VAPID_PUBLIC_KEY = NEXT_PUBLIC_VAPID_PUBLIC_KEY) isn't secret.
 */
export function serverOnlyValues(processEnv: Env, fileEnv: Env): Map<string, string> {
  const all: Env = { ...processEnv, ...fileEnv };
  const publicValues = new Set(
    Object.entries(all)
      .filter(([name]) => name.startsWith("NEXT_PUBLIC_"))
      .map(([, value]) => value),
  );
  const out = new Map<string, string>();
  for (const [name, value] of Object.entries(all)) {
    if (!value || value.length < MIN_LENGTH) continue;
    if (name.startsWith("NEXT_PUBLIC_") || NOT_SECRET.has(name) || /PUBLIC|PUBLISHABLE|ANON/i.test(name)) continue;
    if (!(name in fileEnv) && !SECRET_NAME.test(name)) continue;
    if (publicValues.has(value)) continue;
    out.set(name, value);
  }
  return out;
}

// Known secret shapes. Not a generic "43 base64url chars" (a VAPID private key) or hex matcher:
// chunk hashes and integrity strings would trip them; those secrets are caught by value instead.
const PATTERNS: { what: string; re: RegExp }[] = [
  { what: "Supabase secret key (sb_secret_)", re: /sb_secret_[A-Za-z0-9_-]{10,}/ },
  { what: "Grafana Cloud token (glc_)", re: /glc_[A-Za-z0-9+/=_-]{20,}/ },
  { what: "private key (PEM)", re: /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/ },
];
const JWT = /eyJ[A-Za-z0-9_-]{2,}\.(eyJ[A-Za-z0-9_-]{2,})\.[A-Za-z0-9_-]+/g;
const PRIVILEGED_ROLES = new Set(["service_role", "supabase_admin"]);

function jwtRole(payload: string): unknown {
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))?.role;
  } catch {
    return undefined;
  }
}

/** What in `text` must not be public, by name only: never the value itself. */
export function findSecrets(text: string, secrets: Map<string, string>): string[] {
  const found: string[] = [];
  for (const [name, value] of secrets) if (text.includes(value)) found.push(`value of ${name}`);
  for (const { what, re } of PATTERNS) if (re.test(text)) found.push(what);
  for (const [, payload] of text.matchAll(JWT)) {
    const role = jwtRole(payload);
    if (typeof role === "string" && PRIVILEGED_ROLES.has(role)) {
      found.push(`JWT with role ${role}`);
      break;
    }
  }
  return found;
}

/** Parses KEY=value lines of a .env file (comments, `export`, quotes). */
export function parseDotenv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m) continue;
    let value = m[2];
    const quoted = /^(['"`])(.*)\1$/.exec(value);
    if (quoted) value = quoted[2];
    else value = value.replace(/\s+#.*$/, "");
    out[m[1]] = value;
  }
  return out;
}
