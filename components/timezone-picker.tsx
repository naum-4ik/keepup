"use client";

import { MapPin } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { InfoHint } from "@/components/info-hint";
import { cityOf, timeChoices } from "@/lib/timezones";

type Props = {
  name: string;
  value: string;
  onChange: (tz: string) => void;
  timezones: string[];
  error?: string;
  // Settings: after a change, remind that it applies from the next day and week.
  showChangeNote?: boolean;
};

const selectClass = "h-11 w-full rounded-xl border border-input bg-transparent px-3 text-base tabular-nums";

// The browser's clock and zone, only after mount (the server's would mismatch on hydration); the clock
// ticks every minute so the times stay current.
function useBrowserClock(): { now: Date | null; deviceZone: string | null } {
  const [now, setNow] = useState<Date | null>(null);
  const [deviceZone, setDeviceZone] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only values, read after mount
    setNow(new Date());
    setDeviceZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return { now, deviceZone };
}

// Pick the time zone by what the clock says now: one row per local time, each with a familiar city.
export function TimezonePicker({ name, value, onChange, timezones, error, showChangeNote = false }: Props) {
  const [initial] = useState(value);
  const { now, deviceZone } = useBrowserClock();
  const device = deviceZone && timezones.includes(deviceZone) ? deviceZone : null;
  const selectRef = useRef<HTMLSelectElement>(null);

  const choices = useMemo(
    () => (now ? timeChoices(timezones, now, device ? [value, device] : [value]) : []),
    [now, timezones, value, device],
  );

  // The browser resets <form> fields after a server action runs; a <select> doesn't re-sync from its
  // `value` prop, so put it back after every render.
  useEffect(() => {
    if (selectRef.current) selectRef.current.value = value;
  });

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1">
        <label htmlFor={name} className="text-sm font-semibold">
          Time zone
        </label>
        <InfoHint text="Pick the time it is where you are now. Your days start at midnight there." />
      </div>
      <select
        ref={selectRef}
        id={name}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={selectClass}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
      >
        {choices.length === 0 ? (
          <option value={value}>{cityOf(value)}</option>
        ) : (
          choices.map((c) => (
            <option key={c.id} value={c.id}>
              {c.time} ({c.city})
            </option>
          ))
        )}
      </select>

      {device && device !== value && (
        <button
          type="button"
          onClick={() => onChange(device)}
          className="-ml-2 flex min-h-11 items-center gap-1.5 self-start rounded-lg px-2 text-sm font-semibold text-primary hover:bg-accent"
        >
          <MapPin className="size-4" aria-hidden />
          Use this device&apos;s time zone ({cityOf(device)})
        </button>
      )}

      {showChangeNote && value !== initial && (
        <p className="text-xs text-muted-foreground">Changes apply from your next day and week.</p>
      )}
      {error && (
        <p id={`${name}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
