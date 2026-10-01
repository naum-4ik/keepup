"use client";

import { useOptimistic, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { Check, Volume2, VolumeX } from "lucide-react";
import { checkInFor } from "@/app/(app)/kids/actions";
import { Avatar } from "@/components/avatar";
import { Confetti } from "@/components/celebrations/confetti";
import { GardenPicture } from "@/components/kids/garden";
import { NewWeekCard } from "@/components/kids/new-week-card";
import { HoldToExit } from "@/components/kids/hold-to-exit";
import { stageFor } from "@/lib/garden";
import { isMuted, playKidSound, setMuted } from "@/lib/kid-sound";
import { MAX_ITEMS, sceneItems } from "@/lib/scene-items";
import type { CheckInState } from "@/lib/schedule";
import { cn } from "@/lib/utils";

type PlayHabit = { id: string; title: string; emoji: string; target: number; done: number; state: CheckInState };
type Child = { id: string; name: string; emoji: string | null; color: string | null; theme: string };
type Flying = { key: number; emoji: string; x: number; y: number; dx: number; dy: number };

// Two quick taps on the same card (a toddler's double tap) count once.
const SAME_CARD_GAP_MS = 2000;

// The mute setting lives in localStorage; this keeps the button in step (and renders "on" on the server).
const soundListeners = new Set<() => void>();
const subscribeSound = (cb: () => void) => {
  soundListeners.add(cb);
  return () => soundListeners.delete(cb);
};

// The full-screen kid view (ideas/kid-view-next.md §4), for children as young as 2–3: a tap counts at
// once (logged as by the child), with a pop sound, and the thing it adds flies from the card into the
// week's scene. A new picture brings a chime and confetti; the last habit of the day makes the scene
// dance. Tapping a done card or the scene is play: a wiggle and a sound, nothing counted.
// No numbers or text for the child; the star count and "what's next" are on the kid page.
export function KidPlay({
  child,
  habits,
  stars,
  weekStart,
  lastStars,
}: {
  child: Child;
  habits: PlayHabit[];
  stars: number;
  weekStart?: string;
  // Last week's stars, when it had any: the new-week card shows that picture going to the album.
  lastStars?: number;
}) {
  const [, startTransition] = useTransition();
  // Only the tapped habit waits for its save; the others stay tappable. The ref guards a quick
  // second tap on the same one before React re-renders it busy.
  const [saving, setSaving] = useState<ReadonlySet<string>>(() => new Set());
  const inFlight = useRef(new Set<string>());
  const lastTap = useRef(new Map<string, number>());
  const [view, tap] = useOptimistic({ habits, stars }, (s, habitId: string) => ({
    stars: s.stars + 1,
    habits: s.habits.map((h) => {
      if (h.id !== habitId) return h;
      const done = h.done + 1;
      return { ...h, done, state: (done >= h.target ? "done" : "open") as CheckInState };
    }),
  }));
  const [error, setError] = useState<string | null>(null);
  const [flying, setFlying] = useState<Flying[]>([]);
  const [bumped, setBumped] = useState<string | null>(null);
  const [party, setParty] = useState<number | null>(null);
  const [dancing, setDancing] = useState(false);
  const picture = useRef<HTMLDivElement>(null);
  const seq = useRef(0);
  const muted = useSyncExternalStore(subscribeSound, isMuted, () => false);

  const toggleSound = () => {
    setMuted(!muted);
    soundListeners.forEach((cb) => cb());
  };

  // The item this tap adds flies from the card to its spot in the scene (once the scene is full,
  // to the middle, as a star).
  const fly = (from: HTMLElement, stars: number) => {
    const a = from.getBoundingClientRect();
    const b = picture.current?.getBoundingClientRect();
    const item = stars < MAX_ITEMS ? sceneItems(stars + 1, child.theme)[stars] : null;
    const x = a.left + a.width / 2;
    const y = a.top + a.height / 2;
    const tx = b ? b.left + (b.width * (item?.x ?? 50)) / 100 : x;
    const ty = b ? b.top + (b.height * (item?.y ?? 50)) / 100 : y - 240;
    const key = ++seq.current;
    setFlying((f) => [...f, { key, emoji: item?.emoji ?? "⭐", x, y, dx: tx - x, dy: ty - y }]);
    window.setTimeout(() => setFlying((f) => f.filter((s) => s.key !== key)), 800);
  };

  const celebrate = (stars: number, allDone: boolean) => {
    if (stageFor(stars + 1) > stageFor(stars)) {
      playKidSound("chime");
      const key = ++seq.current;
      setParty(key);
      window.setTimeout(() => setParty((p) => (p === key ? null : p)), 1200);
    } else {
      playKidSound("pop");
    }
    if (allDone) {
      window.setTimeout(() => {
        playKidSound("melody");
        setDancing(true);
        window.setTimeout(() => setDancing(false), 2000);
      }, 700);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-5">
      <header className="flex items-center gap-3">
        <Avatar name={child.name} emoji={child.emoji} color={child.color} size="lg" />
        <h1 className="min-w-0 flex-1 truncate text-2xl font-bold">{child.name}</h1>
        {/* For the grown-up: sound is on by default and remembered on this phone. */}
        <button
          type="button"
          onClick={toggleSound}
          aria-label="Sound"
          aria-pressed={!muted}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground shadow-soft"
        >
          {muted ? <VolumeX aria-hidden className="size-5" /> : <Volume2 aria-hidden className="size-5" />}
        </button>
        <HoldToExit href={`/kids/${child.id}`} childName={child.name} />
      </header>

      {weekStart && lastStars ? <NewWeekCard childId={child.id} weekStart={weekStart} lastStars={lastStars} theme={child.theme} /> : null}

      <div ref={picture} className="relative">
        <GardenPicture stars={view.stars} size="lg" theme={child.theme} interactive dancing={dancing} />
        {party !== null && <Confetti key={party} />}
        <p className="sr-only" aria-live="polite">
          {view.stars} {view.stars === 1 ? "star" : "stars"} this week
        </p>
      </div>

      {error && <p role="alert" className="text-center text-base text-destructive">{error}</p>}

      <ul className="grid grid-cols-1 gap-3 pb-4">
        {view.habits.map((h) => {
          const done = h.state !== "open";
          return (
            <li key={h.id}>
              <button
                type="button"
                disabled={saving.has(h.id)}
                aria-busy={saving.has(h.id) || undefined}
                onClick={(e) => {
                  // Done already: a happy wiggle, nothing counted.
                  if (done) {
                    setBumped(h.id);
                    playKidSound("boop");
                    return;
                  }
                  const now = Date.now();
                  if (inFlight.current.has(h.id) || now - (lastTap.current.get(h.id) ?? 0) < SAME_CARD_GAP_MS) return;
                  lastTap.current.set(h.id, now);
                  inFlight.current.add(h.id);
                  setSaving(new Set(inFlight.current));
                  const el = e.currentTarget;
                  const before = view.stars;
                  const allDone = view.habits.every((x) => (x.id === h.id ? x.done + 1 >= x.target : x.state !== "open"));
                  setError(null);
                  startTransition(async () => {
                    tap(h.id);
                    fly(el, before);
                    celebrate(before, allDone);
                    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(10);
                    try {
                      const r = await checkInFor(h.id, child.id, true);
                      if (!r.ok) setError(r.message);
                    } finally {
                      inFlight.current.delete(h.id);
                      setSaving(new Set(inFlight.current));
                    }
                  });
                }}
                onAnimationEnd={() => setBumped((b) => (b === h.id ? null : b))}
                className={cn(
                  "flex min-h-24 w-full touch-manipulation items-center gap-4 rounded-3xl border-2 p-4 text-left shadow-soft transition-colors",
                  done ? "border-done bg-done text-done-foreground" : "border-transparent bg-card active:bg-accent",
                  bumped === h.id && "animate-wiggle",
                )}
              >
                {/* The picture first: a child knows 🪥, the title is for the grown-up. */}
                <span aria-hidden className={cn("flex size-20 shrink-0 items-center justify-center rounded-full text-6xl leading-none", done ? "bg-white/20" : "bg-accent")}>
                  {h.emoji}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="text-lg font-semibold leading-tight">{h.title}</span>
                  {h.target > 1 && (
                    <span aria-hidden className="flex flex-wrap gap-1.5">
                      {Array.from({ length: h.target }, (_, i) => (
                        <span key={i} className={cn("size-5 rounded-full", i < h.done ? (done ? "bg-done-foreground" : "bg-done") : done ? "bg-done-foreground/40" : "bg-muted ring-1 ring-border")} />
                      ))}
                    </span>
                  )}
                </span>
                {done ? (
                  <>
                    <Check aria-hidden className="size-12 shrink-0" strokeWidth={3} />
                    <span className="sr-only">, done</span>
                  </>
                ) : (
                  // Where the ✓ will go: an empty circle says "tap here".
                  <span aria-hidden className="size-12 shrink-0 rounded-full border-2 border-primary/50 bg-background" />
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {flying.map((s) => (
        <span
          key={s.key}
          aria-hidden
          className="pointer-events-none fixed z-50 flex size-10 items-center justify-center text-4xl leading-none motion-safe:animate-star-fly motion-reduce:hidden"
          // Centred by offset, not translate: the animation owns the transform.
          style={{ left: s.x - 20, top: s.y - 20, ["--fly-x" as string]: `${s.dx}px`, ["--fly-y" as string]: `${s.dy}px` }}
        >
          {s.emoji}
        </span>
      ))}
    </div>
  );
}
