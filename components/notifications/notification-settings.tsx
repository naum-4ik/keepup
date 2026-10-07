// components/notifications/notification-settings.tsx
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { forgetPushSubscription, pauseAll, setDelivery, setReminderHour } from "@/app/(app)/profile/settings/notification-actions";
import { currentEndpoint, TurnOnReminders } from "@/components/notifications/turn-on-reminders";
import { InfoHint } from "@/components/info-hint";
import { Button } from "@/components/ui/button";
import { DEMO_OFF } from "@/lib/demo-copy";
import { GENERIC_ERROR } from "@/lib/habit-errors";
import {
  APPROVALS_OFF_NOTE, DELIVERIES, IPHONE_SOUND_HINT, NOTIFICATION_CATEGORIES, PAUSE_CHOICES, reminderHourHint, reminderStatus,
  type CategoryKey, type Delivery,
} from "@/lib/notification-categories";
import type { NotificationSettings } from "@/lib/notification-settings";
import { browserSubscription, iosVersion, removeDevice } from "@/lib/push-support";
import { cn } from "@/lib/utils";

const selectClass = "h-11 rounded-xl border border-input bg-transparent px-3 text-base";
// A segmented row of three pills (radios): fits 390px, each a 44px target. Same look as the habit form's chips.
const pillClass =
  "relative flex h-11 cursor-pointer items-center justify-center rounded-full border border-border px-2 text-sm font-semibold has-checked:border-primary has-checked:bg-accent has-checked:text-accent-foreground has-focus-visible:ring-2 has-focus-visible:ring-ring has-disabled:cursor-default has-disabled:opacity-60";
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;

function pausedUntil(until: string, timeZone: string): string {
  if (until === "infinity") return "you turn them back on";
  return new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(until));
}

// isDemo: a demo login can't save a push device, so it never sees the browser's permission prompt.
export function NotificationSettingsCard({ settings, isDemo = false }: { settings: NotificationSettings; isDemo?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [here, setHere] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [iphone, setIphone] = useState(false);
  // Turned on in this visit: the confirmation says when the summary comes, and takes focus (the
  // dialog it came from closes as this device appears under Devices).
  const [justOn, setJustOn] = useState(false);
  const confirmation = useRef<HTMLParagraphElement>(null);
  const paused = settings.mutedUntil && (settings.mutedUntil === "infinity" || (now !== null && Date.parse(settings.mutedUntil) > now));

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the clock is browser-only, read after mount
    setNow(Date.now());
    setIphone(iosVersion(navigator.userAgent, navigator.maxTouchPoints ?? 0) !== null);
    void currentEndpoint().then(setHere);
  }, [settings]);

  const run = (action: () => Promise<{ ok: true } | { ok: false; message: string }>, onRefused?: () => void) =>
    startTransition(async () => {
      setError(null);
      const r = await action();
      if (!r.ok) {
        setError(r.message);
        onRefused?.();
      }
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
          <InfoHint text={reminderHourHint(settings.devices.length > 0)} />
        </div>
        <select id="reminderHour" className={selectClass} defaultValue={settings.reminderHour} key={settings.reminderHour}
          disabled={pending} onChange={(e) => run(() => setReminderHour(Number(e.target.value)))}>
          {HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
        </select>
        {thisDeviceOn ? (
          <p ref={confirmation} tabIndex={-1} role="status" className="text-sm text-muted-foreground outline-none">
            {reminderStatus({
              pausedUntil: paused ? pausedUntil(settings.mutedUntil!, settings.timezone) : null,
              delivery: settings.delivery.reminders,
              arrivesAt: justOn ? hourLabel(settings.reminderHour) : null,
            })}
          </p>
        ) : isDemo ? (
          <p className="text-sm text-muted-foreground">{DEMO_OFF}</p>
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
            <p className="text-sm">Paused until {pausedUntil(settings.mutedUntil!, settings.timezone)}</p>
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

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-sm font-semibold">What to send</legend>
        {NOTIFICATION_CATEGORIES.map((c) => (
          <DeliveryChoice key={c.key} category={c.key} label={c.label} hint={c.hint} saved={settings.delivery[c.key]} onError={setError} />
        ))}
        {iphone && <p className="text-sm text-muted-foreground">{IPHONE_SOUND_HINT}</p>}
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

// How long arrowing through the pills waits before saving: one save for where the person stops.
export const DELIVERY_SAVE_DELAY_MS = 400;

// One category's three pills. Arrow keys move through them (a radio group): the pill moved to is
// checked at once and keeps focus. Nothing is disabled or remounted while saving (a disabled radio
// drops focus); the save goes 400 ms after the last change, and a refused one goes back to what is
// saved. A save still waiting when the page is left is sent then.
function DeliveryChoice({ category, label, hint, saved, onError }: {
  category: CategoryKey;
  label: string;
  hint: string;
  saved: Delivery;
  onError: (message: string | null) => void;
}) {
  const [value, setValue] = useState<Delivery>(saved);
  const [saving, setSaving] = useState(false);
  // Another category's save refreshes the page: follow what is saved, unless a change here is waiting.
  const [seen, setSeen] = useState(saved);
  if (seen !== saved) {
    setSeen(saved);
    if (!saving) setValue(saved);
  }
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waiting = useRef<Delivery | null>(null);
  const latest = useRef(0);
  const savedRef = useRef(saved);
  useEffect(() => {
    savedRef.current = saved;
  }, [saved]);

  useEffect(
    () => () => {
      if (timer.current === null || waiting.current === null) return;
      clearTimeout(timer.current);
      void setDelivery(category, waiting.current);
    },
    [category],
  );

  function choose(next: Delivery) {
    setValue(next);
    setSaving(true);
    onError(null);
    waiting.current = next;
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      timer.current = null;
      waiting.current = null;
      const n = ++latest.current;
      const r = await setDelivery(category, next).catch(() => ({ ok: false as const, message: GENERIC_ERROR }));
      // A newer change took over: its own save decides.
      if (n !== latest.current || timer.current !== null) return;
      if (!r.ok) {
        onError(r.message);
        setValue(savedRef.current);
      }
      setSaving(false);
    }, DELIVERY_SAVE_DELAY_MS);
  }

  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={`delivery-${category}-hint`} aria-busy={saving || undefined}>
      <legend className="font-semibold">{label}</legend>
      <div className="flex items-start gap-2">
        <p id={`delivery-${category}-hint`} className="flex-1 text-xs text-muted-foreground">
          {category === "approvals" && value === "inbox" ? APPROVALS_OFF_NOTE : hint}
        </p>
        {/* Seen while the change waits or is being saved (screen readers get aria-busy). */}
        {saving && (
          <span aria-hidden data-testid={`delivery-${category}-saving`} className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin motion-reduce:animate-none" />
            Saving…
          </span>
        )}
      </div>
      <div className={cn("grid grid-cols-3 gap-2 transition-opacity", saving && "opacity-70")}>
        {DELIVERIES.map((d) => (
          <label key={d.delivery} className={pillClass}>
            <input type="radio" name={`delivery-${category}`} value={d.delivery} checked={value === d.delivery}
              className="absolute inset-0 cursor-pointer appearance-none rounded-full opacity-0"
              onChange={() => choose(d.delivery)} />
            {d.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
