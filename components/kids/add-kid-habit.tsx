"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { addChildHabit, type KidFormState } from "@/app/(app)/kids/actions";
import { KidTemplateTile } from "@/components/kids/add-child-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HABIT_TITLE_MAX } from "@/lib/habit-schema";
import { KID_TEMPLATES } from "@/lib/kid-templates";

const initialState: KidFormState = { status: "idle" };
// Picture emoji a child recognizes (docs/design.md: a curated kid set).
const KID_EMOJI = ["⭐", ...new Set(KID_TEMPLATES.map((t) => t.emoji)), "🎹", "⚽", "🐶", "🌙"];
const selectClass = "h-11 rounded-xl border border-input bg-card px-3 text-base";

// The kid templates she doesn't have yet, plus "Create your own".
export function AddKidHabit({ childId, existingTitles }: { childId: string; existingTitles: string[] }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [state, formAction, pending] = useActionState(addChildHabit.bind(null, childId), initialState);
  const [emoji, setEmoji] = useState("⭐");
  const have = new Set(existingTitles);
  const templates = KID_TEMPLATES.filter((t) => !have.has(t.title));

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-11 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/30 text-sm font-bold text-primary hover:bg-accent"
      >
        <Plus aria-hidden className="size-4" />
        Add a habit
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {state.status === "error" && <p role="alert" className="text-sm text-destructive">{state.message}</p>}
      {!custom ? (
        <form action={formAction} className="flex flex-col gap-2">
          {templates.map((t) => (
            <button
              key={t.id}
              type="submit"
              name="templateId"
              value={t.id}
              disabled={pending}
              aria-label={`Add ${t.title}`}
              className="flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 border-transparent bg-muted/60 p-3 hover:border-primary/30"
            >
              <KidTemplateTile template={t} />
            </button>
          ))}
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="h-11 flex-1" onClick={() => setOpen(false)}>
              Done
            </Button>
            <Button type="button" variant="outline" className="h-11 flex-1" onClick={() => setCustom(true)}>
              Create your own
            </Button>
          </div>
        </form>
      ) : (
        <form action={formAction} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="kid-habit-title" className="font-semibold">Title</Label>
            <Input id="kid-habit-title" name="title" required maxLength={HABIT_TITLE_MAX} autoComplete="off" className="h-11 rounded-xl px-3 text-base" />
          </div>
          <input type="hidden" name="emoji" value={emoji} />
          <div role="group" aria-label="Emoji" className="grid grid-cols-8 gap-1">
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
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="h-11 flex-1" onClick={() => setCustom(false)} disabled={pending}>
              Back
            </Button>
            <Button type="submit" className="h-11 flex-1" disabled={pending}>
              {pending ? "Adding…" : "Add habit"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
