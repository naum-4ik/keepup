// The habit pages' toasts (docs/design.md "States and feedback"). Kept free of React and Next so they
// are unit-tested (lib/habit-toasts.test.ts).
// - After a server action that redirects (create, delete, restore, start again): a flash, built here
//   and set by app/(app)/habits/actions.ts with lib/toast-server.ts flashToast. Its text and action
//   label are catalog keys (client namespace `habits`), its values plain, the habit name isolated.
// - Archive: no redirect from the server, so its toast can carry Undo (a callback can't cross a
//   redirect). Undo restores it: archiving and restoring in the same period settles no days (the
//   restore RPC marks only whole periods between, and those as skipped, never missed).
import { formatLocalDate } from "@/lib/dates";
import type { HabitPeriod } from "@/lib/habit-schema";
import type { Flash, ToastAction } from "@/lib/toast";
import { isolate, type Locale, type T } from "@/supabase/functions/_shared/i18n";

type FlashInput = Omit<Flash, "id" | "at">;

// Every key a habit flash names. The Toaster drops a flash whose key it doesn't know, silently, so
// lib/habit-toasts.test.ts checks each one is in every catalog.
export const HABIT_FLASH_KEYS = {
  added: "habits.toast.added",
  deleted: "habits.toast.deleted",
  restored: "habits.toast.restored",
  startedAgain: "habits.toast.startedAgain",
  open: "habits.toast.open",
} as const;

const openHabit = (id: string | undefined) => (id ? { action: { label: HABIT_FLASH_KEYS.open, href: `/habits/${id}` } } : {});

// "Added Read · check in now to start day 1", or, with a start date ahead, when it starts. `startsOn`:
// the date picked in the form ("" = today). The person lands on Today, where the habit already is,
// so the action opens the habit itself.
export function addedFlash(h: { id?: string; title: string; period: HabitPeriod; startsOn?: string }, locale: Locale): FlashInput {
  return {
    text: HABIT_FLASH_KEYS.added,
    values: { habit: isolate(h.title), period: h.period, starts: h.startsOn ? "later" : "now", date: h.startsOn ? formatLocalDate(h.startsOn, locale) : "" },
    ...openHabit(h.id),
  };
}

// Delete is offered only while the habit has no check-ins: nothing to undo, nowhere to open.
export const deletedFlash = (title: string): FlashInput => ({ text: HABIT_FLASH_KEYS.deleted, values: { habit: isolate(title) } });

export const restoredFlash = (h: { id: string; title: string }): FlashInput => ({
  text: HABIT_FLASH_KEYS.restored,
  values: { habit: isolate(h.title) },
  ...openHabit(h.id),
});

// Start again: the new copy, from today.
export const startedAgainFlash = (h: { id?: string; title: string }): FlashInput => ({
  text: HABIT_FLASH_KEYS.startedAgain,
  values: { habit: isolate(h.title) },
  ...openHabit(h.id),
});

// --- Archive with Undo ---

type Result = { ok: true } | { ok: false; message: string };
type Shown = { id: string; text: string; action?: ToastAction; sticky?: boolean; focusAction?: boolean };

export type ArchiveUndoDeps = {
  t: T;
  show: (toast: Shown) => void;
  close: (id: string) => void;
  // app/(app)/habits/actions.ts undoArchive: restore without leaving the page.
  restore: (habitId: string) => Promise<Result>;
  newId?: () => string;
  // How long "Restoring…" waits for an answer before it says it couldn't (with Undo again).
  timeoutMs?: number;
};

export const RESTORE_TIMEOUT_MS = 30_000;

let seq = 0;
const nextId = () => `archive-${++seq}`;

// One archive toast at a time: each new one closes the ones before (as lib/check-in-undo.ts does).
const ours = new Set<string>();
function replaceWith(deps: Pick<ArchiveUndoDeps, "show" | "close">, toast: Shown) {
  for (const id of ours) deps.close(id);
  ours.clear();
  ours.add(toast.id);
  deps.show(toast);
}

export type ArchivedHabit = { habitId: string; title: string };

const undoAction = (deps: ArchiveUndoDeps, h: ArchivedHabit): ToastAction => ({
  label: deps.t("offline.undo"),
  onAction: () => void undoArchive(deps, h),
});

// "Archived Read. Its history is in Progress → Archived." with Undo.
export function showArchived(deps: ArchiveUndoDeps, h: ArchivedHabit): void {
  replaceWith(deps, { id: (deps.newId ?? nextId)(), text: deps.t("habits.toast.archived", { habit: isolate(h.title) }), action: undoAction(deps, h) });
}

// Undo: "Restoring Read…" (sticky until it answers), then restored with a link to the habit, or what
// went wrong with Undo again (offline or a hung request: check the connection; refused: the server's
// reason). Focus moves to that retry only when it was lost (the toast's focusAction).
export async function undoArchive(deps: ArchiveUndoDeps, h: ArchivedHabit): Promise<"restored" | "failed"> {
  const { t } = deps;
  const newId = deps.newId ?? nextId;
  const habit = isolate(h.title);
  replaceWith(deps, { id: newId(), text: t("habits.toast.restoring", { habit }), sticky: true });
  let result: Result | null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    result = await Promise.race([
      deps.restore(h.habitId),
      new Promise<never>((_, reject) => (timer = setTimeout(() => reject(new Error("timeout")), deps.timeoutMs ?? RESTORE_TIMEOUT_MS))),
    ]);
  } catch {
    result = null;
  } finally {
    clearTimeout(timer);
  }
  if (result?.ok) {
    replaceWith(deps, { id: newId(), text: t("habits.toast.undone", { habit }), action: { label: t("habits.toast.open"), href: `/habits/${h.habitId}` } });
    return "restored";
  }
  replaceWith(deps, {
    id: newId(),
    text: result ? result.message : t("habits.toast.undoFailed", { habit }),
    action: undoAction(deps, h),
    focusAction: true,
  });
  return "failed";
}
