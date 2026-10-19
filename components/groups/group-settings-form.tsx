"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import type { GroupActionState } from "@/app/(app)/groups/actions";
import { SaveButton } from "@/components/save-button";
import { TimezonePicker } from "@/components/timezone-picker";

const initialState: GroupActionState = { status: "idle" };
// 12 px sides to match the 12 px radius (as Notice does).
const selectClass = "h-11 rounded-xl border border-input bg-transparent px-3 text-base";

export function GroupSettingsForm({
  timezone: initialTimezone,
  weekStart,
  timezones,
  action,
}: {
  timezone: string;
  weekStart: 0 | 1;
  timezones: string[];
  action: (prev: GroupActionState, formData: FormData) => Promise<GroupActionState>;
}) {
  const t = useTranslations("groups.settingsForm");
  const tp = useTranslations("profile.form");
  const [state, formAction, pending] = useActionState(action, initialState);
  const [timezone, setTimezone] = useState(initialTimezone);

  return (
    <form action={formAction} className="flex flex-col gap-item">
      <TimezonePicker name="timezone" value={timezone} onChange={setTimezone} timezones={timezones} />
      <div className="flex flex-col gap-inner">
        <label htmlFor="group-week-start" className="text-sm font-semibold">{tp("weekStart")}</label>
        <select id="group-week-start" name="weekStart" key={weekStart} defaultValue={String(weekStart)} className={selectClass}>
          <option value="1">{tp("monday")}</option>
          <option value="0">{tp("sunday")}</option>
        </select>
      </div>
      <p className="text-xs text-muted-foreground">{t("note")}</p>
      {state.status === "error" && <p role="alert" className="text-sm text-destructive">{state.message}</p>}
      <SaveButton state={state} pending={pending} />
    </form>
  );
}
