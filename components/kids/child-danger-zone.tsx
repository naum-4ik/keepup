"use client";

import { useState, useTransition } from "react";
import { deleteChild, exportChild, moveChild, resetChild } from "@/app/(app)/kids/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { exportFileName } from "@/lib/kid-schema";
import { cn } from "@/lib/utils";

export type MoveTarget = { id: string; name: string };

// Saves the child's export as keepup-{nickname}-{date}.json through a Blob URL.
function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = exportFileName(name);
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoked later: some browsers start the download after click() returns.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ExportChildButton({ childId, childName, label, className }: { childId: string; childName: string; label?: string; className?: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="outline"
        className={cn("h-11", className)}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await exportChild(childId);
            if (!r.ok) return setError(r.message);
            setError(null);
            download(childName, r.data);
          })
        }
      >
        {pending ? "Exporting…" : (label ?? `Export ${childName}'s data`)}
      </Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

// Admins of both groups (the RPC checks). Hidden when there's nowhere to move to.
export function MoveChildForm({
  childId,
  childName,
  targets,
  label = "Move to another group",
  onMoved,
}: {
  childId: string;
  childName: string;
  targets: MoveTarget[];
  label?: string;
  onMoved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(targets[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (targets.length === 0) return null;
  if (!open) {
    return (
      <Button type="button" variant="outline" className="h-11" onClick={() => setOpen(true)}>
        {label}
      </Button>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-muted p-3">
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Move {childName} to
        <select
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="h-11 rounded-xl border border-input bg-card px-3 text-base font-normal"
        >
          {targets.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="h-11 flex-1" disabled={pending} onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button
          type="button"
          className="h-11 flex-1"
          disabled={pending || !to}
          onClick={() =>
            startTransition(async () => {
              const r = await moveChild(childId, to);
              if (!r.ok) return setError(r.message);
              setError(null);
              setOpen(false);
              onMoved?.();
            })
          }
        >
          {pending ? "Moving…" : "Move"}
        </Button>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

// A fresh start: habits, check-ins, stars, the album and treat goals go; the nickname and avatar stay.
function ResetChildButton({ childId, childName }: { childId: string; childName: string }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-11 text-destructive hover:text-destructive"
        onClick={() => {
          setDone(false);
          setError(null);
          setOpen(true);
        }}
      >
        Reset {childName}&apos;s profile
      </Button>
      {done && (
        <p role="status" className="text-sm font-semibold text-[#4F8A5B]">
          {childName}&apos;s profile is reset. A fresh start 🌱
        </p>
      )}
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent>
          <div className="flex flex-col gap-1 pr-10">
            <DialogTitle>Reset {childName}&apos;s profile?</DialogTitle>
            <DialogDescription>
              Everything except {childName}&apos;s nickname and avatar is cleared: habits, check-ins, stars, the garden album and treat
              goals. This can&apos;t be undone.
            </DialogDescription>
          </div>
          <ExportChildButton childId={childId} childName={childName} label="Export first" />
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="h-11 flex-1" disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-11 flex-1"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await resetChild(childId);
                  if (!r.ok) return setError(r.message);
                  setOpen(false);
                  setDone(true);
                })
              }
            >
              {pending ? "Resetting…" : "Reset"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DeleteChildButton({ childId, childName }: { childId: string; childName: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Button type="button" variant="outline" className="h-11 text-destructive hover:text-destructive" onClick={() => setOpen(true)}>
        Delete {childName}&apos;s profile
      </Button>
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent>
          <div className="flex flex-col gap-1 pr-10">
            <DialogTitle>Delete {childName}&apos;s profile?</DialogTitle>
            <DialogDescription>
              {childName}&apos;s profile and history will be deleted. This can&apos;t be undone.
            </DialogDescription>
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="h-11 flex-1" disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-11 flex-1"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await deleteChild(childId);
                  // On success the action redirects to /groups.
                  if (r && !r.ok) setError(r.message);
                })
              }
            >
              {pending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ChildDangerZone({
  childId,
  childName,
  isAdmin,
  moveTargets,
}: {
  childId: string;
  childName: string;
  isAdmin: boolean;
  moveTargets: MoveTarget[];
}) {
  return (
    <section aria-label="Danger zone" className="flex flex-col gap-2 rounded-2xl bg-card p-5 shadow-soft">
      <h2 className="text-sm font-bold text-muted-foreground">Danger zone</h2>
      <ExportChildButton childId={childId} childName={childName} />
      {isAdmin && <MoveChildForm childId={childId} childName={childName} targets={moveTargets} />}
      {isAdmin && <ResetChildButton childId={childId} childName={childName} />}
      {isAdmin && <DeleteChildButton childId={childId} childName={childName} />}
    </section>
  );
}
