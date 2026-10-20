"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

// The loading screen's one polite "Loading…". A live region announces changes, not what it held when it
// appeared, so it mounts empty and takes its words a moment later. No role="status": pages own their
// status lines (Today's summary, "Saved ✓"), and a second one in <main> would make tests' and screen
// readers' "the status" ambiguous while the page swaps in.
export function LoadingAnnouncement() {
  const t = useTranslations("common");
  const [text, setText] = useState("");
  useEffect(() => {
    const id = window.setTimeout(() => setText(t("loading")), 100);
    return () => window.clearTimeout(id);
  }, [t]);
  return (
    <p className="sr-only" aria-live="polite">
      {text}
    </p>
  );
}
