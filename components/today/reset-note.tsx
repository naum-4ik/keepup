"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Notice } from "@/components/ui/notice";

// Today, right after Settings → Reset my data (?reset=1): said once. Focus moves to it so a screen
// reader announces it, and the address loses ?reset=1 (no re-render), so a reload or Back to this
// page doesn't say it again. A Notice, not a card (docs/design.md "Notices"); the focus target wraps it.
export function ResetNote() {
  const t = useTranslations("today");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const url = new URL(window.location.href);
    url.searchParams.delete("reset");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, []);
  return (
    <div ref={ref} tabIndex={-1} className="outline-none">
      <Notice tone="success" live>
        {t("resetDone")}
      </Notice>
    </div>
  );
}
