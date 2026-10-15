// components/notifications/turn-on-reminders.tsx
"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { BellRing } from "lucide-react";
import { savePushSubscription, setReminderHour } from "@/app/(app)/profile/settings/notification-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  browserSubscription, pushSupport, pushSupportText, readPushEnv, subscribeAndSave, urlBase64ToUint8Array, withTimeout, type PushSupport,
} from "@/lib/push-support";
import { useT } from "@/lib/i18n/client";

const HOURS = Array.from({ length: 24 }, (_, h) => h);
// Inlined at build time, so the server and the browser render the same thing.
const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;

export async function currentEndpoint(): Promise<string | null> {
  return (await browserSubscription())?.endpoint ?? null;
}

// The worker installs on the first visit; if it never gets there, say so instead of spinning forever.
const READY_TIMEOUT_MS = 10_000;

// The first "turn on reminders" (ideas/onboarding.md): the hour, then the browser's permission, then
// this device is saved. On an iPhone that hasn't installed Keepup, the Home Screen guide instead.
// Without a VAPID key (local, CI) there is nothing to subscribe with, so no button at all.
export function TurnOnReminders({ hour, label, onDone }: { hour: number; label?: string; onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [chosen, setChosen] = useState(hour);
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const { t: tr } = useT();
  const t = useTranslations("notifications.turnOn");
  const [pending, startTransition] = useTransition();

  function allow() {
    setMessage(null);
    startTransition(async () => {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setSupport(permission === "denied" ? "blocked" : "ready");
        return;
      }
      try {
        const reg = await withTimeout(navigator.serviceWorker.ready, READY_TIMEOUT_MS);
        const saved = await subscribeAndSave({
          current: () => reg.pushManager.getSubscription().catch(() => null),
          subscribe: () => reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_KEY ?? "") }),
          save: (keys) => savePushSubscription({ ...keys, userAgent: navigator.userAgent }),
        });
        const timed = saved.ok ? await setReminderHour(chosen) : saved;
        if (!timed.ok) {
          setMessage(timed.message);
          return;
        }
        setDone(true);
        onDone?.();
      } catch (e) {
        console.error("push subscribe failed", e);
        setMessage(t("failed"));
      }
    });
  }

  if (!VAPID_KEY) return null;

  return (
    <>
      <Button type="button" className="h-11" onClick={() => { setDone(false); setMessage(null); setSupport(pushSupport(readPushEnv())); setOpen(true); }}>
        <BellRing aria-hidden />
        {label ?? t("label")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>{support === "needs-install" ? t("addToHomeScreen") : t("title")}</DialogTitle>
          {done ? (
            <DialogDescription>{tr("notificationSettings.status.onWithHour", { time: hourLabel(chosen) })}</DialogDescription>
          ) : support === "needs-install" ? (
            <>
              <DialogDescription>{pushSupportText(tr, "needs-install")}</DialogDescription>
              <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
                <li>{t("stepShare")}</li>
                <li>{t("stepAdd")}</li>
                <li>{t("stepOpen")}</li>
              </ol>
            </>
          ) : support && support !== "ready" ? (
            <DialogDescription>{pushSupportText(tr, support)}</DialogDescription>
          ) : (
            <>
              <DialogDescription>{t("intro")}</DialogDescription>
              <label className="flex flex-col gap-1.5 text-sm font-semibold">
                {t("summaryAt")}
                <select value={chosen} onChange={(e) => setChosen(Number(e.target.value))} className="h-11 rounded-xl border border-input bg-transparent px-3 text-base font-normal">
                  {HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
                </select>
              </label>
              <Button type="button" className="h-11" disabled={pending} onClick={allow}>{t("allow")}</Button>
            </>
          )}
          {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}
