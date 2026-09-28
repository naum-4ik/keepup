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

const selectClass = "h-9 rounded-md border border-input bg-background px-3 text-sm";
const initialState: ProfileFormState = { status: "idle" };

export function ProfileForm({ action, timezones, defaults, detectTimezone = false, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const timezoneRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (detectTimezone && timezoneRef.current) {
      timezoneRef.current.value = pickTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone, timezones);
    }
  }, [detectTimezone, timezones]);

  // React resets the form after an action; defaults come back from the state so input survives errors.
  const values = state.status === "error" && state.values ? state.values : defaults;
  const errors = state.status === "error" ? (state.errors ?? {}) : {};

  return (
    <form key={JSON.stringify(values)} action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="displayName">Display name</Label>
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
        <Label htmlFor="timezone">Time zone</Label>
        <select
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
        <Label htmlFor="reminderHour">Daily reminder</Label>
        <select
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

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
