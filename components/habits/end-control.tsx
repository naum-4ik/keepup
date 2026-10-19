"use client";

import { useState, useTransition } from "react";
import { changeHabitEnd, finishHabit, keepGoing, type ActionResult } from "@/app/(app)/habits/actions";
import { Notice } from "@/components/ui/notice";
import { useToast } from "@/components/ui/toast";
import { endOptions } from "@/lib/habit-end";
import type { HabitPeriod } from "@/lib/habit-schema";
import { formatLocalDate } from "@/lib/dates";
import { useT } from "@/lib/i18n/client";
import { isolate } from "@/supabase/functions/_shared/i18n";

// What a tap on the Ends row did, said under the chips: the new last day, or no end now.
type Saved = { end: string | null } | null;

// The habit page's end (ideas/habit-end-date.md): extend it or remove it; never earlier. Once the
// habit's own today is past the end, only the finish card's two choices are left.
// States (docs/design.md "States and feedback"): the tapped chip says Saving… (Finishing… for
// Finish), the others wait disabled; a change shows "Saved: …" in place; Finish moves the habit to
// Finished, so this row goes away and a toast says where it went; an error says what to do.
export function EndControl({
  habitId,
  title,
  child,
  period,
  startsOn,
  endsOn,
  today,
}: {
  habitId: string;
  title: string;
  // A child's own habit: its Finished list is on the child's page, not in Progress.
  child?: { id: string; name: string } | null;
  period: HabitPeriod;
  startsOn: string;
  endsOn: string | null;
  today: string;
}) {
  const { t, locale } = useT();
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved>(null);
  const run = (key: string, call: () => Promise<ActionResult>, after?: { end: string | null } | "finished") => {
    setBusy(key);
    setSaved(null);
    startTransition(async () => {
      const r = await call();
      setBusy(null);
      setError(r.ok ? null : r.message);
      if (!r.ok) return;
      if (after === "finished") {
        const where = { where: child ? "kid" : "progress", name: child ? isolate(child.name) : "" };
        showToast({
          text: t("habits.end.finished", { habit: isolate(title), ...where }),
          action: { label: t("habits.end.openFinished", where), href: child ? `/kids/${child.id}` : "/progress?view=finished" },
        });
      } else if (after) setSaved(after);
    });
  };
  const options = endOptions(t, startsOn, endsOn, today, period);
  const chip =
    "flex h-11 items-center rounded-full border border-border bg-card px-item text-sm font-semibold hover:bg-muted disabled:opacity-50";
  const label = (key: string, idle: string, working = t("common.saving")) => (pending && busy === key ? working : idle);

  return (
    <div className="flex flex-col gap-inner">
      <p className="text-sm">
        {endsOn ? t("habits.end.lastDay", { date: formatLocalDate(endsOn, locale) }) : t("habits.end.noEnd")}
        {!options && ` ${t("habits.end.reached")}`}
      </p>
      <div className="flex flex-wrap gap-inner">
        {options ? (
          <>
            {options.map((o) => (
              <button key={o.n} type="button" disabled={pending} onClick={() => run(`n${o.n}`, () => changeHabitEnd(habitId, o.date), { end: o.date })} className={chip}>
                {label(`n${o.n}`, o.label)}
              </button>
            ))}
            {endsOn && (
              <button type="button" disabled={pending} onClick={() => run("remove", () => changeHabitEnd(habitId, null), { end: null })} className={chip}>
                {label("remove", t("habits.end.removeEnd"))}
              </button>
            )}
          </>
        ) : (
          <>
            <button type="button" disabled={pending} onClick={() => run("finish", () => finishHabit(habitId), "finished")} className={chip}>
              {label("finish", t("today.finish.finish"), t("habits.end.finishing"))}
            </button>
            <button type="button" disabled={pending} onClick={() => run("keep", () => keepGoing(habitId), { end: null })} className={chip}>
              {label("keep", t("today.finish.keepGoing"))}
            </button>
          </>
        )}
      </div>
      {saved && (
        <Notice tone="success" live>
          {t("habits.end.saved", { end: saved.end ? "date" : "none", date: saved.end ? formatLocalDate(saved.end, locale) : "" })}
        </Notice>
      )}
      {error && <Notice tone="error" live>{error}</Notice>}
    </div>
  );
}
