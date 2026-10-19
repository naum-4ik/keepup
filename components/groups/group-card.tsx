import { ChevronRight } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Surface } from "@/components/ui/surface";
import { groupKindLabel, isGroupKind } from "@/lib/group-schema";
import type { MyGroup } from "@/lib/groups";
import type { T } from "@/supabase/functions/_shared/i18n";

export function KindChip({ kind, t }: { kind: string; t: T }) {
  return (
    <span className="inline-flex h-6 items-center rounded-full bg-muted px-inner text-xs font-semibold text-muted-foreground">
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
    <Surface as="a" href={`/groups/${group.group_id}`} className="flex min-h-16 items-center gap-item">
      {/* The name is right next to it, so the avatar is decoration here. */}
      <span aria-hidden>
        <Avatar name={group.name} emoji={group.avatar_emoji} color={group.avatar_color} size="md" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-bold">{group.name}</span>
        <span className="flex flex-wrap items-center gap-inner text-sm text-muted-foreground">
          <KindChip kind={group.kind} t={t} />
          <span className="tabular-nums">{counts}</span>
        </span>
      </span>
      <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground rtl:-scale-x-100" />
    </Surface>
  );
}
