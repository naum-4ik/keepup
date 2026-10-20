"use client";

import { useActionState, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { useTranslations } from "next-intl";
import { updateChild, type KidFormState } from "@/app/(app)/kids/actions";
import { AvatarPicker } from "@/components/avatar-picker";
import { SaveButton } from "@/components/save-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import type { AvatarColor } from "@/lib/avatars";
import { GenderField } from "@/components/kids/gender-field";
import { keepFormValues } from "@/lib/keep-form-values";
import { reach } from "@/lib/reach";
import { useFocusFirstInvalid } from "@/lib/focus-first-invalid";
import { CHILD_NAME_MAX, type KidGender } from "@/lib/kid-schema";

const initialState: KidFormState = { status: "idle" };

// Nickname, avatar and boy or girl only (privacy policy §9). Any adult of the group may edit them.
export function EditChildButton({
  childId,
  name,
  emoji,
  color,
  gender,
}: {
  childId: string;
  name: string;
  emoji: string | null;
  color: AvatarColor | null;
  gender: KidGender | null;
}) {
  const t = useTranslations("kids");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" className="h-11 gap-inner rounded-full px-item" onClick={() => setOpen(true)}>
        <Pencil aria-hidden className="size-4" />
        {t("edit.button")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <div className="flex flex-col pe-10">
            <DialogTitle>{t.rich("edit.title", { name, bdi: (c) => <bdi>{c}</bdi> })}</DialogTitle>
            <DialogDescription>{t("form.nicknameHelp")}</DialogDescription>
          </div>
          {open && <EditChildForm childId={childId} name={name} emoji={emoji} color={color} gender={gender} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function EditChildForm({ childId, name, emoji, color, gender }: { childId: string; name: string; emoji: string | null; color: AvatarColor | null; gender: KidGender | null }) {
  const t = useTranslations("kids.form");
  const tk = useTranslations("kids.errors");
  // Offline, nothing is sent; a request that dies on the way says to reload. The input is kept.
  const [state, formAction, pending] = useActionState(async (prev: KidFormState, formData: FormData): Promise<KidFormState> => {
    const r = await reach(() => updateChild(childId, prev, formData), { offline: tk("offline"), reload: tk("reload") }, { rethrow: unstable_rethrow });
    return "ok" in r ? { status: "error", message: r.message } : r;
  }, initialState);
  const [value, setValue] = useState(name);
  // A message about the nickname sits under it; any other (offline, a server error) above Save.
  const nameError = state.status === "error" && state.field === "name";
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstInvalid(formRef, state);
  return (
    // noValidate: the app's own message under the nickname, never the browser's bubble.
    <form ref={formRef} onSubmit={keepFormValues(formAction)} noValidate className="flex flex-col gap-item">
      <div className="flex flex-col gap-inner">
        <Label htmlFor="child-edit-name" className="font-semibold">{t("nickname")}</Label>
        <Input
          id="child-edit-name"
          name="name"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
          maxLength={CHILD_NAME_MAX}
          autoComplete="off"
          className="h-11 rounded-xl px-3 text-base"
          aria-invalid={nameError}
          aria-describedby={nameError ? "child-edit-name-error" : undefined}
        />
        {nameError && (
          <p id="child-edit-name-error" className="text-sm text-destructive">
            {state.message}
          </p>
        )}
      </div>
      <input type="hidden" name="previousGender" value={gender ?? ""} />
      <GenderField defaultValue={gender} />
      <AvatarPicker name={value.trim()} emoji={emoji} color={color} />
      {state.status === "error" && !nameError && (
        <Notice tone="error" live>
          {state.message}
        </Notice>
      )}
      <SaveButton state={state} pending={pending} />
    </form>
  );
}
