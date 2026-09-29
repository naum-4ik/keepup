"use client";

import { useActionState, useState } from "react";
import type { FormActionState } from "@/app/(app)/habits/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

const initialState: FormActionState = { status: "idle" };

// Shared by DeleteHabitButton and ArchiveHabitButton: a trigger button, an in-app Dialog
// confirm (never window.confirm), an inline error instead of a thrown one, and a pending
// label on the confirm button while the action runs.
export function ConfirmHabitAction({
  triggerLabel,
  title,
  description,
  confirmLabel,
  pendingLabel,
  confirmVariant,
  action,
}: {
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel: string;
  confirmVariant: "destructive" | "outline";
  action: (prev: FormActionState, formData: FormData) => Promise<FormActionState>;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <>
      <Button type="button" variant="outline" className="h-11 w-full" onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent>
          <div className="flex flex-col gap-1 pr-10">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </div>
          {state.status === "error" && <p role="alert" className="text-sm text-destructive">{state.message}</p>}
          <form action={formAction} className="flex gap-2">
            <Button type="button" variant="outline" className="h-11 flex-1" disabled={pending} onClick={() => setOpen(false)}>
              Cancel
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
