// Keepup moved to a new address (2026-10). Installed apps can't follow an origin change, so phones
// with the old icon must install again. proxy.ts forwards the old host here with ?moved=1, and
// components/moved/moved-notice.tsx tells people how. Pure: no next/server, so the banner can import it too.
export const OLD_HOSTS = ["keepup-murex.vercel.app"] as const;
export const NEW_ORIGIN = "https://keepuphabits.vercel.app";
export const MOVED_PARAM = "moved";

function bareHost(host: string | null | undefined): string {
  return (host ?? "").trim().toLowerCase().replace(/:\d+$/, "");
}

export function isOldHost(host: string | null | undefined): boolean {
  return (OLD_HOSTS as readonly string[]).includes(bareHost(host));
}

// Same path and query on the new address, with moved=1 (once).
export function movedUrl(pathname: string, search: string): string {
  // Set the path on the URL, not as a base-relative string: "//evil.com" must not become the host.
  const url = new URL(NEW_ORIGIN);
  url.pathname = pathname;
  url.search = search;
  url.searchParams.set(MOVED_PARAM, "1");
  return url.toString();
}

// The visible URL without moved=1, so it isn't bookmarked or shared. Null when there is nothing to strip.
export function withoutMoved(href: string): string | null {
  const url = new URL(href);
  if (!url.searchParams.has(MOVED_PARAM)) return null;
  url.searchParams.delete(MOVED_PARAM);
  return url.pathname + url.search + url.hash;
}
