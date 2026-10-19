"use client";

import { useActionState, useEffect, useEffectEvent, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { ConfirmActionState } from "@/app/(app)/habits/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";

const initialState: ConfirmActionState = { status: "idle" };

// Shared by DeleteHabitButton and ArchiveHabitButton: a trigger button, an in-app Dialog
// confirm (never window.confirm), an inline error instead of a thrown one, and a pending
// label on the confirm button while the action runs. An action that redirects (delete) leaves
// with its flash toast; one that answers "done" (archive) closes the dialog first, then `onDone`
// goes on and shows its toast (a toast behind an open dialog can't be seen).
export function ConfirmHabitAction({
  triggerLabel,
  title,
  description,
  confirmLabel,
  pendingLabel,
  confirmVariant,
  action,
  onDone,
}: {
  triggerLabel: string;
  title: ReactNode;
  description: string;
  confirmLabel: string;
  pendingLabel: string;
  confirmVariant: "destructive" | "outline";
  action: (prev: ConfirmActionState, formData: FormData) => Promise<ConfirmActionState>;
  onDone?: (next: string) => void;
}) {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, initialState);
  // Each answer is a new state object: a "done" closes the dialog in this render, then (after it
  // commits, as it navigates and updates the toast store) onDone runs once.
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state.status === "done") setOpen(false);
  }
  const done = useEffectEvent((next: string) => onDone?.(next));
  useEffect(() => {
    if (state.status === "done") done(state.next);
  }, [state]);

  return (
    <>
      <Button type="button" variant="outline" className="h-11 w-full" onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent>
          <div className="flex flex-col gap-1 pe-10">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </div>
          {state.status === "error" && <Notice tone="error" live>{state.message}</Notice>}
          <form action={formAction} className="flex gap-inner">
            <Button type="button" variant="outline" className="h-11 flex-1" disabled={pending} onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" variant={confirmVariant} className="h-11 flex-1" disabled={pending}>
              {pending ? pendingLabel : confirmLabel}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
