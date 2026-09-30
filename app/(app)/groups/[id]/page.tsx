import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronDown, ChevronLeft } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { ConfirmGroupAction } from "@/components/groups/confirm-group-action";
import { KindChip } from "@/components/groups/group-card";
import { GroupSettingsForm } from "@/components/groups/group-settings-form";
import { InviteLink } from "@/components/groups/invite-link";
import { MemberRow } from "@/components/groups/member-row";
import { RenameGroupForm } from "@/components/groups/rename-group-form";
import { getProfile } from "@/lib/auth";
import { childrenDeletionNotice, inviteUrl } from "@/lib/group-schema";
import { getGroupDetail } from "@/lib/groups";
import { isUuid } from "@/lib/habit-schema";
import { requestOrigin } from "@/lib/request-origin";
import { listTimezones } from "@/lib/timezones";
import { deleteGroup, leaveGroup, renameGroup, updateGroupSettings } from "../actions";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3 rounded-2xl bg-card p-5 shadow-soft">
      <h2 className="text-sm font-bold text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ invite?: string }>;
}) {
  const [{ id }, { invite }] = await Promise.all([params, searchParams]);
  if (!isUuid(id)) notFound();
  const [{ profile, userId }, group] = await Promise.all([getProfile(), getGroupDetail(id)]);
  if (!group) notFound();

  const isAdmin = group.my_role === "admin";
  const url = group.invite ? inviteUrl(await requestOrigin(), group.invite.token) : null;
  const validUntil = group.invite
    ? new Date(group.invite.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: profile.timezone })
    : null;
  const childrenNotice = childrenDeletionNotice(group.children.map((c) => c.name));
  const alone = group.members.length === 1;

  return (
    <section className="flex flex-col gap-4 pt-2 pb-6">
      <Link href="/groups" className="-ml-2 flex h-11 w-fit items-center gap-1 rounded-full px-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
        <ChevronLeft aria-hidden className="size-4" />
        Groups
      </Link>

      <header className="flex flex-col gap-2">
        <RenameGroupForm name={group.name} canRename={isAdmin} action={renameGroup.bind(null, group.id)} />
        <div>
          <KindChip kind={group.kind} />
        </div>
      </header>

      {isAdmin && (
        <Card title="Invite">
          <InviteLink groupId={group.id} groupName={group.name} url={url} validUntil={validUntil} autoFocus={invite === "1"} />
        </Card>
      )}

      <Card title="People">
        <ul className="flex flex-col gap-2">
          {group.members.map((m) => (
            <MemberRow
              key={m.id}
              groupId={group.id}
              groupName={group.name}
              member={m}
              isSelf={m.id === userId}
              canManage={isAdmin && m.id !== userId}
            />
          ))}
          {/* Task 10 links each child to /kids/[id]. */}
          {group.children.map((c) => (
            <li key={c.id} className="flex min-h-11 items-center gap-3">
              <Avatar name={c.name} emoji={c.avatar_emoji} color={c.avatar_color} size="md" />
              <span className="min-w-0 flex-1 truncate font-semibold">{c.name}</span>
            </li>
          ))}
        </ul>
      </Card>

      {isAdmin && (
        <details className="group rounded-2xl bg-card shadow-soft">
          <summary className="flex min-h-14 list-none items-center gap-3 rounded-2xl px-5 py-3 hover:bg-muted/60 [&::-webkit-details-marker]:hidden">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-bold">Group settings</span>
              <span className="text-xs text-muted-foreground">Time zone and week start</span>
            </span>
            <ChevronDown aria-hidden className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-5 pt-1 pb-5">
            <GroupSettingsForm
              timezone={group.timezone}
              weekStart={group.week_start === 0 ? 0 : 1}
              timezones={listTimezones()}
              action={updateGroupSettings.bind(null, group.id)}
            />
          </div>
        </details>
      )}

      <div className="flex flex-col gap-2 pt-2">
        <ConfirmGroupAction
          triggerLabel="Leave group"
          title={`Leave ${group.name}?`}
          description={
            alone
              ? "You're the only member, so leaving deletes the group."
              : "You stop seeing its habits. Your own habits stay with you."
          }
          confirmLabel="Leave group"
          pendingLabel="Leaving…"
          childrenNotice={childrenNotice}
          action={leaveGroup.bind(null, group.id)}
        />
        {isAdmin && (
          <ConfirmGroupAction
            triggerLabel="Delete group"
            title={`Delete ${group.name}?`}
            description="This removes the group and its shared habits for everyone. It can't be undone."
            confirmLabel="Delete group"
            pendingLabel="Deleting…"
            childrenNotice={childrenNotice}
            destructiveTrigger
            action={deleteGroup.bind(null, group.id)}
          />
        )}
      </div>
    </section>
  );
}
