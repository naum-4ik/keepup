"use client";

import { useTranslations } from "next-intl";
import { deleteHabit } from "@/app/(app)/habits/actions";
import { ConfirmHabitAction } from "@/components/habits/confirm-habit-action";

export function DeleteHabitButton({ habitId, title }: { habitId: string; title: string }) {
  const t = useTranslations("habits.delete");
  const tc = useTranslations("common");
  return (
    <ConfirmHabitAction
      triggerLabel={t("trigger")}
      title={t.rich("title", { title, bdi: (c) => <bdi>{c}</bdi> })}
      description={t("description")}
      confirmLabel={tc("delete")}
      pendingLabel={tc("deleting")}
      confirmVariant="destructive"
      action={deleteHabit.bind(null, habitId)}
    />
  );
}
