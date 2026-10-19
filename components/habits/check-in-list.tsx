"use client";

import { useState, useTransition } from "react";
import { Undo2 } from "lucide-react";
import { undoCheckIn } from "@/app/(app)/habits/actions";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { useT } from "@/lib/i18n/client";
import { INTL_LOCALE } from "@/supabase/functions/_shared/i18n";
import type { HabitPeriod } from "@/lib/habit-schema";
import type { HabitCheckIn } from "@/lib/habits";

export function CheckInList({
  habitId,
  checkIns,
  timeZone,
  period,
  targetCount,
  open,
}: {
  habitId: string;
  checkIns: HabitCheckIn[];
  timeZone: string;
  period: HabitPeriod;
  targetCount: number;
  // The habit can be checked in now (not paused, not before its start): only then does the empty
  // list ask for the first check-in.
  open: boolean;
}) {
  const { t, locale } = useT();
  const [pending, startTransition] = useTransition();
  // The row being undone: its button says Undoing… (the others are only disabled).
  const [undoing, setUndoing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A daily habit only ever has today's check-ins in this period, so the weekday plus time is
  // enough; a week/month period spans several days, so show the date too.
  const time = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone,
    weekday: "short",
    ...(period !== "day" ? { day: "numeric", month: "short" } : {}),
    hour: "2-digit",
    minute: "2-digit",
  });

  if (checkIns.length === 0) {
    return open ? <p className="text-sm text-muted-foreground">{t("habits.checkIns.empty", { period, target: targetCount })}</p> : null;
  }

  return (
    <div className="flex flex-col gap-inner">
      {/* One check-in: the card's "Done for today" (or "1 of 3 this week") already says it. */}
      {checkIns.length > 1 && <p className="text-sm font-semibold">{t("habits.checkIns.count", { n: checkIns.length, count: String(checkIns.length) })}</p>}
      <ul className="flex flex-col gap-inner">
        {/* A tinted row, not a card. 6px around the 44px button keeps it 56px tall (off the scale on
            purpose); the button's own 6px icon gap and 16px sides are the Button's. */}
        {checkIns.map((c) => (
          <li key={c.id} className="flex min-h-14 items-center justify-between rounded-xl bg-muted py-1.5 pe-1.5 ps-item text-sm">
            <span>{time.format(new Date(c.created_at))}</span>
            <Button
              type="button"
              variant="outline"
              className="h-11 gap-1.5 rounded-full px-item text-sm hover:border-primary/60 hover:bg-accent hover:text-foreground"
              aria-label={t("habits.checkIns.undoAt", { time: time.format(new Date(c.created_at)) })}
              disabled={pending}
              onClick={() => {
                setUndoing(c.id);
                startTransition(async () => {
                  const r = await undoCheckIn(c.id, habitId);
                  setError(r.ok ? null : r.message);
                  setUndoing(null);
                });
              }}
            >
              <Undo2 aria-hidden className="size-4" />
              {pending && undoing === c.id ? t("habits.checkIns.undoing") : t("offline.undo")}
            </Button>
          </li>
        ))}
      </ul>
      {error && <Notice tone="error" live>{error}</Notice>}
    </div>
  );
}
