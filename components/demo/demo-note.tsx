"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { LeaveDemoButton } from "@/components/demo/leave-demo-button";
import { useT } from "@/lib/i18n/client";
import { DEMO_NOTE_COOKIE } from "@/lib/demo-note";

// The demo's line in the app header (design pass PR 1): one 32px line, "Demo, resets in 24 h. Sign in",
// so the header leaves room for the page at 320×640. The X hides it until the browser closes (a session
// cookie the app layout reads, so a hidden note never flashes back on the next page). Sign in stays
// reachable after that: Profile → Sign out. Sign in and the X keep a 44px hit area inside the line
// (negative margins). min-h, not h: Sign in's "Needs a connection" line can grow it (it wraps; the
// words don't). ps-3 (12px) like Notice: it matches the 12px corner radius.
export function DemoNote() {
  const { t, rich } = useT();
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  function hide() {
    document.cookie = `${DEMO_NOTE_COOKIE}=hidden; path=/; samesite=lax`;
    setHidden(true);
  }

  return (
    <div className="mx-auto flex min-h-8 w-[calc(100%-2rem)] max-w-[calc(28rem-2rem)] items-center gap-inner rounded-xl bg-muted ps-3 text-xs font-semibold text-muted-foreground">
      <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1 whitespace-nowrap">
        {rich("demo.compact", {
          signIn: (c: React.ReactNode) => (
            <span className="-my-1.5 inline-flex shrink-0">
              <LeaveDemoButton>{c}</LeaveDemoButton>
            </span>
          ),
        })}
      </p>
      <button
        type="button"
        onClick={hide}
        aria-label={t("demo.dismiss")}
        className="-my-1.5 flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-background/60"
      >
        <X aria-hidden className="size-4" />
      </button>
    </div>
  );
}
