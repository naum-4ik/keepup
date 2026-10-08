"use client";

import { useActionState, useEffect } from "react";
import { AvatarPicker } from "@/components/avatar-picker";
import { SaveButton } from "@/components/save-button";
import type { AvatarColor, AvatarFormState } from "@/lib/avatars";

const initialState: AvatarFormState = { status: "idle" };

export function AvatarForm({
  action,
  name,
  emoji,
  color,
  options,
  hint,
  onSaved,
}: {
  action: (prev: AvatarFormState, formData: FormData) => Promise<AvatarFormState>;
  name: string;
  emoji: string | null;
  color: AvatarColor | null;
  options?: readonly string[];
  hint?: string;
  // Called once after a successful save (e.g. to close the dialog).
  onSaved?: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  useEffect(() => {
    if (state.status === "saved") onSaved?.();
  }, [state, onSaved]);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <AvatarPicker name={name} emoji={emoji} color={color} options={options} hint={hint} />
      {state.status === "error" && <p role="alert" className="text-sm text-destructive">{state.message}</p>}
      <SaveButton state={state} pending={pending} />
    </form>
  );
}
