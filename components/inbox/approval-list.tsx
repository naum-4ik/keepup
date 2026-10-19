"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { approveAll, review } from "@/app/(app)/inbox/actions";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { showToast } from "@/components/ui/toast";
import { alreadyReviewedNote } from "@/lib/habit-errors";
import { approvedAllText, nextFocusIndex, reachServer, reviewedText } from "@/lib/inbox-toasts";
import { focusIsLost } from "@/lib/toast";
import { useT } from "@/lib/i18n/client";
import { isolate } from "@/supabase/functions/_shared/i18n";
import { cn } from "@/lib/utils";

export type ApprovalRow = {
  check_in_id: string;
  author_name: string;
  author_avatar_emoji: string | null;
  author_avatar_color: string | null;
  habit_title: string;
  group_name: string;
  day: string; // "today", "yesterday", "Thu 1 Oct"
  reviewBy: string | null; // "Review by 22:30" when the window closes soon
};

export function ApprovalList({ rows }: { rows: ApprovalRow[] }) {
  const { t } = useT();
  const tx = useTranslations("inbox.approvals");
  const bdi = (c: ReactNode) => <bdi>{c}</bdi>;
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  // Per-row notes (e.g. someone else reviewed it first); the row leaves on the next refresh.
  const [notes, setNotes] = useState<Record<string, string>>({});
  // Per-row errors, next to the buttons that failed; "all" for Approve all.
  const [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  // The row a decision was made on, and where it stood: once the refresh takes it away, focus (if it
  // was lost with the row's buttons) goes to the row now in its place, else the one before it, else
  // the empty state's action. Never away from where the person put it (lib/toast.ts focusIsLost).
  // After every commit (no deps): the refresh can land before or after the answer sets `decided`.
  const decided = useRef<{ ids: string[]; index: number } | null>(null);
  useEffect(() => {
    const d = decided.current;
    if (!d || d.ids.some((id) => rows.some((r) => r.check_in_id === id))) return;
    decided.current = null;
    if (!focusIsLost(document.activeElement, document.body)) return;
    const root = rootRef.current;
    const firsts = root ? [...root.querySelectorAll<HTMLElement>("[data-row-first]")] : [];
    const i = nextFocusIndex(d.index, firsts.length);
    (i >= 0 ? firsts[i] : root?.querySelector<HTMLElement>("a, button"))?.focus();
  });

  const run = (key: string, row: string, fn: () => Promise<void>) => {
    setBusy(key);
    setErrors((e) => {
      const { [row]: _gone, ...rest } = e;
      void _gone;
      return rest;
    });
    startTransition(async () => {
      await fn();
      setBusy(null);
    });
  };

  // Approve / Not approved: "Approving…" while it saves, then a toast that says what it did (the row
  // leaves with the refresh), or what went wrong under the row, with what to do.
  const decide = (a: ApprovalRow, approve: boolean) =>
    run(`${a.check_in_id}:${approve ? "yes" : "no"}`, a.check_in_id, async () => {
      const r = await reachServer(t, () => review(a.check_in_id, approve));
      if (r.ok) {
        decided.current = { ids: [a.check_in_id], index: rows.findIndex((x) => x.check_in_id === a.check_in_id) };
        return showToast({ text: reviewedText(t, { name: a.author_name, habit: a.habit_title, approve }) });
      }
      const code = "code" in r ? r.code : undefined;
      if (code === "already_reviewed" || code === "review_closed") {
        const reviewer = "reviewer" in r ? r.reviewer : undefined;
        setNotes((n) => ({ ...n, [a.check_in_id]: code === "already_reviewed" ? alreadyReviewedNote(t, reviewer) : r.message }));
      } else {
        // Gone meanwhile (undone, deleted) or another failure: the list may be stale, so the next
        // step is a reload (the error Notice's action).
        if (code === "check_in_not_found") decided.current = { ids: [a.check_in_id], index: rows.findIndex((x) => x.check_in_id === a.check_in_id) };
        setErrors((e) => ({ ...e, [a.check_in_id]: r.message }));
      }
    });

  const reload = (
    <Button type="button" variant="ghost" className="-my-3 -me-2 h-11 px-inner" onClick={() => router.refresh()}>
      {tx("reload")}
    </Button>
  );

  if (rows.length === 0) {
    return (
      <div ref={rootRef}>
        <EmptyState
          icon={<CircleCheck className="size-6" />}
          action={
            // Nothing to review: the next thing to do is your own check-ins.
            <Button asChild variant="outline">
              <Link href="/today">{tx("emptyAction")}</Link>
            </Button>
          }
        >
          {tx("empty")}
        </EmptyState>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="flex flex-col gap-item">
      {rows.length >= 2 && (
        <div className="flex flex-col gap-inner">
          <Button
            type="button"
            className="h-11 rounded-xl text-base"
            disabled={pending}
            onClick={() =>
              run("all", "all", async () => {
                const r = await reachServer(t, () => approveAll(rows.map((x) => x.check_in_id)));
                if (r.ok) {
                  decided.current = { ids: rows.map((x) => x.check_in_id), index: 0 };
                  showToast({ text: approvedAllText(t, "reviewed" in r ? r.reviewed : 0) });
                }
                else setErrors((e) => ({ ...e, all: r.message }));
              })
            }
          >
            {busy === "all" ? tx("approvingAll", { n: rows.length }) : tx("approveAll", { n: rows.length })}
          </Button>
          {errors.all && (
            <Notice tone="error" live action={reload}>
              {errors.all}
            </Notice>
          )}
        </div>
      )}
      <ul className="flex flex-col gap-item">
        {rows.map((a) => {
          const note = notes[a.check_in_id];
          const error = errors[a.check_in_id];
          return (
            // A card: an approval is an object you act on, with its two buttons inside (like Today's
            // habit card), so it can't be one Surface button itself.
            <li
              key={a.check_in_id}
              aria-label={tx("rowLabel", { name: isolate(a.author_name), habit: isolate(a.habit_title) })}
              className={cn(
                "flex flex-col gap-item rounded-2xl bg-card p-item shadow-soft transition-opacity duration-200 motion-reduce:transition-none",
                note && "opacity-60",
              )}
            >
              <div className="flex items-center gap-inner">
                <Avatar name={a.author_name} emoji={a.author_avatar_emoji} color={a.author_avatar_color} size="md" />
                <div className="flex min-w-0 flex-col">
                  <p className="font-semibold">
                    {tx.rich("did", { name: a.author_name, habit: a.habit_title, bdi })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a.group_name} · {a.day}
                    {a.reviewBy && <span className="font-semibold text-pending"> · {a.reviewBy}</span>}
                  </p>
                </div>
              </div>
              {note ? (
                <p role="status" className="text-sm text-muted-foreground">
                  {note}
                </p>
              ) : (
                <div className="flex flex-col gap-inner">
                  <div className="grid grid-cols-2 gap-inner">
                    <Button type="button" variant="outline" className="h-11 rounded-xl" data-row-first="" disabled={pending} onClick={() => decide(a, false)}>
                      {busy === `${a.check_in_id}:no` ? tx("declining") : tx("notApproved")}
                    </Button>
                    <Button type="button" className="h-11 rounded-xl" disabled={pending} onClick={() => decide(a, true)}>
                      {busy === `${a.check_in_id}:yes` ? tx("approving") : tx("approve")}
                    </Button>
                  </div>
                  {error && (
                    <Notice tone="error" live action={reload}>
                      {error}
                    </Notice>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
