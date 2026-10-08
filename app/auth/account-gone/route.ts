import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Where getProfile sends a session whose account no longer exists. Re-checks first, so opening this
// URL by hand never signs out someone whose account is fine.
export async function GET(request: NextRequest) {
  const { origin } = request.nextUrl;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return NextResponse.redirect(new URL("/login", origin));

  const { data: profile, error } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  // A database error is not proof the account is gone: leave the session alone.
  if (error || profile) return NextResponse.redirect(new URL("/today", origin));

  await supabase.auth.signOut({ scope: "local" });
  return NextResponse.redirect(new URL("/login", origin));
}
