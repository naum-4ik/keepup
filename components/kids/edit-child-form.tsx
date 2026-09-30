"use client";

import { useActionState, useState } from "react";
import { Pencil } from "lucide-react";
import { updateChild, type KidFormState } from "@/app/(app)/kids/actions";
import { AvatarPicker } from "@/components/avatar-picker";
import { SaveButton } from "@/components/save-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AvatarColor } from "@/lib/avatars";
import { CHILD_NAME_MAX } from "@/lib/kid-schema";

const initialState: KidFormState = { status: "idle" };

// Nickname and avatar only (privacy policy §9). Any adult of the group may edit them.
export function EditChildButton({
  childId,
  name,
  emoji,
  color,
}: {
  childId: string;
  name: string;
  emoji: string | null;
  color: AvatarColor | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" className="h-11 gap-1.5 rounded-full px-4" onClick={() => setOpen(true)}>
        <Pencil aria-hidden className="size-4" />
        Edit
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <div className="flex flex-col gap-1 pr-10">
            <DialogTitle>Edit {name}</DialogTitle>
            <DialogDescription>A nickname is enough. No full names, photos or birthdays.</DialogDescription>
          </div>
          {open && <EditChildForm childId={childId} name={name} emoji={emoji} color={color} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function EditChildForm({ childId, name, emoji, color }: { childId: string; name: string; emoji: string | null; color: AvatarColor | null }) {
  const [state, formAction, pending] = useActionState(updateChild.bind(null, childId), initialState);
  const [value, setValue] = useState(name);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="child-edit-name" className="font-semibold">Nickname</Label>
        <Input
          id="child-edit-name"
          name="name"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
          maxLength={CHILD_NAME_MAX}
          autoComplete="off"
          className="h-11 rounded-xl px-3 text-base"
        />
      </div>
      <AvatarPicker name={value.trim()} emoji={emoji} color={color} />
      {state.status === "error" && <p role="alert" className="text-sm text-destructive">{state.message}</p>}
      <SaveButton state={state} pending={pending} />
    </form>
  );
}
