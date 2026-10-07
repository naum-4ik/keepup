"use server";

import { redirect } from "next/navigation";
import { track } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";
import { userAttributes } from "@/lib/telemetry";

export async function signOut() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  await supabase.auth.signOut({ scope: "local" });
  if (data?.claims) track("signed_out", userAttributes(data.claims));
  redirect("/");
}
