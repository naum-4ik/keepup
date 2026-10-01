"use server";

import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { habitErrorMessage } from "@/lib/habit-errors";

export type AcceptInviteState = { message: string } | null;

// Bound to the token by the page (`acceptInvite.bind(null, token)`); the form state and data aren't needed.
export async function acceptInvite(token: string): Promise<AcceptInviteState> {
  const { supabase, profile } = await getProfile();
  // Read before accepting: a current member's tap changes nothing, so it opens the group instead
  // of saying "You joined".
  const { data: before } = await supabase.rpc("my_groups");
  const { data: groupId, error } = await supabase.rpc("accept_invite", { p_token: token });
  // Expired or revoked since the page loaded: back to the page, which now shows its "doesn't work
  // anymore" card instead of an inline error.
  if (error?.message?.includes("keepup:invite_invalid")) redirect(`/invite/${encodeURIComponent(token)}`);
  if (error || !groupId) return { message: habitErrorMessage(error) };
  if ((before ?? []).some((g) => g.group_id === groupId)) redirect(`/groups/${groupId}`);
  // New people finish onboarding first; the group rides along in the URL.
  redirect(profile.onboarded_at ? `/today?joined=${groupId}` : `/onboarding?joined=${groupId}`);
}
