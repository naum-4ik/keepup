"use client";

import { useState, useTransition } from "react";
import { Notice } from "@/components/ui/notice";
import { useT } from "@/lib/i18n/client";
import { reach } from "@/lib/reach";
import { cn } from "@/lib/utils";

// Settings' one rule (docs/design.md "States and feedback"): every setting saves when it changes, and
// says so where it is: "Saving…", then "Saved ✓", or what went wrong and what to do. Nothing goes back
// silently: a choice that couldn't be saved returns to the saved one with the reason beside it.
export type SettingState = { status: "idle" } | { status: "saving" } | { status: "saved" } | { status: "error"; message: string };
type Answer = { ok: true } | { ok: false; message?: string };

// `retry`: how the person tries again, in the words of the control ("pick" a choice, "save" a typed name).
export function useSettingSave(retry: "pick" | "save" = "pick") {
  const { t } = useT();
  const [state, setState] = useState<SettingState>({ status: "idle" });
  const [pending, startTransition] = useTransition();
  const fallback = retry === "pick" ? t("settings.status.failedPick") : t("settings.status.failedSave");
  const save = (call: () => Promise<Answer>, after?: { saved?: () => void; failed?: () => void }) => {
    setState({ status: "saving" });
    startTransition(async () => {
      const r = await reach(call, {
        offline: t(retry === "pick" ? "settings.status.offlinePick" : "settings.status.offlineSave"),
        reload: fallback,
      });
      if (r.ok) {
        setState({ status: "saved" });
        after?.saved?.();
      } else {
        setState({ status: "error", message: r.message ?? fallback });
        after?.failed?.();
      }
    });
  };
  return { state, pending, save };
}

// Always there (empty until a save), so screen readers hear each change of it. `id`: for the control's
// aria-describedby.
export function SettingStatus({ state, id }: { state: SettingState; id?: string }) {
  const { t } = useT();
  return (
    <>
      <p id={id} role="status" className={cn("text-sm font-semibold", state.status === "saved" ? "text-done" : "text-muted-foreground", (state.status === "idle" || state.status === "error") && "sr-only")}>
        {state.status === "saving" ? t("settings.status.saving") : state.status === "saved" ? t("settings.status.saved") : ""}
      </p>
      {state.status === "error" && (
        <Notice tone="error" live>
          {state.message}
        </Notice>
      )}
    </>
  );
}
