"use client";

import { useState, useTransition } from "react";
import { approveAll, review } from "@/app/(app)/inbox/actions";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
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
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  // Per-row notes (e.g. someone else reviewed it first); the row leaves on the next refresh.
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const run = (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    startTransition(async () => {
      await fn();
      setBusy(null);
    });
  };

  const decide = (id: string, approve: boolean) =>
    run(`${id}:${approve ? "yes" : "no"}`, async () => {
      const r = await review(id, approve);
      if (r.ok) return;
      if (r.code === "already_reviewed" || r.code === "review_closed") {
        setNotes((n) => ({ ...n, [id]: r.code === "already_reviewed" ? "Someone already reviewed this." : r.message }));
      } else setError(r.message);
    });

  if (rows.length === 0) return <p className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground shadow-soft">Nothing waiting for you.</p>;

  return (
    <div className="flex flex-col gap-3">
      {rows.length >= 2 && (
        <Button
          type="button"
          className="h-11 rounded-xl text-base"
          disabled={pending}
          onClick={() =>
            run("all", async () => {
              const r = await approveAll(rows.map((x) => x.check_in_id));
              if (!r.ok) setError(r.message);
            })
          }
        >
          Approve all ({rows.length})
        </Button>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {rows.map((a) => {
          const note = notes[a.check_in_id];
          return (
            <li
              key={a.check_in_id}
              aria-label={`${a.author_name} did ${a.habit_title}`}
              className={cn("flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-soft transition-opacity duration-200", note && "opacity-60")}
            >
              <div className="flex items-center gap-3">
                <Avatar name={a.author_name} emoji={a.author_avatar_emoji} color={a.author_avatar_color} size="md" />
                <div className="flex min-w-0 flex-col">
                  <p className="font-semibold">
                    {a.author_name} did {a.habit_title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a.group_name} · {a.day}
                    {a.reviewBy && <span className="font-semibold text-[#9A6A10]"> · {a.reviewBy}</span>}
                  </p>
                </div>
              </div>
              {note ? (
                <p role="status" className="text-sm text-muted-foreground">
                  {note}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant="outline" className="h-11 rounded-xl" disabled={pending} onClick={() => decide(a.check_in_id, false)}>
                    {busy === `${a.check_in_id}:no` ? "Saving…" : "Not approved"}
                  </Button>
                  <Button type="button" className="h-11 rounded-xl" disabled={pending} onClick={() => decide(a.check_in_id, true)}>
                    {busy === `${a.check_in_id}:yes` ? "Saving…" : "Approve"}
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
