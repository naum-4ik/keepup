"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Star } from "lucide-react";
import { Confetti } from "@/components/celebrations/confetti";
import { SproutIcon } from "@/components/sprout-icon";
import { BADGE_ICONS } from "@/lib/badges";
import { takeBurstTurn } from "@/lib/burst-turns";
import { isCelebrationMode, type Celebration, type CelebrationMode, type SeenItem } from "@/lib/celebrations";

// A level-up shows the app's sprout (docs/design.md: never lucide's); a badge its own icon (lib/badges.ts).
function CelebrationIcon({ item, className }: { item: Celebration; className: string }) {
  if (item.kind === "level") return <SproutIcon className={className} />;
  const Icon = BADGE_ICONS[item.icon] ?? Star;
  return <Icon className={className} strokeWidth={1.75} />;
}

// Fails soft: nothing to show (offline, signed out, an older server).
async function loadCelebrations(): Promise<{ mode: CelebrationMode; queue: Celebration[] }> {
  const res = await fetch("/api/celebrations", { cache: "no-store" });
  if (!res.ok) return { mode: "full", queue: [] };
  const body = (await res.json()) as { mode?: unknown; queue?: unknown };
  return { mode: isCelebrationMode(body.mode) ? body.mode : "full", queue: Array.isArray(body.queue) ? (body.queue as Celebration[]) : [] };
}

function markSeen(item: SeenItem): void {
  void fetch("/api/celebrations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item) }).catch(() => {});
}

// Whether the tab is on screen. A moment waits for it: a page opened in a background tab shows (and
// marks seen) nothing until it is looked at, and a tab hidden mid-moment stops its timer (as
// EveryoneDidIt does).
function onVisibility(change: () => void): () => void {
  document.addEventListener("visibilitychange", change);
  return () => document.removeEventListener("visibilitychange", change);
}
const useTabVisible = () => useSyncExternalStore(onVisibility, () => document.visibilityState === "visible", () => false);

// Escape belongs to an open dialog above the page, if there is one.
const dialogOpen = () => document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]') !== null;

const SHOWN_MS: Record<CelebrationMode, number> = { full: 2400, subtle: 4000 };

// §9: a ~2 s full-screen moment (Full) or a small toast (Subtle), once each. It is checked when a page
// opens (the pathname changes), never in the middle of a run of check-ins on the same page. It doesn't
// take focus; tap, Escape (Full) or the timer moves on. Reduced motion: no confetti, no pop. Full waits its
// turn with the page's other bursts (lib/burst-turns.ts) and holds it while it shows, so "Everyone did
// it", a finish card or Today's all-done confetti never plays at the same time. The (app) layout only:
// never in the kid view.
export function CelebrationMoment() {
  const pathname = usePathname();
  const [state, setState] = useState<{ mode: CelebrationMode; queue: Celebration[]; ready: boolean }>({ mode: "full", queue: [], ready: false });
  const [index, setIndex] = useState(0);
  const turn = useRef<{ release: () => void } | null>(null);
  const marked = useRef(new Set<string>());
  const visible = useTabVisible();
  const lineId = useId();

  useEffect(() => {
    let live = true;
    let wait: number | null = null;
    void loadCelebrations()
      .then((r) => {
        if (!live || r.queue.length === 0) return;
        turn.current?.release();
        turn.current = null;
        setIndex(0);
        if (r.mode === "subtle") return setState({ ...r, ready: true }); // a toast is no burst
        const t = takeBurstTurn(SHOWN_MS.full * r.queue.length);
        turn.current = t;
        setState({ ...r, ready: t.wait === 0 });
        if (t.wait > 0) wait = window.setTimeout(() => setState((s) => ({ ...s, ready: true })), t.wait);
      })
      .catch(() => {});
    return () => {
      live = false;
      if (wait) window.clearTimeout(wait);
    };
  }, [pathname]);

  // Gone with the layout (signed out): hand back what's left of the turn.
  useEffect(() => () => turn.current?.release(), []);

  const current = state.ready && visible ? state.queue[index] : undefined;
  const done = state.queue.length > 0 && index >= state.queue.length;
  const next = useCallback(() => setIndex((i) => i + 1), []);

  useEffect(() => {
    if (!done) return;
    turn.current?.release();
    turn.current = null;
  }, [done]);

  useEffect(() => {
    if (!current) return;
    // On screen: marked seen now, so leaving mid-moment never shows it twice (once per item, even when
    // the tab is hidden and shown again). The timer restarts each time the tab comes back.
    const id = current.kind === "level" ? `level:${current.level}` : `badge:${current.code}`;
    if (!marked.current.has(id)) {
      marked.current.add(id);
      markSeen(current.kind === "level" ? { level: current.level } : { badge: current.code });
    }
    const timer = window.setTimeout(next, SHOWN_MS[state.mode]);
    // Full only: the toast covers nothing, so Escape stays with the page. Captured before a dialog's
    // own listener, and left to it when one is open above the moment.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || dialogOpen()) return;
      e.stopImmediatePropagation();
      next();
    };
    if (state.mode === "full") window.addEventListener("keydown", onKey, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [current, next, state.mode]);

  if (!current) return null;
  const key = current.kind === "level" ? `level:${current.level}` : `badge:${current.code}`;

  if (state.mode === "subtle") {
    return (
      <div role="status" aria-label="Celebration" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 mx-auto flex max-w-md justify-center px-4">
        <div className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-soft">
          <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
            <CelebrationIcon item={current} className="size-5" />
          </span>
          <p className="text-sm font-semibold">
            {current.title} · {current.line}
          </p>
        </div>
      </div>
    );
  }

  return (
    // Not a `dialog` (e2e reads unscoped dialogs) and no focus trap: tap anywhere or Escape moves on.
    <div
      role="alertdialog"
      aria-label="Celebration"
      aria-describedby={lineId}
      onClick={next}
      className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-background/90 p-6"
    >
      <div key={key} className="relative flex w-full max-w-xs flex-col items-center gap-3 rounded-3xl bg-card px-8 py-10 text-center shadow-soft">
        <Confetti />
        <span aria-hidden className="flex size-16 animate-item-pop items-center justify-center rounded-full bg-accent text-primary">
          <CelebrationIcon item={current} className="size-8" />
        </span>
        <p className="text-2xl font-extrabold">{current.title}</p>
        <p id={lineId} className="text-base text-muted-foreground">
          {current.line}
        </p>
        <p className="text-xs text-muted-foreground">Tap or press Esc</p>
      </div>
    </div>
  );
}
