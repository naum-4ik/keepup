"use client";

import { useActionState, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { InfoHint } from "@/components/info-hint";
import { PrivacyConsent } from "@/components/privacy-consent";
import { SaveButton } from "@/components/save-button";
import { TimezonePicker } from "@/components/timezone-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorTexts } from "@/lib/field-error";
import { useT } from "@/lib/i18n/client";
import { purposeForGroupKind, type GroupKind } from "@/lib/group-schema";
import type { OnboardingFormState, OnboardingFormValues, Purpose } from "@/lib/profile-schema";
import { weekdayLabels } from "@/lib/weekdays";
import { cityOf, pickTimezone } from "@/lib/timezones";
import { cn } from "@/lib/utils";

type Props = {
  action: (state: OnboardingFormState, formData: FormData) => Promise<OnboardingFormState>;
  timezones: string[];
  defaults: OnboardingFormValues;
  // Set when the user came from an invite: the group sets the purpose, so the picker is hidden.
  invitedTo?: { id: string; name: string; kind: GroupKind };
};

// The emoji are the owner-chosen content of this one choice, not UI icons.
const PURPOSE_CHIPS: { value: Purpose; emoji: string }[] = [
  { value: "me", emoji: "🙋" },
  { value: "family", emoji: "👨‍👩‍👧" },
  { value: "friends", emoji: "👯" },
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

// profile.summary's parts as separate flex items, as before the shared message: the city, a "·" screen
// readers skip, and the week start.
const summaryTags = {
  place: (c: ReactNode) => <span>{c}</span>,
  dot: (c: ReactNode) => <span aria-hidden>{c}</span>,
  week: (c: ReactNode) => <span>{c}</span>,
};

export function AboutYouForm({ action, timezones, defaults, invitedTo }: Props) {
  const { t, rich, locale } = useT();
  const weekdays = weekdayLabels(locale, "long");
  const [state, formAction, pending] = useActionState(action, initialState);
  const [timezone, setTimezone] = useState(defaults.timezone);
  const [weekStart, setWeekStart] = useState(defaults.weekStart);
  const [purpose, setPurpose] = useState(defaults.purpose);
  const [detected, setDetected] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const weekStartRef = useRef<HTMLSelectElement>(null);
  const detailsId = useId();

  const values = state.status === "error" && state.values ? state.values : defaults;
  const errors = state.status === "error" ? errorTexts(t, state.errors) : {};
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
    if (weekStartRef.current) weekStartRef.current.value = weekStart;
  }, [state, weekStart]);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="displayName" className="font-semibold">
          {t("profile.form.displayName")}
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
          {rich("profile.summary", {
            city: cityOf(timezone),
            weekStart: weekStart === "0" ? "sun" : "mon",
            ...summaryTags,
          })}
          <span aria-hidden>·</span>
          <button
            type="button"
            aria-expanded={false}
            aria-controls={detailsId}
            onClick={() => setExpanded(true)}
            className="-mx-2 min-h-11 rounded-lg px-2 font-semibold text-primary hover:bg-accent"
          >
            {t("common.change")}
          </button>
        </p>
      )}

      {/* Both fields stay in the form either way, so the detected values are always submitted. */}
      <div id={detailsId} hidden={!showDetails} className="flex flex-col gap-4">
        <TimezonePicker name="timezone" value={timezone} onChange={setTimezone} timezones={timezones} error={errors.timezone} />

        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-1">
            <Label htmlFor="weekStart" className="font-semibold">
              {t("profile.form.weekStart")}
            </Label>
            <InfoHint text={t("profile.form.weekStartHint")} />
          </div>
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
            <option value="1">{weekdays[1]}</option>
            <option value="0">{weekdays[0]}</option>
          </select>
          {errors.weekStart && (
            <p id="weekStart-error" className="text-sm text-destructive">
              {errors.weekStart}
            </p>
          )}
        </div>
      </div>

      {invitedTo ? (
        <>
          <input type="hidden" name="purpose" value={purposeForGroupKind(invitedTo.kind)} />
          <input type="hidden" name="joined" value={invitedTo.id} />
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <p id="purpose-label" className="text-sm font-semibold">
            {rich("onboarding.purposeLabel", { muted: (c: ReactNode) => <span className="font-normal text-muted-foreground">{c}</span> })}
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
                  {t(`onboarding.purpose.${chip.value}`)}
                </button>
              );
            })}
          </div>
          {errors.purpose && <p className="text-sm text-destructive">{errors.purpose}</p>}
        </div>
      )}

      {state.status === "error" && state.message && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <SaveButton state={state} pending={pending} label={t("common.continue")} />
        <PrivacyConsent />
      </div>
    </form>
  );
}
