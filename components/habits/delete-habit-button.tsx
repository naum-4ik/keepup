"use client";

import { useState } from "react";
import { deleteHabit } from "@/app/(app)/habits/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export function DeleteHabitButton({ habitId, title }: { habitId: string; title: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="outline" className="h-11 w-full" onClick={() => setOpen(true)}>
        Delete habit
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <div className="flex flex-col gap-1 pr-10">
            <DialogTitle>{`Delete "${title}"?`}</DialogTitle>
            <DialogDescription>This can&apos;t be undone.</DialogDescription>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="h-11 flex-1" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <form action={deleteHabit.bind(null, habitId)} className="flex-1">
              <Button type="submit" variant="destructive" className="h-11 w-full">
                Delete
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
