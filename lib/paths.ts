// The app's screens: a signed-out visit goes to /login and comes back after (lib/supabase/proxy.ts).
// Everything else answers for itself: public pages (/, /login, /privacy, /install, /invite, …), the
// manifest, /sw.js, /robots.txt and /sitemap.xml, /api routes (they check the session and answer 401
// JSON), and unknown addresses, which get the real "Page not found" (app/not-found.tsx) rather than a
// sign-in screen. A new screen folder under app/ must be added here: lib/paths.test.ts checks app/.
export const APP_PREFIXES = ["/today", "/progress", "/habits", "/groups", "/inbox", "/kids", "/profile", "/onboarding"];

export function needsSignIn(pathname: string): boolean {
  return APP_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
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
