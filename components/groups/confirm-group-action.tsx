"use client";

import { useActionState, useState } from "react";
import type { GroupActionState } from "@/app/(app)/groups/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const initialState: GroupActionState = { status: "idle" };

// Leave and Delete, like ConfirmHabitAction: an in-app Dialog confirm with an inline error. When the
// group has children the database asks for a second, explicit confirmation (children_would_be_deleted);
// the dialog then names them and offers "Delete anyway" (Task 10 adds Export and Move here).
export function ConfirmGroupAction({
  triggerLabel,
  title,
  description,
  confirmLabel,
  pendingLabel,
  childrenNotice,
  destructiveTrigger = false,
  action,
}: {
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel: string;
  childrenNotice: string;
  destructiveTrigger?: boolean;
  action: (confirmChildren: boolean) => Promise<GroupActionState>;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    (_prev: GroupActionState, formData: FormData) => action(formData.get("confirmChildren") === "1"),
    initialState,
  );
  const askChildren = state.status === "error" && state.code === "children_would_be_deleted";

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={cn("h-11 w-full", destructiveTrigger && "text-destructive hover:text-destructive")}
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </Button>
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent>
          <div className="flex flex-col gap-1 pr-10">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </div>
          {askChildren ? (
            <p role="alert" className="text-sm font-semibold text-destructive">{childrenNotice}</p>
          ) : (
            state.status === "error" && <p role="alert" className="text-sm text-destructive">{state.message}</p>
          )}
          <form action={formAction} className="flex gap-2">
            {askChildren && <input type="hidden" name="confirmChildren" value="1" />}
            <Button type="button" variant="outline" className="h-11 flex-1" disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" className="h-11 flex-1" disabled={pending}>
              {pending ? pendingLabel : askChildren ? "Delete anyway" : confirmLabel}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
