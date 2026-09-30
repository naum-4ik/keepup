"use client";

import { useActionState, useState, useTransition } from "react";
import { cancelGoal, markReceived, setGoal, type KidFormState } from "@/app/(app)/kids/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GOAL_DEFAULT_EMOJI, GOAL_DEFAULT_TARGET, GOAL_TITLE_MAX } from "@/lib/kid-schema";
import type { TreatGoal as Goal } from "@/lib/kids";
import { cn } from "@/lib/utils";

const initialState: KidFormState = { status: "idle" };
const TREAT_EMOJI = ["🎁", "🍦", "🎈", "🧁", "🎡", "🍕", "🎨", "🦖"];

// ideas/achievements-and-rewards.md §8: a treat the family agrees on, reached with stars.
export function TreatGoal({ childId, childName, goal }: { childId: string; childName: string; goal: Goal | null }) {
  return (
    <section aria-label="Treat goal" className="flex flex-col gap-3 rounded-2xl bg-card p-5 shadow-soft">
      <h2 className="text-sm font-bold text-muted-foreground">Treat goal</h2>
      {goal ? <ActiveGoal childId={childId} childName={childName} goal={goal} /> : <SetGoalForm childId={childId} />}
    </section>
  );
}

function ActiveGoal({ childId, childName, goal }: { childId: string; childName: string; goal: Goal }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const reached = goal.reached_at !== null;
  const stars = reached ? goal.target : Math.min(goal.stars, goal.target);
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      const r = await fn();
      setError(r.ok ? null : (r.message ?? null));
    });

  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-2 font-bold">
        <span aria-hidden className="text-2xl leading-none">{goal.emoji}</span>
        {goal.title}
      </p>
      {/* The star-dot path: one dot per star, filled as they come, leading to the treat. */}
      <div
        role="img"
        aria-label={`${stars} of ${goal.target} stars`}
        className="flex flex-wrap items-center gap-1.5"
      >
        {Array.from({ length: goal.target }, (_, i) => (
          <span
            key={i}
            aria-hidden
            className={cn("size-3 rounded-full", i < stars ? "bg-[#D4A017]" : "bg-muted ring-1 ring-border")}
          />
        ))}
        <span aria-hidden className="ml-1 text-2xl leading-none">{goal.emoji}</span>
      </div>
      {reached ? (
        <>
          <p className="font-semibold text-[#4F8A5B]">{childName} reached the goal ✓</p>
          <Button type="button" className="h-11" disabled={pending} onClick={() => run(() => markReceived(goal.id, childId))}>
            Mark as received
          </Button>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">⭐ {stars} of {goal.target}</p>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => cancelGoal(goal.id, childId))}
        className="h-11 w-fit rounded-full px-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        Cancel goal
      </button>
    </div>
  );
}

function SetGoalForm({ childId }: { childId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(setGoal.bind(null, childId), initialState);
  const [emoji, setEmoji] = useState(GOAL_DEFAULT_EMOJI);

  if (!open) {
    return (
      <>
        <p className="text-sm text-muted-foreground">Pick a treat to work toward together, like a trip to the zoo.</p>
        <Button type="button" variant="outline" className="h-11" onClick={() => setOpen(true)}>
          Set a goal
        </Button>
      </>
    );
  }
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="goal-title" className="font-semibold">Treat</Label>
        <Input id="goal-title" name="title" required maxLength={GOAL_TITLE_MAX} autoComplete="off" placeholder="Ice cream at the park" className="h-11 rounded-xl px-3 text-base" />
      </div>
      <input type="hidden" name="emoji" value={emoji} />
      <div role="group" aria-label="Treat emoji" className="flex flex-wrap gap-1">
        {TREAT_EMOJI.map((e) => (
          <button
            key={e}
            type="button"
            aria-pressed={e === emoji}
            onClick={() => setEmoji(e)}
            className="flex size-11 items-center justify-center rounded-xl text-2xl leading-none hover:bg-muted aria-pressed:bg-accent aria-pressed:ring-2 aria-pressed:ring-primary"
          >
            {e}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="goal-target" className="font-semibold">Stars</Label>
        <Input id="goal-target" name="target" type="number" inputMode="numeric" min={1} max={200} defaultValue={GOAL_DEFAULT_TARGET} required className="h-11 w-28 rounded-xl px-3 text-base" />
      </div>
      {state.status === "error" && <p role="alert" className="text-sm text-destructive">{state.message}</p>}
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="h-11 flex-1" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" className="h-11 flex-1" disabled={pending}>
          {pending ? "Saving…" : "Set goal"}
        </Button>
      </div>
    </form>
  );
}
