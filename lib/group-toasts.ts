// The group pages' flash toasts (docs/design.md "States and feedback"): set by
// app/(app)/groups/actions.ts with lib/toast-server.ts flashToast before redirect(). Text keys are in
// the client namespace `groups`; values are plain, the group name isolated. Kept free of Next so they
// are unit-tested (lib/group-toasts.test.ts).
import type { Flash } from "@/lib/toast";
import { isolate } from "@/supabase/functions/_shared/i18n";

type FlashInput = Omit<Flash, "id" | "at">;

// Every key a group flash names. The Toaster drops a flash whose key it doesn't know, silently, so
// lib/group-toasts.test.ts checks each one is in every catalog.
export const GROUP_FLASH_KEYS = {
  created: "groups.toast.created",
  left: "groups.toast.left",
  deleted: "groups.toast.deleted",
} as const;

// "Created Family. Share its invite link below: it works for 7 days." The group page opens with the
// invite in focus (?invite=1). A demo login can't invite, so its line stops at "Created Family."
export const createdFlash = (name: string, canInvite: boolean): FlashInput => ({
  text: GROUP_FLASH_KEYS.created,
  values: { group: isolate(name), invite: canInvite ? "yes" : "no" },
});

// Leaving as the only member deletes the group (private.leave_group_impl), so the line says so.
export const leftFlash = (name: string, alone: boolean): FlashInput => ({
  text: GROUP_FLASH_KEYS.left,
  values: { group: isolate(name), alone: alone ? "yes" : "no" },
});

export const deletedFlash = (name: string): FlashInput => ({ text: GROUP_FLASH_KEYS.deleted, values: { group: isolate(name) } });
