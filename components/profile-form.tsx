"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { InfoHint } from "@/components/info-hint";
import { SaveButton } from "@/components/save-button";
import { TimezonePicker } from "@/components/timezone-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorTexts } from "@/lib/field-error";
import { useT } from "@/lib/i18n/client";
import type { ProfileFormState, ProfileFormValues } from "@/lib/profile-schema";

type Props = {
  action: (state: ProfileFormState, formData: FormData) => Promise<ProfileFormState>;
  timezones: string[];
  defaults: ProfileFormValues;
  submitLabel: string;
};

const selectClass = "h-11 rounded-xl border border-input bg-transparent px-3 text-base";
const initialState: ProfileFormState = { status: "idle" };

export function ProfileForm({ action, timezones, defaults, submitLabel }: Props) {
  const { t } = useT();
  const tp = useTranslations("profile.form");
  const [state, formAction, pending] = useActionState(action, initialState);
  // React resets uncontrolled fields to their defaultValue after an action. Inputs re-sync fine because
  // React updates defaultValue on every render; <select> doesn't, so each select is keyed by its own
  // value below to force a remount (with the fresh defaultValue baked in) instead of remounting the form.
  const values = state.status === "error" && state.values ? state.values : defaults;
  const errors = state.status === "error" ? errorTexts(t, state.errors) : {};
  const [timezone, setTimezone] = useState(defaults.timezone);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="displayName" className="font-semibold">
          {tp("displayName")}
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

      <TimezonePicker
        name="timezone"
        value={timezone}
        onChange={setTimezone}
        timezones={timezones}
        error={errors.timezone}
        showChangeNote
      />

      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-1">
          <Label htmlFor="weekStart" className="font-semibold">
            {tp("weekStart")}
          </Label>
          <InfoHint text={tp("weekStartHint")} />
        </div>
        <select
          id="weekStart"
          name="weekStart"
          key={values.weekStart}
          defaultValue={values.weekStart}
          className={selectClass}
          aria-invalid={Boolean(errors.weekStart)}
          aria-describedby={errors.weekStart ? "weekStart-error" : undefined}
        >
          <option value="1">{tp("monday")}</option>
          <option value="0">{tp("sunday")}</option>
        </select>
        <p className="text-xs text-muted-foreground">{tp("weekStartNote")}</p>
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

      <SaveButton state={state} pending={pending} label={submitLabel} />
    </form>
  );
}
