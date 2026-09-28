"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInWithEmail } from "./actions";
import type { LoginState } from "./state";

const initialState: LoginState = { status: "idle" };

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signInWithEmail, initialState);

  if (state.status === "sent") {
    return (
      <p role="status" className="rounded-md border p-4 text-sm">
        {state.message}
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <Label htmlFor="email">Email</Label>
      <Input id="email" name="email" type="email" autoComplete="email" required />
      {state.status === "error" && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Email me a link"}
      </Button>
    </form>
  );
}
