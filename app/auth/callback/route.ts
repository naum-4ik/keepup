import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authErrorReason } from "@/lib/auth-errors";
import { track } from "@/lib/log";
import { safeNextPath } from "@/lib/paths";
import { userAttributes } from "@/lib/telemetry";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const reason = authErrorReason(searchParams);
  if (reason) return NextResponse.redirect(new URL(`/auth/error?reason=${reason}`, origin));

  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // A new account: created (Google) or its email confirmed (password sign-up) in the last 2 minutes.
      const { user } = data;
      const provider = user.app_metadata.provider;
      const justNow = (at?: string | null) => !!at && Date.now() - Date.parse(at) < 120_000;
      const isNew = justNow(user.created_at) || justNow(user.email_confirmed_at);
      track(isNew ? "signed_up" : "signed_in", userAttributes({ sub: user.id, email: user.email }), { "auth.method": provider === "email" ? "password" : (provider ?? "google") });
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL("/auth/error", origin));
}
