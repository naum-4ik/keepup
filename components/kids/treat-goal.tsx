"use client";

import { useActionState, useState, useTransition } from "react";
import { cancelGoal, markReceived, setGoal, type KidFormState } from "@/app/(app)/kids/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GOAL_DEFAULT_EMOJI, GOAL_DEFAULT_TARGET, GOAL_TITLE_MAX } from "@/lib/kid-schema";
import type { TreatGoal as Goal } from "@/lib/kids";
import { TREAT_EMOJI, TREAT_IDEAS } from "@/lib/treat-ideas";
import { cn } from "@/lib/utils";

const initialState: KidFormState = { status: "idle" };
const STAR_PICKS = [10, 20, 30];
const SHORT_IDEAS = 6;

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
  const [emoji, setEmoji] = useState<string>(GOAL_DEFAULT_EMOJI);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState(String(GOAL_DEFAULT_TARGET));
  const [allIdeas, setAllIdeas] = useState(false);

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
      <div className="flex flex-col gap-2">
        <p id="treat-ideas" className="text-sm font-semibold">Ideas</p>
        <div role="group" aria-labelledby="treat-ideas" className="flex flex-wrap gap-2">
          {(allIdeas ? TREAT_IDEAS : TREAT_IDEAS.slice(0, SHORT_IDEAS)).map((idea) => {
            const on = title === idea.title;
            return (
              <button
                key={idea.title}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setTitle(idea.title);
                  setEmoji(idea.emoji);
                }}
                className="flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm font-semibold hover:bg-muted aria-pressed:border-primary aria-pressed:bg-accent"
              >
                <span aria-hidden className="text-lg leading-none">{idea.emoji}</span>
                {idea.title}
              </button>
            );
          })}
          {!allIdeas && (
            <button
              type="button"
              onClick={() => setAllIdeas(true)}
              className="flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-primary hover:bg-accent"
            >
              More ideas
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="goal-title" className="font-semibold">Treat</Label>
        <Input
          id="goal-title"
          name="title"
          required
          maxLength={GOAL_TITLE_MAX}
          autoComplete="off"
          placeholder="Pick an idea or write your own"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-11 rounded-xl px-3 text-base"
        />
      </div>
      <input type="hidden" name="emoji" value={emoji} />
      <div role="group" aria-label="Treat emoji" className="grid grid-cols-8 gap-1">
        {TREAT_EMOJI.map((e) => (
          <button
            key={e}
            type="button"
            aria-pressed={e === emoji}
            onClick={() => setEmoji(e)}
            className="flex h-11 items-center justify-center rounded-xl text-2xl leading-none hover:bg-muted aria-pressed:bg-accent aria-pressed:ring-2 aria-pressed:ring-primary"
          >
            {e}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="goal-target" className="font-semibold">Stars</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="goal-target"
            name="target"
            type="number"
            inputMode="numeric"
            min={1}
            max={200}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            required
            className="h-11 w-24 rounded-xl px-3 text-base"
          />
          {STAR_PICKS.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={target === String(n)}
              onClick={() => setTarget(String(n))}
              className="flex h-11 items-center gap-1 rounded-full border border-border px-3 text-sm font-semibold tabular-nums hover:bg-muted aria-pressed:border-primary aria-pressed:bg-accent"
            >
              ⭐ {n}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">A check-in earns one star.</p>
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
