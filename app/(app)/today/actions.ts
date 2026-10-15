"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { isUuid } from "@/lib/habit-schema";
import { logError, track } from "@/lib/log";

const MAX_BATCH = 100;

// dismiss_card validates the key itself (keepup:invalid_card); a failed dismissal only means the
// card comes back on the next visit.
export async function dismissCard(card: string): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("dismiss_card", { p_card: String(card) });
  if (error) logError("dismiss_card failed", error.message);
  revalidatePath("/today");
  revalidatePath("/inbox"); // the weekly family recap
}

// No revalidate: the card stays on screen while it's being read and is gone from the next render.
export async function markSeen(ids: string[]): Promise<void> {
  const valid = [...new Set(Array.isArray(ids) ? ids : [])].filter(isUuid).slice(0, MAX_BATCH);
  if (valid.length === 0) return;
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("mark_feed_seen", { p_ids: valid });
  if (error) logError("mark_feed_seen failed", error.message);
}

// The Invite card's one tap: create the group and open its share link.
export async function startInviteGroup(kind: "family" | "friends"): Promise<{ message: string } | void> {
  const { t } = await getT();
  if (kind !== "family" && kind !== "friends") return { message: t("errors.pickFamilyOrFriends") };
  const { supabase, who } = await requireUser();
  // The group is named in the creator's language, and stays that way.
  const { data, error } = await supabase.rpc("create_group", { p_name: kind === "family" ? t("groups.defaultFamily") : t("groups.defaultFriends"), p_kind: kind });
  if (error || !data) {
    logError("create_group failed", error?.message);
    return { message: t("errors.groupCreateFailed") };
  }
  track("group_created", who, { "group.id": data.id, "group.kind": kind });
  revalidatePath("/groups");
  revalidatePath("/today");
  redirect(`/groups/${data.id}?invite=1`);
}
