"use client";

import { useEffect, useEffectEvent, useLayoutEffect, useMemo, useOptimistic, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { Check, Volume2, VolumeX } from "lucide-react";
import { checkInFor } from "@/app/(app)/kids/actions";
import { Avatar } from "@/components/avatar";
import { Confetti } from "@/components/celebrations/confetti";
import { GardenPicture } from "@/components/kids/garden";
import { NewWeekCard } from "@/components/kids/new-week-card";
import { HoldToExit } from "@/components/kids/hold-to-exit";
import { useReducedMotion } from "@/components/kids/use-calm";
import { useOfflineQueue, useSubmitTap } from "@/components/offline/offline-queue-provider";
import { stageFor, themeStages } from "@/lib/garden";
import { createTapGuard, inOrder, orderForKid } from "@/lib/kid-order";
import { createMoments, FLY_AT, kindOfTap, LAND_AT, type Moment, type Moments } from "@/lib/kid-reveal";
import { isMuted, playKidSound, setMuted } from "@/lib/kid-sound";
import { withQueuedTaps } from "@/lib/offline-sync";
import { MAX_ITEMS, sceneItems } from "@/lib/scene-items";
import type { CheckInState } from "@/lib/schedule";
import { cn } from "@/lib/utils";

type PlayHabit = { id: string; title: string; emoji: string; target: number; done: number; state: CheckInState };
type Child = { id: string; name: string; emoji: string | null; color: string | null; theme: string };
type Flying = { key: number; emoji: string; x: number; y: number; dx: number; dy: number };
// Where a big thing in the middle of the screen goes: from the middle to its place, and its size there.
type Goal = { dx: number; dy: number; scale: number };
// The big moment playing over the screen (lib/kid-reveal.ts): a reveal (the item this tap adds, at its
// scene `index`; none once the scene is full) or a milestone (the new picture, its goal measured at the tap).
type Big = {
  emoji: string;
  habitId: string;
  index: number | null;
  allDone: boolean;
  tappedAt: number;
  // The tap finished its habit: the card holds its place until this lands.
  holds: boolean;
  goal?: Goal;
};
type Landed = { index: number; key: number };
// A tap still saving, and the habit's count (without it) when it was made.
type Tap = { habitId: string; doneAtTap: number };

// The new picture's size on screen during its moment (it lands at text-8xl, 96px).
const MILESTONE_PX = 240;

// The big reveal: the box is about 60% of the screen's width, the emoji a little smaller inside it.
const REVEAL_BOX = "min(60vw, 420px)";
const REVEAL_GLYPH = "min(48vw, 336px)";
// A sparkle burst around it, a fixed fan (no Math.random: server and client agree).
const SPARKS = Array.from({ length: 10 }, (_, i) => {
  const angle = (i / 10) * 2 * Math.PI + 0.3;
  const dist = 130 + ((i * 37) % 50);
  return { dx: Math.round(Math.cos(angle) * dist), dy: Math.round(Math.sin(angle) * dist), delay: 60 + (i % 3) * 50 };
});
// After its item lands, a finished card waits this long before it slides down (but never less than
// SETTLE_MS after the tap).
const AFTER_LAND_MS = 250;
const DANCE_MS = 2000;

// Two quick taps on the same card (a toddler's double tap) count once.
const SAME_CARD_GAP_MS = 2000;

// A card that turns green stays put a moment (the star flies, the scene grows), then slides down to the
// done ones. While it slides, the moving cards don't take taps (lib/kid-order.ts createTapGuard). A
// finger on the list holds the slide back, up to MAX_HOLD_MS after the tap.
const SETTLE_MS = 1000;
const SLIDE_MS = 350;
const MAX_HOLD_MS = 3000;

const without = <T,>(s: ReadonlySet<T>, x: T | null): ReadonlySet<T> => {
  if (x === null || !s.has(x)) return s;
  const next = new Set(s);
  next.delete(x);
  return next;
};

// Once the picture sticks to the top, it shrinks as the list scrolls on, down to this size, so the
// cards under it stay in view; the strip above the cards always closes up with it.
const MIN_SCALE = 0.6;

// The mute setting lives in localStorage; this keeps the button in step (and renders "on" on the server).
const soundListeners = new Set<() => void>();
const subscribeSound = (cb: () => void) => {
  soundListeners.add(cb);
  return () => soundListeners.delete(cb);
};

// FLIP for the list: a card is drawn back where it was (no transition), then slides to its new place.
function placeAt(el: HTMLElement, dy: number) {
  el.style.transition = "none";
  el.style.transform = `translateY(${dy}px)`;
  // The card going down passes over the others.
  el.style.zIndex = dy < 0 ? "1" : "";
}

function slideHome(el: HTMLElement) {
  el.style.transition = `transform ${SLIDE_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
  el.style.transform = "";
  const done = (e: TransitionEvent) => {
    if (e.target !== el) return; // the button's colour change bubbles up too
    el.style.transition = "";
    el.style.zIndex = "";
    el.removeEventListener("transitionend", done);
  };
  el.addEventListener("transitionend", done);
}

// The picture at `scale` (from its top), with the page behind it ending 8px under it (the wrapper's
// 8px top padding included). Written straight to the elements on scroll, no re-render.
function shrinkTo(wrap: HTMLElement, pic: HTMLElement, backdrop: HTMLElement, height: number, scale: number) {
  pic.style.scale = scale === 1 ? "" : String(scale);
  backdrop.style.bottom = `${height * (1 - scale) - 8}px`;
  if (scale < 1) wrap.dataset.shrunk = "";
  else delete wrap.dataset.shrunk;
}

// The full-screen kid view (ideas/kid-view-next.md §4), for children as young as 2–3: a tap counts at
// once (logged as by the child), with a pop sound, and the thing it adds flies from the card into the
// week's scene. A new picture brings a chime and confetti; the last habit of the day makes the scene
// dance. Tapping a done card or the scene is play: a wiggle and a sound, nothing counted.
// No numbers or text for the child; the star count and "what's next" are on the kid page.
// With more habits than fit (ideas/kid-view-next.md, 2026-10-04): open ones come first and done ones
// slide to the bottom, and the picture sticks to the top (smaller once scrolled), so every tap's effect
// stays in sight. When nothing happens, the scene moves gently by itself.
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
  const { delta, ready } = useOfflineQueue();
  const submitTap = useSubmitTap();
  // Taps saved on the phone count on screen until they sync, so the star doesn't vanish in the car,
  // and a queued card counts as done for the order (it still sinks).
  const base = useMemo(() => {
    const q = withQueuedTaps(habits, delta, child.id);
    return { habits: q.habits, stars: stars + q.added };
  }, [habits, stars, delta, child.id]);
  // A tap shows at once and until the new count arrives, from the server or from the queue: a tap is
  // drawn only while its habit's count hasn't moved past where it was, so it never counts twice.
  const [taps, tap] = useOptimistic<Tap[], Tap>([], (s, t) => [...s, t]);
  const view = useMemo(() => {
    const shown = base.habits.map((h) => {
      const mine = taps.filter((t) => t.habitId === h.id && h.done <= t.doneAtTap).length;
      const done = h.done + Math.min(mine, Math.max(0, h.target - h.done));
      return done === h.done ? h : { ...h, done, state: (done >= h.target ? "done" : "open") as CheckInState };
    });
    const extra = shown.reduce((n, h, i) => n + h.done - base.habits[i].done, 0);
    return { habits: shown, stars: base.stars + extra };
  }, [base, taps]);
  const [error, setError] = useState<string | null>(null);
  const [flying, setFlying] = useState<Flying[]>([]);
  const [bumped, setBumped] = useState<string | null>(null);
  const [cheer, setCheer] = useState<string | null>(null);
  const [dance, setDance] = useState<number | null>(null);
  const dancing = dance !== null;
  const picture = useRef<HTMLDivElement>(null);
  const bigGlyph = useRef<HTMLSpanElement>(null);
  const seq = useRef(0);
  // The big reveal (ideas/kid-view-next.md, decided 2026-10-05; lib/kid-reveal.ts). While an item is on
  // its way, it's drawn invisible at its spot (`hidden`) and its card holds its place (`holding`); items
  // that came this way don't pop on their own (`revealed`); the last one in flashes its spot (`landed`).
  const [showing, setShowing] = useState<Moment<Big> | null>(null);
  const [hidden, setHidden] = useState<ReadonlySet<number>>(() => new Set());
  const [revealed, setRevealed] = useState<ReadonlySet<number>>(() => new Set());
  const [holding, setHolding] = useState<ReadonlySet<string>>(() => new Set());
  const [landed, setLanded] = useState<Landed | null>(null);
  // How long the next settle waits (see AFTER_LAND_MS); null: SETTLE_MS.
  const settleIn = useRef<number | null>(null);
  const muted = useSyncExternalStore(subscribeSound, isMuted, () => false);
  const reduce = useReducedMotion();

  // The list order: open first, done last, settled a moment after a card turns green (see SETTLE_MS).
  const [order, setOrder] = useState(() => orderForKid(base.habits).map((h) => h.id));
  // The saved queue arrives just after the first render: a card already queued (offline, after a
  // reload) takes its place at once, without the slide.
  const [placedQueue, setPlacedQueue] = useState(ready);
  if (ready && !placedQueue) {
    setPlacedQueue(true);
    setOrder(orderForKid(base.habits).map((h) => h.id));
  }
  // An item that went away again (a failed save) isn't "revealed" any more: the next one there pops.
  const gone = [...revealed].filter((i) => i >= view.stars && !hidden.has(i));
  if (gone.length > 0) setRevealed((s) => new Set([...s].filter((i) => !gone.includes(i))));
  const shown = inOrder(order, view.habits);
  const current = shown.map((h) => h.id).join(" ");
  // A card whose item is still on its way stays where it is, as if open (orderForKid keeps the order).
  const target = orderForKid(view.habits.map((h) => (holding.has(h.id) ? { ...h, state: "open" as CheckInState } : h)))
    .map((h) => h.id)
    .join(" ");
  const list = useRef<HTMLUListElement>(null);
  const rows = useRef(new Map<string, HTMLLIElement>());
  const slideFrom = useRef<Map<string, number> | null>(null);
  const refocus = useRef<HTMLElement | null>(null);
  const [guard] = useState(createTapGuard);
  // A finger on the list: the cards wait until it lifts.
  const held = useRef(false);
  const waiting = useRef<string | null>(null);

  const settle = useEffectEvent((next: string) => {
    // FLIP: where each card is now, so the layout effect can slide it from there to its new place.
    slideFrom.current = new Map([...rows.current].map(([id, el]) => [id, el.getBoundingClientRect().top]));
    // Moving a card in the DOM drops its focus; give it back without scrolling.
    const active = document.activeElement;
    refocus.current = active instanceof HTMLElement && list.current?.contains(active) ? active : null;
    setOrder(next.split(" ").filter(Boolean));
  });

  // Several taps in a row settle once: each new target restarts the wait.
  useEffect(() => {
    if (target === current) return;
    const wait = settleIn.current ?? SETTLE_MS;
    settleIn.current = null;
    let fallback = 0;
    const t = window.setTimeout(() => {
      if (!held.current) return settle(target);
      waiting.current = target;
      // A pointerup that never comes (the finger slid off the screen) can't hold the list forever.
      fallback = window.setTimeout(() => {
        held.current = false;
        waiting.current = null;
        settle(target);
      }, Math.max(0, MAX_HOLD_MS - wait));
    }, wait);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(fallback);
      waiting.current = null;
    };
  }, [target, current]);
  // A land's shorter wait is for the settle it causes, in that same render; never a later, unrelated one.
  useEffect(() => {
    settleIn.current = null;
  });

  useEffect(() => {
    const lift = () => {
      held.current = false;
      const next = waiting.current;
      waiting.current = null;
      if (next !== null) settle(next);
    };
    // No pointerup when the app goes to the background or loses focus mid-touch: count it as lifted.
    window.addEventListener("pointerup", lift);
    window.addEventListener("pointercancel", lift);
    window.addEventListener("blur", lift);
    document.addEventListener("visibilitychange", lift);
    return () => {
      window.removeEventListener("pointerup", lift);
      window.removeEventListener("pointercancel", lift);
      window.removeEventListener("blur", lift);
      document.removeEventListener("visibilitychange", lift);
    };
  }, []);

  useLayoutEffect(() => {
    const from = slideFrom.current;
    slideFrom.current = null;
    const back = refocus.current;
    refocus.current = null;
    if (back?.isConnected && document.activeElement !== back) back.focus({ preventScroll: true });
    if (!from || reduce) return;
    const moved: HTMLLIElement[] = [];
    const movedIds: string[] = [];
    for (const [id, el] of rows.current) {
      const before = from.get(id);
      if (before === undefined) continue;
      const dy = before - el.getBoundingClientRect().top;
      if (Math.abs(dy) < 1) continue;
      placeAt(el, dy);
      moved.push(el);
      movedIds.push(id);
    }
    if (moved.length === 0) return;
    guard.arm(movedIds, SLIDE_MS);
    list.current?.getBoundingClientRect(); // apply the start positions before the transition
    moved.forEach(slideHome);
  }, [order, reduce, guard]);

  // The picture sticks to the top; past that, it shrinks with the scroll (see MIN_SCALE).
  const sentinel = useRef<HTMLDivElement>(null);
  const sticky = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const mark = sentinel.current;
    const wrap = sticky.current;
    const pic = picture.current;
    const bg = backdrop.current;
    if (!mark || !wrap || !pic || !bg) return;
    // Where the picture sticks and how tall it is, read once and again on resize (not on every scroll).
    // `|| 0`: a top Safari can't parse must not make the scale NaN.
    let stuckAt = 0;
    let height = 1;
    const measure = () => {
      const style = getComputedStyle(wrap);
      stuckAt = (parseFloat(style.top) || 0) + (parseFloat(style.paddingTop) || 0);
      height = pic.offsetHeight || 1;
    };
    let frame = 0;
    const update = () => {
      frame = 0;
      // How far the list has scrolled past the point where the picture stuck.
      const past = stuckAt - mark.getBoundingClientRect().top;
      shrinkTo(wrap, pic, bg, height, Math.max(MIN_SCALE, Math.min(1, 1 - past / height)));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const onResize = () => {
      measure();
      onScroll();
    };
    measure();
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(frame);
    };
  }, []);

  const milestone = showing?.kind === "milestone" ? showing : null;
  // The enter beat (0–0.1 s) draws nothing yet.
  const revealing = showing?.kind === "reveal" && showing.phase !== "enter" ? showing : null;
  const flyingId = revealing?.phase === "fly" ? revealing.id : null;
  const flyingIndex = revealing?.data.index ?? null;

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

  // From the middle of the screen to `el` (a spot in the picture), for something `px` tall there.
  // Measured when it's about to go, so a sticky or shrunk picture is where it is now.
  const goalFor = (el: Element | null | undefined, px: number): Goal => {
    const b = el?.getBoundingClientRect();
    if (!b) return { dx: 0, dy: 0, scale: 0.2 };
    return { dx: b.left + b.width / 2 - window.innerWidth / 2, dy: b.top + b.height / 2 - window.innerHeight / 2, scale: b.height / px };
  };

  // The item's spot (its emoji, drawn invisible until it lands); the stage picture once the scene is full.
  const spotOf = (index: number | null) =>
    (index === null ? null : picture.current?.querySelector(`[data-item="${index}"] > span > span`)) ?? picture.current?.querySelector("[data-hero]");

  const startDance = () => {
    playKidSound("melody");
    const key = ++seq.current;
    setDance(key);
    window.setTimeout(() => setDance((d) => (d === key ? null : d)), DANCE_MS);
  };

  // One big moment at a time (lib/kid-reveal.ts); a new one lands the one playing at once.
  const onMoment = useEffectEvent((moment: Moment<Big> | null) => {
    setShowing(moment);
  });
  const onLand = useEffectEvent((moment: Moment<Big>) => {
    const { data } = moment;
    // A finished card slides down a moment after its big moment is over (reveal or milestone).
    if (data.holds) {
      setHolding((s) => without(s, data.habitId));
      settleIn.current = Math.max(AFTER_LAND_MS, SETTLE_MS - (Date.now() - data.tappedAt));
    }
    if (moment.kind === "reveal") {
      // The real item shows now, its spot flashes and the picture gives a little bounce.
      setHidden((s) => without(s, data.index));
      if (data.index !== null) setLanded({ index: data.index, key: moment.id });
      if (!reduce) {
        picture.current?.querySelector("[data-scene]")?.animate(
          [{ transform: "scale(1)" }, { transform: "scale(1.035)" }, { transform: "scale(1)" }],
          { duration: 360, easing: "ease-out" },
        );
      }
    }
    // The last habit of the day: the scene dances once the big moment is over (one burst at a time).
    if (data.allDone) startDance();
  });
  const moments = useRef<Moments<Big> | null>(null);
  useEffect(() => {
    const m = createMoments<Big>({ change: (x) => onMoment(x), land: (x) => onLand(x) });
    moments.current = m;
    return () => {
      m.dispose();
      moments.current = null;
    };
  }, []);

  // A hidden page can't show a reveal: it lands at once, so nothing is left half-way on return.
  useEffect(() => {
    const away = () => {
      if (document.visibilityState === "hidden") moments.current?.fastForward();
    };
    document.addEventListener("visibilitychange", away);
    return () => document.removeEventListener("visibilitychange", away);
  }, []);

  // The flight (FLY_AT → LAND_AT): every frame it heads for where its spot is now, so it lands right
  // even if the sticky picture shrinks or the list scrolls on the way.
  const revealBox = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const box = revealBox.current;
    if (flyingId === null || !box) return;
    const px = bigGlyph.current?.offsetHeight || 1;
    const start = performance.now();
    let frame = 0;
    const step = (t: number) => {
      const k = Math.min(1, Math.max(0, (t - start) / (LAND_AT - FLY_AT)));
      const p = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2; // ease in and out
      const g = goalFor(spotOf(flyingIndex), px);
      box.style.transform = `translate(${g.dx * p}px, ${g.dy * p}px) scale(${1 + (g.scale - 1) * p})`;
      if (k < 1) frame = requestAnimationFrame(step);
    };
    step(start);
    return () => cancelAnimationFrame(frame);
  }, [flyingId, flyingIndex]);

  // A tap that finishes a habit: the item it adds shows huge in the middle, then flies to its spot.
  const reveal = (habitId: string, stars: number, allDone: boolean, tappedAt: number) => {
    const index = stars < MAX_ITEMS ? stars : null;
    const emoji = index === null ? "⭐" : sceneItems(index + 1, child.theme)[index].emoji;
    playKidSound("pop");
    playKidSound("reveal"); // starts 0.1 s in, as it springs up
    if (index !== null) {
      setRevealed((s) => new Set(s).add(index));
      if (!reduce) setHidden((s) => new Set(s).add(index));
    }
    setHolding((s) => new Set(s).add(habitId));
    // Reduce Motion: no zoom or fly; it lands (fades in at its spot) at once.
    moments.current?.play("reveal", { emoji, habitId, index, allDone, tappedAt, holds: true }, { instant: reduce });
  };

  // A new picture zooms in big in the middle of the screen, then shrinks into its place in the scene.
  const zoomIn = (habitId: string, stars: number, allDone: boolean, tappedAt: number, holds: boolean) => {
    playKidSound("chime");
    if (holds) setHolding((s) => new Set(s).add(habitId));
    // Its size there: smaller while the picture is shrunk.
    const goal = goalFor(picture.current?.querySelector("[data-hero]"), MILESTONE_PX);
    const emoji = themeStages(child.theme)[stageFor(stars + 1)].icon;
    moments.current?.play("milestone", { emoji, habitId, index: null, allDone, tappedAt, holds, goal });
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

      {/* The app draws under the iPhone status bar: cards scrolling up pass under this strip. */}
      <div aria-hidden className="fixed inset-x-0 top-0 z-20 h-[env(safe-area-inset-top)] bg-background" />
      {/* Where the picture sits before it sticks (the negative margin cancels the column's gap). */}
      <div ref={sentinel} aria-hidden className="-mb-5 h-0" />
      <div ref={sticky} className="sticky top-[env(safe-area-inset-top)] z-20 -mt-2 pt-2">
        {/* The page behind the picture, so cards slide under it cleanly; it closes up as the picture shrinks. */}
        <div ref={backdrop} aria-hidden className="absolute -inset-x-4 top-0 -bottom-2 bg-background" />
        <div ref={picture} className="relative origin-top">
          <GardenPicture
            stars={view.stars}
            size="lg"
            theme={child.theme}
            interactive
            dancing={dancing}
            settling={milestone !== null}
            idle={dancing || showing !== null || flying.length > 0 ? "pause" : "play"}
            hidden={hidden}
            revealed={revealed}
            landed={landed}
          />
          {/* One burst at a time: the new picture's, or the bigger one when the day is done (after it). */}
          {milestone && <Confetti key={milestone.id} />}
          {dance !== null && <Confetti key={dance} big />}
          <p className="sr-only" aria-live="polite">
            {view.stars} {view.stars === 1 ? "star" : "stars"} this week
          </p>
        </div>
      </div>

      {error && <p role="alert" className="text-center text-base text-destructive">{error}</p>}

      {/* No scroll anchoring: the page must not follow a card as it slides down. */}
      <ul ref={list} className="grid grid-cols-1 gap-3 pb-4 [overflow-anchor:none]" onPointerDown={() => (held.current = true)}>
        {shown.map((h) => {
          const done = h.state !== "open";
          return (
            <li
              key={h.id}
              className="relative"
              ref={(el) => {
                rows.current.set(h.id, el!);
                return () => {
                  rows.current.delete(h.id);
                };
              }}
            >
              <button
                type="button"
                disabled={saving.has(h.id)}
                aria-busy={saving.has(h.id) || undefined}
                onClick={(e) => {
                  // This card is sliding to its new place: a wiggle, nothing counted, so the tap isn't silent.
                  if (guard.blocks(h.id)) {
                    setBumped(h.id);
                    playKidSound("boop");
                    return;
                  }
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
                  // Outside the transition: its updates wait for the save, and these must show at once.
                  // One effect per tap (lib/kid-reveal.ts): a new picture wins over the big reveal, and part
                  // of a 2×-a-day habit keeps the small one (the item flies from the card).
                  const kind = kindOfTap({ starsBefore: before, done: h.done, target: h.target });
                  if (kind !== "partial") setCheer(h.id);
                  if (kind === "reveal") reveal(h.id, before, allDone, now);
                  else {
                    fly(el, before);
                    if (kind === "milestone") zoomIn(h.id, before, allDone, now, h.done + 1 >= h.target);
                    else {
                      playKidSound("pop");
                      moments.current?.fastForward(); // whatever is big on screen lands now
                    }
                  }
                  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(10);
                  const doneAtTap = base.habits.find((x) => x.id === h.id)?.done ?? h.done;
                  startTransition(async () => {
                    tap({ habitId: h.id, doneAtTap });
                    // Saved on this phone first, then tried online; offline it just waits (the effect
                    // above already played). lib/offline-client.ts submitTap.
                    try {
                      const r = await submitTap({ habitId: h.id, subjectId: child.id, byChild: true }, (id) => checkInFor(h.id, child.id, true, id));
                      if (!r.ok) setError(r.message);
                    } finally {
                      inFlight.current.delete(h.id);
                      setSaving(new Set(inFlight.current));
                    }
                  });
                }}
                onAnimationEnd={(e) => {
                  if (e.target !== e.currentTarget) return;
                  setBumped((b) => (b === h.id ? null : b));
                  setCheer((c) => (c === h.id ? null : c));
                }}
                className={cn(
                  "flex min-h-24 w-full touch-manipulation items-center gap-4 rounded-3xl border-2 p-4 text-left shadow-soft transition-colors",
                  done ? "border-done bg-done text-done-foreground" : "border-transparent bg-card active:bg-accent",
                  bumped === h.id ? "animate-wiggle" : cheer === h.id && "animate-card-bounce",
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

      {milestone?.data.goal && (
        <span
          key={milestone.id}
          aria-hidden
          data-milestone
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center motion-reduce:hidden"
        >
          <span
            className="relative block leading-none select-none motion-safe:animate-hero-zoom"
            style={{
              fontSize: MILESTONE_PX,
              ["--to-x" as string]: `${milestone.data.goal.dx}px`,
              ["--to-y" as string]: `${milestone.data.goal.dy}px`,
              ["--to-scale" as string]: String(milestone.data.goal.scale),
            }}
          >
            <span className="absolute inset-[-25%] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.9)_0%,rgba(255,255,255,0.4)_45%,rgba(255,255,255,0)_70%)]" />
            <span className="relative">{milestone.data.emoji}</span>
          </span>
        </span>
      )}

      {/* The big reveal: the new item huge in the middle, then on its way to its spot. Decorative (the
          live region above says the stars), never in the way of a tap, and not drawn with Reduce Motion. */}
      {revealing && !reduce && (
        <span
          aria-hidden
          data-reveal
          data-phase={revealing.phase}
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
        >
          <span
            key={revealing.id}
            ref={revealBox}
            data-reveal-item
            // While it flies, the transform is written each frame (see the flight effect above).
            className={cn("relative flex items-center justify-center", revealing.phase === "show" && "animate-reveal-in")}
            style={{ width: REVEAL_BOX, height: REVEAL_BOX }}
          >
            {/* A soft glow, gone as it flies. */}
            <span
              className={cn(
                "absolute inset-[-15%] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.95)_0%,rgba(255,250,220,0.55)_40%,rgba(255,255,255,0)_70%)] transition-opacity duration-300",
                revealing.phase === "fly" && "opacity-0",
              )}
            />
            {revealing.phase === "show" &&
              SPARKS.map((p, i) => (
                <span
                  key={i}
                  className="absolute top-1/2 left-1/2 -mt-4 -ml-4 block size-8 animate-reveal-spark text-3xl leading-none select-none"
                  style={{ animationDelay: `${p.delay}ms`, ["--dx" as string]: `${p.dx}px`, ["--dy" as string]: `${p.dy}px` }}
                >
                  ✨
                </span>
              ))}
            <span ref={bigGlyph} data-reveal-glyph className="relative block leading-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.18)] select-none" style={{ fontSize: REVEAL_GLYPH }}>
              {revealing.data.emoji}
            </span>
          </span>
        </span>
      )}

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
