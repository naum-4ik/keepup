"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/avatar";
import { AvatarForm } from "@/components/avatar-form";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { AvatarColor, AvatarFormState } from "@/lib/avatars";
import { cn } from "@/lib/utils";

// An avatar you tap to change: a small pencil badge, then a dialog with the picker and Save.
export function AvatarEdit({
  name,
  emoji,
  color,
  action,
  title,
  description,
  options,
  className,
}: {
  name: string;
  emoji: string | null;
  color: AvatarColor | null;
  action: (prev: AvatarFormState, formData: FormData) => Promise<AvatarFormState>;
  title: string;
  description: string;
  options?: readonly string[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={title}
        onClick={() => setOpen(true)}
        className="relative rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <Avatar name={name} emoji={emoji} color={color} className={cn("size-20 text-4xl font-bold", className)} />
        <span
          aria-hidden
          className="absolute -right-0.5 -bottom-0.5 flex size-8 items-center justify-center rounded-full border-2 border-background bg-card text-muted-foreground shadow-soft"
        >
          <Pencil className="size-3.5" />
        </span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <div className="flex flex-col gap-1 pr-10">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </div>
          <AvatarForm action={action} name={name} emoji={emoji} color={color} options={options} onSaved={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
