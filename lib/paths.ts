// The manifest is fetched without cookies, so it must never redirect to /login. /offline is what the
// service worker saves at install, signed in or not.
const PUBLIC_EXACT = new Set(["/", "/manifest.webmanifest", "/sw.js", "/offline"]);
// /api routes check the session themselves and answer 401 JSON (a redirect to the login page would
// look like success to a fetch from the service worker).
const PUBLIC_PREFIXES = ["/login", "/signup", "/auth", "/whats-new", "/privacy", "/install", "/invite", "/api"];

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

// Only same-site absolute paths. Browsers strip tabs/newlines and treat "\" as "/",
// so "/\t/evil.com" and "/\\evil.com" would become protocol-relative URLs.
export function safeNextPath(next: string | null | undefined, fallback = "/today"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  if (/[\u0000-\u001f\\]/.test(next)) return fallback;
  return next;
}

// Links between /login and /signup carry `next` along, but only when it isn't the default.
export function withNext(path: string, next: string): string {
  return next === "/today" ? path : `${path}?next=${encodeURIComponent(next)}`;
}
