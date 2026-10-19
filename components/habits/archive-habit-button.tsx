"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { archiveHabit, undoArchive } from "@/app/(app)/habits/actions";
import { ConfirmHabitAction } from "@/components/habits/confirm-habit-action";
import { closeToast, showToast } from "@/components/ui/toast";
import { useT } from "@/lib/i18n/client";
import { showArchived } from "@/lib/habit-toasts";

// Archive, then the archived list (or the child's page) with "Archived … · Undo" (lib/habit-toasts.ts).
// The toast and its Undo live in the toast store, not here: this button goes away with the page.
export function ArchiveHabitButton({ habitId, title }: { habitId: string; title: string }) {
  const t = useTranslations("habits.archive");
  const { t: tr } = useT();
  const router = useRouter();
  return (
    <ConfirmHabitAction
      triggerLabel={t("trigger")}
      title={t.rich("title", { title, bdi: (c) => <bdi>{c}</bdi> })}
      description={t("description")}
      confirmLabel={t("confirm")}
      pendingLabel={t("pending")}
      confirmVariant="outline"
      action={archiveHabit.bind(null, habitId)}
      onDone={(next) => {
        router.push(next);
        showArchived({ t: tr, show: showToast, close: closeToast, restore: undoArchive }, { habitId, title });
      }}
    />
  );
}
