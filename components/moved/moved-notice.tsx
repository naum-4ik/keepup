"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MOVED_PARAM, withoutMoved } from "@/lib/moved";
import { MOVED_DISMISS, MOVED_HOW, MOVED_NOTICE } from "@/lib/moved-copy";

// Arrived from the old address (proxy.ts adds ?moved=1, lib/moved.ts): an installed app can't follow
// the move, so say how to install again. Shown on every screen (root layout) for this session until
// dismissed; ?moved=1 is taken off the visible URL so it isn't bookmarked or shared. Read in an effect,
// not useSearchParams: static pages (/privacy, /install) stay static, and nothing differs at hydration.
const KEY = "keepup:moved";

function read(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function write(value: "show" | "dismissed") {
  try {
    sessionStorage.setItem(KEY, value);
  } catch {
    // private mode or blocked storage: the notice lasts for this page only
  }
}

export function MovedNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const arrived = new URLSearchParams(window.location.search).get(MOVED_PARAM) === "1";
    const stripped = withoutMoved(window.location.href);
    if (stripped !== null) window.history.replaceState(null, "", stripped);
    const saved = read();
    if (saved === "dismissed") return;
    if (arrived) write("show");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage and the URL exist only in the browser
    if (arrived || saved === "show") setShow(true);
  }, []);

  if (!show) return null;
  return (
    <div className="mx-auto mt-2 flex w-[calc(100%-2rem)] max-w-[calc(28rem-2rem)] items-start gap-2 rounded-xl bg-muted py-2 pl-4 pr-1 text-sm font-semibold text-muted-foreground">
      <p className="flex-1 py-1">
        <span role="status">{MOVED_NOTICE}</span>{" "}
        <Link href="/install" className="text-primary underline underline-offset-4">
          {MOVED_HOW}
        </Link>
      </p>
      <button
        type="button"
        onClick={() => {
          write("dismissed");
          setShow(false);
        }}
        aria-label={MOVED_DISMISS}
        className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-background/60"
      >
        <X aria-hidden className="size-4" />
      </button>
    </div>
  );
}
