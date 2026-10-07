"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// "Try it": a fresh anonymous login (every anonymous login is a demo profile, deleted after 24h), seeded as
// Sam by start_demo. Already signed in: straight to Today, so start_demo never runs for an onboarded
// account (it would be a no-op there and leave an empty demo). See the demo ADR.
export async function startDemo(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (claims?.claims) redirect("/today");
  // The page may post before hydration fills the zone in; the database falls back to UTC for a bad one.
  const timezone = String(formData.get("timezone") || "UTC");
  const { error: signInError } = await supabase.auth.signInAnonymously();
  if (signInError) redirect("/?demo=failed");
  const { error } = await supabase.rpc("start_demo", { p_timezone: timezone });
  if (error) {
    await supabase.auth.signOut({ scope: "local" });
    redirect("/?demo=failed");
  }
  redirect("/today");
}

// The banner's "Sign in": leave the demo session, then the normal sign-in page. Never convert the
// anonymous login with updateUser: it would keep is_demo, and every demo guard would block it.
export async function leaveDemo(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
