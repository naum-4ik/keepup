"use client";

import { useActionState, useState, useTransition } from "react";
import { CalendarPlus, X } from "lucide-react";
import { freezeHabit, unfreezeHabit, type ActionResult, type FormActionState } from "@/app/(app)/habits/actions";
import { StartDatePicker } from "@/components/habits/start-date-picker";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { formatLocalDate } from "@/lib/dates";
import { useT } from "@/lib/i18n/client";
import type { HabitFreeze } from "@/lib/habits";
import { pauseEndQuickPicks } from "@/lib/schedule";

const initialState: FormActionState = { status: "idle" };

// The pause actions: the whole habit by default; PauseMeForm passes a member's own pause (`me`: its
// own labels and note).
export type PauseKind = {
  freeze: (habitId: string, prev: FormActionState, formData: FormData) => Promise<FormActionState>;
  unfreeze: (habitId: string) => Promise<ActionResult>;
  me?: boolean;
};

const WHOLE_HABIT: PauseKind = { freeze: freezeHabit, unfreeze: unfreezeHabit };

export function FreezeForm({
  habitId,
  today,
  weekStart,
  activeFreeze,
  paused,
  kind = WHOLE_HABIT,
  submitLabel,
}: {
  habitId: string;
  today: string;
  weekStart: 0 | 1;
  // The current pause (when `paused`) or the next scheduled one.
  activeFreeze: HabitFreeze | null;
  paused: boolean;
  kind?: PauseKind;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(kind.freeze.bind(null, habitId), initialState);
  const { t, locale } = useT();
  const submitText = submitLabel ?? t(kind.me ? "habits.freeze.pause" : "habits.freeze.pauseHabit");
  const [resuming, startResume] = useTransition();
  const [resumeError, setResumeError] = useState<string | null>(null);
  // Resumed (or a scheduled pause cancelled): the form comes back with a "Saved" line over it.
  const [resumed, setResumed] = useState<"resumed" | "cancelled" | null>(null);
  // The pause just saved: the page swaps the form for the pause's dates, with "Saved" under them.
  // Each save is a new state object (as in SaveButton), so pausing again says it again.
  const [seen, setSeen] = useState(state);
  const [justSaved, setJustSaved] = useState(false);
  if (state !== seen) {
    setSeen(state);
    if (state.status === "saved") {
      setJustSaved(true);
      setResumed(null);
    }
  }
  const [startsOn, setStartsOn] = useState(today);
  const [endsOn, setEndsOn] = useState<string | null>(null);

  // Moving the start date past an already-chosen end date would leave an invalid range
  // (the server rejects ends_on < starts_on); clear it instead of submitting something invalid.
  const changeStart = (date: string) => {
    setStartsOn(date);
    setEndsOn((e) => (e !== null && e < date ? null : e));
  };

  if (activeFreeze) {
    const scheduled = !paused;
    return (
      <div className="flex flex-col gap-inner">
        <p className="text-sm">
          {scheduled
            ? t("habits.freeze.starts", { date: formatLocalDate(activeFreeze.starts_on, locale) })
            : activeFreeze.ends_on
              ? t("habits.freeze.pausedFromUntil", { from: formatLocalDate(activeFreeze.starts_on, locale), until: formatLocalDate(activeFreeze.ends_on, locale) })
              : t("habits.freeze.pausedFrom", { from: formatLocalDate(activeFreeze.starts_on, locale) })}
        </p>
        {justSaved && (
          <Notice tone="success" live>
            {t("habits.freeze.saved", { me: kind.me ? "yes" : "no", scheduled: scheduled ? "yes" : "no" })}
          </Notice>
        )}
        <Button
          type="button"
          variant="outline"
          className="h-11"
          disabled={resuming}
          onClick={() =>
            startResume(async () => {
              const r = await kind.unfreeze(habitId);
              setResumeError(r.ok ? null : r.message);
              if (r.ok) {
                setJustSaved(false);
                setResumed(scheduled ? "cancelled" : "resumed");
              }
            })
          }
        >
          {resuming
            ? t(scheduled ? "habits.freeze.cancelling" : "habits.freeze.resuming")
            : scheduled
              ? t("habits.freeze.cancel")
              : t(kind.me ? "habits.freeze.resumeMe" : "habits.freeze.resume")}
        </Button>
        {resumeError && <Notice tone="error" live>{resumeError}</Notice>}
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-item">
      {resumed && (
        <Notice tone="success" live>
          {t("habits.freeze.resumed", { what: resumed, me: kind.me ? "yes" : "no" })}
        </Notice>
      )}
      {kind.me && <p className="text-sm text-muted-foreground">{t("habits.freeze.meNote")}</p>}
      {/* Today is sent as empty, so the server uses its own today (this page's may be stale after midnight). */}
      <input type="hidden" name="startsOn" value={startsOn === today ? "" : startsOn} />
      <input type="hidden" name="endsOn" value={endsOn ?? ""} />

      <fieldset className="flex flex-col gap-inner">
        <legend className="text-sm font-semibold">{t("habits.freeze.pauseFrom")}</legend>
        <StartDatePicker value={startsOn} onChange={changeStart} today={today} weekStart={weekStart} />
      </fieldset>

      {endsOn === null ? (
        <button
          type="button"
          onClick={() => setEndsOn(pauseEndQuickPicks(t, startsOn)[0].date)}
          className="flex h-11 items-center justify-center gap-inner rounded-xl border-2 border-dashed border-input text-sm font-semibold text-muted-foreground hover:bg-muted"
        >
          <CalendarPlus aria-hidden className="size-4" />
          {t("habits.freeze.addReturn")}
        </button>
      ) : (
        <fieldset className="flex flex-col gap-inner">
          <legend className="flex w-full items-center justify-between text-sm font-semibold">
            <span>{t("habits.freeze.until")}</span>
            <button
              type="button"
              onClick={() => setEndsOn(null)}
              // 4px icon-to-label (off the scale): a small text button inside the legend line.
              className="flex h-11 items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              <X aria-hidden className="size-3.5" />
              {t("habits.freeze.removeEnd")}
            </button>
          </legend>
          <StartDatePicker
            value={endsOn}
            onChange={setEndsOn}
            today={today}
            min={startsOn}
            weekStart={weekStart}
            quickPicks={pauseEndQuickPicks(t, startsOn)}
          />
        </fieldset>
      )}

      {state.status === "error" && <Notice tone="error" live>{state.message}</Notice>}
      <Button type="submit" className="h-11" disabled={pending}>
        {pending ? t("habits.freeze.pausing") : submitText}
      </Button>
    </form>
  );
}
