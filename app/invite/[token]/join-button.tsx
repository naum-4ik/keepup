"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { AcceptInviteState } from "./actions";

type Props = {
  action: (state: AcceptInviteState, formData: FormData) => Promise<AcceptInviteState>;
  groupName: string;
};

export function JoinButton({ action, groupName }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      {state?.message && (
        <p role="alert" className="text-center text-sm text-destructive">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending} className="h-12 w-full rounded-xl text-base">
        {pending ? "Joining…" : `Join ${groupName}`}
      </Button>
    </form>
  );
}
