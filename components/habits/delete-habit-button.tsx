"use client";

import { deleteHabit } from "@/app/(app)/habits/actions";
import { ConfirmHabitAction } from "@/components/habits/confirm-habit-action";

export function DeleteHabitButton({ habitId, title }: { habitId: string; title: string }) {
  return (
    <ConfirmHabitAction
      triggerLabel="Delete habit"
      title={`Delete "${title}"?`}
      description="This can't be undone."
      confirmLabel="Delete"
      pendingLabel="Deleting…"
      confirmVariant="destructive"
      action={deleteHabit.bind(null, habitId)}
    />
  );
}
