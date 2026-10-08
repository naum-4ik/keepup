import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { MOVED_PARAM } from "@/lib/moved";
import { isPublicPath } from "@/lib/paths";
import type { Database } from "@/lib/database.types";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
          // Mark refreshed-session responses non-cacheable so a CDN/reverse proxy
          // never serves one visitor's Set-Cookie session to another.
          Object.entries(headers).forEach(([key, value]) => supabaseResponse.headers.set(key, value));
        },
      },
    },
  );

  // Do not run code between createServerClient and getClaims(): it refreshes the session.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const { pathname, search } = request.nextUrl;

  if (!signedIn && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    // Arrived from the old address (lib/moved.ts): keep the notice on the login screen too.
    if (request.nextUrl.searchParams.get(MOVED_PARAM) === "1") url.searchParams.set(MOVED_PARAM, "1");
    const redirectResponse = NextResponse.redirect(url);
    // Carry over any cookies Supabase cleared/refreshed on supabaseResponse -- otherwise a
    // signed-out visitor's stale/expired cookies would survive the redirect unchanged.
    supabaseResponse.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }

  // Return supabaseResponse as-is so refreshed cookies reach the browser.
  return supabaseResponse;
}
