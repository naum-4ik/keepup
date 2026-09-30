"use client";

import { useActionState } from "react";
import type { AvatarFormState } from "@/app/(app)/profile/settings/actions";
import { AvatarPicker } from "@/components/avatar-picker";
import { SaveButton } from "@/components/save-button";
import type { AvatarColor } from "@/lib/avatars";

const initialState: AvatarFormState = { status: "idle" };

export function AvatarForm({
  action,
  name,
  emoji,
  color,
}: {
  action: (prev: AvatarFormState, formData: FormData) => Promise<AvatarFormState>;
  name: string;
  emoji: string | null;
  color: AvatarColor | null;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <AvatarPicker name={name} emoji={emoji} color={color} />
      {state.status === "error" && <p role="alert" className="text-sm text-destructive">{state.message}</p>}
      <SaveButton state={state} pending={pending} />
    </form>
  );
}
