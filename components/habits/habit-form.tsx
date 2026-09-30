"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Minus, Plus, Star, Users } from "lucide-react";
import { createGroupHabit, createHabit } from "@/app/(app)/habits/actions";
import { Avatar } from "@/components/avatar";
import { CategoryIcon, HabitEmoji } from "@/components/habits/category-icon";
import { EMOJI_PANEL_ATTR, EmojiPicker } from "@/components/habits/emoji-picker";
import { EndPicker } from "@/components/habits/end-picker";
import { StartDatePicker } from "@/components/habits/start-date-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORIES, CATEGORY_ORDER, normalizeCategory } from "@/lib/categories";
import { formatLocalDate } from "@/lib/dates";
import { GROUP_TEMPLATES } from "@/lib/group-templates";
import { HABIT_TEMPLATES, type HabitTemplate } from "@/lib/habit-templates";
import {
  HABIT_TITLE_MAX, TARGET_LIMITS, type HabitCategory, type HabitFormState, type HabitFormValues, type HabitPeriod,
} from "@/lib/habit-schema";
import { describeSchedule } from "@/lib/schedule";
import { cn } from "@/lib/utils";

// Every control in the dialog shares one height so the fields line up.
const fieldClass = "h-11 rounded-xl px-3 text-base";
const selectClass = cn(fieldClass, "w-full border border-input bg-transparent");
const chipClass =
  "relative flex h-11 cursor-pointer items-center rounded-full border border-border px-4 text-sm font-semibold has-checked:border-primary has-checked:bg-accent has-checked:text-accent-foreground has-focus-visible:ring-2 has-focus-visible:ring-ring";
const initialState: HabitFormState = { status: "idle" };
type Tab = "together" | "popular" | HabitCategory;
type Draft = { key: number; custom: boolean; values: HabitFormValues; groupId: string; groupOnly: boolean };
export type FormGroup = { id: string; name: string; children: { id: string; name: string; avatar_emoji: string | null; avatar_color: string | null }[] };

// One form, two creates: a group picked in "Who's it for" makes a group habit.
const submitHabit = (prev: HabitFormState, formData: FormData) =>
  formData.get("groupId") ? createGroupHabit(prev, formData) : createHabit(prev, formData);

export function HabitForm({
  today,
  weekStart,
  groups = [],
  initialGroupId,
}: {
  today: string;
  weekStart: 0 | 1;
  // The groups the user admins (only admins create group habits).
  groups?: FormGroup[];
  // ?group=<id>: the group page's "Add a group habit" link.
  initialGroupId?: string;
}) {
  // Together is offered only when adding from a group (?group=<id> of a group the user admins).
  const showTogether = Boolean(initialGroupId);
  const [tab, setTab] = useState<Tab>(initialGroupId ? "together" : "popular");
  const [draft, setDraft] = useState<Draft | null>(null);
  // While the create is in flight the dialog stays open (Esc, outside click and Close are ignored).
  const [pending, setPending] = useState(false);
  const templates =
    tab === "together" ? GROUP_TEMPLATES : HABIT_TEMPLATES.filter((t) => (tab === "popular" ? t.popular : t.category === tab));

  // Each open gets a new key, so the dialog's form starts fresh (no errors from a previous try).
  const open = (custom: boolean, values: Omit<HabitFormValues, "startsOn">, groupId = initialGroupId ?? "", groupOnly = false) =>
    setDraft((d) => ({ key: (d?.key ?? 0) + 1, custom, values: { ...values, startsOn: today }, groupId, groupOnly }));
  const pickTemplate = (t: HabitTemplate) =>
    open(
      false,
      { title: t.title, emoji: t.emoji, category: t.category, targetCount: String(t.targetCount), period: t.period },
      // A Together template pre-selects a group (the one from the link, else the first).
      tab === "together" ? (initialGroupId ?? groups[0].id) : undefined,
      // Together templates are for groups only: no "Just me".
      tab === "together",
    );
  const createOwn = () =>
    open(true, { title: "", emoji: "", category: tab === "popular" || tab === "together" ? "health" : tab, targetCount: "1", period: "day" });

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Template categories" className="grid grid-cols-3 gap-2">
        {([...(showTogether ? ["together"] : []), "popular", ...CATEGORY_ORDER] as Tab[]).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              "flex min-h-11 items-center gap-1.5 rounded-xl bg-card px-2 py-1.5 text-left text-xs leading-tight font-semibold shadow-soft",
              tab === key ? "bg-accent text-foreground ring-2 ring-primary" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {key === "popular" || key === "together" ? (
              <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent">
                {key === "popular" ? <Star className="size-4 text-primary" /> : <Users className="size-4 text-primary" />}
              </span>
            ) : (
              <CategoryIcon category={key} size="xs" />
            )}
            {key === "popular" ? "Popular" : key === "together" ? "Together" : CATEGORIES[key].label}
          </button>
        ))}
      </div>

      {/* Fixed 2×3 grid (every category tab has exactly 6 templates, Together has 4) with same-size
          cards, so switching tabs never moves anything and "Create your own" always sits in the same place. */}
      <div role="tabpanel" className="grid grid-cols-2 grid-rows-[repeat(3,4.75rem)] gap-2.5">
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => pickTemplate(t)}
            className="flex h-full items-center gap-2.5 rounded-2xl bg-card px-3 text-left shadow-soft hover:bg-muted"
          >
            <HabitEmoji category={t.category} emoji={t.emoji} size="xs" />
            <span className="flex min-w-0 flex-col">
              <span className="line-clamp-2 text-[0.9375rem] leading-snug font-bold">{t.title}</span>
              <span className="text-xs text-muted-foreground">{describeSchedule(t.targetCount, t.period)}</span>
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={createOwn}
        className="flex h-12 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/30 text-[0.9375rem] font-bold text-primary hover:bg-accent"
      >
        <Plus aria-hidden className="size-5" />
        Create your own
      </button>

      <Dialog open={draft !== null} onOpenChange={(isOpen) => !isOpen && !pending && setDraft(null)}>
        {/* Templates open without focusing a field, so the phone keyboard doesn't cover the form;
            "Create your own" focuses the title (not the emoji button before it). Escape inside the
            open emoji panel closes only the panel. */}
        <DialogContent
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            if (draft?.custom) document.getElementById("title")?.focus();
          }}
          onEscapeKeyDown={(e) => (e.target as Element | null)?.closest?.(`[${EMOJI_PANEL_ATTR}]`) && e.preventDefault()}
        >
          <div className="flex flex-col gap-1 pr-10">
            <DialogTitle>{draft?.custom ? "Create your own" : "Add habit"}</DialogTitle>
            <DialogDescription>You can change anything before adding it.</DialogDescription>
          </div>
          {draft && (
            <HabitFields
              key={draft.key}
              initial={draft.values}
              initialGroupId={draft.groupId}
              groupOnly={draft.groupOnly}
              groups={groups}
              today={today}
              weekStart={weekStart}
              onPendingChange={setPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HabitFields({
  initial,
  initialGroupId,
  groupOnly,
  groups,
  today,
  weekStart,
  onPendingChange,
}: {
  initial: HabitFormValues;
  initialGroupId: string;
  groupOnly: boolean;
  groups: FormGroup[];
  today: string;
  weekStart: 0 | 1;
  onPendingChange: (pending: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState(submitHabit, initialState);
  const [groupId, setGroupId] = useState(initialGroupId);
  const group = groups.find((g) => g.id === groupId) ?? null;
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => onPendingChange(pending), [pending, onPendingChange]);
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
  // The same for radios and checkboxes: they fall back to unticked, so re-apply what was picked
  // (the toggles are uncontrolled; their state before the reset is kept in data-on).
  useEffect(() => {
    if (categoryRef.current) categoryRef.current.value = values.category;
    if (periodRef.current) periodRef.current.value = values.period;
    formRef.current?.querySelectorAll<HTMLInputElement>('input[name="groupId"]').forEach((r) => (r.checked = r.value === groupId));
    formRef.current?.querySelectorAll<HTMLInputElement>('input[role="switch"]').forEach((c) => (c.checked = c.dataset.on === "1"));
  }, [state, values.category, values.period, groupId]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title" className="font-semibold">Title</Label>
        <EmojiPicker
          value={values.emoji}
          category={normalizeCategory(values.category)}
          onChange={(emoji) => setValues((v) => ({ ...v, emoji }))}
          error={errors.emoji}
        >
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
        </EmojiPicker>
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
              className="flex size-11 shrink-0 items-center justify-center rounded-l-xl text-primary enabled:hover:bg-accent disabled:text-muted-foreground/50">
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
              className="flex size-11 shrink-0 items-center justify-center rounded-r-xl text-primary enabled:hover:bg-accent disabled:text-muted-foreground/50">
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

      {groups.length > 0 && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-semibold">Who&apos;s it for</legend>
          <div className="flex flex-wrap gap-2">
            {(groupOnly ? groups : [{ id: "", name: "Just me" }, ...groups]).map((g) => (
              <label key={g.id || "me"} className={chipClass}>
                <input
                  type="radio"
                  name="groupId"
                  value={g.id}
                  checked={groupId === g.id}
                  onChange={() => setGroupId(g.id)}
                  className="absolute inset-0 cursor-pointer appearance-none rounded-full opacity-0"
                />
                {g.name}
              </label>
            ))}
          </div>
          {group && (
            <div className="flex flex-col gap-3 pt-2">
              <p className="text-sm text-muted-foreground">
                Everyone in {group.name} does this together. It&apos;s done when everyone&apos;s checked in.
              </p>
              <Toggle name="requiresApproval" label="Needs approval" hint={`Someone else in ${group.name} confirms each check-in.`} />
              {group.children.map((c) => (
                <Toggle
                  key={c.id}
                  name="children"
                  value={c.id}
                  label={`Include ${c.name}`}
                  icon={<Avatar name={c.name} emoji={c.avatar_emoji} color={c.avatar_color} size="sm" />}
                />
              ))}
            </div>
          )}
        </fieldset>
      )}

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-semibold">Starts</legend>
        {/* Today is sent as empty, so the server uses its own today (this page's may be stale after midnight). */}
        <input type="hidden" name="startsOn" value={values.startsOn === today ? "" : values.startsOn} />
        <StartDatePicker
          value={values.startsOn}
          onChange={(startsOn) => setValues((v) => ({ ...v, startsOn }))}
          today={today}
          weekStart={weekStart}
          errorId={errors.startsOn ? "startsOn-error" : undefined}
        />
        <p className="text-xs text-muted-foreground">
          {formatLocalDate(values.startsOn)}. Nothing before this day counts.
        </p>
        {errors.startsOn && <p id="startsOn-error" className="text-sm text-destructive">{errors.startsOn}</p>}
      </fieldset>

      {/* Keyed by period so the chips reset to "No end" when the unit changes. */}
      <EndPicker key={period} period={period} startsOn={values.startsOn} />

      {state.status === "error" && state.message && (
        <p role="alert" className="text-sm text-destructive">{state.message}</p>
      )}
      <Button type="submit" disabled={pending} className="h-11 text-base">
        {pending ? "Adding…" : validCount ? `Add habit · ${describeSchedule(count, period)}` : "Add habit"}
      </Button>
    </form>
  );
}

// An on/off row (a checkbox shown as a switch); off by default, sent as "on" or the value when ticked.
function Toggle({ name, value, label, hint, icon }: { name: string; value?: string; label: string; hint?: string; icon?: React.ReactNode }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3">
      {icon}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-semibold">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        name={name}
        value={value}
        onChange={(e) => (e.currentTarget.dataset.on = e.currentTarget.checked ? "1" : "0")}
        className="relative h-7 w-12 shrink-0 cursor-pointer appearance-none rounded-full bg-muted transition-colors before:absolute before:top-0.5 before:left-0.5 before:size-6 before:rounded-full before:bg-white before:shadow-sm before:transition-transform checked:bg-primary checked:before:translate-x-5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      />
    </label>
  );
}
