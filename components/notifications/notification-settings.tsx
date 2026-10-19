// components/notifications/notification-settings.tsx
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { forgetPushSubscription, pauseAll, setDelivery, setReminderHour } from "@/app/(app)/profile/settings/notification-actions";
import { currentEndpoint, TurnOnReminders } from "@/components/notifications/turn-on-reminders";
import { InfoHint } from "@/components/info-hint";
import { SettingStatus, useSettingSave } from "@/components/profile/setting-status";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Section } from "@/components/ui/section";
import { useT } from "@/lib/i18n/client";
import {
  DELIVERIES, NOTIFICATION_CATEGORIES, PAUSE_CHOICES, reminderHourHint, reminderStatus,
  type CategoryKey, type Delivery,
} from "@/lib/notification-categories";
import type { NotificationSettings } from "@/lib/notification-settings";
import { browserSubscription, iosVersion, removeDevice } from "@/lib/push-support";
import { INTL_LOCALE, type Locale, type T } from "@/supabase/functions/_shared/i18n";
import { reach } from "@/lib/reach";
import { cn } from "@/lib/utils";

// 12 px sides to match the 12 px radius (as Notice does).
const selectClass = "h-11 rounded-xl border border-input bg-transparent px-3 text-base";
// A segmented row of three pills (radios): fits 390px, each a 44px target. Same look as the habit form's chips.
const pillClass =
  "relative flex h-11 cursor-pointer items-center justify-center rounded-full border border-border px-inner text-sm font-semibold has-checked:border-primary has-checked:bg-accent has-checked:text-accent-foreground has-focus-visible:ring-2 has-focus-visible:ring-ring has-disabled:cursor-default has-disabled:opacity-60";
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;

// Null: paused until turned back on (muted_until = infinity).
function pausedUntil(locale: Locale, until: string, timeZone: string): string | null {
  if (until === "infinity") return null;
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone, weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(until));
}

const pausedLine = (t: T, until: string | null) =>
  until ? t("notifications.card.pausedUntil", { until }) : t("notifications.card.pausedUntilOn");

// isDemo: a demo login can't save a push device, so it never sees the browser's permission prompt.
export function NotificationSettingsCard({ settings, isDemo = false }: { settings: NotificationSettings; isDemo?: boolean }) {
  const { t, locale } = useT();
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
  // The reminder hour saves when it changes, and says so under it.
  const hour = useSettingSave(settings.reminderHour);
  const [hourValue, setHourValue] = useState(settings.reminderHour);
  const [hourSeen, setHourSeen] = useState(settings.reminderHour);
  if (hourSeen !== settings.reminderHour) {
    setHourSeen(settings.reminderHour);
    setHourValue(settings.reminderHour);
  }

  useEffect(() => {
    if (justOn && thisDeviceOn) confirmation.current?.focus();
  }, [justOn, thisDeviceOn]);

  return (
    // A settings group, not a card (docs/design.md "Surfaces"): a Section; its parts 24 px apart.
    <Section title={t("notifications.card.title")} className="gap-section">
      <div className="flex flex-col gap-inner">
        {/* The label and its (i): one glyph pair, 4 px. */}
        <div className="flex flex-wrap items-center gap-1">
          <label htmlFor="reminderHour" className="text-sm font-semibold">{t("notifications.card.dailyReminder")}</label>
          <InfoHint text={reminderHourHint(t, settings.devices.length > 0)} />
        </div>
        <select id="reminderHour" className={selectClass} value={hourValue} aria-describedby="reminderHour-status"
          disabled={pending || hour.pending}
          onChange={(e) => {
            const next = Number(e.target.value);
            setHourValue(next);
            hour.save(next, () => setReminderHour(next), { revert: setHourValue });
          }}>
          {HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
        </select>
        <SettingStatus state={hour.state} id="reminderHour-status" />
        {thisDeviceOn ? (
          <p ref={confirmation} tabIndex={-1} role="status" className="text-sm text-muted-foreground outline-none">
            {reminderStatus(t, {
              paused: paused ? { until: pausedUntil(locale, settings.mutedUntil!, settings.timezone) } : null,
              delivery: settings.delivery.reminders,
              arrivesAt: justOn ? hourLabel(settings.reminderHour) : null,
            })}
          </p>
        ) : isDemo ? (
          <p className="text-sm text-muted-foreground">{t("demo.off")}</p>
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

      <div className="flex flex-col gap-inner">
        <h3 className="text-sm font-semibold">{t("notifications.card.pauseAll")}</h3>
        {paused ? (
          <div className="flex flex-wrap items-center gap-item">
            <p className="text-sm">{pausedLine(t, pausedUntil(locale, settings.mutedUntil!, settings.timezone))}</p>
            <Button type="button" variant="outline" className="h-11" disabled={pending} onClick={() => run(() => pauseAll("resume"))}>{t("notifications.card.resume")}</Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-inner">
            {PAUSE_CHOICES.map((c) => (
              <Button key={c.choice} type="button" variant="outline" className="h-11" disabled={pending} onClick={() => run(() => pauseAll(c.choice))}>
                {t(`notificationSettings.pauseChoice.${c.choice}`)}
              </Button>
            ))}
          </div>
        )}
      </div>

      <fieldset className="flex flex-col gap-item">
        <legend className="mb-inner text-sm font-semibold">{t("notifications.card.whatToSend")}</legend>
        {NOTIFICATION_CATEGORIES.map((c) => (
          <DeliveryChoice key={c.key} category={c.key} label={t(`notificationCategories.${c.key}.label`)} hint={t(`notificationCategories.${c.key}.hint`)} saved={settings.delivery[c.key]} />
        ))}
        {iphone && <p className="text-sm text-muted-foreground">{t("notificationSettings.iphoneSoundHint")}</p>}
      </fieldset>

      {settings.devices.length > 0 && (
        <div className="flex flex-col gap-inner">
          <h3 className="text-sm font-semibold">{t("notifications.card.devices")}</h3>
          <ul className="flex flex-col gap-inner">
            {settings.devices.map((d) => (
              <li key={d.endpoint} className="flex min-h-11 items-center gap-item">
                <span className="flex-1 text-sm">
                  {d.label}
                  {d.endpoint === here && <span className="text-muted-foreground"> · {t("notifications.card.thisDevice")}</span>}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  aria-label={t(d.endpoint === here ? "notifications.card.removeThisLabel" : "notifications.card.removeLabel", { label: d.label })}
                  disabled={pending}
                  onClick={() =>
                    run(() => removeDevice({ endpoint: d.endpoint, here, forget: forgetPushSubscription, getSubscription: browserSubscription }))
                  }
                >
                  {t("notifications.card.remove")}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <Notice tone="error" live>
          {error}
        </Notice>
      )}
    </Section>
  );
}

// How long arrowing through the pills waits before saving: one save for where the person stops.
export const DELIVERY_SAVE_DELAY_MS = 400;

// One category's three pills. Arrow keys move through them (a radio group): the pill moved to is
// checked at once and keeps focus. Nothing is disabled or remounted while saving (a disabled radio
// drops focus); the save goes 400 ms after the last change; then "Saved ✓" under it, or a refused
// one goes back to what is saved with the reason there. A save still waiting when the page is left
// is sent then.
function DeliveryChoice({ category, label, hint, saved }: {
  category: CategoryKey;
  label: string;
  hint: string;
  saved: Delivery;
}) {
  const { t } = useT();
  const [value, setValue] = useState<Delivery>(saved);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: true } | { ok: false; message: string } | null>(null);
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
    setResult(null);
    waiting.current = next;
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      timer.current = null;
      waiting.current = null;
      const n = ++latest.current;
      const r = await reach(() => setDelivery(category, next), { offline: t("settings.status.offlinePick"), reload: t("settings.status.failedPick") });
      // A newer change took over: its own save decides.
      if (n !== latest.current || timer.current !== null) return;
      if (!r.ok) setValue(savedRef.current);
      setResult(r);
      setSaving(false);
    }, DELIVERY_SAVE_DELAY_MS);
  }

  return (
    <fieldset className="flex flex-col gap-inner" aria-describedby={`delivery-${category}-hint delivery-${category}-status`} aria-busy={saving || undefined}>
      <legend className="font-semibold">{label}</legend>
      <div className="flex items-start gap-inner">
        <p id={`delivery-${category}-hint`} className="flex-1 text-xs text-muted-foreground">
          {category === "approvals" && value === "inbox" ? t("notificationCategories.approvalsOffNote") : hint}
        </p>
        {/* Seen while the change waits or is being saved (screen readers get aria-busy). */}
        {saving && (
          // Spinner to its word: one glyph pair, 4 px.
          <span aria-hidden data-testid={`delivery-${category}-saving`} className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin motion-reduce:animate-none" />
            {t("common.saving")}
          </span>
        )}
      </div>
      <div className={cn("grid grid-cols-3 gap-inner transition-opacity", saving && "opacity-70")}>
        {DELIVERIES.map((d) => (
          <label key={d.delivery} className={pillClass}>
            <input type="radio" name={`delivery-${category}`} value={d.delivery} checked={value === d.delivery}
              className="absolute inset-0 cursor-pointer appearance-none rounded-full opacity-0"
              onChange={() => choose(d.delivery)} />
            {t(`notificationSettings.delivery.${d.delivery}`)}
          </label>
        ))}
      </div>
      {/* While it waits the cue above shows; then Saved ✓ or the reason (aria-busy covers the wait). */}
      <SettingStatus
        id={`delivery-${category}-status`}
        state={saving || !result ? { status: "idle" } : result.ok ? { status: "saved" } : { status: "error", message: result.message }}
      />
    </fieldset>
  );
}
