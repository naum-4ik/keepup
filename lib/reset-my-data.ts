// Settings → Reset my data (owner 2026-10-06): the confirm rule.
// What it clears and keeps is decided by public.reset_my_data; the catalog lines say the same in plain words.
import type { T } from "@/supabase/functions/_shared/i18n";
// The words live in the catalog (`settings.reset.*`).

// The confirm field: the word in the person's language or the English "reset" (a keyboard may not have
// the other), in any case, spaces around it ignored.
export function isResetWord(t: T, typed: string): boolean {
  const word = typed.trim().toLowerCase();
  return word === t("settings.reset.word").toLowerCase() || word === "reset";
}

// The confirm button's steps (components/profile/reset-my-data.tsx): the reset first; only once it
// succeeded is the phone cleared (waiting taps on the private habits, saved pages), and a failure
// there is logged, not shown: the reset happened, so Today opens. Returns the error to show, if any.
export async function runReset(steps: {
  reset: () => Promise<{ ok: true } | { ok: false; message: string }>;
  clearPhone: () => Promise<void>;
  openToday: () => void;
}): Promise<string | null> {
  const r = await steps.reset();
  if (!r.ok) return r.message;
  try {
    await steps.clearPhone();
  } catch (e) {
    // A leftover tap on a removed habit is refused when it syncs.
    console.error("reset: clearing the phone's queue", e);
  }
  steps.openToday();
  return null;
}
