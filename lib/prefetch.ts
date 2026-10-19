// A link prefetch (Next's router fetching a page ahead of a tap) renders the page on the server too,
// but nobody has seen it: server-side view signals skip it (app/page.tsx keepup.landing_viewed).
export function isPrefetch(h: Pick<Headers, "has">): boolean {
  return h.has("next-router-prefetch");
}
