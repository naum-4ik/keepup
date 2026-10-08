// Secrets that can hide inside any string we send to Grafana, from the server (lib/telemetry.ts) or
// the browser (components/observability/faro.tsx): the sign-in code, tokens and token hashes in URLs,
// an invite link's token (it is a key to the group), JWTs, Grafana and Supabase secret keys. Emails and
// IDs pass (owner, 2026-10-07). No imports: the browser bundle includes this file.
export const REDACTED = "[REDACTED]";

const SECRET_PARAM = /([?&](?:code|access_token|refresh_token|token_hash|token|apikey|password)=)[^&#\s"]+/gi;
const INVITE_TOKEN = /(\/invite\/)[^/?#\s"]+/g;
const SECRET_VALUE = /eyJ[\w-]+\.[\w-]+\.[\w-]+|glc_[\w=+/-]+|sb_secret_[\w-]+/g;

export function redactString(value: string) {
  return value.replace(SECRET_PARAM, `$1${REDACTED}`).replace(INVITE_TOKEN, `$1${REDACTED}`).replace(SECRET_VALUE, REDACTED);
}

// Every string in a nested object or array (a browser telemetry item), cleaned; nothing else changes.
export function redactDeep<T>(value: T): T {
  if (typeof value === "string") return redactString(value) as T;
  if (Array.isArray(value)) return value.map(redactDeep) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, redactDeep(inner)])) as T;
  }
  return value;
}
