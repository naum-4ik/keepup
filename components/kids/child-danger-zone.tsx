"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { deleteChild, exportChild, moveChild, resetChild } from "@/app/(app)/kids/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { downloadJson } from "@/lib/download-json";
import { exportFileName } from "@/lib/kid-schema";
import { cn } from "@/lib/utils";

export type MoveTarget = { id: string; name: string };
const bdi = (c: ReactNode) => <bdi>{c}</bdi>;

export function ExportChildButton({ childId, childName, label, className }: { childId: string; childName: string; label?: ReactNode; className?: string }) {
  const t = useTranslations("kids.danger");
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
            // Saved as keepup-{nickname}-{date}.json.
            downloadJson(exportFileName(childName), r.data);
          })
        }
      >
        <span className="truncate">{pending ? t("exporting") : (label ?? t.rich("export", { name: childName, bdi }))}</span>
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
  label,
  onMoved,
}: {
  childId: string;
  childName: string;
  targets: MoveTarget[];
  label?: ReactNode;
  onMoved?: () => void;
}) {
  const t = useTranslations("kids.danger");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(targets[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (targets.length === 0) return null;
  if (!open) {
    return (
      <Button type="button" variant="outline" className="h-11" onClick={() => setOpen(true)}>
        {label ?? t("moveLabel")}
      </Button>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-muted p-3">
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        {t.rich("moveTo", { name: childName, bdi })}
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
          {tc("cancel")}
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
          {pending ? t("moving") : t("move")}
        </Button>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

// A fresh start: habits, check-ins, stars, the album and treat goals go; the nickname and avatar stay.
function ResetChildButton({ childId, childName }: { childId: string; childName: string }) {
  const t = useTranslations("kids.danger");
  const tc = useTranslations("common");
  const tg = useTranslations("groups.confirm");
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
        <span className="truncate">{t.rich("resetTrigger", { name: childName, bdi })}</span>
      </Button>
      {done && (
        <p role="status" className="text-sm font-semibold text-done">
          {t.rich("resetDone", { name: childName, bdi })}
        </p>
      )}
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent>
          <div className="flex flex-col gap-1 pr-10">
            <DialogTitle>{t.rich("resetTitle", { name: childName, bdi })}</DialogTitle>
            <DialogDescription>{t.rich("resetDescription", { name: childName, bdi })}</DialogDescription>
          </div>
          <ExportChildButton childId={childId} childName={childName} label={tg("exportFirst")} />
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="h-11 flex-1" disabled={pending} onClick={() => setOpen(false)}>
              {tc("cancel")}
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
              {pending ? t("resetting") : t("reset")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DeleteChildButton({ childId, childName }: { childId: string; childName: string }) {
  const t = useTranslations("kids.danger");
  const tc = useTranslations("common");
  const th = useTranslations("habits.delete");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Button type="button" variant="outline" className="h-11 text-destructive hover:text-destructive" onClick={() => setOpen(true)}>
        <span className="truncate">{t.rich("deleteTrigger", { name: childName, bdi })}</span>
      </Button>
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent>
          <div className="flex flex-col gap-1 pr-10">
            <DialogTitle>{t.rich("deleteTitle", { name: childName, bdi })}</DialogTitle>
            <DialogDescription>{t.rich("deleteDescription", { name: childName, bdi })}</DialogDescription>
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="h-11 flex-1" disabled={pending} onClick={() => setOpen(false)}>
              {tc("cancel")}
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
              {pending ? th("pending") : th("confirm")}
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
  const t = useTranslations("kids.danger");
  // Admins only: export (anyone's right to a copy) lives in the kid page's Data section.
  if (!isAdmin) return null;
  return (
    <section aria-label={t("title")} className="flex flex-col gap-2 rounded-2xl bg-card p-5 shadow-soft">
      <h2 className="text-sm font-bold text-muted-foreground">{t("title")}</h2>
      <MoveChildForm childId={childId} childName={childName} targets={moveTargets} />
      <ResetChildButton childId={childId} childName={childName} />
      <DeleteChildButton childId={childId} childName={childName} />
    </section>
  );
}
