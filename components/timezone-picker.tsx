"use client";

import { MapPin, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { InfoHint } from "@/components/info-hint";
import { Input } from "@/components/ui/input";
import { cityOf, describeZone, searchZones } from "@/lib/timezones";

type Props = {
  name: string;
  value: string;
  onChange: (tz: string) => void;
  timezones: string[];
  error?: string;
  // Settings: after a change, remind that it applies from the next day and week.
  showChangeNote?: boolean;
};

// Current time only after mount (the server's clock and zone would mismatch on hydration), then every minute.
function useNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser clock, read after mount
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export function TimezonePicker({ name, value, onChange, timezones, error, showChangeNote = false }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [initial] = useState(value);
  const [deviceZone, setDeviceZone] = useState<string | null>(null);
  const now = useNow();
  const labelId = useId();
  const listId = useId();
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only value, read once after mount
    if (timezones.includes(tz)) setDeviceZone(tz);
  }, [timezones]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const results = useMemo(() => (open && now ? searchZones(timezones, query, now) : []), [open, now, timezones, query]);
  const current = now ? describeZone(value, now) : null;

  function choose(tz: string) {
    onChange(tz);
    setOpen(false);
    setQuery("");
  }

  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1">
        <span id={labelId} className="text-sm font-semibold">
          Time zone
        </span>
        <InfoHint text="Your days start at midnight here. Streaks follow it." />
      </div>
      <input type="hidden" name={name} value={value} />

      <div className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-input px-3">
        <span className="text-base">
          {cityOf(value)}
          {current && <span className="text-muted-foreground"> · {current.time} now</span>}
        </span>
        <button
          type="button"
          aria-label="Change time zone"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((o) => !o)}
          className="-mr-2 min-h-11 rounded-lg px-2 text-sm font-semibold text-primary hover:bg-accent"
        >
          {open ? "Cancel" : "Change"}
        </button>
      </div>

      {open && (
        <div id={listId} className="flex flex-col gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              ref={searchRef}
              type="search"
              aria-label="Search time zones"
              placeholder="City, region or GMT+3"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
                if (e.key === "Enter") {
                  e.preventDefault(); // don't submit the form
                  if (results[0]) choose(results[0].id);
                }
              }}
              className="h-11 rounded-xl pl-9"
            />
          </div>
          <ul aria-label="Time zones" className="max-h-64 overflow-y-auto rounded-xl border border-input">
            {results.map((z) => (
              <li key={z.id}>
                <button
                  type="button"
                  aria-current={z.id === value || undefined}
                  onClick={() => choose(z.id)}
                  className="flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left hover:bg-muted aria-[current]:bg-accent"
                >
                  <span>
                    {z.city}
                    {z.region && <span className="text-xs text-muted-foreground"> · {z.region}</span>}
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                    {z.time} <span className="text-xs">({z.offset})</span>
                  </span>
                </button>
              </li>
            ))}
            {now && results.length === 0 && <li className="px-3 py-3 text-sm text-muted-foreground">No matches. Try a nearby city.</li>}
          </ul>
        </div>
      )}

      {deviceZone && deviceZone !== value && (
        <button
          type="button"
          onClick={() => choose(deviceZone)}
          className="-ml-2 flex min-h-11 items-center gap-1.5 self-start rounded-lg px-2 text-sm font-semibold text-primary hover:bg-accent"
        >
          <MapPin className="size-4" aria-hidden />
          Use this device&apos;s time zone ({cityOf(deviceZone)})
        </button>
      )}

      {showChangeNote && value !== initial && (
        <p className="text-xs text-muted-foreground">Changes apply from your next day and week.</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
