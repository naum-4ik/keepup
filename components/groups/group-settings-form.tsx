"use client";

import { useActionState, useState } from "react";
import type { GroupActionState } from "@/app/(app)/groups/actions";
import { SaveButton } from "@/components/save-button";
import { TimezonePicker } from "@/components/timezone-picker";

const initialState: GroupActionState = { status: "idle" };
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
  const [state, formAction, pending] = useActionState(action, initialState);
  const [timezone, setTimezone] = useState(initialTimezone);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <TimezonePicker name="timezone" value={timezone} onChange={setTimezone} timezones={timezones} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="group-week-start" className="text-sm font-semibold">Week starts on</label>
        <select id="group-week-start" name="weekStart" key={weekStart} defaultValue={String(weekStart)} className={selectClass}>
          <option value="1">Monday</option>
          <option value="0">Sunday</option>
        </select>
      </div>
      <p className="text-xs text-muted-foreground">Applies to new weekly habits.</p>
      {state.status === "error" && <p role="alert" className="text-sm text-destructive">{state.message}</p>}
      <SaveButton state={state} pending={pending} />
    </form>
  );
}
