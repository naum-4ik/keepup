"use client";

import { useRef, useState, useTransition } from "react";
import { Ellipsis } from "lucide-react";
import { removeMember, setMemberRole, type GroupActionState } from "@/app/(app)/groups/actions";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { GroupMember } from "@/lib/groups";

const menuItem = "flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-semibold hover:bg-muted disabled:opacity-50";

export function MemberRow({
  groupId,
  groupName,
  member,
  isSelf,
  canManage,
}: {
  groupId: string;
  groupName: string;
  member: GroupMember;
  isSelf: boolean;
  canManage: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const menuRef = useRef<HTMLDetailsElement>(null);

  const run = (call: () => Promise<GroupActionState>, after?: () => void) =>
    startTransition(async () => {
      const result = await call();
      setError(result.status === "error" ? result.message : null);
      if (menuRef.current) menuRef.current.open = false;
      if (result.status !== "error") after?.();
    });

  const isAdmin = member.role === "admin";

  return (
    <li className="flex flex-col gap-1">
      <div className="flex min-h-11 items-center gap-3">
        <Avatar name={member.name} emoji={member.avatar_emoji} color={member.avatar_color} size="md" />
        <span className="min-w-0 flex-1 truncate font-semibold">{isSelf ? "You" : member.name}</span>
        {isAdmin && (
          <span className="inline-flex h-6 items-center rounded-full bg-accent px-2.5 text-xs font-semibold text-accent-foreground">
            Admin
          </span>
        )}
        {canManage && (
          <details ref={menuRef} className="relative">
            <summary
              aria-label={`Options for ${member.name}`}
              className="flex size-11 list-none items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground [&::-webkit-details-marker]:hidden"
            >
              <Ellipsis aria-hidden className="size-5" />
            </summary>
            <div className="absolute right-0 z-10 mt-1 flex w-52 flex-col rounded-2xl bg-card p-1 shadow-soft ring-1 ring-border">
              <button
                type="button"
                disabled={pending}
                className={menuItem}
                onClick={() => run(() => setMemberRole(groupId, member.id, isAdmin ? "member" : "admin"))}
              >
                {isAdmin ? "Make member" : "Make admin"}
              </button>
              <button
                type="button"
                disabled={pending}
                className={`${menuItem} text-destructive`}
                onClick={() => {
                  if (menuRef.current) menuRef.current.open = false;
                  setConfirming(true);
                }}
              >
                Remove from group
              </button>
            </div>
          </details>
        )}
      </div>
      {error && !confirming && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <Dialog open={confirming} onOpenChange={(next) => !pending && setConfirming(next)}>
        <DialogContent>
          <div className="flex flex-col gap-1 pr-10">
            <DialogTitle>Remove {member.name}?</DialogTitle>
            <DialogDescription>
              They leave {groupName} and stop seeing its habits. Their own habits stay with them.
            </DialogDescription>
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="h-11 flex-1" disabled={pending} onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-11 flex-1"
              disabled={pending}
              onClick={() => run(() => removeMember(groupId, member.id), () => setConfirming(false))}
            >
              {pending ? "Removing…" : "Remove"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </li>
  );
}
