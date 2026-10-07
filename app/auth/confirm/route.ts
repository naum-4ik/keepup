import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authErrorReason } from "@/lib/auth-errors";
import { safeNextPath } from "@/lib/paths";

const OTP_TYPES = new Set<EmailOtpType>(["signup", "recovery", "email"]);

function isOtpType(value: string | null): value is EmailOtpType {
  return value !== null && OTP_TYPES.has(value);
}

// Where the confirm-email and reset-password links land. The Keepup templates send `token_hash`
// (verified here, so the link works on any device); Supabase's default template goes through
// /auth/v1/verify and comes back with a PKCE `code` (works only in the browser that asked for it).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const reason = authErrorReason(searchParams);
  if (reason) return NextResponse.redirect(new URL(`/auth/error?reason=${reason}`, origin));

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (tokenHash && isOtpType(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, origin));
  } else if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }

  return NextResponse.redirect(new URL("/auth/error?reason=expired", origin));
}
