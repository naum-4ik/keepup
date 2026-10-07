// Settings → Reset my data (owner 2026-10-06): its words in one place, and the confirm rule.
// What it clears and keeps is decided by public.reset_my_data; these lines say the same in plain words.
export const RESET_WORD = "reset";
export const RESET_CLEARS = "This clears your own habits and their check-ins, your XP and level, your badges, recaps and your Inbox.";
export const RESET_KEEPS = "Your account, settings, devices, groups and children stay, and so do your check-ins in group habits.";
// Today, right after a reset.
export const RESET_DONE = "Your data is reset. A fresh start 🌱";

// The confirm field: "reset", in any case, spaces around it ignored.
export const isResetWord = (typed: string) => typed.trim().toLowerCase() === RESET_WORD;

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
