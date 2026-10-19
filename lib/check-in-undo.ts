// Today's check-in toast and its Undo (docs/design.md "States and feedback"): "{habit} checked in" with
// Undo; Undo shows "Undoing {habit}…", then "check-in undone", or what went wrong with the next step
// (Undo again, or open the habit when there is nothing left to undo). Kept free of React so the flow
// is unit-tested (lib/check-in-undo.test.ts); the button wires it to the toast and the server action.
// Module functions, not component state: the check-in moves the habit to the Done list, which remounts
// its button, so nothing here may depend on that button staying mounted.
import type { ToastAction } from "@/lib/toast";
import { isolate, type T } from "@/supabase/functions/_shared/i18n";

type UndoResult = { ok: true } | { ok: false; message: string; code?: string };

export type UndoDeps = {
  t: T;
  // focusAction: the toast's action takes focus (a retry after an error, where focus was on the Undo
  // that just went away).
  show: (toast: { id: string; text: string; action?: ToastAction; sticky?: boolean; focusAction?: boolean }) => void;
  close: (id: string) => void;
  // app/(app)/habits/actions.ts undoCheckInByClient
  undo: (clientId: string, habitId: string) => Promise<UndoResult>;
  // Undone: focus goes back to the habit's check-in button once the page shows it open again
  // (components/habits/check-in-focus.ts). The toast's own Undo, which had it, is gone.
  onUndone?: (habitId: string) => void;
  newId?: () => string;
};

// The server's answer to an undo by client id (app/(app)/habits/actions.ts undoCheckInByClient): the
// RPC's true, or else whether the row is still there. Gone (an earlier undo whose answer was lost) is
// as good as undone; still there, or unknown, means it was refused (approved, or its period closed).
export function undoOutcome(undone: boolean, stillThere: boolean | null): "undone" | "already" | "refused" {
  if (undone) return "undone";
  return stillThere === false ? "already" : "refused";
}

// A tap that landed online (lib/offline-client.ts submitTap's clientId). approval: the server kept it
// waiting for someone's yes (TapResult.pending), so the toast says "sent for approval".
export type LandedTap = { habitId: string; clientId: string; title: string; approval: boolean };

let seq = 0;
const nextId = () => `check-in-${++seq}`;

// The toasts this module put up. Each new one replaces them (closes them first): three quick taps
// show the latest "checked in", and "Undoing…" and its answer show at once instead of queueing behind
// another tap's toast (lib/toast.ts queues and drops the oldest). Older taps undo on the habit page.
const ours = new Set<string>();
type Shown = { id: string; text: string; action?: ToastAction; sticky?: boolean; focusAction?: boolean };
function replaceWith(deps: Pick<UndoDeps, "show" | "close">, toast: Shown) {
  for (const id of ours) deps.close(id);
  ours.clear();
  ours.add(toast.id);
  deps.show(toast);
}

export function checkedInText(t: T, title: string, approval: boolean): string {
  return t("today.checkIn.done", { habit: isolate(title), approval: approval ? "yes" : "no" });
}

export function showCheckedIn(deps: UndoDeps, tap: LandedTap): void {
  const id = (deps.newId ?? nextId)();
  replaceWith(deps, { id, text: checkedInText(deps.t, tap.title, tap.approval), action: undoAction(deps, tap) });
}

// "Me + Mary" (several check-ins in one call, none with a client id): confirmed without Undo (the
// habit page undoes them one by one), still one toast at a time.
export function showCheckedInWithout(deps: Pick<UndoDeps, "t" | "show" | "close" | "newId">, title: string): void {
  replaceWith(deps, { id: (deps.newId ?? nextId)(), text: checkedInText(deps.t, title, false) });
}

const undoAction = (deps: UndoDeps, tap: LandedTap): ToastAction => ({
  label: deps.t("offline.undo"),
  onAction: () => void undoCheckIn(deps, tap),
});

export type UndoOutcome = "undone" | "gone" | "failed";

export async function undoCheckIn(deps: UndoDeps, tap: LandedTap): Promise<UndoOutcome> {
  const { t } = deps;
  const newId = deps.newId ?? nextId;
  const habit = isolate(tap.title);
  const busy = newId();
  // Sticky: it stays until the answer replaces it, however long the request takes.
  replaceWith(deps, { id: busy, text: t("today.undo.undoing", { habit }), sticky: true });
  let result: UndoResult | null;
  try {
    result = await deps.undo(tap.clientId, tap.habitId);
  } catch {
    result = null; // no answer: offline, or the request failed on the way
  }
  // A newer check-in's toast took over while this undo ran: the answer waits its turn behind it
  // rather than closing it.
  const show = (toast: Shown) => {
    if (ours.has(busy)) return replaceWith(deps, toast);
    ours.add(toast.id);
    deps.show(toast);
  };
  if (result?.ok) {
    show({ id: newId(), text: t("today.undo.done", { habit }) });
    deps.onUndone?.(tap.habitId);
    return "undone";
  }
  // Nothing left to take back (approved meanwhile, or its period closed): the habit page shows why.
  if (result?.code === "undo_gone") {
    show({ id: newId(), text: result.message, action: { label: t("today.undo.openHabit"), href: `/habits/${tap.habitId}` }, focusAction: true });
    return "gone";
  }
  show({ id: newId(), text: result ? result.message : t("today.undo.failed", { habit }), action: undoAction(deps, tap), focusAction: true });
  return "failed";
}
