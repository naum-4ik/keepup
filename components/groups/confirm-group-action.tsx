"use client";

import { useActionState, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { GroupActionState } from "@/app/(app)/groups/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ExportChildButton, MoveChildForm, type MoveTarget } from "@/components/kids/child-danger-zone";
import { childrenDeletionNotice } from "@/lib/group-schema";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

const initialState: GroupActionState = { status: "idle" };

type Copy = {
  title: ReactNode;
  description: ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  childrenNotice: ReactNode;
  // The group's children, for the step's Export first / Move to another group (moveTargets: other
  // groups where I'm admin; empty hides Move).
  groupChildren?: { id: string; name: string }[];
  moveTargets?: MoveTarget[];
};
type Action = (confirmChildren: boolean) => Promise<GroupActionState>;

// Leave and Delete, like ConfirmHabitAction: an in-app Dialog confirm with an inline error. When the
// group has children the database asks for a second, explicit confirmation (children_would_be_deleted);
// the dialog then names them, offers Export first and Move to another group for each (a blocking
// warning, ideas/kids-and-groups.md §3), and "Delete anyway" last.
export function ConfirmGroupAction({
  triggerLabel,
  destructiveTrigger = false,
  action,
  ...copy
}: Copy & { triggerLabel: string; destructiveTrigger?: boolean; action: Action }) {
  const [open, setOpen] = useState(false);
  // Each opening is a new session: the "Delete anyway" step must never survive a Cancel, or the
  // next confirm tap would delete the children without the warning being shown first.
  const [session, setSession] = useState(0);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={cn("h-11 w-full", destructiveTrigger && "text-destructive hover:text-destructive")}
        onClick={() => {
          setSession((n) => n + 1);
          setOpen(true);
        }}
      >
        {triggerLabel}
      </Button>
      {session > 0 && <ConfirmDialog key={session} open={open} onOpenChange={setOpen} action={action} {...copy} />}
    </>
  );
}

function ConfirmDialog({
  open,
  onOpenChange,
  action,
  title,
  description,
  confirmLabel,
  pendingLabel,
  childrenNotice,
  groupChildren = [],
  moveTargets = [],
}: Copy & { open: boolean; onOpenChange: (open: boolean) => void; action: Action }) {
  const { rich, locale } = useT();
  const tc = useTranslations("groups.confirm");
  const tm = useTranslations("common");
  // Children moved out from this step; the dialog isn't remounted by the refresh, so track them here.
  const [moved, setMoved] = useState<Set<string>>(() => new Set());
  const remaining = groupChildren.filter((c) => !moved.has(c.id));
  const [state, formAction, pending] = useActionState(
    (_prev: GroupActionState, formData: FormData) => action(formData.get("confirmChildren") === "1"),
    initialState,
  );
  const askChildren = state.status === "error" && state.code === "children_would_be_deleted";

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent>
        <div className="flex flex-col gap-1 pe-10">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </div>
        {askChildren ? (
          <div className="flex flex-col gap-3">
            {remaining.length > 0 || groupChildren.length === 0 ? (
              <p role="alert" className="text-sm font-semibold text-destructive">
                {groupChildren.length > 0 ? childrenDeletionNotice(rich, locale, remaining.map((c) => c.name)) : childrenNotice}
              </p>
            ) : (
              <p role="status" className="text-sm font-semibold">{tc("allMoved")}</p>
            )}
            {remaining.map((c) => (
              <div key={c.id} role="group" aria-label={c.name} className="flex flex-col gap-2 rounded-2xl bg-muted/60 p-3">
                <p className="font-semibold">{c.name}</p>
                <ExportChildButton childId={c.id} childName={c.name} label={tc("exportFirst")} className="w-full" />
                <MoveChildForm
                  childId={c.id}
                  childName={c.name}
                  targets={moveTargets}
                  onMoved={() => setMoved((m) => new Set(m).add(c.id))}
                />
              </div>
            ))}
          </div>
        ) : (
          state.status === "error" && <p role="alert" className="text-sm text-destructive">{state.message}</p>
        )}
        <form action={formAction} className="flex gap-2">
          {askChildren && <input type="hidden" name="confirmChildren" value="1" />}
          <Button type="button" variant="outline" className="h-11 flex-1" disabled={pending} onClick={() => onOpenChange(false)}>
            {tm("cancel")}
          </Button>
          <Button type="submit" variant="destructive" className="h-11 flex-1" disabled={pending}>
            {pending ? pendingLabel : askChildren && (remaining.length > 0 || groupChildren.length === 0) ? tc("deleteAnyway") : confirmLabel}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
