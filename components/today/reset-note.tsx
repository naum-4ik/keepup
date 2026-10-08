"use client";

import { useEffect, useRef } from "react";
import { RESET_DONE } from "@/lib/reset-my-data";

// Today, right after Settings → Reset my data (?reset=1): said once. Focus moves to it so a screen
// reader announces it, and the address loses ?reset=1 (no re-render), so a reload or Back to this
// page doesn't say it again.
export function ResetNote() {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const url = new URL(window.location.href);
    url.searchParams.delete("reset");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, []);
  return (
    <p ref={ref} tabIndex={-1} role="status" className="rounded-2xl bg-card p-4 text-sm font-semibold shadow-soft outline-none">
      {RESET_DONE}
    </p>
  );
}
