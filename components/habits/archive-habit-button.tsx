"use client";

import { useTranslations } from "next-intl";
import { archiveHabit } from "@/app/(app)/habits/actions";
import { ConfirmHabitAction } from "@/components/habits/confirm-habit-action";

export function ArchiveHabitButton({ habitId, title }: { habitId: string; title: string }) {
  const t = useTranslations("habits.archive");
  return (
    <ConfirmHabitAction
      triggerLabel={t("trigger")}
      title={t.rich("title", { title, bdi: (c) => <bdi>{c}</bdi> })}
      description={t("description")}
      confirmLabel={t("confirm")}
      pendingLabel={t("pending")}
      confirmVariant="outline"
      action={archiveHabit.bind(null, habitId)}
    />
  );
}
