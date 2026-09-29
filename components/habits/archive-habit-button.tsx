"use client";

import { archiveHabit } from "@/app/(app)/habits/actions";
import { ConfirmHabitAction } from "@/components/habits/confirm-habit-action";

export function ArchiveHabitButton({ habitId, title }: { habitId: string; title: string }) {
  return (
    <ConfirmHabitAction
      triggerLabel="Archive habit"
      title={`Archive "${title}"?`}
      description="It moves to Progress with its history. This can't be undone."
      confirmLabel="Archive"
      pendingLabel="Archiving…"
      confirmVariant="outline"
      action={archiveHabit.bind(null, habitId)}
    />
  );
}
