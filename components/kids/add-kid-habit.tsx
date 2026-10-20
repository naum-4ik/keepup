"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { PenLine, Plus } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { useTranslations } from "next-intl";
import { addChildHabit, type KidFormState } from "@/app/(app)/kids/actions";
import { KidTemplateGroups, KidTemplateTile } from "@/components/kids/add-child-form";
import { CountStepper } from "@/components/habits/count-stepper";
import { Button } from "@/components/ui/button";
import { addButtonClass } from "@/components/ui/add-button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { useToast } from "@/components/ui/toast";
import { useFocusFirstInvalid } from "@/lib/focus-first-invalid";
import { HABIT_TITLE_MAX, type HabitPeriod } from "@/lib/habit-schema";
import { useT } from "@/lib/i18n/client";
import type { Gender } from "@/lib/garden";
import { KID_TEMPLATES, kidTemplateTitle, templatesLeft, type KidTemplateTitles } from "@/lib/kid-templates";
import { keepFormValues } from "@/lib/keep-form-values";
import { reach } from "@/lib/reach";
import { isolate } from "@/supabase/functions/_shared/i18n";

const initialState: KidFormState = { status: "idle" };
// Picture emoji a child recognizes (docs/design.md: a curated kid set).
const KID_EMOJI = ["⭐", ...new Set(KID_TEMPLATES.map((t) => t.emoji)), "🌙", "🦷", "🙏"];
const bdi = (c: React.ReactNode) => <bdi>{c}</bdi>;
// 12 px sides to match the 12 px radius (as Notice does).
const selectClass = "h-11 rounded-xl border border-input bg-card px-3 text-base";

// addChildHabit, but offline or a request that dies says what to do instead of leaving the form stuck.
function useAddHabit(childId: string) {
  const { t } = useT();
  return useActionState(async (prev: KidFormState, formData: FormData): Promise<KidFormState> => {
    const r = await reach(() => addChildHabit(childId, prev, formData), { offline: t("kids.errors.offline"), reload: t("kids.errors.reload") }, { rethrow: unstable_rethrow });
    return "ok" in r ? { status: "error", message: r.message } : r;
  }, initialState);
}

// "Add a habit" opens a dialog: "Create your own" first, then the kid templates she doesn't have yet,
// by group. A template adds straight away (the dialog stays open for more); your own opens a form.
// templateTitles: each template's title in every language, so one added in another language stays hidden.
export function AddKidHabit({
  childId,
  childName,
  existingTitles,
  templateTitles,
  gender,
}: {
  childId: string;
  childName: string;
  existingTitles: string[];
  templateTitles: KidTemplateTitles;
  gender: Gender;
}) {
  const { t } = useT();
  const { showToast } = useToast();
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
        className={addButtonClass}
      >
        <Plus aria-hidden className="size-4" />
        {t("common.addHabit")}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          {custom ? (
            <CustomHabitForm
              childId={childId}
              childName={childName}
              gender={gender}
              onBack={() => setCustom(false)}
              onAdded={(title) => {
                // The dialog closes first: a toast behind it couldn't be seen. The habit joins her list,
                // maybe below the fold; the toast says what a check-in earns.
                setOpen(false);
                showToast({ text: t("kids.toast.habitAdded", { title: isolate(title), name: isolate(childName) }) });
              }}
            />
          ) : (
            <TemplatePicker childId={childId} childName={childName} existingTitles={existingTitles} templateTitles={templateTitles} onCustom={() => setCustom(true)} />
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
  templateTitles,
  onCustom,
}: {
  childId: string;
  childName: string;
  existingTitles: string[];
  templateTitles: KidTemplateTitles;
  onCustom: () => void;
}) {
  const { t: tr } = useT();
  const t = useTranslations("kids.habit");
  const [state, formAction, pending] = useAddHabit(childId);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const have = new Set(existingTitles);
  const left = templatesLeft(KID_TEMPLATES, templateTitles, have, (id) => kidTemplateTitle(tr, id));

  return (
    <>
      {/* pe-10: room for the dialog's close X. Title over description: line-height, no gap. */}
      <div className="flex flex-col pe-10">
        <DialogTitle>{t.rich("title", { name: childName, bdi })}</DialogTitle>
        <DialogDescription>{t("description")}</DialogDescription>
      </div>
      <Button type="button" variant="outline" className="h-12 justify-start gap-inner" onClick={onCustom}>
        <PenLine aria-hidden className="size-5 text-primary" />
        {tr("habits.form.createOwn")}
      </Button>
      {state.status === "error" && !pending && (
        <Notice tone="error" live>
          {state.message}
        </Notice>
      )}
      {/* In progress, then done, for the tile just tapped: the dialog stays open for more. */}
      <p role="status" className="text-sm font-semibold text-done">
        {pending && lastAdded ? (
          <span className="text-muted-foreground">{t("adding", { title: lastAdded })}</span>
        ) : state.status === "saved" && lastAdded ? (
          t("added", { title: lastAdded })
        ) : (
          ""
        )}
      </p>
      <form action={formAction} className="flex flex-col gap-item">
        <KidTemplateGroups
          templates={left}
          item={(tpl) => (
            <button
              type="submit"
              name="templateId"
              value={tpl.id}
              disabled={pending}
              onClick={() => setLastAdded(kidTemplateTitle(tr, tpl.id))}
              aria-label={t("add", { title: kidTemplateTitle(tr, tpl.id) })}
              // A template to pick: tinted, not a shadowed card (it's inside a dialog). 12 px padding.
              className="flex min-h-16 w-full items-center gap-item rounded-2xl border-2 border-transparent bg-muted/60 p-3 hover:border-primary/30"
            >
              <KidTemplateTile template={tpl} />
            </button>
          )}
        />
        {left.length === 0 && <p className="text-sm text-muted-foreground">{t.rich("hasAll", { name: childName, bdi })}</p>}
      </form>
    </>
  );
}

function CustomHabitForm({
  childId,
  childName,
  gender,
  onBack,
  onAdded,
}: {
  childId: string;
  childName: string;
  gender: Gender;
  onBack: () => void;
  onAdded: (title: string) => void;
}) {
  const { t: tr } = useT();
  const t = useTranslations("kids.habit");
  const [state, formAction, pending] = useAddHabit(childId);
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("⭐");
  // Controlled, so the stepper knows the period's limit; keepFormValues means no reset wipes them.
  const [count, setCount] = useState("1");
  const [period, setPeriod] = useState<HabitPeriod>("day");
  // A message about one field sits beside it; any other (offline, a server error) above the buttons.
  const field = state.status === "error" ? state.field : undefined;
  const fieldError = (f: typeof field) => (state.status === "error" && field === f ? state.message : null);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstInvalid(formRef, state);
  useEffect(() => {
    if (state.status === "saved") onAdded(title.trim());
    // Only a new answer counts; the title is read as it was sent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <>
      <div className="flex flex-col pe-10">
        <DialogTitle>{t.rich("ownTitle", { name: childName, bdi })}</DialogTitle>
        <DialogDescription>{t.rich("ownDescription", { name: childName, gender: gender ?? "other", bdi })}</DialogDescription>
      </div>
      {/* noValidate: the app's own messages beside each field, never the browser's bubbles. */}
      <form ref={formRef} onSubmit={keepFormValues(formAction)} noValidate className="flex flex-col gap-item">
        <div className="flex flex-col gap-inner">
          <Label htmlFor="kid-habit-title" className="font-semibold">{tr("habits.form.titleLabel")}</Label>
          <Input
            id="kid-habit-title"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
            maxLength={HABIT_TITLE_MAX}
            autoComplete="off"
            placeholder={t("titlePlaceholder")}
            className="h-11 rounded-xl px-3 text-base"
            aria-invalid={Boolean(fieldError("title"))}
            aria-describedby={fieldError("title") ? "kid-habit-title-error" : undefined}
          />
          {fieldError("title") && <p id="kid-habit-title-error" className="text-sm text-destructive">{fieldError("title")}</p>}
        </div>
        <input type="hidden" name="emoji" value={emoji} />
        <div className="flex flex-col gap-inner">
        <p id="kid-habit-emoji" className="text-sm font-semibold">{t("picture")}</p>
        {/* As many 44 px tiles as fit (4 in the dialog at 320; 6 a row made them 38 px). */}
        <div
          role="group"
          aria-labelledby="kid-habit-emoji"
          aria-describedby={fieldError("emoji") ? "kid-habit-emoji-error" : undefined}
          data-invalid={fieldError("emoji") ? "" : undefined}
          className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-inner"
        >
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
        {fieldError("emoji") && <p id="kid-habit-emoji-error" className="text-sm text-destructive">{fieldError("emoji")}</p>}
        </div>
        <div className="grid grid-cols-2 gap-inner">
          <div className="flex flex-col gap-inner">
            <Label htmlFor="kid-habit-target" className="font-semibold">{tr("habits.form.times")}</Label>
            <CountStepper
              id="kid-habit-target"
              value={count}
              onChange={setCount}
              period={period}
              invalid={Boolean(fieldError("targetCount"))}
              describedBy={fieldError("targetCount") ? "kid-habit-count-error" : undefined}
            />
          </div>
          <div className="flex flex-col gap-inner">
            <Label htmlFor="kid-habit-period" className="font-semibold">{tr("habits.form.per")}</Label>
            <select
              id="kid-habit-period"
              name="period"
              value={period}
              onChange={(e) => setPeriod(e.target.value as HabitPeriod)}
              className={selectClass}
              aria-invalid={Boolean(fieldError("period"))}
              aria-describedby={fieldError("period") ? "kid-habit-count-error" : undefined}
            >
              {(["day", "week", "month"] as const).map((p) => (
                <option key={p} value={p}>{t("period", { period: p })}</option>
              ))}
            </select>
          </div>
        </div>
        {/* How often is one line under both: the count and its unit are checked together. */}
        {(fieldError("targetCount") || fieldError("period")) && (
          <p id="kid-habit-count-error" className="text-sm text-destructive">{fieldError("targetCount") ?? fieldError("period")}</p>
        )}
        {state.status === "error" && !field && (
          <Notice tone="error" live>
            {state.message}
          </Notice>
        )}
        <div className="flex gap-inner">
          <Button type="button" variant="outline" className="h-11 flex-1" onClick={onBack} disabled={pending}>
            {t("back")}
          </Button>
          <Button type="submit" className="h-11 flex-1" disabled={pending}>
            {pending ? tr("habits.form.adding") : tr("habits.form.addHabit")}
          </Button>
        </div>
      </form>
    </>
  );
}
