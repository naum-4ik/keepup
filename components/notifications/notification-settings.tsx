// components/notifications/notification-settings.tsx
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { forgetPushSubscription, pauseAll, setCategory, setReminderHour } from "@/app/(app)/profile/settings/notification-actions";
import { currentEndpoint, TurnOnReminders } from "@/components/notifications/turn-on-reminders";
import { InfoHint } from "@/components/info-hint";
import { Button } from "@/components/ui/button";
import { APPROVALS_OFF_NOTE, NOTIFICATION_CATEGORIES, PAUSE_CHOICES } from "@/lib/notification-categories";
import type { NotificationSettings } from "@/lib/notification-settings";
import { browserSubscription, removeDevice } from "@/lib/push-support";

const selectClass = "h-11 rounded-xl border border-input bg-transparent px-3 text-base";
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;

function pausedLabel(until: string, timeZone: string): string {
  if (until === "infinity") return "Paused until you turn them back on";
  return `Paused until ${new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(until))}`;
}

export function NotificationSettingsCard({ settings }: { settings: NotificationSettings }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [here, setHere] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);
  // Turned on in this visit: the confirmation says when the summary comes, and takes focus (the
  // dialog it came from closes as this device appears under Devices).
  const [justOn, setJustOn] = useState(false);
  const confirmation = useRef<HTMLParagraphElement>(null);
  const paused = settings.mutedUntil && (settings.mutedUntil === "infinity" || (now !== null && Date.parse(settings.mutedUntil) > now));

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the clock is browser-only, read after mount
    setNow(Date.now());
    void currentEndpoint().then(setHere);
  }, [settings]);

  const run = (action: () => Promise<{ ok: true } | { ok: false; message: string }>) =>
    startTransition(async () => {
      setError(null);
      const r = await action();
      if (!r.ok) setError(r.message);
    });

  const thisDeviceOn = here !== null && settings.devices.some((d) => d.endpoint === here);

  useEffect(() => {
    if (justOn && thisDeviceOn) confirmation.current?.focus();
  }, [justOn, thisDeviceOn]);

  return (
    <section aria-label="Notifications" className="flex flex-col gap-5 rounded-2xl bg-card p-6 shadow-soft">
      <h2 className="text-base font-bold">Notifications</h2>

      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-1">
          <label htmlFor="reminderHour" className="text-sm font-semibold">Daily reminder</label>
          <InfoHint text="When your daily summary arrives." />
        </div>
        <select id="reminderHour" className={selectClass} defaultValue={settings.reminderHour} key={settings.reminderHour}
          disabled={pending} onChange={(e) => run(() => setReminderHour(Number(e.target.value)))}>
          {HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
        </select>
        {thisDeviceOn ? (
          <p ref={confirmation} tabIndex={-1} role="status" className="text-sm text-muted-foreground outline-none">
            {justOn ? `Reminders are on for this device ✓ Your daily summary arrives at ${hourLabel(settings.reminderHour)}.` : "Reminders are on for this device ✓"}
          </p>
        ) : (
          <TurnOnReminders
            hour={settings.reminderHour}
            onDone={() => {
              setJustOn(true);
              void currentEndpoint().then(setHere);
            }}
          />
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Pause all</h3>
        {paused ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm">{pausedLabel(settings.mutedUntil!, settings.timezone)}</p>
            <Button type="button" variant="outline" className="h-11" disabled={pending} onClick={() => run(() => pauseAll("resume"))}>Resume</Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {PAUSE_CHOICES.map((c) => (
              <Button key={c.choice} type="button" variant="outline" className="h-11" disabled={pending} onClick={() => run(() => pauseAll(c.choice))}>
                {c.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-semibold">What to send</legend>
        {NOTIFICATION_CATEGORIES.map((c) => {
          const on = !settings.disabled.includes(c.key);
          return (
            <label key={c.key} className="flex min-h-11 items-start gap-3">
              <input type="checkbox" className="mt-1 size-5 accent-primary" defaultChecked={on} key={String(on)} disabled={pending}
                onChange={(e) => run(() => setCategory(c.key, e.target.checked))} />
              <span className="flex flex-col">
                <span className="font-semibold">{c.label}</span>
                <span className="text-xs text-muted-foreground">{c.key === "approvals" && !on ? APPROVALS_OFF_NOTE : c.hint}</span>
              </span>
            </label>
          );
        })}
      </fieldset>

      {settings.devices.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Devices</h3>
          <ul className="flex flex-col gap-2">
            {settings.devices.map((d) => (
              <li key={d.endpoint} className="flex min-h-11 items-center gap-3">
                <span className="flex-1 text-sm">
                  {d.label}
                  {d.endpoint === here && <span className="text-muted-foreground"> · this device</span>}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  aria-label={`Remove ${d.label}${d.endpoint === here ? " (this device)" : ""}`}
                  disabled={pending}
                  onClick={() =>
                    run(() => removeDevice({ endpoint: d.endpoint, here, forget: forgetPushSubscription, getSubscription: browserSubscription }))
                  }
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
