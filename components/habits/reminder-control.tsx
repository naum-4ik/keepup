"use client";

import { useState, useTransition } from "react";
import { setHabitMute, setHabitReminder } from "@/app/(app)/habits/actions";
import { TurnOnReminders } from "@/components/notifications/turn-on-reminders";
import { Button } from "@/components/ui/button";
import { DEMO_OFF } from "@/lib/demo-copy";
import type { HabitSettings } from "@/lib/habit-settings";
import { QUARTER_HOURS, type ReminderMode } from "@/lib/reminder-mode";

const MODES: { mode: ReminderMode; label: string }[] = [
  { mode: "summary", label: "In my daily summary" },
  { mode: "time", label: "At a time" },
  { mode: "off", label: "No reminders" },
];

export function ReminderControl({ habitId, settings, isDemo = false }: { habitId: string; settings: HabitSettings; isDemo?: boolean }) {
  const [mode, setMode] = useState<ReminderMode>(settings.mode);
  const [time, setTime] = useState(settings.remindAt ?? "08:00");
  const [muted, setMuted] = useState(settings.muted);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<{ ok: true } | { ok: false; message: string }>, onFail?: () => void) =>
    startTransition(async () => {
      setStatus("");
      setError("");
      const r = await action();
      if (r.ok) setStatus("Saved ✓");
      else {
        onFail?.();
        setError(r.message);
      }
    });

  return (
    <div role="group" aria-label="Reminders" className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">When to remind you</legend>
        {MODES.map((m) => (
          <div key={m.mode} className="flex flex-col gap-2">
            <label className="flex min-h-11 items-center gap-3">
              <input type="radio" name={`remind-${habitId}`} className="size-5 accent-primary" checked={mode === m.mode} onChange={() => setMode(m.mode)} />
              <span className="font-semibold">{m.label}</span>
            </label>
            {m.mode === "time" && mode === "time" && (
              // A select, not a time input: the scheduler works in quarter hours and iOS ignores `step`.
              <select aria-label="Reminder time" value={time} onChange={(e) => setTime(e.target.value)}
                className="h-11 w-36 rounded-xl border border-input bg-transparent px-3 text-base">
                {QUARTER_HOURS.map((q) => <option key={q} value={q}>{q}</option>)}
              </select>
            )}
          </div>
        ))}
        <Button type="button" className="h-11 w-fit" disabled={pending} onClick={() => run(() => setHabitReminder(habitId, mode, mode === "time" ? time : null))}>
          Save
        </Button>
      </fieldset>

      <label className="flex min-h-11 items-start gap-3">
        <input type="checkbox" className="mt-1 size-5 accent-primary" checked={muted} disabled={pending}
          onChange={(e) => {
            const next = e.target.checked;
            setMuted(next);
            run(() => setHabitMute(habitId, next), () => setMuted(!next));
          }} />
        <span className="flex flex-col">
          <span className="font-semibold">Mute this habit</span>
          <span className="text-xs text-muted-foreground">No notifications about it, not even from your group. It stays in your Inbox.</span>
        </span>
      </label>

      {!settings.hasDevice && mode !== "off" &&
        (isDemo ? (
          <p className="text-sm text-muted-foreground">{DEMO_OFF}</p>
        ) : (
          <TurnOnReminders hour={settings.reminderHour} label="Turn on reminders on this device" />
        ))}
      {/* Always rendered so screen readers announce the text when it changes. */}
      <p role="status" className="text-sm text-done">{status}</p>
      <p role="alert" className="text-sm text-destructive">{error}</p>
    </div>
  );
}
