"use client";

import { PenLine } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState, useTransition } from "react";
import { cancelGoal, markReceived, setGoal, type KidFormState } from "@/app/(app)/kids/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GOAL_DEFAULT_EMOJI, GOAL_DEFAULT_TARGET, GOAL_TITLE_MAX } from "@/lib/kid-schema";
import type { TreatGoal as Goal } from "@/lib/kids";
import { useT } from "@/lib/i18n/client";
import { TREAT_EMOJI, TREAT_IDEAS, treatTitle } from "@/lib/treat-ideas";
import { cn } from "@/lib/utils";

const initialState: KidFormState = { status: "idle" };
const STAR_PICKS = [10, 20, 30];
const SHORT_IDEAS = 6;
const bdi = (c: React.ReactNode) => <bdi>{c}</bdi>;

// ideas/achievements-and-rewards.md §8: a treat the family agrees on, reached with stars.
export function TreatGoal({ childId, childName, goal }: { childId: string; childName: string; goal: Goal | null }) {
  const t = useTranslations("kids.goal");
  return (
    <section aria-label={t("title")} className="flex flex-col gap-3 rounded-2xl bg-card p-5 shadow-soft">
      <h2 className="text-sm font-bold text-muted-foreground">{t("title")}</h2>
      {goal ? <ActiveGoal childId={childId} childName={childName} goal={goal} /> : <SetGoalForm childId={childId} />}
    </section>
  );
}

function ActiveGoal({ childId, childName, goal }: { childId: string; childName: string; goal: Goal }) {
  const t = useTranslations("kids.goal");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
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
        aria-label={t("starsLabel", { stars, target: goal.target })}
        className="flex flex-wrap items-center gap-1.5"
      >
        {Array.from({ length: goal.target }, (_, i) => (
          <span
            key={i}
            aria-hidden
            className={cn("size-3 rounded-full", i < stars ? "bg-pending" : "bg-muted ring-1 ring-border")}
          />
        ))}
        <span aria-hidden className="ml-1 text-2xl leading-none">{goal.emoji}</span>
      </div>
      {reached ? (
        <>
          <p className="font-semibold text-done">{t.rich("reached", { name: childName, bdi })}</p>
          <Button type="button" className="h-11" disabled={pending} onClick={() => run(() => markReceived(goal.id, childId))}>
            {t("markReceived")}
          </Button>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{t("progress", { stars, target: goal.target })}</p>
      )}
      {error && !confirming && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          setConfirming(true);
        }}
        className="h-11 w-fit rounded-full px-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        {t("cancel")}
      </button>

      {/* Like the other destructive actions: an in-app confirm with the error inline. */}
      <Dialog open={confirming} onOpenChange={(next) => !pending && setConfirming(next)}>
        <DialogContent>
          <div className="flex flex-col gap-1 pr-10">
            <DialogTitle>{t("cancelTitle")}</DialogTitle>
            <DialogDescription>{t.rich("cancelDescription", { goal: goal.title, name: childName, bdi })}</DialogDescription>
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="h-11 flex-1" disabled={pending} onClick={() => setConfirming(false)}>
              {t("keep")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-11 flex-1"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await cancelGoal(goal.id, childId);
                  setError(r.ok ? null : (r.message ?? null));
                  if (r.ok) setConfirming(false);
                })
              }
            >
              {pending ? t("cancelling") : t("cancel")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const OWN = "own";

function SetGoalForm({ childId }: { childId: string }) {
  const { t: tr } = useT();
  const t = useTranslations("kids.goal");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(setGoal.bind(null, childId), initialState);
  const [picked, setPicked] = useState<string | null>(null); // an idea's id, OWN, or nothing yet
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState<string>(GOAL_DEFAULT_EMOJI);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [allIdeas, setAllIdeas] = useState(false);
  const [target, setTarget] = useState(String(GOAL_DEFAULT_TARGET));
  const [otherTarget, setOtherTarget] = useState(false);

  if (!open) {
    return (
      <>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
        <Button type="button" variant="outline" className="h-11" onClick={() => setOpen(true)}>
          {t("set")}
        </Button>
      </>
    );
  }

  const ideas = allIdeas ? TREAT_IDEAS : TREAT_IDEAS.slice(0, SHORT_IDEAS);
  const tile =
    "flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 bg-card p-2 text-center text-xs font-semibold leading-tight hover:bg-muted aria-pressed:border-primary aria-pressed:bg-accent";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p id="treat-ideas" className="text-sm font-semibold">{t("choose")}</p>
        <div role="group" aria-labelledby="treat-ideas" className="grid grid-cols-3 gap-2">
          {ideas.map((idea) => (
            <button
              key={idea.id}
              type="button"
              aria-pressed={picked === idea.id}
              onClick={() => {
                setPicked(idea.id);
                setTitle(treatTitle(tr, idea.id));
                setEmoji(idea.emoji);
                setEmojiOpen(false);
              }}
              className={cn(tile, "border-transparent")}
            >
              <span aria-hidden className="text-4xl leading-none">{idea.emoji}</span>
              {treatTitle(tr, idea.id)}
            </button>
          ))}
          {!allIdeas && (
            <button type="button" onClick={() => setAllIdeas(true)} className={cn(tile, "border-dashed border-border text-primary")}>
              <span aria-hidden className="text-3xl leading-none">…</span>
              {t("moreIdeas")}
            </button>
          )}
          <button
            type="button"
            aria-pressed={picked === OWN}
            onClick={() => {
              setPicked(OWN);
              setTitle("");
              setEmoji(GOAL_DEFAULT_EMOJI);
            }}
            className={cn(tile, "border-dashed border-border")}
          >
            <PenLine aria-hidden className="size-8 text-primary" />
            {t("own")}
          </button>
        </div>
      </div>

      {picked && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="goal-title" className="font-semibold">{t("treat")}</Label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={t("picture", { emoji })}
              aria-expanded={emojiOpen}
              onClick={() => setEmojiOpen((o) => !o)}
              className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-input text-2xl leading-none hover:bg-muted"
            >
              {emoji}
            </button>
            <Input
              id="goal-title"
              name="title"
              required
              maxLength={GOAL_TITLE_MAX}
              autoComplete="off"
              autoFocus={picked === OWN}
              placeholder={t("placeholder")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-11 rounded-xl px-3 text-base"
            />
          </div>
          {emojiOpen && (
            <div role="group" aria-label={t("emojiGroup")} className="grid grid-cols-6 gap-1 rounded-xl bg-muted/50 p-1">
              {TREAT_EMOJI.map((e) => (
                <button
                  key={e}
                  type="button"
                  aria-pressed={e === emoji}
                  onClick={() => {
                    setEmoji(e);
                    setEmojiOpen(false);
                  }}
                  className="flex h-11 items-center justify-center rounded-lg text-2xl leading-none hover:bg-card aria-pressed:bg-accent aria-pressed:ring-2 aria-pressed:ring-primary"
                >
                  {e}
                </button>
              ))}
            </div>
          )}
          <input type="hidden" name="emoji" value={emoji} />
        </div>
      )}

      {picked && (
        <div className="flex flex-col gap-2">
          <p id="goal-stars" className="text-sm font-semibold">{t("starsToCollect")}</p>
          <div role="group" aria-labelledby="goal-stars" className="grid grid-cols-4 gap-2">
            {STAR_PICKS.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={!otherTarget && target === String(n)}
                onClick={() => {
                  setOtherTarget(false);
                  setTarget(String(n));
                }}
                className="flex h-11 items-center justify-center gap-1 rounded-xl border border-border text-sm font-semibold tabular-nums hover:bg-muted aria-pressed:border-primary aria-pressed:bg-accent"
              >
                ⭐ {n}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={otherTarget}
              onClick={() => setOtherTarget(true)}
              className="flex h-11 items-center justify-center rounded-xl border border-border text-sm font-semibold hover:bg-muted aria-pressed:border-primary aria-pressed:bg-accent"
            >
              {t("other")}
            </button>
          </div>
          {otherTarget ? (
            <div className="flex items-center gap-2">
              <Label htmlFor="goal-target" className="text-sm">{t("stars")}</Label>
              <Input
                id="goal-target"
                name="target"
                type="number"
                inputMode="numeric"
                min={1}
                max={200}
                autoFocus
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                required
                className="h-11 w-24 rounded-xl px-3 text-base"
              />
            </div>
          ) : (
            <input type="hidden" name="target" value={target} />
          )}
          <p className="text-xs text-muted-foreground">{t("earns")}</p>
        </div>
      )}

      {state.status === "error" && <p role="alert" className="text-sm text-destructive">{state.message}</p>}
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="h-11 flex-1" onClick={() => setOpen(false)} disabled={pending}>
          {tc("cancel")}
        </Button>
        <Button type="submit" className="h-11 flex-1" disabled={pending || !picked}>
          {pending ? tc("saving") : t("submit")}
        </Button>
      </div>
    </form>
  );
}
