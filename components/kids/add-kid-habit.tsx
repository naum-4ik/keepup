"use client";

import { useActionState, useEffect, useState } from "react";
import { PenLine, Plus } from "lucide-react";
import { addChildHabit, type KidFormState } from "@/app/(app)/kids/actions";
import { KidTemplateTile } from "@/components/kids/add-child-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HABIT_TITLE_MAX } from "@/lib/habit-schema";
import { KID_TEMPLATES, kidTemplatesByGroup } from "@/lib/kid-templates";
import { keepFormValues } from "@/lib/keep-form-values";

const initialState: KidFormState = { status: "idle" };
// Picture emoji a child recognizes (docs/design.md: a curated kid set).
const KID_EMOJI = ["⭐", ...new Set(KID_TEMPLATES.map((t) => t.emoji)), "🌙", "🦷", "🙏"];
const selectClass = "h-11 rounded-xl border border-input bg-card px-3 text-base";

// "Add a habit" opens a dialog: "Create your own" first, then the kid templates she doesn't have yet,
// by group. A template adds straight away (the dialog stays open for more); your own opens a form.
export function AddKidHabit({ childId, childName, existingTitles }: { childId: string; childName: string; existingTitles: string[] }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setCustom(false);
          setOpen(true);
        }}
        className="flex h-11 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/30 text-sm font-bold text-primary hover:bg-accent"
      >
        <Plus aria-hidden className="size-4" />
        Add a habit
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          {custom ? (
            <CustomHabitForm childId={childId} childName={childName} onBack={() => setCustom(false)} onAdded={() => setOpen(false)} />
          ) : (
            <TemplatePicker childId={childId} childName={childName} existingTitles={existingTitles} onCustom={() => setCustom(true)} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function TemplatePicker({
  childId,
  childName,
  existingTitles,
  onCustom,
}: {
  childId: string;
  childName: string;
  existingTitles: string[];
  onCustom: () => void;
}) {
  const [state, formAction, pending] = useActionState(addChildHabit.bind(null, childId), initialState);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const have = new Set(existingTitles);
  const groups = kidTemplatesByGroup(KID_TEMPLATES.filter((t) => !have.has(t.title)));

  return (
    <>
      <div className="flex flex-col gap-1 pr-10">
        <DialogTitle>Add a habit for {childName}</DialogTitle>
        <DialogDescription>Tap one to add it, or make your own.</DialogDescription>
      </div>
      <Button type="button" variant="outline" className="h-12 justify-start gap-3" onClick={onCustom}>
        <PenLine aria-hidden className="size-5 text-primary" />
        Create your own
      </Button>
      {state.status === "error" && <p role="alert" className="text-sm text-destructive">{state.message}</p>}
      <p role="status" className="text-sm font-semibold text-[#4F8A5B]">
        {state.status === "saved" && lastAdded ? `Added ${lastAdded} ✓` : ""}
      </p>
      <form action={formAction} className="flex flex-col gap-4">
        {groups.map((g) => (
          <section key={g.group} aria-label={g.group} className="flex flex-col gap-2">
            <h3 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">{g.group}</h3>
            {g.templates.map((t) => (
              <button
                key={t.id}
                type="submit"
                name="templateId"
                value={t.id}
                disabled={pending}
                onClick={() => setLastAdded(t.title)}
                aria-label={`Add ${t.title}`}
                className="flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 border-transparent bg-muted/60 p-3 hover:border-primary/30"
              >
                <KidTemplateTile template={t} />
              </button>
            ))}
          </section>
        ))}
        {groups.length === 0 && <p className="text-sm text-muted-foreground">{childName} has all the suggested habits.</p>}
      </form>
    </>
  );
}

function CustomHabitForm({
  childId,
  childName,
  onBack,
  onAdded,
}: {
  childId: string;
  childName: string;
  onBack: () => void;
  onAdded: () => void;
}) {
  const [state, formAction, pending] = useActionState(addChildHabit.bind(null, childId), initialState);
  const [emoji, setEmoji] = useState("⭐");
  useEffect(() => {
    if (state.status === "saved") onAdded();
  }, [state, onAdded]);

  return (
    <>
      <div className="flex flex-col gap-1 pr-10">
        <DialogTitle>Your own habit for {childName}</DialogTitle>
        <DialogDescription>Give it a name {childName} understands, and a picture.</DialogDescription>
      </div>
      <form onSubmit={keepFormValues(formAction)} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="kid-habit-title" className="font-semibold">Title</Label>
          <Input
            id="kid-habit-title"
            name="title"
            required
            autoFocus
            maxLength={HABIT_TITLE_MAX}
            autoComplete="off"
            placeholder="Feed the fish"
            className="h-11 rounded-xl px-3 text-base"
          />
        </div>
        <input type="hidden" name="emoji" value={emoji} />
        <p id="kid-habit-emoji" className="text-sm font-semibold">Picture</p>
        <div role="group" aria-labelledby="kid-habit-emoji" className="grid grid-cols-8 gap-1">
          {KID_EMOJI.map((e) => (
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
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="kid-habit-target" className="font-semibold">Times</Label>
            <Input id="kid-habit-target" name="targetCount" type="number" inputMode="numeric" min={1} max={50} defaultValue={1} required className="h-11 w-20 rounded-xl px-3 text-base" />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="kid-habit-period" className="font-semibold">Per</Label>
            <select id="kid-habit-period" name="period" defaultValue="day" className={selectClass}>
              <option value="day">day</option>
              <option value="week">week</option>
              <option value="month">month</option>
            </select>
          </div>
        </div>
        {state.status === "error" && <p role="alert" className="text-sm text-destructive">{state.message}</p>}
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="h-11 flex-1" onClick={onBack} disabled={pending}>
            Back
          </Button>
          <Button type="submit" className="h-11 flex-1" disabled={pending}>
            {pending ? "Adding…" : "Add habit"}
          </Button>
        </div>
      </form>
    </>
  );
}
