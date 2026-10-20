"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updateHabitDetails, type DetailsFormState } from "@/app/(app)/habits/actions";
import { EmojiPicker } from "@/components/habits/emoji-picker";
import { StartDatePicker } from "@/components/habits/start-date-picker";
import { SaveButton } from "@/components/save-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { focusFirstInvalid } from "@/lib/focus-first-invalid";
import { categoryLabel, CATEGORY_ORDER } from "@/lib/categories";
import { useT } from "@/lib/i18n/client";
import { isHabitCategory, type HabitCategory } from "@/lib/habit-schema";
import { cn } from "@/lib/utils";

const initialState: DetailsFormState = { status: "idle" };
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
  const { t } = useT();
  const [values, setValues] = useState({ title, emoji, category: category ?? "", startsOn });
  const offerNone = category === null;
  const categoryRef = useRef<HTMLSelectElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const errors = state.status === "error" ? (state.errors ?? {}) : {};

  // <select> doesn't reliably resync from its `value` prop after that same reset, so force it
  // back to our own state (same workaround as HabitFields in habit-form.tsx).
  useEffect(() => {
    if (categoryRef.current) categoryRef.current.value = values.category;
  }, [state, values.category]);
  // A refused field takes focus (after the select above is put back); a failed save is a live alert.
  useEffect(() => {
    if (state.status === "error" && state.errors) focusFirstInvalid(formRef.current);
  }, [state]);

  return (
    // noValidate: the app's own messages beside each field, never the browser's bubbles.
    <form ref={formRef} action={formAction} noValidate className="flex flex-col gap-item">
      <div className="flex flex-col gap-inner">
        <Label htmlFor="title">{t("habits.form.titleLabel")}</Label>
        <EmojiPicker
          value={values.emoji}
          category={isHabitCategory(values.category) ? values.category : null}
          onChange={(e) => setValues((v) => ({ ...v, emoji: e }))}
          error={errors.emoji}
        >
          <Input
            id="title"
            name="title"
            value={values.title}
            onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
            required
            className={fieldClass}
            aria-invalid={Boolean(errors.title)}
            aria-describedby={errors.title ? "edit-title-error" : undefined}
          />
        </EmojiPicker>
        {errors.title && <p id="edit-title-error" className="text-sm text-destructive">{errors.title}</p>}
      </div>
      <div className="flex flex-col gap-inner">
        <Label htmlFor="category">{t("habits.form.categoryLabel")}</Label>
        <select
          id="category"
          name="category"
          ref={categoryRef}
          value={values.category}
          onChange={(e) => setValues((v) => ({ ...v, category: e.target.value }))}
          className={cn(fieldClass, "w-full border border-input bg-transparent")}
          aria-invalid={Boolean(errors.category)}
          aria-describedby={errors.category ? "edit-category-error" : undefined}
        >
          {offerNone && <option value="">{t("habits.details.none")}</option>}
          {CATEGORY_ORDER.map((c) => (
            <option key={c} value={c}>
              {categoryLabel(t, c)}
            </option>
          ))}
        </select>
        {errors.category && <p id="edit-category-error" className="text-sm text-destructive">{errors.category}</p>}
      </div>
      {canEditStart && (
        <fieldset className="flex flex-col gap-inner">
          <legend className="mb-inner text-sm font-semibold">{t("habits.form.starts")}</legend>
          <input type="hidden" name="startsOn" value={values.startsOn} />
          <StartDatePicker
            value={values.startsOn}
            onChange={(startsOn) => setValues((v) => ({ ...v, startsOn }))}
            today={today}
            weekStart={weekStart}
            errorId={errors.startsOn ? "edit-startsOn-error" : undefined}
          />
          {errors.startsOn && <p id="edit-startsOn-error" className="text-sm text-destructive">{errors.startsOn}</p>}
        </fieldset>
      )}
      {/* Pinned above the bottom nav while the form is on screen (as in Add a child), so Save is in
          reach on a phone however far the date picker opens. The bar spans <main>'s 16px sides. */}
      <div className="sticky bottom-[calc(var(--nav-height)+env(safe-area-inset-bottom))] z-10 -mx-item flex flex-col gap-inner bg-background px-item py-inner">
        {state.status === "error" && state.message && <Notice tone="error" live>{state.message}</Notice>}
        <SaveButton state={state} pending={pending} />
      </div>
    </form>
  );
}
