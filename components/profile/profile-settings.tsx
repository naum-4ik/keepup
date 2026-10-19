"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { saveProfileSetting } from "@/app/(app)/profile/settings/actions";
import { InfoHint } from "@/components/info-hint";
import { SettingStatus, useSettingSave } from "@/components/profile/setting-status";
import { TimezonePicker } from "@/components/timezone-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Section } from "@/components/ui/section";
import type { ProfileSetting } from "@/lib/profile-schema";

type Saved = { displayName: string; timezone: string; weekStart: string };

// 12 px sides to match the 12 px radius (as Notice does).
const selectClass = "h-11 rounded-xl border border-input bg-transparent px-3 text-base";

// Settings → Your profile. The time zone and the week start save when they change. The name is typed,
// so saving each keystroke would show half a name to the group: it has its own Save right beside it
// (in reach at 320, the first control on the page), and Enter saves too.
export function ProfileSettings({ timezones, saved }: { timezones: string[]; saved: Saved }) {
  const tx = useTranslations("profile.form");
  const ts = useTranslations("settings");
  return (
    <Section title={ts("sections.profile")}>
      <DisplayName saved={saved.displayName} />
      <Timezone saved={saved.timezone} timezones={timezones} />
      <WeekStart saved={saved.weekStart} label={tx("weekStart")} hint={tx("weekStartHint")} note={tx("weekStartNote")} monday={tx("monday")} sunday={tx("sunday")} />
    </Section>
  );
}

const save = (field: ProfileSetting, value: string) => () => saveProfileSetting(field, value);

function DisplayName({ saved }: { saved: string }) {
  const tx = useTranslations("profile.form");
  const tc = useTranslations("common");
  const { state, pending, save: run } = useSettingSave("save");
  const [value, setValue] = useState(saved);
  const invalid = state.status === "error";
  return (
    <form
      className="flex flex-col gap-inner"
      onSubmit={(e) => {
        e.preventDefault();
        // The typed name stays in the field whatever happens.
        run(save("displayName", value));
      }}
    >
      <Label htmlFor="displayName" className="font-semibold">
        {tx("displayName")}
      </Label>
      <div className="flex items-center gap-inner">
        <Input
          id="displayName"
          name="displayName"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
          autoComplete="nickname"
          className="h-11 min-w-0 flex-1 rounded-xl px-3 text-base"
          aria-invalid={invalid}
          aria-describedby="displayName-status"
        />
        <Button type="submit" className="h-11 shrink-0" disabled={pending}>
          {pending ? tc("saving") : tc("save")}
        </Button>
      </div>
      <SettingStatus state={state} id="displayName-status" />
    </form>
  );
}

function Timezone({ saved, timezones }: { saved: string; timezones: string[] }) {
  const { state, save: run } = useSettingSave();
  const [value, setValue] = useState(saved);
  const [last, setLast] = useState(saved);
  return (
    <div className="flex flex-col gap-inner">
      <TimezonePicker
        name="timezone"
        value={value}
        onChange={(next) => {
          setValue(next);
          run(save("timezone", next), { saved: () => setLast(next), failed: () => setValue(last) });
        }}
        timezones={timezones}
        showChangeNote
        describedBy="timezone-status"
      />
      <SettingStatus state={state} id="timezone-status" />
    </div>
  );
}

function WeekStart({ saved, label, hint, note, monday, sunday }: { saved: string; label: string; hint: string; note: string; monday: string; sunday: string }) {
  const { state, save: run } = useSettingSave();
  const [value, setValue] = useState(saved);
  const [last, setLast] = useState(saved);
  return (
    <div className="flex flex-col gap-inner">
      {/* The label and its (i): one glyph pair, 4 px. */}
      <div className="flex flex-wrap items-center gap-1">
        <Label htmlFor="weekStart" className="font-semibold">
          {label}
        </Label>
        <InfoHint text={hint} />
      </div>
      <select
        id="weekStart"
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          run(save("weekStart", next), { saved: () => setLast(next), failed: () => setValue(last) });
        }}
        className={selectClass}
        aria-describedby="weekStart-note weekStart-status"
      >
        <option value="1">{monday}</option>
        <option value="0">{sunday}</option>
      </select>
      <p id="weekStart-note" className="text-xs text-muted-foreground">
        {note}
      </p>
      <SettingStatus state={state} id="weekStart-status" />
    </div>
  );
}
