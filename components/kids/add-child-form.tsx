"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Check, Plus, X } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { useTranslations } from "next-intl";
import { addChild, type KidFormState } from "@/app/(app)/kids/actions";
import { AvatarPicker } from "@/components/avatar-picker";
import { addButtonClass } from "@/components/ui/add-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { GenderField } from "@/components/kids/gender-field";
import { CHILD_NAME_MAX } from "@/lib/kid-schema";
import { DEFAULT_KID_TEMPLATE_IDS, KID_TEMPLATES, kidGroupLabel, kidTemplatesByGroup, kidTemplateTitle, type KidTemplate } from "@/lib/kid-templates";
import { useT } from "@/lib/i18n/client";
import { describeSchedule } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import { keepFormValues } from "@/lib/keep-form-values";
import { reach } from "@/lib/reach";

const initialState: KidFormState = { status: "idle" };

// A kid template as a big tappable card: the emoji large in a pastel circle, the title, how often.
export function KidTemplateTile({ template, selected }: { template: KidTemplate; selected?: boolean }) {
  const { t: tr } = useT();
  return (
    <>
      <span aria-hidden className="flex size-14 shrink-0 items-center justify-center rounded-full bg-accent text-3xl leading-none select-none">
        {template.emoji}
      </span>
      <span className="flex min-w-0 flex-1 flex-col text-start">
        <span className="font-bold leading-tight">{kidTemplateTitle(tr, template.id)}</span>
        <span className="text-xs text-muted-foreground">{describeSchedule(tr, template.targetCount, template.period)}</span>
      </span>
      {selected !== undefined && (
        <span
          aria-hidden
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full border-2",
            selected ? "border-primary bg-primary text-primary-foreground" : "border-input",
          )}
        >
          {selected && <Check aria-hidden className="size-4" strokeWidth={3} />}
        </span>
      )}
    </>
  );
}

// The kid templates by group ("Morning", "Home", …): shared by Add a child and the kid "Add a habit" dialog.
export function KidTemplateGroups({ templates, item }: { templates: readonly KidTemplate[]; item: (t: KidTemplate) => ReactNode }) {
  const { t: tr } = useT();
  return (
    <>
      {kidTemplatesByGroup(templates).map((g) => (
        <section key={g.group} aria-label={kidGroupLabel(tr, g.group)} className="flex flex-col gap-inner">
          <h3 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">{kidGroupLabel(tr, g.group)}</h3>
          {g.templates.map((t) => (
            <div key={t.id}>{item(t)}</div>
          ))}
        </section>
      ))}
    </>
  );
}

// Add a child (ideas/design-review-backlog.md): nickname, avatar and the guardian box first, the
// starter habits as short rows, "Choose more habits" for the rest, and the button always in reach.
export function AddChildForm({ groupId }: { groupId: string }) {
  const { t: tr } = useT();
  const tf = useTranslations("kids.form");
  // Offline, nothing is sent; a request that dies on the way fails the same way: the pinned bar says
  // what to do, the form kept. Success redirects to her page with an "Added Mary…" toast
  // (app/(app)/kids/actions.ts); that redirect arrives as a rejection, so it is rethrown.
  const [state, formAction, pending] = useActionState(async (prev: KidFormState, formData: FormData): Promise<KidFormState> => {
    const r = await reach(() => addChild(prev, formData), { offline: tr("kids.errors.offline"), reload: tr("kids.errors.reload") }, { rethrow: unstable_rethrow });
    return "ok" in r ? { status: "error", message: r.message } : r;
  }, initialState);
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<Set<string>>(() => new Set(DEFAULT_KID_TEMPLATE_IDS));
  const [guardian, setGuardian] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const nickname = name.trim();
  const chosen = KID_TEMPLATES.filter((t) => picked.has(t.id));

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    // A form, not a card (docs/design.md "Surfaces"): fields on the page, the submit pinned above the nav.
    <form onSubmit={keepFormValues(formAction)} className="flex flex-col gap-section">
      <input type="hidden" name="groupId" value={groupId} />
      {[...picked].map((id) => (
        <input key={id} type="hidden" name="templates" value={id} />
      ))}

      <div className="flex flex-col gap-item">
        <div className="flex flex-col gap-inner">
          <Label htmlFor="child-name" className="font-semibold">{tf("nickname")}</Label>
          <Input
            id="child-name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={CHILD_NAME_MAX}
            autoComplete="off"
            // 12 px sides to match the 12 px radius (as Notice does).
            className="h-11 rounded-xl px-3 text-base"
            aria-describedby="child-name-help"
          />
          <p id="child-name-help" className="text-sm text-muted-foreground">
            {tf("nicknameHelp")}
          </p>
        </div>
        <GenderField />
        <AvatarPicker name={nickname} />
        {/* A tinted row: 12 px padding to match its 12 px radius. */}
        <label className="flex min-h-11 cursor-pointer items-center gap-item rounded-xl bg-muted/60 p-3">
          <input
            type="checkbox"
            name="guardian"
            checked={guardian}
            onChange={(e) => setGuardian(e.target.checked)}
            required
            className="size-5 shrink-0 accent-primary"
          />
          <span className="text-sm font-semibold">{tf("guardian")}</span>
        </label>
      </div>

      <section aria-labelledby="child-habits" className="flex flex-col gap-item">
        <h2 id="child-habits" className="text-base font-bold">{tf("habitsToStart")}</h2>
        {chosen.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tf("noneYet")}</p>
        ) : (
          // Rows on dividers, not cards: a list of what she starts with (each removable).
          <ul className="flex flex-col divide-y divide-border">
            {chosen.map((t) => (
              <li key={t.id} className="flex min-h-14 items-center gap-inner py-inner">
                <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-2xl leading-none select-none">
                  {t.emoji}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-bold leading-tight">{kidTemplateTitle(tr, t.id)}</span>
                  <span className="text-xs text-muted-foreground">{describeSchedule(tr, t.targetCount, t.period)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => toggle(t.id)}
                  aria-label={tf("remove", { title: kidTemplateTitle(tr, t.id) })}
                  className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X aria-hidden className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={() => setChoosing(true)}
          className={addButtonClass}
        >
          <Plus aria-hidden className="size-4" />
          {tf("chooseMore")}
        </button>
      </section>

      <Dialog open={choosing} onOpenChange={setChoosing}>
        <DialogContent>
          <div className="flex flex-col pe-10">
            <DialogTitle>{tf("habitsToStart")}</DialogTitle>
            <DialogDescription>{tf("chooseHint")}</DialogDescription>
          </div>
          <div className="flex flex-col gap-item">
            <KidTemplateGroups
              templates={KID_TEMPLATES}
              item={(t) => {
                const on = picked.has(t.id);
                return (
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(t.id)}
                    className={cn(
                      // 12 px padding inside the 2 px border.
                      "flex min-h-16 w-full items-center gap-item rounded-2xl border-2 bg-muted/60 p-3 transition-colors",
                      on ? "border-primary" : "border-transparent hover:border-primary/30",
                    )}
                  >
                    <KidTemplateTile template={t} selected={on} />
                  </button>
                );
              }}
            />
          </div>
          <Button type="button" className="sticky bottom-0 h-12 text-base" onClick={() => setChoosing(false)}>
            {tf("donePicked", { count: picked.size })}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Pinned above the bottom nav on phones, so the button stays in reach while the habits list
          grows (as the new-group and habit forms do). -mx-item px-item: the bar's background spans the page. */}
      <div className="sticky bottom-[calc(var(--nav-height)+env(safe-area-inset-bottom))] z-10 -mx-item flex flex-col gap-inner bg-background px-item py-inner">
        {state.status === "error" && (
          <Notice tone="error" live>
            {state.message}
          </Notice>
        )}
        <Button type="submit" className="h-11 w-full text-base" disabled={!guardian || pending}>
          <span className="truncate">{pending ? tr("habits.form.adding") : tf.rich("submit", { named: nickname ? "yes" : "no", name: nickname, bdi: (c) => <bdi>{c}</bdi> })}</span>
        </Button>
      </div>
    </form>
  );
}
