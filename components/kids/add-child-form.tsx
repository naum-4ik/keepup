"use client";

import { useActionState, useState } from "react";
import { Check } from "lucide-react";
import { addChild, type KidFormState } from "@/app/(app)/kids/actions";
import { AvatarPicker } from "@/components/avatar-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CHILD_NAME_MAX } from "@/lib/kid-schema";
import { DEFAULT_KID_TEMPLATE_IDS, KID_TEMPLATES, type KidTemplate } from "@/lib/kid-templates";
import { describeSchedule } from "@/lib/schedule";
import { cn } from "@/lib/utils";

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

export function AddChildForm({ groupId }: { groupId: string }) {
  const [state, formAction, pending] = useActionState(addChild, initialState);
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<Set<string>>(() => new Set(DEFAULT_KID_TEMPLATE_IDS));
  const [guardian, setGuardian] = useState(false);
  const nickname = name.trim();

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <form action={formAction} className="flex flex-col gap-4">
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
      </section>

      <section aria-labelledby="child-habits" className="flex flex-col gap-3">
        <h2 id="child-habits" className="text-base font-bold">Habits to start</h2>
        <ul className="grid grid-cols-1 gap-2">
          {KID_TEMPLATES.map((t) => {
            const on = picked.has(t.id);
            return (
              <li key={t.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(t.id)}
                  className={cn(
                    "flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 bg-card p-3 shadow-soft transition-colors",
                    on ? "border-primary" : "border-transparent hover:border-primary/30",
                  )}
                >
                  <KidTemplateTile template={t} selected={on} />
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl bg-card p-4 shadow-soft">
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

      {state.status === "error" && <p role="alert" className="text-sm text-destructive">{state.message}</p>}

      <Button type="submit" className="h-12 text-base" disabled={!guardian || pending}>
        {pending ? "Adding…" : `Add ${nickname || "child"}`}
      </Button>
    </form>
  );
}
