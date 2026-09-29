"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Submit button that confirms every save, not just the first: each successful action returns a
// new state object, so the button flashes "Saved" and the status line shows the time again.
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
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  // A new state object means the action just finished; react to it during render.
  if (state !== seen) {
    setSeen(state);
    if (state.status === "saved") {
      setSavedAt(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date()));
      setFlash(true);
    }
  }

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(false), 2000);
    return () => clearTimeout(t);
  }, [flash, seen]);

  return (
    <div className="flex flex-col gap-2">
      {savedAt && (
        <p role="status" className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Check aria-hidden className="size-4 text-[#4F8A5B]" />
          Saved at {savedAt}
        </p>
      )}
      <Button
        type="submit"
        variant={flash ? "default" : variant}
        disabled={pending}
        className={cn("h-11 gap-1.5 transition-colors", flash && "bg-[#4F8A5B] text-white hover:brightness-95")}
      >
        {pending ? "Saving…" : flash ? (<><Check aria-hidden className="size-4" /> Saved</>) : label}
      </Button>
    </div>
  );
}
