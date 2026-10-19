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

// "Created Family. Create its invite link below: it works for 7 days." The group page opens with the
// invite in focus (?invite=1). A demo login can't invite, so its line stops at "Created Family."
export const createdFlash = (name: string, canInvite: boolean): FlashInput => ({
  text: GROUP_FLASH_KEYS.created,
  values: { group: isolate(name), invite: canInvite ? "yes" : "no" },
});

// Leaving as the only member deletes the group (private.leave_group_impl), so the line says so, with
// the children's profiles that went with it.
export const leftFlash = (name: string, alone: boolean, children = 0): FlashInput => ({
  text: GROUP_FLASH_KEYS.left,
  values: { group: isolate(name), alone: alone ? "yes" : "no", children },
});

// public.leave_group's answer ({deleted, children_deleted}, migration 20261028100000). null from a
// database without that migration (it returned nothing): the caller falls back to its own count.
export function leaveResult(data: unknown): { deleted: boolean; children: number } | null {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  const { deleted, children_deleted } = data as Record<string, unknown>;
  if (typeof deleted !== "boolean") return null;
  return { deleted, children: typeof children_deleted === "number" && Number.isInteger(children_deleted) && children_deleted > 0 ? children_deleted : 0 };
}

export const deletedFlash = (name: string): FlashInput => ({ text: GROUP_FLASH_KEYS.deleted, values: { group: isolate(name) } });
