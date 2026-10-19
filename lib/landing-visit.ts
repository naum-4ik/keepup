import { userAgent } from "next/server";

// Whether serving the landing counts as a visit (app/page.tsx keepup.landing_viewed). Not a visit:
// - a prefetch: Next's router fetching a page ahead of a tap (next-router-prefetch), or the browser's
//   own speculative prefetch or prerender (Sec-Purpose / Purpose: prefetch). Nobody has seen it.
// - a crawler or other bot (Next's user-agent parser).
export function isLandingVisit(h: Headers): boolean {
  if (h.has("next-router-prefetch")) return false;
  const purpose = `${h.get("sec-purpose") ?? ""} ${h.get("purpose") ?? ""}`;
  if (/prefetch/i.test(purpose)) return false;
  return !userAgent({ headers: h }).isBot;
}
