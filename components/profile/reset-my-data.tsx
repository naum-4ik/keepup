"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetMyData } from "@/app/(app)/profile/settings/actions";
import { useForgetOfflineHabits } from "@/components/offline/offline-queue-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { Section } from "@/components/ui/section";
import { useT } from "@/lib/i18n/client";
import { isResetWord, runReset } from "@/lib/reset-my-data";

// Settings → Reset my data (owner 2026-10-06): a fresh start that keeps the account and the family.
// The database decides what goes (public.reset_my_data); typing "reset" guards the button. Once it
// has, the waiting taps on the private habits and the saved offline pages leave the phone (if it
// fails, nothing on the phone is lost).
export function ResetMyData({ privateHabitIds }: { privateHabitIds: string[] }) {
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const forgetOffline = useForgetOfflineHabits();
  const router = useRouter();
  const inputId = useId();

  function reset() {
    setError(null);
    if (!navigator.onLine) {
      setError(t("offline.needsConnection"));
      return;
    }
    startTransition(async () => {
      try {
        const message = await runReset({
          reset: resetMyData,
          clearPhone: () => forgetOffline(privateHabitIds),
          openToday: () => router.replace("/today?reset=1"),
        });
        if (message) setError(message);
      } catch {
        setError(navigator.onLine ? t("errors.generic") : t("offline.needsConnection"));
      }
    });
  }

  return (
    <Section title={t("settings.reset.title")}>
      {/* What goes, then what stays: one block, lines on line-height. */}
      <div className="flex flex-col text-sm text-muted-foreground">
        <p>{t("settings.reset.clears")}</p>
        <p>{t("settings.reset.keeps")}</p>
      </div>
      <Button
        type="button"
        variant="outline"
        className="h-11 text-destructive hover:text-destructive"
        onClick={() => {
          setWord("");
          setError(null);
          setOpen(true);
        }}
      >
        {t("settings.reset.title")}
      </Button>
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent>
          {/* pe-10: room for the dialog's close X. Title over description: line-height, no gap. */}
          <div className="flex flex-col pe-10">
            <DialogTitle>{t("settings.reset.dialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("settings.reset.dialogBody", { clears: t("settings.reset.clears"), keeps: t("settings.reset.keeps") })}
            </DialogDescription>
          </div>
          <form
            className="flex flex-col gap-item"
            onSubmit={(e) => {
              e.preventDefault();
              if (isResetWord(t, word) && !pending) reset();
            }}
          >
            <div className="flex flex-col gap-inner">
              <label htmlFor={inputId} className="text-sm font-semibold">
                {t("settings.typeToConfirm", { word: t("settings.reset.word") })}
              </label>
              <Input
                id={inputId}
                value={word}
                onChange={(e) => setWord(e.target.value)}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                className="h-11"
              />
            </div>
            {error && (
              <Notice tone="error" live>
                {error}
              </Notice>
            )}
            <div className="flex gap-inner">
              <Button type="button" variant="outline" className="h-11 flex-1" disabled={pending} onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" variant="destructive" className="h-11 flex-1" disabled={pending || !isResetWord(t, word)}>
                {pending ? t("common.resetting") : t("common.reset")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Section>
  );
}
