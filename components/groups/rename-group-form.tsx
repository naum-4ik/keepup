"use client";

import { useActionState, useState } from "react";
import { Pencil } from "lucide-react";
import type { GroupActionState } from "@/app/(app)/groups/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [seen, setSeen] = useState(state);

  // A new "saved" state means the rename went through: close the form (react during render).
  if (state !== seen) {
    setSeen(state);
    if (state.status === "saved") setEditing(false);
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <h1 className="min-w-0 flex-1 text-2xl font-bold break-words">{name}</h1>
        {canRename && (
          <Button type="button" variant="ghost" className="h-11 gap-1.5 px-3 text-muted-foreground" onClick={() => setEditing(true)}>
            <Pencil aria-hidden className="size-4" /> Rename
          </Button>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Label htmlFor="group-name" className="font-semibold">Group name</Label>
      <Input
        id="group-name"
        name="name"
        defaultValue={name}
        autoFocus
        required
        autoComplete="off"
        className="h-11 rounded-xl px-3 text-base"
        aria-invalid={state.status === "error"}
        aria-describedby={state.status === "error" ? "group-name-error" : undefined}
      />
      {state.status === "error" && (
        <p id="group-name-error" role="alert" className="text-sm text-destructive">{state.message}</p>
      )}
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="h-11 flex-1" disabled={pending} onClick={() => setEditing(false)}>
          Cancel
        </Button>
        <Button type="submit" className="h-11 flex-1" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
