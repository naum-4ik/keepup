// The kid pages' flash toasts (docs/design.md "States and feedback"): set by app/(app)/kids/actions.ts
// with lib/toast-server.ts flashToast before redirect(). Text keys are in the client namespace `kids`;
// values are plain, the child's name isolated. Kept free of Next so they are unit-tested
// (lib/kid-toasts.test.ts).
import type { Flash } from "@/lib/toast";
import { isolate } from "@/supabase/functions/_shared/i18n";

type FlashInput = Omit<Flash, "id" | "at">;

// Every key a kid flash names. The Toaster drops a flash whose key it doesn't know, silently, so
// lib/kid-toasts.test.ts checks each one is in every catalog.
export const KID_FLASH_KEYS = {
  added: "kids.toast.added",
  deleted: "kids.toast.deleted",
} as const;

// "Added Mary with 3 habits. Each check-in earns 1 star." on her new page. habits: the starter habits
// that were really added (a failed one is said by the page's own note).
export const addedFlash = (name: string, habits: number): FlashInput => ({
  text: KID_FLASH_KEYS.added,
  values: { name: isolate(name), habits },
});

// After Delete, on the group list: the page that named her is gone.
export const deletedFlash = (name: string): FlashInput => ({ text: KID_FLASH_KEYS.deleted, values: { name: isolate(name) } });
