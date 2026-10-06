"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Which badge's note is open: one at a time across the page.
const OpenBadge = createContext<{ open: string | null; setOpen: (code: string | null) => void }>({ open: null, setOpen: () => {} });

export function BadgeNotes({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<string | null>(null);
  return <OpenBadge.Provider value={{ open, setOpen }}>{children}</OpenBadge.Provider>;
}

// One badge: its icon and name; the date (earned) or the hint (locked) in a small note on hover
// (a mouse), tap or focus. It closes on tap outside, Escape or blur. The button's name carries the
// whole text, so a screen reader needs no note (the note is hidden from it).
// Locked: the same icon, desaturated, on a muted circle at 85% (icon 3.5:1 on the circle in light,
// 4.8:1 in dark); the name stays full muted-foreground (5.2:1).
export function BadgeTile({
  code,
  name,
  label,
  note,
  earned,
  chip,
  ink,
  children,
}: {
  code: string;
  name: string;
  label: string;
  note: string;
  earned: boolean;
  chip: string;
  ink: string;
  children: React.ReactNode;
}) {
  const { open, setOpen } = useContext(OpenBadge);
  const shown = open === code;
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [shown, setOpen]);

  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      data-earned={earned ? "true" : "false"}
      onClick={() => setOpen(code)}
      onFocus={() => setOpen(code)}
      onBlur={() => {
        if (shown) setOpen(null);
      }}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") setOpen(code);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse" && shown && document.activeElement !== ref.current) setOpen(null);
      }}
      className="relative flex min-h-11 w-full flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-center hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span
        aria-hidden
        data-badge-circle
        className={cn(
          "flex size-12 items-center justify-center rounded-full",
          earned ? cn(chip, ink) : "bg-muted text-muted-foreground opacity-85 grayscale",
        )}
      >
        {children}
      </span>
      <span aria-hidden className={cn("text-xs font-semibold", !earned && "text-muted-foreground")}>
        {name}
      </span>
      {shown && (
        <span
          role="tooltip"
          aria-hidden
          className="absolute top-full left-1/2 z-10 mt-1 w-36 -translate-x-1/2 rounded-xl bg-foreground px-3 py-2 text-xs leading-snug font-semibold text-background shadow-soft"
        >
          {note}
        </span>
      )}
    </button>
  );
}
