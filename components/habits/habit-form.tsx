"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Minus, Plus, Star } from "lucide-react";
import { createHabit } from "@/app/(app)/habits/actions";
import { CategoryIcon } from "@/components/habits/category-icon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORIES, CATEGORY_ORDER } from "@/lib/categories";
import { HABIT_TEMPLATES, type HabitTemplate } from "@/lib/habit-templates";
import {
  HABIT_TITLE_MAX, TARGET_LIMITS, type HabitCategory, type HabitFormState, type HabitFormValues, type HabitPeriod,
} from "@/lib/habit-schema";
import { describeSchedule } from "@/lib/schedule";
import { cn } from "@/lib/utils";

// Every control in the dialog shares one height so the fields line up.
const fieldClass = "h-11 rounded-xl px-3 text-base";
const selectClass = cn(fieldClass, "w-full border border-input bg-transparent");
const initialState: HabitFormState = { status: "idle" };
type Tab = "popular" | HabitCategory;
type Draft = { key: number; custom: boolean; values: HabitFormValues };

export function HabitForm({ today }: { today: string }) {
  const [tab, setTab] = useState<Tab>("popular");
  const [draft, setDraft] = useState<Draft | null>(null);
  const templates = HABIT_TEMPLATES.filter((t) => (tab === "popular" ? t.popular : t.category === tab));

  // Each open gets a new key, so the dialog's form starts fresh (no errors from a previous try).
  const open = (custom: boolean, values: Omit<HabitFormValues, "startsOn">) =>
    setDraft((d) => ({ key: (d?.key ?? 0) + 1, custom, values: { ...values, startsOn: today } }));
  const pickTemplate = (t: HabitTemplate) =>
    open(false, { title: t.title, category: t.category, targetCount: String(t.targetCount), period: t.period });
  const createOwn = () =>
    open(true, { title: "", category: tab === "popular" ? "health" : tab, targetCount: "1", period: "day" });

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Template categories" className="grid grid-cols-3 gap-2">
        {(["popular", ...CATEGORY_ORDER] as Tab[]).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              "flex min-h-11 items-center gap-1.5 rounded-xl bg-card px-2 py-1.5 text-left text-xs leading-tight font-semibold shadow-soft",
              tab === key ? "text-foreground ring-2 ring-primary" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {key === "popular" ? (
              <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent">
                <Star className="size-4 text-primary" />
              </span>
            ) : (
              <CategoryIcon category={key} size="xs" />
            )}
            {key === "popular" ? "Popular" : CATEGORIES[key].label}
          </button>
        ))}
      </div>

      {/* Two columns so every tab (at most 6 templates + Create your own) fits on one phone screen. */}
      <div role="tabpanel" className="grid grid-cols-2 gap-2.5">
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => pickTemplate(t)}
            className="flex min-h-14 items-center gap-2 rounded-2xl bg-card px-3 py-2.5 text-left shadow-soft hover:bg-muted"
          >
            <CategoryIcon category={t.category} size="xs" />
            <span className="flex min-w-0 flex-col">
              <span className="text-[0.9375rem] leading-snug font-bold">{t.title}</span>
              <span className="text-xs text-muted-foreground">{describeSchedule(t.targetCount, t.period)}</span>
            </span>
          </button>
        ))}
        <button
          type="button"
          onClick={createOwn}
          className="flex min-h-14 items-center gap-2 rounded-2xl border-2 border-dashed border-input px-3 py-2.5 text-left text-[0.9375rem] leading-snug font-bold text-muted-foreground hover:bg-muted"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-primary" aria-hidden>
            <Plus className="size-4" />
          </span>
          Create your own
        </button>
      </div>

      <Dialog open={draft !== null} onOpenChange={(isOpen) => !isOpen && setDraft(null)}>
        {/* Templates open without focusing a field, so the phone keyboard doesn't cover the form. */}
        <DialogContent onOpenAutoFocus={(e) => !draft?.custom && e.preventDefault()}>
          <div className="flex flex-col gap-1 pr-10">
            <DialogTitle>{draft?.custom ? "Create your own" : "Add habit"}</DialogTitle>
            <DialogDescription>You can change anything before adding it.</DialogDescription>
          </div>
          {draft && <HabitFields key={draft.key} initial={draft.values} today={today} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HabitFields({ initial, today }: { initial: HabitFormValues; today: string }) {
  const [state, formAction, pending] = useActionState(createHabit, initialState);
  const [values, setValues] = useState(initial);
  const categoryRef = useRef<HTMLSelectElement>(null);
  const periodRef = useRef<HTMLSelectElement>(null);
  const errors = state.status === "error" ? (state.errors ?? {}) : {};
  const set = (key: keyof HabitFormValues) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const count = Number(values.targetCount);
  const period = (values.period in TARGET_LIMITS ? values.period : "day") as HabitPeriod;
  const limit = TARGET_LIMITS[period];
  const step = (delta: number) =>
    setValues((v) => ({ ...v, targetCount: String(Math.min(limit, Math.max(1, (Number(v.targetCount) || 0) + delta))) }));
  const validCount = Number.isInteger(count) && count >= 1 && count <= limit;

  // The browser resets <form> fields after a server action runs. Inputs re-sync from their
  // `value` prop automatically, but <select> doesn't, so force it back to our state here.
  useEffect(() => {
    if (categoryRef.current) categoryRef.current.value = values.category;
    if (periodRef.current) periodRef.current.value = values.period;
  }, [state, values.category, values.period]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title" className="font-semibold">Title</Label>
        <Input
          id="title"
          name="title"
          value={values.title}
          onChange={set("title")}
          maxLength={HABIT_TITLE_MAX}
          className={fieldClass}
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? "title-error" : undefined}
        />
        {errors.title && <p id="title-error" className="text-sm text-destructive">{errors.title}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="category" className="font-semibold">Category</Label>
        <select id="category" name="category" ref={categoryRef} value={values.category} onChange={set("category")} className={selectClass}
          aria-invalid={Boolean(errors.category)} aria-describedby={errors.category ? "category-error" : undefined}>
          {CATEGORY_ORDER.map((c) => (
            <option key={c} value={c}>{CATEGORIES[c].label}</option>
          ))}
        </select>
        {errors.category && <p id="category-error" className="text-sm text-destructive">{errors.category}</p>}
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-semibold">How often</legend>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex h-11 items-center rounded-xl border border-input">
            <button type="button" onClick={() => step(-1)} disabled={count <= 1} aria-label="Decrease"
              className="flex size-11 shrink-0 items-center justify-center rounded-l-xl text-primary disabled:text-muted-foreground/50">
              <Minus className="size-4" />
            </button>
            <Label htmlFor="targetCount" className="sr-only">Times</Label>
            <input
              id="targetCount"
              name="targetCount"
              type="number"
              inputMode="numeric"
              min={1}
              value={values.targetCount}
              onChange={set("targetCount")}
              className="h-full w-full min-w-0 bg-transparent text-center text-base font-bold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              aria-invalid={Boolean(errors.targetCount)}
              aria-describedby={errors.targetCount ? "targetCount-error" : undefined}
            />
            <button type="button" onClick={() => step(1)} disabled={count >= limit} aria-label="Increase"
              className="flex size-11 shrink-0 items-center justify-center rounded-r-xl text-primary disabled:text-muted-foreground/50">
              <Plus className="size-4" />
            </button>
          </div>
          <Label htmlFor="period" className="sr-only">Per</Label>
          <select id="period" name="period" ref={periodRef} value={values.period} onChange={set("period")} className={selectClass}>
            {(["day", "week", "month"] as HabitPeriod[]).map((p) => (
              <option key={p} value={p}>{`times a ${p}`}</option>
            ))}
          </select>
        </div>
        {errors.targetCount && <p id="targetCount-error" className="text-sm text-destructive">{errors.targetCount}</p>}
        {errors.period && <p className="text-sm text-destructive">{errors.period}</p>}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="startsOn" className="font-semibold">Starts</Label>
        <Input
          id="startsOn"
          name="startsOn"
          type="date"
          min={today}
          value={values.startsOn}
          onChange={set("startsOn")}
          className={fieldClass}
          aria-invalid={Boolean(errors.startsOn)}
          aria-describedby={errors.startsOn ? "startsOn-error" : "startsOn-hint"}
        />
        <p id="startsOn-hint" className="text-xs text-muted-foreground">Nothing before this day counts.</p>
        {errors.startsOn && <p id="startsOn-error" className="text-sm text-destructive">{errors.startsOn}</p>}
      </div>

      {state.status === "error" && state.message && (
        <p role="alert" className="text-sm text-destructive">{state.message}</p>
      )}
      <Button type="submit" disabled={pending} className="h-11 text-base">
        {pending ? "Adding…" : validCount ? `Add habit · ${describeSchedule(count, period)}` : "Add habit"}
      </Button>
    </form>
  );
}
