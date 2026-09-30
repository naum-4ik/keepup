"use server";

import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { habitErrorMessage } from "@/lib/habit-errors";

export type AcceptInviteState = { message: string } | null;

// Bound to the token by the page (`acceptInvite.bind(null, token)`); the form state and data aren't needed.
export async function acceptInvite(token: string): Promise<AcceptInviteState> {
  const { supabase, profile } = await getProfile();
  const { data: groupId, error } = await supabase.rpc("accept_invite", { p_token: token });
  if (error || !groupId) return { message: habitErrorMessage(error) };
  // New people finish onboarding first; the group rides along in the URL.
  redirect(profile.onboarded_at ? `/today?joined=${groupId}` : `/onboarding?joined=${groupId}`);
}
