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
  show: (toast: { id: string; text: string; action?: ToastAction }) => void;
  close: (id: string) => void;
  // app/(app)/habits/actions.ts undoCheckInByClient
  undo: (clientId: string, habitId: string) => Promise<UndoResult>;
  newId?: () => string;
};

// A tap that landed online (lib/offline-client.ts submitTap's clientId). approval: it waits for
// someone's yes, so the toast says "sent for approval".
export type LandedTap = { habitId: string; clientId: string; title: string; approval: boolean };

let seq = 0;
const nextId = () => `check-in-${++seq}`;

export function checkedInText(t: T, title: string, approval: boolean): string {
  return t("today.checkIn.done", { habit: isolate(title), approval: approval ? "yes" : "no" });
}

export function showCheckedIn(deps: UndoDeps, tap: LandedTap): void {
  const id = (deps.newId ?? nextId)();
  deps.show({ id, text: checkedInText(deps.t, tap.title, tap.approval), action: undoAction(deps, tap) });
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
  deps.show({ id: busy, text: t("today.undo.undoing", { habit }) });
  let result: UndoResult | null;
  try {
    result = await deps.undo(tap.clientId, tap.habitId);
  } catch {
    result = null; // no answer: offline, or the request failed on the way
  }
  deps.close(busy);
  if (result?.ok) {
    deps.show({ id: newId(), text: t("today.undo.done", { habit }) });
    return "undone";
  }
  // Nothing left to take back (approved meanwhile, or its period closed): the habit page shows why.
  if (result?.code === "undo_gone") {
    deps.show({ id: newId(), text: result.message, action: { label: t("today.undo.openHabit"), href: `/habits/${tap.habitId}` } });
    return "gone";
  }
  deps.show({ id: newId(), text: result ? result.message : t("today.undo.failed", { habit }), action: undoAction(deps, tap) });
  return "failed";
}
