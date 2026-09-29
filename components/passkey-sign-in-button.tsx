"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ScanFace } from "lucide-react";
import { Button } from "@/components/ui/button";
import { passkeyErrorMessage, signInWithPasskey, usePasskeysAvailable } from "@/lib/passkeys";

// Login page: shown only where passkeys can work (see passkeysAvailable). When Google is off, the
// "or" divider before the email form comes with this button so it never shows on its own.
export function PasskeySignInButton({ next, withDivider }: { next: string; withDivider: boolean }) {
  const available = usePasskeysAvailable();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState(false);

  if (!available) return null;

  async function signIn() {
    setPending(true);
    setError(null);
    setHint(false);
    const result = await signInWithPasskey();
    if (result.ok) {
      router.replace(next);
      router.refresh();
      return;
    }
    const message = passkeyErrorMessage(result.error, "signIn");
    setError(message);
    // Closing the sheet and having no passkey on this device look the same; offer the way in.
    setHint(message === null);
    setPending(false);
  }

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Button
          type="button"
          variant="outline"
          onClick={signIn}
          disabled={pending}
          className="h-12 w-full justify-center gap-3 border-primary/40 bg-card text-primary hover:bg-accent hover:text-primary"
        >
          <ScanFace aria-hidden className="size-5" />
          {pending ? "Signing in…" : "Sign in with Face ID"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">or Touch ID, or your device PIN</p>
        <div aria-live="polite">
          {error && <p className="pt-1 text-sm text-destructive">{error}</p>}
          {hint && (
            <p className="pt-1 text-center text-sm text-muted-foreground">
              No Face ID set up on this device? Sign in with Google or email, then add it in Settings.
            </p>
          )}
        </div>
      </div>
      {withDivider && (
        <div className="flex items-center gap-3">
          <div aria-hidden="true" className="h-px flex-1 bg-border" />
          <span className="text-sm text-muted-foreground">or</span>
          <div aria-hidden="true" className="h-px flex-1 bg-border" />
        </div>
      )}
    </>
  );
}
