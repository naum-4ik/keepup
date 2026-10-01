"use client";

import { useRef, useState } from "react";
import { tabFromKey } from "@/lib/tabs";
import { cn } from "@/lib/utils";

type Tab = "approvals" | "activity";

// Client state, set once: after the last approval the page refreshes and stays on Approvals.
// Keyboard: the WAI-ARIA tabs pattern (arrows, Home, End; only the selected tab is in the Tab order),
// with automatic activation, so arrowing onto Activity shows it and marks the feed read.
export function InboxTabs({
  approvalsCount,
  approvals,
  activity,
}: {
  approvalsCount: number;
  approvals: React.ReactNode;
  activity: React.ReactNode;
}) {
  const [tab, setTab] = useState<Tab>(approvalsCount > 0 ? "approvals" : "activity");
  const tabs: [Tab, string][] = [
    ["approvals", `Approvals (${approvalsCount})`],
    ["activity", "Activity"],
  ];
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    const next = tabFromKey(e.key, i, tabs.length);
    if (next === null) return;
    e.preventDefault();
    setTab(tabs[next][0]);
    refs.current[next]?.focus();
  };
  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Inbox" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        {tabs.map(([key, label], i) => (
          <button
            key={key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            tabIndex={tab === key ? 0 : -1}
            onKeyDown={(e) => onKeyDown(e, i)}
            id={`inbox-tab-${key}`}
            aria-selected={tab === key}
            aria-controls={`inbox-panel-${key}`}
            onClick={() => setTab(key)}
            className={cn(
              "min-h-11 rounded-lg text-sm font-semibold tabular-nums",
              tab === key ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {/* Only the shown panel is mounted, so Activity marks the feed read only when it's on screen. */}
      <div role="tabpanel" id={`inbox-panel-${tab}`} aria-labelledby={`inbox-tab-${tab}`}>
        {tab === "approvals" ? approvals : activity}
      </div>
    </div>
  );
}
