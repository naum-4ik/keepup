"use client";

import { useTranslations } from "next-intl";
import { deleteHabit } from "@/app/(app)/habits/actions";
import { ConfirmHabitAction } from "@/components/habits/confirm-habit-action";

export function DeleteHabitButton({ habitId, title }: { habitId: string; title: string }) {
  const t = useTranslations("habits.delete");
  return (
    <ConfirmHabitAction
      triggerLabel={t("trigger")}
      title={t.rich("title", { title, bdi: (c) => <bdi>{c}</bdi> })}
      description={t("description")}
      confirmLabel={t("confirm")}
      pendingLabel={t("pending")}
      confirmVariant="destructive"
      action={deleteHabit.bind(null, habitId)}
    />
  );
}
