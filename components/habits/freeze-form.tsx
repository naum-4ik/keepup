"use client";

import { useActionState, useState, useTransition } from "react";
import { CalendarPlus, X } from "lucide-react";
import { freezeHabit, unfreezeHabit, type FormActionState } from "@/app/(app)/habits/actions";
import { StartDatePicker } from "@/components/habits/start-date-picker";
import { Button } from "@/components/ui/button";
import { formatLocalDate } from "@/lib/dates";
import type { HabitFreeze } from "@/lib/habits";
import { pauseEndQuickPicks } from "@/lib/schedule";

const initialState: FormActionState = { status: "idle" };

export function FreezeForm({
  habitId,
  today,
  weekStart,
  activeFreeze,
}: {
  habitId: string;
  today: string;
  weekStart: 0 | 1;
  activeFreeze: HabitFreeze | null;
}) {
  const [state, formAction, pending] = useActionState(freezeHabit.bind(null, habitId), initialState);
  const [resuming, startResume] = useTransition();
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [startsOn, setStartsOn] = useState(today);
  const [endsOn, setEndsOn] = useState<string | null>(null);

  // Moving the start date past an already-chosen end date would leave an invalid range
  // (the server rejects ends_on < starts_on); clear it instead of submitting something invalid.
  const changeStart = (date: string) => {
    setStartsOn(date);
    setEndsOn((e) => (e !== null && e < date ? null : e));
  };

  if (activeFreeze) {
    const scheduled = activeFreeze.starts_on > today;
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm">
          {scheduled
            ? `Pause starts ${formatLocalDate(activeFreeze.starts_on)}`
            : `Paused from ${formatLocalDate(activeFreeze.starts_on)}${
                activeFreeze.ends_on ? ` until ${formatLocalDate(activeFreeze.ends_on)}` : ""
              }`}
        </p>
        <Button
          type="button"
          variant="outline"
          className="h-11"
          disabled={resuming}
          onClick={() =>
            startResume(async () => {
              const r = await unfreezeHabit(habitId);
              setResumeError(r.ok ? null : r.message);
            })
          }
        >
          {scheduled ? "Cancel pause" : "Resume"}
        </Button>
        {resumeError && <p role="alert" className="text-sm text-destructive">{resumeError}</p>}
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">Going away? Pause it and your streak waits for you.</p>
      <input type="hidden" name="startsOn" value={startsOn} />
      <input type="hidden" name="endsOn" value={endsOn ?? ""} />

      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-sm font-semibold">Pause from</legend>
        <StartDatePicker value={startsOn} onChange={changeStart} today={today} weekStart={weekStart} />
      </fieldset>

      {endsOn === null ? (
        <button
          type="button"
          onClick={() => setEndsOn(pauseEndQuickPicks(startsOn)[0].date)}
          className="flex h-11 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-input text-sm font-semibold text-muted-foreground hover:bg-muted"
        >
          <CalendarPlus aria-hidden className="size-4" />
          Set an end date
        </button>
      ) : (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="flex w-full items-center justify-between text-sm font-semibold">
            <span>Until</span>
            <button
              type="button"
              onClick={() => setEndsOn(null)}
              className="flex h-11 items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              <X aria-hidden className="size-3.5" />
              Remove end date
            </button>
          </legend>
          <StartDatePicker
            value={endsOn}
            onChange={setEndsOn}
            today={today}
            min={startsOn}
            weekStart={weekStart}
            quickPicks={pauseEndQuickPicks(startsOn)}
          />
        </fieldset>
      )}

      {state.status === "error" && <p role="alert" className="text-sm text-destructive">{state.message}</p>}
      <Button type="submit" variant="outline" className="h-11" disabled={pending}>
        Pause habit
      </Button>
    </form>
  );
}
