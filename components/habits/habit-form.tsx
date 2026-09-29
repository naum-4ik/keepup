"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { createHabit } from "@/app/(app)/habits/actions";
import { CategoryIcon } from "@/components/habits/category-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORIES, CATEGORY_ORDER } from "@/lib/categories";
import { HABIT_TEMPLATES } from "@/lib/habit-templates";
import { HABIT_TITLE_MAX, type HabitCategory, type HabitFormState, type HabitFormValues, type HabitPeriod } from "@/lib/habit-schema";
import { describeSchedule } from "@/lib/schedule";
import { cn } from "@/lib/utils";

const selectClass = "h-11 rounded-xl border border-input bg-transparent px-3 text-base";
const initialState: HabitFormState = { status: "idle" };
type Tab = "popular" | HabitCategory;

export function HabitForm({ today }: { today: string }) {
  const [state, formAction, pending] = useActionState(createHabit, initialState);
  const [tab, setTab] = useState<Tab>("popular");
  const [values, setValues] = useState<HabitFormValues>({
    title: "", category: "health", targetCount: "1", period: "day", startsOn: today,
  });
  const titleRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLSelectElement>(null);
  const periodRef = useRef<HTMLSelectElement>(null);
  const errors = state.status === "error" ? (state.errors ?? {}) : {};
  const set = (key: keyof HabitFormValues) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  // The browser resets <form> fields after a server action runs. Inputs re-sync from their
  // `value` prop automatically, but <select> doesn't, so force it back to our state here.
  useEffect(() => {
    if (categoryRef.current) categoryRef.current.value = values.category;
    if (periodRef.current) periodRef.current.value = values.period;
  }, [state, values.category, values.period]);

  const templates = HABIT_TEMPLATES.filter((t) => (tab === "popular" ? t.popular : t.category === tab));
  const createOwn = () => {
    setValues((v) => ({ ...v, title: "", targetCount: "1", period: "day", category: tab === "popular" ? "health" : tab }));
    titleRef.current?.focus();
  };

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Templates" className="flex flex-col gap-3">
        <div role="tablist" aria-label="Template categories" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {(["popular", ...CATEGORY_ORDER] as Tab[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                "min-h-11 shrink-0 rounded-full px-4 py-2 text-sm font-semibold",
                tab === key ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground shadow-soft",
              )}
            >
              {key === "popular" ? "Popular" : CATEGORIES[key].label}
            </button>
          ))}
        </div>

        <div role="tabpanel" className="grid grid-cols-2 gap-3">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={values.title === t.title}
              onClick={() => setValues((v) => ({ ...v, title: t.title, category: t.category, targetCount: String(t.targetCount), period: t.period }))}
              className="flex items-center gap-2 rounded-2xl bg-card p-3 text-left shadow-soft hover:bg-muted aria-pressed:ring-2 aria-pressed:ring-primary"
            >
              <CategoryIcon category={t.category} />
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-bold">{t.title}</span>
                <span className="text-xs text-muted-foreground">{describeSchedule(t.targetCount, t.period)}</span>
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={createOwn}
            className="flex items-center gap-2 rounded-2xl border-2 border-dashed border-input p-3 text-left text-sm font-bold text-muted-foreground hover:bg-muted"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-accent text-primary" aria-hidden>
              <Plus className="size-5" />
            </span>
            Create your own
          </button>
        </div>
      </section>

      <form action={formAction} className="flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-soft">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            name="title"
            ref={titleRef}
            value={values.title}
            onChange={set("title")}
            maxLength={HABIT_TITLE_MAX}
            aria-invalid={Boolean(errors.title)}
            aria-describedby={errors.title ? "title-error" : undefined}
          />
          {errors.title && <p id="title-error" className="text-sm text-destructive">{errors.title}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category">Category</Label>
          <select id="category" name="category" ref={categoryRef} value={values.category} onChange={set("category")} className={selectClass}
            aria-invalid={Boolean(errors.category)} aria-describedby={errors.category ? "category-error" : undefined}>
            {CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>{CATEGORIES[c].label}</option>
            ))}
          </select>
          {errors.category && <p id="category-error" className="text-sm text-destructive">{errors.category}</p>}
        </div>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-sm font-semibold">How often</legend>
          <div className="flex gap-2">
            <Label htmlFor="targetCount" className="sr-only">Times</Label>
            <Input
              id="targetCount"
              name="targetCount"
              type="number"
              inputMode="numeric"
              min={1}
              value={values.targetCount}
              onChange={set("targetCount")}
              className="w-24"
              aria-invalid={Boolean(errors.targetCount)}
              aria-describedby={errors.targetCount ? "targetCount-error" : undefined}
            />
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
          <Label htmlFor="startsOn">Starts</Label>
          <Input
            id="startsOn"
            name="startsOn"
            type="date"
            min={today}
            value={values.startsOn}
            onChange={set("startsOn")}
            aria-invalid={Boolean(errors.startsOn)}
            aria-describedby={errors.startsOn ? "startsOn-error" : "startsOn-hint"}
          />
          <p id="startsOn-hint" className="text-xs text-muted-foreground">Nothing before this day counts.</p>
          {errors.startsOn && <p id="startsOn-error" className="text-sm text-destructive">{errors.startsOn}</p>}
        </div>

        {state.status === "error" && state.message && (
          <p role="alert" className="text-sm text-destructive">{state.message}</p>
        )}
        <Button type="submit" disabled={pending}>{pending ? "Adding…" : "Add habit"}</Button>
      </form>
    </div>
  );
}
