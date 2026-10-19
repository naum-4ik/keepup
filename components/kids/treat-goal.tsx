"use client";

import { PenLine } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { useTranslations } from "next-intl";
import { useActionState, useState, useTransition } from "react";
import { cancelGoal, markReceived, setGoal, type KidActionResult, type KidFormState } from "@/app/(app)/kids/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { Section } from "@/components/ui/section";
import { reach } from "@/lib/reach";
import type { Gender } from "@/lib/garden";
import { GOAL_DEFAULT_EMOJI, GOAL_DEFAULT_TARGET, GOAL_TITLE_MAX } from "@/lib/kid-schema";
import type { TreatGoal as Goal } from "@/lib/kids";
import { useT } from "@/lib/i18n/client";
import { TREAT_EMOJI, TREAT_IDEAS, treatTitle } from "@/lib/treat-ideas";
import { cn } from "@/lib/utils";
import { keepFormValues } from "@/lib/keep-form-values";

const initialState: KidFormState = { status: "idle" };
const STAR_PICKS = [10, 20, 30];
const SHORT_IDEAS = 6;
const bdi = (c: React.ReactNode) => <bdi>{c}</bdi>;

// What just happened to the goal, said where it happened (the section changes in place: a set goal
// takes the form's place, a received or cancelled one gives it back).
type Done = { kind: "set" | "received" | "cancelled"; treat: string };
const DONE_KEY = { set: "setDone", received: "receivedDone", cancelled: "cancelledDone" } as const;

// ideas/achievements-and-rewards.md §8: a treat the family agrees on, reached with stars.
export function TreatGoal({ childId, childName, gender, goal }: { childId: string; childName: string; gender: Gender; goal: Goal | null }) {
  const t = useTranslations("kids.goal");
  const tc = useTranslations("common");
  const [done, setDone] = useState<Done | null>(null);
  return (
    <Section title={t("title")}>
      {done && (
        <Notice tone="success" live dismiss={{ onDismiss: () => setDone(null), label: tc("dismiss") }}>
          {t.rich(DONE_KEY[done.kind], { treat: done.treat, name: childName, bdi })}
        </Notice>
      )}
      {goal ? (
        <ActiveGoal childId={childId} childName={childName} gender={gender} goal={goal} onDone={setDone} />
      ) : (
        <SetGoalForm childId={childId} onSet={(treat) => setDone({ kind: "set", treat })} />
      )}
    </Section>
  );
}

function ActiveGoal({ childId, childName, gender, goal, onDone }: { childId: string; childName: string; gender: Gender; goal: Goal; onDone: (d: Done) => void }) {
  const t = useTranslations("kids.goal");
  const tk = useTranslations("kids.errors");
  const [pending, startTransition] = useTransition();
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const reached = goal.reached_at !== null;
  const stars = reached ? goal.target : Math.min(goal.stars, goal.target);
  const send = (fn: () => Promise<KidActionResult>) => reach(fn, { offline: tk("offline"), reload: tk("reload") }, { rethrow: unstable_rethrow });

  return (
    <div className="flex flex-col gap-item">
      <p className="flex items-center gap-inner font-bold">
        <span aria-hidden className="text-2xl leading-none">{goal.emoji}</span>
        {goal.title}
      </p>
      {/* The star-dot path: one dot per star, filled as they come, leading to the treat. */}
      <div
        role="img"
        aria-label={t("starsLabel", { stars, target: goal.target })}
        // 6 px between the 12 px dots: a path, tighter than the 8 px scale on purpose.
        className="flex flex-wrap items-center gap-1.5"
      >
        {Array.from({ length: goal.target }, (_, i) => (
          <span
            key={i}
            aria-hidden
            className={cn("size-3 rounded-full", i < stars ? "bg-pending" : "bg-muted ring-1 ring-border")}
          />
        ))}
        <span aria-hidden className="text-2xl leading-none">{goal.emoji}</span>
      </div>
      {reached ? (
        <>
          <p className="font-semibold text-done">{t.rich("reached", { name: childName, gender: gender ?? "other", bdi })}</p>
          <Button
            type="button"
            className="h-11"
            disabled={pending}
            onClick={() => {
              setError(null);
              setMarking(true);
              startTransition(async () => {
                const r = await send(() => markReceived(goal.id, childId));
                setMarking(false);
                if (r.ok) onDone({ kind: "received", treat: goal.title });
                else setError(r.message);
              });
            }}
          >
            {marking ? t("marking") : t("markReceived")}
          </Button>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{t("progress", { stars, target: goal.target })}</p>
      )}
      {error && !confirming && (
        <Notice tone="error" live>
          {error}
        </Notice>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          setConfirming(true);
        }}
        className="-ms-inner h-11 w-fit rounded-full px-inner text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        {t("cancel")}
      </button>

      {/* Like the other destructive actions: an in-app confirm with the error inline. */}
      <Dialog open={confirming} onOpenChange={(next) => !pending && setConfirming(next)}>
        <DialogContent>
          <div className="flex flex-col pe-10">
            <DialogTitle>{t("cancelTitle")}</DialogTitle>
            <DialogDescription>{t.rich("cancelDescription", { goal: goal.title, name: childName, gender: gender ?? "other", bdi })}</DialogDescription>
          </div>
          {error && (
            <Notice tone="error" live>
              {error}
            </Notice>
          )}
          <div className="flex gap-inner">
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
                  const r = await send(() => cancelGoal(goal.id, childId));
                  setError(r.ok ? null : r.message);
                  if (!r.ok) return;
                  // Closed first: behind the dialog the section's line couldn't be seen.
                  setConfirming(false);
                  onDone({ kind: "cancelled", treat: goal.title });
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

function SetGoalForm({ childId, onSet }: { childId: string; onSet: (treat: string) => void }) {
  const { t: tr } = useT();
  const t = useTranslations("kids.goal");
  const tc = useTranslations("common");
  const tk = useTranslations("kids.errors");
  const [open, setOpen] = useState(false);
  // Offline or a request that dies says what to do, with the form kept (keepFormValues).
  const [state, formAction, pending] = useActionState(async (prev: KidFormState, formData: FormData): Promise<KidFormState> => {
    const r = await reach(() => setGoal(childId, prev, formData), { offline: tk("offline"), reload: tk("reload") }, { rethrow: unstable_rethrow });
    if ("ok" in r) return { status: "error", message: r.message };
    if (r.status === "saved") onSet(String(formData.get("title") ?? "").trim());
    return r;
  }, initialState);
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
  // wrap-normal break-normal: idea names wrap between words only (the page is wrap-anywhere).
  const tile =
    "flex min-h-24 flex-col items-center justify-center gap-inner rounded-2xl border-2 bg-card p-inner text-center text-xs font-semibold leading-tight wrap-normal break-normal shadow-soft hover:bg-muted aria-pressed:border-primary aria-pressed:bg-accent";

  return (
    <form onSubmit={keepFormValues(formAction)} className="flex flex-col gap-item">
      <div className="flex flex-col gap-inner">
        <p id="treat-ideas" className="text-sm font-semibold">{t("choose")}</p>
        <div role="group" aria-labelledby="treat-ideas" className="grid grid-cols-3 gap-inner">
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
        <div className="flex flex-col gap-inner">
          <Label htmlFor="goal-title" className="font-semibold">{t("treat")}</Label>
          <div className="flex items-center gap-inner">
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
            // As many 44 px tiles as fit (5 at 320; 6 a row made them 36 px). 12 px padding: the 12 px radius.
            <div role="group" aria-label={t("emojiGroup")} className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-inner rounded-xl bg-muted/50 p-3">
              {TREAT_EMOJI.map((e) => (
                <button
                  key={e}
                  type="button"
                  aria-pressed={e === emoji}
                  onClick={() => {
                    setEmoji(e);
                    setEmojiOpen(false);
                  }}
                  className="flex h-11 items-center justify-center rounded-xl text-2xl leading-none hover:bg-card aria-pressed:bg-accent aria-pressed:ring-2 aria-pressed:ring-primary"
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
        <div className="flex flex-col gap-inner">
          <p id="goal-stars" className="text-sm font-semibold">{t("starsToCollect")}</p>
          <div role="group" aria-labelledby="goal-stars" className="grid grid-cols-4 gap-inner">
            {STAR_PICKS.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={!otherTarget && target === String(n)}
                onClick={() => {
                  setOtherTarget(false);
                  setTarget(String(n));
                }}
                // ⭐ to its number: one glyph pair, 4 px.
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
            <div className="flex items-center gap-inner">
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

      {state.status === "error" && (
        <Notice tone="error" live>
          {state.message}
        </Notice>
      )}
      <div className="flex gap-inner">
        <Button type="button" variant="outline" className="h-11 flex-1" onClick={() => setOpen(false)} disabled={pending}>
          {tc("cancel")}
        </Button>
        <Button type="submit" className="h-11 flex-1" disabled={pending || !picked}>
          {pending ? t("setting") : t("submit")}
        </Button>
      </div>
    </form>
  );
}
