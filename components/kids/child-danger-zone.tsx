"use client";

import { useState, useTransition, type ReactNode } from "react";
import { unstable_rethrow } from "next/navigation";
import { useTranslations } from "next-intl";
import { deleteChild, exportChild, moveChild, resetChild } from "@/app/(app)/kids/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";
import { Section } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { downloadJson } from "@/lib/download-json";
import { exportFileName } from "@/lib/kid-schema";
import { reach } from "@/lib/reach";
import { cn } from "@/lib/utils";
import { isolate } from "@/supabase/functions/_shared/i18n";

export type MoveTarget = { id: string; name: string };
const bdi = (c: ReactNode) => <bdi>{c}</bdi>;

// Saves the file, then says which one (it may land in Downloads unseen; "Download started", as an
// iPhone home-screen app can drop it silently). Inline, not a toast: the
// button also sits in dialogs, where a toast can't be seen behind the overlay.
export function ExportChildButton({ childId, childName, label, className }: { childId: string; childName: string; label?: ReactNode; className?: string }) {
  const t = useTranslations("kids.danger");
  const tc = useTranslations("common");
  const tk = useTranslations("kids.errors");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-inner">
      <Button
        type="button"
        variant="outline"
        className={cn("h-11", className)}
        disabled={pending}
        onClick={() => {
          setError(null);
          setSaved(null);
          startTransition(async () => {
            const r = await reach(() => exportChild(childId), { offline: tk("offline"), reload: tk("reload") });
            if (!r.ok) return setError(r.message);
            // Saved as keepup-{nickname}-{date}.json.
            const file = exportFileName(childName);
            downloadJson(file, r.data);
            setSaved(file);
          });
        }}
      >
        <span className="truncate">{pending ? tc("exporting") : (label ?? t("export", { name: isolate(childName) }))}</span>
      </Button>
      <p role="status" className={cn("text-sm font-semibold text-done", !saved && "sr-only")}>
        {saved ? tc("downloaded", { file: isolate(saved) }) : ""}
      </p>
      {error && (
        <Notice tone="error" live>
          {error}
        </Notice>
      )}
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
  const tk = useTranslations("kids");
  const { showToast } = useToast();
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
    // A tinted panel: 12 px padding to match its 12 px radius (as Notice does).
    <div className="flex flex-col gap-inner rounded-xl bg-muted p-3">
      <label className="flex flex-col gap-inner text-sm font-semibold">
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
      <div className="flex gap-inner">
        <Button type="button" variant="outline" className="h-11 flex-1" disabled={pending} onClick={() => setOpen(false)}>
          {tc("cancel")}
        </Button>
        <Button
          type="button"
          className="h-11 flex-1"
          disabled={pending || !to}
          onClick={() =>
            startTransition(async () => {
              const r = await reach(() => moveChild(childId, to), { offline: tk("errors.offline"), reload: tk("errors.reload") });
              if (!r.ok) return setError(r.message);
              setError(null);
              setOpen(false);
              // From a dialog (a group's Leave or Delete), the dialog says so itself: a toast would be
              // hidden behind it.
              if (onMoved) onMoved();
              else showToast({ text: tk("toast.moved", { name: isolate(childName), group: isolate(targets.find((g) => g.id === to)?.name ?? "") }) });
            })
          }
        >
          {pending ? t("moving") : t("move")}
        </Button>
      </div>
      {error && (
        <Notice tone="error" live>
          {error}
        </Notice>
      )}
    </div>
  );
}

// A fresh start: habits, check-ins, stars, the album and treat goals go; the nickname and avatar stay.
function ResetChildButton({ childId, childName }: { childId: string; childName: string }) {
  const t = useTranslations("kids.danger");
  const tc = useTranslations("common");
  const tg = useTranslations("groups.confirm");
  const tk = useTranslations("kids.errors");
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
        <span className="truncate">{t("resetTrigger", { name: isolate(childName) })}</span>
      </Button>
      {done && (
        <Notice tone="success" live>
          {t.rich("resetDone", { name: childName, bdi })}
        </Notice>
      )}
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent>
          {/* pe-10: room for the dialog's close X. Title over description: line-height, no gap. */}
          <div className="flex flex-col pe-10">
            <DialogTitle>{t.rich("resetTitle", { name: childName, bdi })}</DialogTitle>
            <DialogDescription>{t.rich("resetDescription", { name: childName, bdi })}</DialogDescription>
          </div>
          <ExportChildButton childId={childId} childName={childName} label={tg("exportFirst")} />
          {error && (
            <Notice tone="error" live>
              {error}
            </Notice>
          )}
          <div className="flex gap-inner">
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
                  const r = await reach(() => resetChild(childId), { offline: tk("offline"), reload: tk("reload") });
                  if (!r.ok) return setError(r.message);
                  setOpen(false);
                  setDone(true);
                })
              }
            >
              {pending ? tc("resetting") : tc("reset")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Success redirects to the group list with "Deleted Mary's profile and history." (the server action's
// flash); that redirect arrives as a thrown error, so it is rethrown, never shown as a failure.
function DeleteChildButton({ childId, childName }: { childId: string; childName: string }) {
  const t = useTranslations("kids.danger");
  const tc = useTranslations("common");
  const tk = useTranslations("kids.errors");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Button type="button" variant="outline" className="h-11 text-destructive hover:text-destructive" onClick={() => setOpen(true)}>
        <span className="truncate">{t("deleteTrigger", { name: isolate(childName) })}</span>
      </Button>
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent>
          <div className="flex flex-col pe-10">
            <DialogTitle>{t.rich("deleteTitle", { name: childName, bdi })}</DialogTitle>
            <DialogDescription>{t.rich("deleteDescription", { name: childName, bdi })}</DialogDescription>
          </div>
          {error && (
            <Notice tone="error" live>
              {error}
            </Notice>
          )}
          <div className="flex gap-inner">
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
                  setError(null);
                  const r = await reach(() => deleteChild(childId), { offline: tk("offline"), reload: tk("reload") }, { rethrow: unstable_rethrow });
                  if (r && !r.ok) setError(r.message);
                })
              }
            >
              {pending ? tc("deleting") : tc("delete")}
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
    <Section title={t("title")}>
      <MoveChildForm childId={childId} childName={childName} targets={moveTargets} />
      <ResetChildButton childId={childId} childName={childName} />
      <DeleteChildButton childId={childId} childName={childName} />
    </Section>
  );
}
