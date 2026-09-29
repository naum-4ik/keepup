"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProfileFormState, ProfileFormValues } from "@/lib/profile-schema";
import { pickTimezone } from "@/lib/timezones";

type Props = {
  action: (state: ProfileFormState, formData: FormData) => Promise<ProfileFormState>;
  timezones: string[];
  defaults: ProfileFormValues;
  detectTimezone?: boolean;
  submitLabel: string;
};

const selectClass = "h-11 rounded-lg border border-input bg-transparent px-3 text-sm";
const initialState: ProfileFormState = { status: "idle" };

export function ProfileForm({ action, timezones, defaults, detectTimezone = false, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const timezoneRef = useRef<HTMLSelectElement>(null);
  const weekStartRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (detectTimezone && timezoneRef.current) {
      timezoneRef.current.value = pickTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone, timezones);
    }
    if (detectTimezone) {
      const locale = new Intl.Locale(navigator.language) as Intl.Locale & {
        getWeekInfo?: () => { firstDay: number };
        weekInfo?: { firstDay: number };
      };
      const firstDay = locale.getWeekInfo?.().firstDay ?? locale.weekInfo?.firstDay;
      if (weekStartRef.current && firstDay !== undefined) {
        weekStartRef.current.value = firstDay === 7 ? "0" : "1";
      }
    }
  }, [detectTimezone, timezones]);

  // React resets uncontrolled fields to their defaultValue after an action. Inputs re-sync fine because
  // React updates defaultValue on every render; <select> doesn't, so each select is keyed by its own
  // value below to force a remount (with the fresh defaultValue baked in) instead of remounting the form.
  const values = state.status === "error" && state.values ? state.values : defaults;
  const errors = state.status === "error" ? (state.errors ?? {}) : {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="displayName" className="font-semibold">
          Display name
        </Label>
        <Input
          id="displayName"
          name="displayName"
          defaultValue={values.displayName}
          required
          aria-invalid={Boolean(errors.displayName)}
          aria-describedby={errors.displayName ? "displayName-error" : undefined}
        />
        {errors.displayName && (
          <p id="displayName-error" className="text-sm text-destructive">
            {errors.displayName}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="timezone" className="font-semibold">
          Time zone
        </Label>
        <select
          key={values.timezone}
          id="timezone"
          name="timezone"
          ref={timezoneRef}
          defaultValue={values.timezone}
          className={selectClass}
          aria-invalid={Boolean(errors.timezone)}
          aria-describedby={errors.timezone ? "timezone-error" : undefined}
        >
          {timezones.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        {errors.timezone && (
          <p id="timezone-error" className="text-sm text-destructive">
            {errors.timezone}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reminderHour" className="font-semibold">
          Daily reminder
        </Label>
        <select
          key={values.reminderHour}
          id="reminderHour"
          name="reminderHour"
          defaultValue={values.reminderHour}
          className={selectClass}
          aria-invalid={Boolean(errors.reminderHour)}
          aria-describedby={errors.reminderHour ? "reminderHour-error" : undefined}
        >
          {Array.from({ length: 24 }, (_, h) => (
            <option key={h} value={String(h)}>
              {String(h).padStart(2, "0")}:00
            </option>
          ))}
        </select>
        {errors.reminderHour && (
          <p id="reminderHour-error" className="text-sm text-destructive">
            {errors.reminderHour}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="weekStart" className="font-semibold">
          Week starts on
        </Label>
        <select
          id="weekStart"
          name="weekStart"
          ref={weekStartRef}
          key={values.weekStart}
          defaultValue={values.weekStart}
          className={selectClass}
          aria-invalid={Boolean(errors.weekStart)}
          aria-describedby={errors.weekStart ? "weekStart-error" : undefined}
        >
          <option value="1">Monday</option>
          <option value="0">Sunday</option>
        </select>
        <p className="text-xs text-muted-foreground">Applies to weekly habits you create from now on.</p>
        {errors.weekStart && (
          <p id="weekStart-error" className="text-sm text-destructive">
            {errors.weekStart}
          </p>
        )}
      </div>

      {state.status === "error" && state.message && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
      {state.status === "saved" && (
        <p role="status" className="text-sm text-muted-foreground">
          Saved.
        </p>
      )}

      <Button type="submit" disabled={pending} className="h-11">
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
