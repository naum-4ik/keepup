"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { archiveHabit, undoArchive, type ConfirmActionState } from "@/app/(app)/habits/actions";
import { ConfirmHabitAction } from "@/components/habits/confirm-habit-action";
import { closeToast, showToast } from "@/components/ui/toast";
import { useT } from "@/lib/i18n/client";
import { showArchived } from "@/lib/habit-toasts";

// Archive, then the archived list (or the child's page) with "Archived … · Undo" (lib/habit-toasts.ts).
// The next step runs right after the answer, in this function, not in an effect: the answer comes with
// the habit page re-rendered as archived, which drops Manage and this button in the same update, so an
// effect here would never run. The toast and its Undo live in the toast store, not in this component.
// `child`: a child's own habit, whose Archived list is on the child's page.
export function ArchiveHabitButton({ habitId, title, child }: { habitId: string; title: string; child?: { id: string; name: string } | null }) {
  const t = useTranslations("habits.archive");
  const { t: tr } = useT();
  const router = useRouter();
  const archive = async (): Promise<ConfirmActionState> => {
    const r = await archiveHabit(habitId);
    if (r.status === "done") {
      router.push(r.next);
      showArchived({ t: tr, show: showToast, close: closeToast, restore: undoArchive }, { habitId, title, child: child ?? undefined });
    }
    return r;
  };
  return (
    <ConfirmHabitAction
      triggerLabel={t("trigger")}
      title={t.rich("title", { title, bdi: (c) => <bdi>{c}</bdi> })}
      description={t("description")}
      confirmLabel={t("confirm")}
      pendingLabel={t("pending")}
      confirmVariant="outline"
      action={archive}
    />
  );
}
