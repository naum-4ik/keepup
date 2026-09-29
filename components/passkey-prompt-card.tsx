"use client";

import { useEffect, useState } from "react";
import { Check, ScanFace } from "lucide-react";
import { Button } from "@/components/ui/button";
import { firstCheckinTipGoneToday } from "@/components/first-checkin-tip";
import { listPasskeys, passkeyErrorMessage, passkeysAvailableHere, registerPasskey } from "@/lib/passkeys";

const DISMISSED_KEY = "keepup:passkey-prompt-dismissed";

function wasDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

type View = "hidden" | "prompt" | "done";

// Today: a one-time offer to set up Face ID, for someone with no passkey yet on a device that can
// use one. Waits while the first check-in tip is (or was today) on screen, so one hint shows at a time.
export function PasskeyPromptCard({ tipEligible }: { tipEligible: boolean }) {
  const [view, setView] = useState<View>("hidden");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tipEligible || firstCheckinTipGoneToday() || wasDismissed() || !passkeysAvailableHere()) return;
    let cancelled = false;
    // Render nothing until the list is back, so the card never flashes for someone who has one.
    void listPasskeys().then((result) => {
      if (!cancelled && result.ok && result.data.length === 0) setView("prompt");
    });
    return () => {
      cancelled = true;
    };
  }, [tipEligible]);

  if (view === "hidden") return null;

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Storage unavailable: hidden for this visit only.
    }
    setView("hidden");
  }

  async function setUp() {
    setPending(true);
    setError(null);
    const result = await registerPasskey();
    setPending(false);
    if (result.ok) setView("done");
    else setError(passkeyErrorMessage(result.error, "setUp"));
  }

  if (view === "done") {
    return (
      <div aria-live="polite" className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-soft">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#4F8A5B] text-white">
          <Check aria-hidden className="size-5" />
        </div>
        <p className="text-sm font-semibold">Face ID is set up. Use it next time you sign in.</p>
      </div>
    );
  }

  return (
    <section aria-labelledby="passkey-prompt-title" className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-soft">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
          <ScanFace aria-hidden className="size-5" />
        </div>
        <div className="flex flex-col gap-0.5">
          <h2 id="passkey-prompt-title" className="font-bold">
            Sign in faster with Face ID
          </h2>
          <p className="text-sm text-muted-foreground">No email links next time. Touch ID or your device PIN work too.</p>
        </div>
      </div>
      <div aria-live="polite">{error && <p className="text-sm text-destructive">{error}</p>}</div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="h-11 flex-1" onClick={dismiss} disabled={pending}>
          Not now
        </Button>
        <Button type="button" className="h-11 flex-1" onClick={setUp} disabled={pending}>
          {pending ? "Setting up…" : "Set up"}
        </Button>
      </div>
    </section>
  );
}
