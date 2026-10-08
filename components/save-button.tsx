"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Submit button that confirms every save, not just the first: each successful action returns a
// new state object, so the button flashes "Saved" again.
export function SaveButton({
  state,
  pending,
  label = "Save",
  variant = "default",
}: {
  state: { status: string };
  pending: boolean;
  label?: string;
  variant?: "default" | "outline";
}) {
  const [seen, setSeen] = useState(state);
  const [flash, setFlash] = useState(false);
  const [saves, setSaves] = useState(0);

  // A new state object means the action just finished; react to it during render.
  if (state !== seen) {
    setSeen(state);
    if (state.status === "saved") {
      setFlash(true);
      setSaves((n) => n + 1);
    }
  }

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(false), 2000);
    return () => clearTimeout(t);
  }, [flash, seen]);

  return (
    <div className="flex flex-col gap-2">
      {/* Screen readers hear each save; sighted users see the button flash. */}
      <p key={saves} role="status" className="sr-only">
        {saves > 0 ? "Saved" : ""}
      </p>
      <Button
        type="submit"
        variant={flash ? "default" : variant}
        disabled={pending}
        className={cn("h-11 gap-1.5 transition-colors", flash && "bg-done text-done-foreground hover:brightness-95")}
      >
        {pending ? "Saving…" : flash ? (<><Check aria-hidden className="size-4" /> Saved</>) : label}
      </Button>
    </div>
  );
}
