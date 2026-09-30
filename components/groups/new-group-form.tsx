"use client";

import { useActionState, useState } from "react";
import { createGroup, type GroupActionState } from "@/app/(app)/groups/actions";
import { AvatarPicker } from "@/components/avatar-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GROUP_AVATAR_EMOJI } from "@/lib/avatars";
import { GROUP_KIND_LABEL, GROUP_KINDS, type GroupKind } from "@/lib/group-schema";

const initialState: GroupActionState = { status: "idle" };
const KIND_LABELS = new Set<string>(Object.values(GROUP_KIND_LABEL));

export function NewGroupForm({ city }: { city: string }) {
  const [state, formAction, pending] = useActionState(createGroup, initialState);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<GroupKind | "">("");

  const pick = (k: GroupKind) => {
    setKind(k);
    // Pre-fill only a name the person hasn't typed (empty, or another chip's label).
    if (name.trim() === "" || KIND_LABELS.has(name.trim())) setName(GROUP_KIND_LABEL[k]);
  };

  return (
    <form action={formAction} className="flex flex-col gap-5 rounded-2xl bg-card p-5 shadow-soft">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">Who is it for?</legend>
        <div className="flex flex-wrap gap-2">
          {GROUP_KINDS.map((k) => (
            <label
              key={k}
              className="relative flex h-11 cursor-pointer items-center rounded-full border border-border px-4 text-sm font-semibold has-checked:border-primary has-checked:bg-accent has-checked:text-accent-foreground has-focus-visible:ring-2 has-focus-visible:ring-ring"
            >
              <input
                type="radio"
                name="kind"
                value={k}
                checked={kind === k}
                onChange={() => pick(k)}
                className="absolute inset-0 cursor-pointer appearance-none rounded-full opacity-0"
              />
              {GROUP_KIND_LABEL[k]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="group-new-name" className="font-semibold">Name</Label>
        <Input
          id="group-new-name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="off"
          placeholder="The Levis, Book club…"
          className="h-11 rounded-xl px-3 text-base"
          aria-invalid={state.status === "error"}
          aria-describedby={state.status === "error" ? "group-new-name-error" : "group-new-name-help"}
        />
        {state.status === "error" && (
          <p id="group-new-name-error" role="alert" className="text-sm text-destructive">{state.message}</p>
        )}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">
          Avatar <span className="font-normal text-muted-foreground">(optional)</span>
        </legend>
        <AvatarPicker name={name} options={GROUP_AVATAR_EMOJI} hint="Until you pick one, the group shows its first letter." />
      </fieldset>

      <p id="group-new-name-help" className="text-sm text-muted-foreground">
        Your time zone ({city}) and week start are used for the group&apos;s habits. Admins can change them later.
      </p>

      <Button type="submit" className="h-11" disabled={pending}>
        {pending ? "Creating…" : "Create group"}
      </Button>
    </form>
  );
}
