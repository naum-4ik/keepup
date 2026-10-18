"use server";

import { redirect } from "next/navigation";
import { whereFrom } from "@/lib/geo";
import { getT } from "@/lib/i18n/server";
import { track } from "@/lib/log";
import { safeNextPath, withNext } from "@/lib/paths";
import { createClient } from "@/lib/supabase/server";
import { userAttributes } from "@/lib/telemetry";

// "Try it", step 2: the browser has just signed in anonymously (TryDemoButton: so each visitor counts
// against Supabase's per-IP limit with their own IP, not the server's). Every anonymous login is a demo
// profile, deleted after 24h; start_demo seeds it as Sam (a second call is a no-op). A real login never
// reaches start_demo: it goes to Today. See the demo ADR.
export async function startDemo(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/?demo=failed");
  if (!data.claims.is_anonymous) redirect("/today");
  // The page may post before hydration fills the zone in; the database falls back to UTC for a bad one.
  const timezone = String(formData.get("timezone") || "UTC");
  // The group and the treat are stored names: seed them in the visitor's language.
  const { t } = await getT();
  let { error } = await supabase.rpc("start_demo", {
    p_timezone: timezone,
    p_group_name: t("groups.defaultFamily"),
    p_treat_title: t("templates.treat.playground"),
  });
  // Deploy order: a database without the new params yet (PGRST202: no such function) seeds in English.
  if (error?.code === "PGRST202") ({ error } = await supabase.rpc("start_demo", { p_timezone: timezone }));
  if (error) {
    await supabase.auth.signOut({ scope: "local" });
    redirect("/?demo=failed");
  }
  track("demo_started", userAttributes(data.claims), await whereFrom());
  redirect("/today");
}

// The banner's "Sign in": leave the demo session, then the normal sign-in page. Never convert the
// anonymous login with updateUser: it would keep is_demo, and every demo guard would block it.
// `next` (an invite link opened in the demo): sign-in then returns there. Same-site paths only.
export async function leaveDemo(next?: string): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect(withNext("/login", safeNextPath(next)));
}
