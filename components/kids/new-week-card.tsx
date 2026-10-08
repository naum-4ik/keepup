"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GardenPicture } from "@/components/kids/garden";
import { newWeekLine } from "@/lib/garden";

// ideas/kid-view-next.md: the first time a new week is opened, last week's picture goes to the album
// and a new one starts. Shown once per child per week on this device.
export function NewWeekCard({
  childId,
  weekStart,
  lastStars,
  theme,
  albumHref,
}: {
  childId: string;
  weekStart: string;
  lastStars: number;
  theme: string;
  albumHref?: string;
}) {
  const key = `keepup:new-week:${childId}`;
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once after mount (browser storage)
      setShow(localStorage.getItem(key) !== weekStart);
    } catch {
      setShow(true);
    }
  }, [key, weekStart]);

  const dismiss = () => {
    try {
      localStorage.setItem(key, weekStart);
    } catch {
      // Private mode: it may show again next time.
    }
    setShow(false);
  };

  if (!show) return null;
  return (
    <section aria-label="A new week" className="flex items-center gap-3 rounded-2xl bg-accent p-3 shadow-soft">
      <GardenPicture stars={lastStars} size="sm" theme={theme} className="shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="text-sm font-semibold">{newWeekLine(theme)}</p>
        <div className="flex flex-wrap gap-2">
          {albumHref && (
            <Link href={albumHref} onClick={dismiss} className="flex min-h-11 items-center rounded-full bg-card px-3 text-sm font-semibold text-primary hover:bg-muted">
              See the album
            </Link>
          )}
          <button type="button" onClick={dismiss} className="flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-muted-foreground hover:bg-card">
            Got it
          </button>
        </div>
      </div>
    </section>
  );
}
