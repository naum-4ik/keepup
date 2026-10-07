// A screen's name for "most used screens": the route, not the address, so /habits/<one id> and
// /habits/<another> count as one screen.
export function screenName(pathname: string) {
  return pathname
    .replace(/^\/invite\/[^/]+/, "/invite/[token]")
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi, "/[id]");
}
