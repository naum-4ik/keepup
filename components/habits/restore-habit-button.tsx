"use client";

import { ArchiveRestore } from "lucide-react";
import { useState, useTransition } from "react";
import { restoreHabit } from "@/app/(app)/habits/actions";
import { Notice } from "@/components/ui/notice";
import { useT } from "@/lib/i18n/client";
import { isolate } from "@/supabase/functions/_shared/i18n";

// Archived tab and an archived habit's page: back on Today, history kept.
export function RestoreHabitButton({ habitId, title }: { habitId: string; title: string }) {
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-inner">
      <button
        type="button"
        aria-label={t("habits.restore.aria", { title: isolate(title) })}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await restoreHabit(habitId); // redirects to Today on success, with a toast
            if (r && !r.ok) setError(r.message);
          })
        }
        className="flex h-11 items-center gap-inner self-start rounded-full px-inner text-sm font-semibold text-primary hover:bg-accent"
      >
        <ArchiveRestore aria-hidden className="size-4" />
        {pending ? t("habits.restore.pending") : t("habits.restore.label")}
      </button>
      {error && <Notice tone="error" live>{error}</Notice>}
    </div>
  );
}
