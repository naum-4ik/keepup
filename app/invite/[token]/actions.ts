"use server";

import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { habitErrorMessage } from "@/lib/habit-errors";
import { track } from "@/lib/log";

export type AcceptInviteState = { message: string } | null;

// Bound to the token by the page (`acceptInvite.bind(null, token)`); the form state and data aren't needed.
export async function acceptInvite(token: string): Promise<AcceptInviteState> {
  const { supabase, who, profile } = await getProfile();
  // Already in (a page loaded before joining, e.g. in another tab): open the group instead of
  // saying "You joined".
  const { data: memberOf } = await supabase.rpc("invite_membership", { p_token: token });
  if (memberOf) redirect(`/groups/${memberOf}`);
  const { data: groupId, error } = await supabase.rpc("accept_invite", { p_token: token });
  // Expired or revoked since the page loaded: back to the page, which now shows its "doesn't work
  // anymore" card instead of an inline error.
  if (error?.message?.includes("keepup:invite_invalid")) redirect(`/invite/${encodeURIComponent(token)}`);
  if (error || !groupId) return { message: habitErrorMessage(error) };
  track("invite_accepted", who, { "group.id": groupId, "group.role": "member" });
  // New people finish onboarding first; the group rides along in the URL.
  redirect(profile.onboarded_at ? `/today?joined=${groupId}` : `/onboarding?joined=${groupId}`);
}
