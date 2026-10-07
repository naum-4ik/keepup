import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { AvatarEdit } from "@/components/avatar-edit";
import { ConfirmGroupAction } from "@/components/groups/confirm-group-action";
import { KindChip } from "@/components/groups/group-card";
import { HabitEmoji } from "@/components/habits/category-icon";
import { GroupSettingsForm } from "@/components/groups/group-settings-form";
import { InviteLink } from "@/components/groups/invite-link";
import { MemberRow } from "@/components/groups/member-row";
import { RenameGroupForm } from "@/components/groups/rename-group-form";
import { addButtonClass } from "@/components/ui/add-button";
import { getProfile } from "@/lib/auth";
import { DEMO_OFF } from "@/lib/demo-copy";
import { GROUP_AVATAR_EMOJI } from "@/lib/avatars";
import { childrenDeletionNotice, inviteUrl } from "@/lib/group-schema";
import { getGroupDetail, getMyGroups } from "@/lib/groups";
import { isUuid } from "@/lib/habit-schema";
import { getHabitSummaries } from "@/lib/habits";
import { requestOrigin } from "@/lib/request-origin";
import { describeSchedule } from "@/lib/schedule";
import { listTimezones } from "@/lib/timezones";
import { deleteGroup, leaveGroup, renameGroup, saveGroupAvatar, updateGroupSettings } from "../actions";

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
  const [{ profile, userId }, group, summaries, myGroups] = await Promise.all([
    getProfile(),
    getGroupDetail(id),
    // Fail soft: on an error the group page shows no habits rather than the error screen.
    getHabitSummaries().catch((e: Error) => {
      console.error(e.message);
      return [];
    }),
    getMyGroups(),
  ]);
  if (!group) notFound();
  const habits = summaries.filter((h) => h.group_id === group.id && !h.archived_at);

  const isAdmin = group.my_role === "admin";
  const url = group.invite ? inviteUrl(await requestOrigin(), group.invite.token) : null;
  const validUntil = group.invite
    ? new Date(group.invite.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: profile.timezone })
    : null;
  const childrenNotice = childrenDeletionNotice(group.children.map((c) => c.name));
  const alone = group.members.length === 1;
  // Leave/Delete's children step: each child can be exported, or moved to another group I admin.
  const children = group.children.map((c) => ({ id: c.id, name: c.name }));
  const moveTargets = isAdmin
    ? myGroups.filter((g) => g.role === "admin" && g.group_id !== group.id).map((g) => ({ id: g.group_id, name: g.name }))
    : [];

  return (
    <section className="flex flex-col gap-4 pt-2 pb-6">
      <Link href="/groups" className="-ml-2 flex h-11 w-fit items-center gap-1 rounded-full px-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
        <ChevronLeft aria-hidden className="size-4" />
        Groups
      </Link>

      <header className="flex items-center gap-4">
        {isAdmin ? (
          <AvatarEdit
            name={group.name}
            emoji={group.avatar_emoji}
            color={group.avatar_color}
            action={saveGroupAvatar.bind(null, group.id)}
            options={GROUP_AVATAR_EMOJI}
            title="Change the group avatar"
            description="Everyone in the group sees it."
            className="size-16 text-3xl"
          />
        ) : (
          <Avatar name={group.name} emoji={group.avatar_emoji} color={group.avatar_color} size="lg" />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <RenameGroupForm name={group.name} canRename={isAdmin} action={renameGroup.bind(null, group.id)} />
          <div>
            <KindChip kind={group.kind} />
          </div>
        </div>
      </header>

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
          {group.children.map((c) => (
            <li key={c.id}>
              <Link href={`/kids/${c.id}`} className="-mx-2 flex min-h-11 items-center gap-3 rounded-xl px-2 hover:bg-muted/60">
                <Avatar name={c.name} emoji={c.avatar_emoji} color={c.avatar_color} size="md" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold">{c.name}</span>
                  <span className="text-xs text-muted-foreground">Child</span>
                </span>
                <ChevronRight aria-hidden className="size-5 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
        {isAdmin && (
          <Link
            href={`/kids/new?group=${group.id}`}
            className={addButtonClass}
          >
            <Plus aria-hidden className="size-4" />
            Add a child
          </Link>
        )}
      </Card>

      <Card title="Group habits">
        {habits.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {habits.map((h) => (
              <li key={h.habit_id}>
                <Link href={`/habits/${h.habit_id}`} className="-mx-2 flex min-h-11 items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-muted/60">
                  <HabitEmoji category={h.category} emoji={h.emoji} size="xs" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold">{h.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {describeSchedule(h.target_count, h.period)}
                      {h.requires_approval && " · needs approval"}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No group habits yet.</p>
        )}
        {isAdmin && (
          <Link
            href={`/habits/new?group=${group.id}`}
            className={addButtonClass}
          >
            <Plus aria-hidden className="size-4" />
            Add a group habit
          </Link>
        )}
      </Card>

      {/* People, then what they do together, then bringing someone new (owner's order). ?invite=1
          still focuses the link (autoFocus scrolls it into view). */}
      {isAdmin && (
        <Card title="Invite">
          {/* A demo login can't invite anyone (the database refuses it). */}
          {profile.is_demo ? (
            <p className="text-sm text-muted-foreground">{DEMO_OFF}</p>
          ) : (
            <InviteLink groupId={group.id} groupName={group.name} url={url} validUntil={validUntil} autoFocus={invite === "1"} />
          )}
        </Card>
      )}

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
          groupChildren={children}
          moveTargets={moveTargets}
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
            groupChildren={children}
            moveTargets={moveTargets}
            destructiveTrigger
            action={deleteGroup.bind(null, group.id)}
          />
        )}
      </div>
    </section>
  );
}
