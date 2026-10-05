"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updateHabitDetails, type FormActionState } from "@/app/(app)/habits/actions";
import { EmojiPicker } from "@/components/habits/emoji-picker";
import { StartDatePicker } from "@/components/habits/start-date-picker";
import { SaveButton } from "@/components/save-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORIES, CATEGORY_ORDER, normalizeCategory } from "@/lib/categories";
import type { HabitCategory } from "@/lib/habit-schema";
import { cn } from "@/lib/utils";

const initialState: FormActionState = { status: "idle" };
// Matches the new-habit form: every control shares one 44px height.
const fieldClass = "h-11 rounded-xl px-3 text-base";

export function HabitDetailsForm({
  habitId,
  title,
  emoji,
  category,
  startsOn,
  canEditStart,
  today,
  weekStart,
}: {
  habitId: string;
  title: string;
  emoji: string;
  // null: a child's own habit with no category (kid templates). The form then offers None and keeps it.
  category: HabitCategory | null;
  startsOn: string;
  canEditStart: boolean;
  today: string;
  weekStart: 0 | 1;
}) {
  const [state, formAction, pending] = useActionState(updateHabitDetails.bind(null, habitId), initialState);
  // Controlled, like the new-habit form's HabitFields: a failed save must keep what the user
  // typed rather than reverting to the original values (the browser resets uncontrolled
  // <form> fields to their mount-time defaultValue once the action returns).
  const [values, setValues] = useState({ title, emoji, category: category ?? "", startsOn });
  const offerNone = category === null;
  const categoryRef = useRef<HTMLSelectElement>(null);

  // <select> doesn't reliably resync from its `value` prop after that same reset, so force it
  // back to our own state (same workaround as HabitFields in habit-form.tsx).
  useEffect(() => {
    if (categoryRef.current) categoryRef.current.value = values.category;
  }, [state, values.category]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Title</Label>
        <EmojiPicker value={values.emoji} category={normalizeCategory(values.category)} onChange={(e) => setValues((v) => ({ ...v, emoji: e }))}>
          <Input
            id="title"
            name="title"
            value={values.title}
            onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
            className={fieldClass}
          />
        </EmojiPicker>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="category">Category</Label>
        <select
          id="category"
          name="category"
          ref={categoryRef}
          value={values.category}
          onChange={(e) => setValues((v) => ({ ...v, category: e.target.value }))}
          className={cn(fieldClass, "w-full border border-input bg-transparent")}
        >
          {offerNone && <option value="">None</option>}
          {CATEGORY_ORDER.map((c) => (
            <option key={c} value={c}>
              {CATEGORIES[c].label}
            </option>
          ))}
        </select>
      </div>
      {canEditStart && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-sm font-semibold">Starts</legend>
          <input type="hidden" name="startsOn" value={values.startsOn} />
          <StartDatePicker
            value={values.startsOn}
            onChange={(startsOn) => setValues((v) => ({ ...v, startsOn }))}
            today={today}
            weekStart={weekStart}
          />
        </fieldset>
      )}
      {state.status === "error" && <p role="alert" className="text-sm text-destructive">{state.message}</p>}
      <SaveButton state={state} pending={pending} variant="outline" />
    </form>
  );
}
