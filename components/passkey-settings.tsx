"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ScanFace } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  deletePasskey,
  listPasskeys,
  passkeyErrorMessage,
  registerPasskey,
  usePasskeysAvailable,
  type Passkey,
} from "@/lib/passkeys";

const dateFormat = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });

function usage(p: Passkey): string {
  return p.lastUsedAt ? `Last used ${dateFormat.format(new Date(p.lastUsedAt))}` : `Added ${dateFormat.format(new Date(p.createdAt))}`;
}

// Settings card: list, add and remove this account's passkeys. Hidden where passkeys can't work.
export function PasskeySettings() {
  const available = usePasskeysAvailable();
  if (!available) return null;
  return <PasskeySettingsCard />;
}

function PasskeySettingsCard() {
  const [passkeys, setPasskeys] = useState<Passkey[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [flash, setFlash] = useState(0);
  const [removing, setRemoving] = useState<Passkey | null>(null);

  const apply = useCallback((result: Awaited<ReturnType<typeof listPasskeys>>) => {
    if (result.ok) {
      setPasskeys(result.data);
    } else {
      setPasskeys([]);
      setError("Couldn't load your Face ID devices. Try again in a moment.");
    }
  }, []);

  const load = useCallback(async () => apply(await listPasskeys()), [apply]);

  useEffect(() => {
    let cancelled = false;
    void listPasskeys().then((result) => {
      if (!cancelled) apply(result);
    });
    return () => {
      cancelled = true;
    };
  }, [apply]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(0), 2000);
    return () => clearTimeout(t);
  }, [flash]);

  async function add() {
    setAdding(true);
    setError(null);
    const result = await registerPasskey();
    if (result.ok) {
      await load();
      setFlash((n) => n + 1);
    } else {
      setError(passkeyErrorMessage(result.error, "setUp"));
    }
    setAdding(false);
  }

  const empty = passkeys !== null && passkeys.length === 0;

  return (
    <section aria-labelledby="passkeys-title" className="flex flex-col gap-4 rounded-2xl bg-card p-6 shadow-soft">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
          <ScanFace aria-hidden className="size-5" />
        </div>
        <div className="flex flex-col gap-0.5">
          <h2 id="passkeys-title" className="font-bold">
            Face ID sign-in
          </h2>
          <p className="text-sm text-muted-foreground">
            {empty || passkeys === null ? "Sign in with Face ID next time." : "These devices can sign in with Face ID."}
          </p>
        </div>
      </div>

      {passkeys && passkeys.length > 0 && (
        <ul aria-label="Face ID devices" className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {passkeys.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2 pr-2 pl-4">
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-semibold">{p.name}</span>
                <span className="text-xs text-muted-foreground">{usage(p)}</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="h-11 shrink-0 px-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setRemoving(p)}
                aria-label={`Remove ${p.name}`}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div aria-live="polite" className="sr-only">
        {flash ? "Face ID added" : ""}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {passkeys !== null && (
        <Button
          type="button"
          variant={flash ? "default" : empty ? "default" : "outline"}
          onClick={add}
          disabled={adding}
          className={cn("h-11 gap-1.5 transition-colors", flash && "bg-[#4F8A5B] text-white hover:brightness-95")}
        >
          {adding ? (
            "Setting up…"
          ) : flash ? (
            <>
              <Check aria-hidden className="size-4" /> Added
            </>
          ) : empty ? (
            "Set up Face ID"
          ) : (
            "Add another device"
          )}
        </Button>
      )}

      <RemovePasskeyDialog
        passkey={removing}
        onClose={() => setRemoving(null)}
        onRemoved={async () => {
          setRemoving(null);
          await load();
        }}
      />
    </section>
  );
}

function RemovePasskeyDialog({
  passkey,
  onClose,
  onRemoved,
}: {
  passkey: Passkey | null;
  onClose: () => void;
  onRemoved: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Keep the last name on screen while the dialog animates closed.
  const [shownName, setShownName] = useState("");
  if (passkey && passkey.name !== shownName) setShownName(passkey.name);

  async function remove() {
    if (!passkey) return;
    setPending(true);
    setError(null);
    const result = await deletePasskey(passkey.id);
    setPending(false);
    if (result.ok) await onRemoved();
    else setError("Couldn't remove it. Try again in a moment.");
  }

  return (
    <Dialog
      open={passkey !== null}
      onOpenChange={(open) => {
        if (!open && !pending) {
          setError(null);
          onClose();
        }
      }}
    >
      <DialogContent>
        <div className="flex flex-col gap-1 pr-10">
          <DialogTitle>Remove {shownName}?</DialogTitle>
          <DialogDescription>
            This device will stop signing in with Face ID. You can still use Google or an email link, and set it up again any
            time.
          </DialogDescription>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="h-11 flex-1" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" className="h-11 flex-1" disabled={pending} onClick={remove}>
            {pending ? "Removing…" : "Remove"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
