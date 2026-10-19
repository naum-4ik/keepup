"use client";

import { useActionState, useState } from "react";
import { ChevronDown } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { useTranslations } from "next-intl";
import { createGroup, type GroupActionState } from "@/app/(app)/groups/actions";
import { AvatarPicker } from "@/components/avatar-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { GROUP_AVATAR_EMOJI } from "@/lib/avatars";
import { groupKindLabel, GROUP_KINDS, type GroupKind } from "@/lib/group-schema";
import { useT } from "@/lib/i18n/client";
import { keepFormValues } from "@/lib/keep-form-values";

const initialState: GroupActionState = { status: "idle" };

export function NewGroupForm({ city }: { city: string }) {
  const { t } = useT();
  const tn = useTranslations("groups.new");
  const tc = useTranslations("common");
  // Offline, nothing is sent; a request that dies on the way fails the same way: the pinned bar says
  // what to do. Success redirects to the new group with a "Created …" toast
  // (app/(app)/groups/actions.ts); that redirect arrives as a rejection, so it is rethrown.
  const [state, formAction, pending] = useActionState(async (prev: GroupActionState, formData: FormData): Promise<GroupActionState> => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return { status: "error", message: tn("failed"), code: "offline" };
    try {
      return await createGroup(prev, formData);
    } catch (e) {
      unstable_rethrow(e);
      return { status: "error", message: tn("failed"), code: "offline" };
    }
  }, initialState);
  const offline = state.status === "error" && state.code === "offline";
  const nameError = state.status === "error" && !offline;
  const [name, setName] = useState("");
  const [kind, setKind] = useState<GroupKind | "">("");

  const pick = (k: GroupKind) => {
    setKind(k);
    // Pre-fill only a name the person hasn't typed (empty, or another chip's label).
    if (name.trim() === "" || GROUP_KINDS.some((g) => groupKindLabel(t, g) === name.trim())) setName(groupKindLabel(t, k));
  };

  return (
    // A form, not a card (docs/design.md "Surfaces"): fields on the page, the submit pinned above the nav.
    <form onSubmit={keepFormValues(formAction)} className="flex flex-col gap-section">
      <fieldset className="flex flex-col gap-inner">
        <legend className="mb-inner text-sm font-semibold">{tn("whoFor")}</legend>
        <div className="flex flex-wrap gap-inner">
          {GROUP_KINDS.map((k) => (
            <label
              key={k}
              className="relative flex h-11 cursor-pointer items-center rounded-full border border-border px-item text-sm font-semibold has-checked:border-primary has-checked:bg-accent has-checked:text-accent-foreground has-focus-visible:ring-2 has-focus-visible:ring-ring"
            >
              <input
                type="radio"
                name="kind"
                value={k}
                checked={kind === k}
                onChange={() => pick(k)}
                className="absolute inset-0 cursor-pointer appearance-none rounded-full opacity-0"
              />
              {groupKindLabel(t, k)}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-inner">
        <Label htmlFor="group-new-name" className="font-semibold">{tn("name")}</Label>
        <Input
          id="group-new-name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="off"
          placeholder={tn("namePlaceholder")}
          // 12 px sides to match the 12 px radius (as Notice does).
          className="h-11 rounded-xl px-3 text-base"
          aria-invalid={nameError}
          aria-describedby={nameError ? "group-new-name-error" : "group-new-name-help"}
        />
        {nameError && (
          <p id="group-new-name-error" role="alert" className="text-sm text-destructive">{state.message}</p>
        )}
      </div>

      {/* Optional, so folded away: the form leads with who it's for and the name. Closed, the
          picker's hidden inputs still post (an empty emoji: the group shows its first letter). */}
      <details className="group/avatar">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-inner text-sm font-semibold [&::-webkit-details-marker]:hidden">
          <span>{tn.rich("avatar", { muted: (c) => <span className="font-normal text-muted-foreground">{c}</span> })}</span>
          <ChevronDown aria-hidden className="size-4 text-muted-foreground transition-transform group-open/avatar:rotate-180" />
        </summary>
        <div className="pt-inner">
          <AvatarPicker name={name} options={GROUP_AVATAR_EMOJI} hint={tn("avatarHint")} />
        </div>
      </details>

      <p id="group-new-name-help" className="text-sm text-muted-foreground">
        {tn("timezoneHelp", { city })}
      </p>

      {/* Pinned above the bottom nav on phones, so Create stays in reach while the avatar picker is
          open (as the habit edit form does). -mx-item px-item: the bar's background spans the page. */}
      <div className="sticky bottom-[calc(var(--nav-height)+env(safe-area-inset-bottom))] z-10 -mx-item flex flex-col gap-inner bg-background px-item py-inner">
        {offline && (
          <Notice tone="error" live>
            {state.message}
          </Notice>
        )}
        <Button type="submit" className="h-11" disabled={pending}>
          {pending ? tc("creating") : tn("create")}
        </Button>
      </div>
    </form>
  );
}
