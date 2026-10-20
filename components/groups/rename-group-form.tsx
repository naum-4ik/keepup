"use client";

import { useActionState, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import type { GroupActionState } from "@/app/(app)/groups/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { useFocusFirstInvalid } from "@/lib/focus-first-invalid";
import { GROUP_NAME_MAX } from "@/lib/group-schema";
import { keepFormValues } from "@/lib/keep-form-values";

const initialState: GroupActionState = { status: "idle" };

// The group's name as the page title; admins get a Rename button that swaps it for a small form.
export function RenameGroupForm({
  name,
  canRename,
  action,
}: {
  name: string;
  canRename: boolean;
  action: (prev: GroupActionState, formData: FormData) => Promise<GroupActionState>;
}) {
  const t = useTranslations("groups.rename");
  const tc = useTranslations("common");
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [seen, setSeen] = useState(state);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstInvalid(formRef, state);
  const nameError = state.status === "error" && state.field === "name";

  // A new "saved" state means the rename went through: close the form (react during render).
  if (state !== seen) {
    setSeen(state);
    if (state.status === "saved") setEditing(false);
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-inner">
        <h1 className="min-w-0 flex-1 text-2xl font-bold break-words">{name}</h1>
        {canRename && (
          <Button type="button" variant="ghost" className="h-11 gap-inner px-inner text-muted-foreground" onClick={() => setEditing(true)}>
            <Pencil aria-hidden className="size-4" /> {t("action")}
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      {/* The page keeps its title while the name is being edited. */}
      <h1 className="sr-only">{name}</h1>
      {/* noValidate: the app's own message beside the name, never the browser's bubble. */}
      <form ref={formRef} onSubmit={keepFormValues(formAction)} noValidate className="flex flex-col gap-inner">
        <Label htmlFor="group-name" className="font-semibold">{t("label")}</Label>
        <Input
          id="group-name"
          name="name"
          defaultValue={name}
          maxLength={GROUP_NAME_MAX}
          autoFocus
          required
          autoComplete="off"
          // 12 px sides to match the 12 px radius (as Notice does).
          className="h-11 rounded-xl px-3 text-base"
          aria-invalid={nameError}
          aria-describedby={nameError ? "group-name-error" : undefined}
        />
        {nameError && <p id="group-name-error" className="text-sm text-destructive">{state.message}</p>}
        {state.status === "error" && !nameError && (
          <Notice tone="error" live>
            {state.message}
          </Notice>
        )}
        <div className="flex gap-inner">
          <Button type="button" variant="outline" className="h-11 flex-1" disabled={pending} onClick={() => setEditing(false)}>
            {tc("cancel")}
          </Button>
          <Button type="submit" className="h-11 flex-1" disabled={pending}>
            {pending ? tc("saving") : tc("save")}
          </Button>
        </div>
      </form>
    </>
  );
}
