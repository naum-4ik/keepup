"use client";

import { archiveHabit } from "@/app/(app)/habits/actions";
import { ConfirmHabitAction } from "@/components/habits/confirm-habit-action";

export function ArchiveHabitButton({ habitId, title }: { habitId: string; title: string }) {
  return (
    <ConfirmHabitAction
      triggerLabel="Archive habit"
      title={`Archive "${title}"?`}
      description="It leaves Today and keeps its history in Progress → Archived."
      confirmLabel="Archive"
      pendingLabel="Archiving…"
      confirmVariant="outline"
      action={archiveHabit.bind(null, habitId)}
    />
  );
}
