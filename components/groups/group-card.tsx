import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { groupKindLabel, isGroupKind } from "@/lib/group-schema";
import type { MyGroup } from "@/lib/groups";
import type { T } from "@/supabase/functions/_shared/i18n";

export function KindChip({ kind, t }: { kind: string; t: T }) {
  return (
    <span className="inline-flex h-6 items-center rounded-full bg-muted px-2.5 text-xs font-semibold text-muted-foreground">
      {groupKindLabel(t, isGroupKind(kind) ? kind : "other")}
    </span>
  );
}

export function GroupCard({ group, t }: { group: MyGroup; t: T }) {
  const counts = t("groups.card.counts", {
    members: group.member_count,
    children: group.child_count,
    withChildren: group.child_count > 0 ? "yes" : "no",
  });
  return (
    <Link
      href={`/groups/${group.group_id}`}
      className="flex min-h-16 items-center gap-3 rounded-2xl bg-card p-4 shadow-soft hover:bg-muted/60"
    >
      {/* The name is right next to it, so the avatar is decoration here. */}
      <span aria-hidden>
        <Avatar name={group.name} emoji={group.avatar_emoji} color={group.avatar_color} size="md" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate font-bold">{group.name}</span>
        <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <KindChip kind={group.kind} t={t} />
          <span className="tabular-nums">{counts}</span>
        </span>
      </span>
      <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground" />
    </Link>
  );
}
