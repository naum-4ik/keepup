import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";

// Create a new client per request; never store it in a module-level variable.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet, headers) {
          // headers (the no-cache/no-store/must-revalidate set) go unused here:
          // reading cookies via next/headers already marks this route dynamic,
          // so Next never lets a CDN cache it; proxy.ts is what fronts a CDN
          // and applies these headers to the responses it returns.
          void headers;
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component: safe to ignore, proxy.ts refreshes sessions.
          }
        },
      },
    },
  );
}
