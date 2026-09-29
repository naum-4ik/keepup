"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { SaveButton } from "@/components/save-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OnboardingFormState, OnboardingFormValues, Purpose } from "@/lib/profile-schema";
import { pickTimezone } from "@/lib/timezones";
import { cn } from "@/lib/utils";

type Props = {
  action: (state: OnboardingFormState, formData: FormData) => Promise<OnboardingFormState>;
  timezones: string[];
  defaults: OnboardingFormValues;
};

// The emoji are the owner-chosen content of this one choice, not UI icons.
const PURPOSE_CHIPS: { value: Purpose; emoji: string; label: string }[] = [
  { value: "me", emoji: "🙋", label: "Me" },
  { value: "family", emoji: "👨‍👩‍👧", label: "My family" },
  { value: "friends", emoji: "👯", label: "Friends" },
];

const selectClass = "h-11 w-full rounded-xl border border-input bg-transparent px-3 text-base";
const initialState: OnboardingFormState = { status: "idle" };

function detectWeekStart(): "0" | "1" | null {
  const locale = new Intl.Locale(navigator.language) as Intl.Locale & {
    getWeekInfo?: () => { firstDay: number };
    weekInfo?: { firstDay: number };
  };
  const firstDay = locale.getWeekInfo?.().firstDay ?? locale.weekInfo?.firstDay;
  if (firstDay === undefined) return null;
  return firstDay === 7 ? "0" : "1";
}

const cityOf = (tz: string) => (tz.split("/").pop() ?? tz).replaceAll("_", " ");

export function AboutYouForm({ action, timezones, defaults }: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [timezone, setTimezone] = useState(defaults.timezone);
  const [weekStart, setWeekStart] = useState(defaults.weekStart);
  const [purpose, setPurpose] = useState(defaults.purpose);
  const [detected, setDetected] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const timezoneRef = useRef<HTMLSelectElement>(null);
  const weekStartRef = useRef<HTMLSelectElement>(null);
  const detailsId = useId();

  const values = state.status === "error" && state.values ? state.values : defaults;
  const errors = state.status === "error" ? (state.errors ?? {}) : {};
  const showDetails = expanded || Boolean(errors.timezone || errors.weekStart);

  // Time zone and week start come from the browser once, on mount (the server can't know them).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of browser-only values
    setTimezone(pickTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone, timezones));
    const firstDay = detectWeekStart();
    if (firstDay) setWeekStart(firstDay);
    setDetected(true);
  }, [timezones]);

  // The browser resets <form> fields after a server action runs; <select> doesn't re-sync from its
  // `value` prop, so put it back to our state here.
  useEffect(() => {
    if (timezoneRef.current) timezoneRef.current.value = timezone;
    if (weekStartRef.current) weekStartRef.current.value = weekStart;
  }, [state, timezone, weekStart]);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="displayName" className="font-semibold">
          Display name
        </Label>
        <Input
          id="displayName"
          name="displayName"
          defaultValue={values.displayName}
          required
          autoComplete="name"
          className="h-11 rounded-xl px-3"
          aria-invalid={Boolean(errors.displayName)}
          aria-describedby={errors.displayName ? "displayName-error" : undefined}
        />
        {errors.displayName && (
          <p id="displayName-error" className="text-sm text-destructive">
            {errors.displayName}
          </p>
        )}
      </div>

      {!showDetails && (
        <p className={cn("flex min-h-11 flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground", !detected && "invisible")}>
          <span>{cityOf(timezone)}</span>
          <span aria-hidden>·</span>
          <span>weeks start {weekStart === "0" ? "Sunday" : "Monday"}</span>
          <span aria-hidden>·</span>
          <button
            type="button"
            aria-expanded={false}
            aria-controls={detailsId}
            onClick={() => setExpanded(true)}
            className="-mx-2 min-h-11 rounded-lg px-2 font-semibold text-primary hover:bg-accent"
          >
            Change
          </button>
        </p>
      )}

      {/* Both selects stay in the form either way, so the detected values are always submitted. */}
      <div id={detailsId} hidden={!showDetails} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="timezone" className="font-semibold">
            Time zone
          </Label>
          <select
            id="timezone"
            name="timezone"
            ref={timezoneRef}
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
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
          <Label htmlFor="weekStart" className="font-semibold">
            Week starts on
          </Label>
          <select
            id="weekStart"
            name="weekStart"
            ref={weekStartRef}
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)}
            className={selectClass}
            aria-invalid={Boolean(errors.weekStart)}
            aria-describedby={errors.weekStart ? "weekStart-error" : undefined}
          >
            <option value="1">Monday</option>
            <option value="0">Sunday</option>
          </select>
          {errors.weekStart && (
            <p id="weekStart-error" className="text-sm text-destructive">
              {errors.weekStart}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p id="purpose-label" className="text-sm font-semibold">
          Keepup is for… <span className="font-normal text-muted-foreground">(optional)</span>
        </p>
        <input type="hidden" name="purpose" value={purpose} />
        <div role="group" aria-labelledby="purpose-label" className="flex flex-wrap gap-2">
          {PURPOSE_CHIPS.map((chip) => {
            const pressed = purpose === chip.value;
            return (
              <button
                key={chip.value}
                type="button"
                aria-pressed={pressed}
                onClick={() => setPurpose(pressed ? "" : chip.value)}
                className={cn(
                  "flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors",
                  pressed
                    ? "border-primary bg-accent text-foreground ring-1 ring-primary hover:brightness-95"
                    : "border-input bg-card text-foreground hover:bg-muted",
                )}
              >
                <span aria-hidden>{chip.emoji}</span>
                {chip.label}
              </button>
            );
          })}
        </div>
        {errors.purpose && <p className="text-sm text-destructive">{errors.purpose}</p>}
      </div>

      {state.status === "error" && state.message && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <SaveButton state={state} pending={pending} label="Continue" />
        {/* Plain text until /privacy exists (M6), then a link. */}
        <p className="text-center text-xs text-muted-foreground">By continuing, you agree to the Privacy Policy</p>
      </div>
    </form>
  );
}
