// components/notifications/turn-on-reminders.tsx
"use client";

import { useState, useTransition } from "react";
import { BellRing } from "lucide-react";
import { savePushSubscription, setReminderHour } from "@/app/(app)/profile/settings/notification-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { PUSH_SUPPORT_TEXT, pushSupport, readPushEnv, subscribeAndSave, urlBase64ToUint8Array, type PushSupport } from "@/lib/push-support";

const HOURS = Array.from({ length: 24 }, (_, h) => h);
// Inlined at build time, so the server and the browser render the same thing.
const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;

export async function currentEndpoint(): Promise<string | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription())?.endpoint ?? null;
}

// The first "turn on reminders" (ideas/onboarding.md): the hour, then the browser's permission, then
// this device is saved. On an iPhone that hasn't installed Keepup, the Home Screen guide instead.
// Without a VAPID key (local, CI) there is nothing to subscribe with, so no button at all.
export function TurnOnReminders({ hour, label = "Turn on reminders", onDone }: { hour: number; label?: string; onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [chosen, setChosen] = useState(hour);
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);
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
        const reg = await navigator.serviceWorker.ready;
        const saved = await subscribeAndSave({
          current: () => reg.pushManager.getSubscription(),
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
        setMessage("This device couldn't be set up for notifications. Try again.");
      }
    });
  }

  if (!VAPID_KEY) return null;

  return (
    <>
      <Button type="button" className="h-11" onClick={() => { setDone(false); setMessage(null); setSupport(pushSupport(readPushEnv())); setOpen(true); }}>
        <BellRing aria-hidden />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>{support === "needs-install" ? "Add Keepup to your Home Screen" : "Reminders"}</DialogTitle>
          {done ? (
            <DialogDescription>Reminders are on for this device ✓ Your daily summary arrives at {hourLabel(chosen)}.</DialogDescription>
          ) : support === "needs-install" ? (
            <>
              <DialogDescription>{PUSH_SUPPORT_TEXT["needs-install"]}</DialogDescription>
              <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
                <li>In Safari, tap Share (the square with an arrow).</li>
                <li>Choose Add to Home Screen, then Add.</li>
                <li>Open Keepup from your Home Screen and turn on reminders there.</li>
              </ol>
            </>
          ) : support && support !== "ready" ? (
            <DialogDescription>{PUSH_SUPPORT_TEXT[support]}</DialogDescription>
          ) : (
            <>
              <DialogDescription>{"One summary a day of what's still to do. You can pause or change it any time."}</DialogDescription>
              <label className="flex flex-col gap-1.5 text-sm font-semibold">
                Daily summary at
                <select value={chosen} onChange={(e) => setChosen(Number(e.target.value))} className="h-11 rounded-xl border border-input bg-transparent px-3 text-base font-normal">
                  {HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
                </select>
              </label>
              <Button type="button" className="h-11" disabled={pending} onClick={allow}>Allow notifications</Button>
            </>
          )}
          {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}
