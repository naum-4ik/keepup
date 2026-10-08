"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Check, Plus, X } from "lucide-react";
import { addChild, type KidFormState } from "@/app/(app)/kids/actions";
import { AvatarPicker } from "@/components/avatar-picker";
import { addButtonClass } from "@/components/ui/add-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CHILD_NAME_MAX } from "@/lib/kid-schema";
import { DEFAULT_KID_TEMPLATE_IDS, KID_TEMPLATES, kidTemplatesByGroup, type KidTemplate } from "@/lib/kid-templates";
import { describeSchedule } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import { keepFormValues } from "@/lib/keep-form-values";

const initialState: KidFormState = { status: "idle" };

// A kid template as a big tappable card: the emoji large in a pastel circle, the title, how often.
export function KidTemplateTile({ template, selected }: { template: KidTemplate; selected?: boolean }) {
  return (
    <>
      <span aria-hidden className="flex size-14 shrink-0 items-center justify-center rounded-full bg-accent text-3xl leading-none select-none">
        {template.emoji}
      </span>
      <span className="flex min-w-0 flex-1 flex-col text-left">
        <span className="font-bold leading-tight">{template.title}</span>
        <span className="text-xs text-muted-foreground">{describeSchedule(template.targetCount, template.period)}</span>
      </span>
      {selected !== undefined && (
        <span
          aria-hidden
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full border-2",
            selected ? "border-primary bg-primary text-primary-foreground" : "border-input",
          )}
        >
          {selected && <Check className="size-4" strokeWidth={3} />}
        </span>
      )}
    </>
  );
}

// The kid templates by group ("Morning", "Home", …): shared by Add a child and the kid "Add a habit" dialog.
export function KidTemplateGroups({ templates, item }: { templates: readonly KidTemplate[]; item: (t: KidTemplate) => ReactNode }) {
  return (
    <>
      {kidTemplatesByGroup(templates).map((g) => (
        <section key={g.group} aria-label={g.group} className="flex flex-col gap-2">
          <h3 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">{g.group}</h3>
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
  const [state, formAction, pending] = useActionState(addChild, initialState);
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
    <form onSubmit={keepFormValues(formAction)} className="flex flex-col gap-4">
      <input type="hidden" name="groupId" value={groupId} />
      {[...picked].map((id) => (
        <input key={id} type="hidden" name="templates" value={id} />
      ))}

      <section className="flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-soft">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="child-name" className="font-semibold">Nickname</Label>
          <Input
            id="child-name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={CHILD_NAME_MAX}
            autoComplete="off"
            className="h-11 rounded-xl px-3 text-base"
            aria-describedby="child-name-help"
          />
          <p id="child-name-help" className="text-sm text-muted-foreground">
            A nickname is enough. No full names, photos or birthdays.
          </p>
        </div>
        <AvatarPicker name={nickname} />
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-muted/60 p-3">
          <input
            type="checkbox"
            name="guardian"
            checked={guardian}
            onChange={(e) => setGuardian(e.target.checked)}
            required
            className="size-5 shrink-0 accent-primary"
          />
          <span className="text-sm font-semibold">I&apos;m this child&apos;s parent or guardian</span>
        </label>
      </section>

      <section aria-labelledby="child-habits" className="flex flex-col gap-2">
        <h2 id="child-habits" className="text-base font-bold">Habits to start</h2>
        {chosen.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet. You can add habits later too.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {chosen.map((t) => (
              <li key={t.id} className="flex min-h-14 items-center gap-3 rounded-2xl bg-card py-2 pr-1 pl-2 shadow-soft">
                <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-2xl leading-none select-none">
                  {t.emoji}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-bold leading-tight">{t.title}</span>
                  <span className="text-xs text-muted-foreground">{describeSchedule(t.targetCount, t.period)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => toggle(t.id)}
                  aria-label={`Remove ${t.title}`}
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
          Choose more habits
        </button>
      </section>

      <Dialog open={choosing} onOpenChange={setChoosing}>
        <DialogContent>
          <div className="flex flex-col gap-1 pr-10">
            <DialogTitle>Habits to start</DialogTitle>
            <DialogDescription>Tap to pick or unpick. You can add your own later.</DialogDescription>
          </div>
          <div className="flex flex-col gap-4">
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
                      "flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 bg-muted/60 p-3 transition-colors",
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
            Done · {picked.size} picked
          </Button>
        </DialogContent>
      </Dialog>

      {state.status === "error" && <p role="alert" className="text-sm text-destructive">{state.message}</p>}

      {/* Sticky above the bottom nav (about 4rem), so the button is always in reach. */}
      <div className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] -mx-4 bg-gradient-to-t from-background from-70% to-transparent px-4 pt-4 pb-2">
        <Button type="submit" className="h-12 w-full text-base" disabled={!guardian || pending}>
          <span className="truncate">{pending ? "Adding…" : `Add ${nickname || "child"}`}</span>
        </Button>
      </div>
    </form>
  );
}
