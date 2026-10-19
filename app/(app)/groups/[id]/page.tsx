import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
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
import { Notice } from "@/components/ui/notice";
import { Section } from "@/components/ui/section";
import { getProfile } from "@/lib/auth";
import { GROUP_AVATAR_EMOJI } from "@/lib/avatars";
import { childrenDeletionNotice, inviteUrl } from "@/lib/group-schema";
import { getGroupDetail, getMyGroups } from "@/lib/groups";
import { isUuid } from "@/lib/habit-schema";
import { getHabitSummaries } from "@/lib/habits";
import { getT } from "@/lib/i18n/server";
import { INTL_LOCALE } from "@/supabase/functions/_shared/i18n";
import { requestOrigin } from "@/lib/request-origin";
import { describeSchedule } from "@/lib/schedule";
import { listTimezones } from "@/lib/timezones";
import { deleteGroup, leaveGroup, renameGroup, saveGroupAvatar, updateGroupSettings } from "../actions";
import { logError } from "@/lib/log";

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ invite?: string }>;
}) {
  const [{ id }, { invite }] = await Promise.all([params, searchParams]);
  if (!isUuid(id)) notFound();
  const { t: tg, rich, locale } = await getT();
  const t = await getTranslations("groups.detail");
  const tc = await getTranslations("common");
  const bdi = (c: React.ReactNode) => <bdi>{c}</bdi>;
  const [{ profile, userId }, group, summaries, myGroups] = await Promise.all([
    getProfile(),
    getGroupDetail(id),
    // Fail soft: on an error the group page shows no habits rather than the error screen.
    getHabitSummaries().catch((e: Error) => {
      logError(e.message);
      return [];
    }),
    getMyGroups(),
  ]);
  if (!group) notFound();
  const habits = summaries.filter((h) => h.group_id === group.id && !h.archived_at);

  const isAdmin = group.my_role === "admin";
  const url = group.invite ? inviteUrl(await requestOrigin(), group.invite.token) : null;
  const validUntil = group.invite
    ? new Intl.DateTimeFormat(INTL_LOCALE[locale], { day: "numeric", month: "short", timeZone: profile.timezone }).format(new Date(group.invite.expires_at))
    : null;
  const childrenNotice = childrenDeletionNotice(rich, locale, group.children.map((c) => c.name));
  const alone = group.members.length === 1;
  // Leave/Delete's children step: each child can be exported, or moved to another group I admin.
  const children = group.children.map((c) => ({ id: c.id, name: c.name }));
  const moveTargets = isAdmin
    ? myGroups.filter((g) => g.role === "admin" && g.group_id !== group.id).map((g) => ({ id: g.group_id, name: g.name }))
    : [];

  return (
    // Headed sections, no cards (docs/design.md "Sections"): a group page is lists and controls.
    <section className="flex flex-col gap-section py-section">
      {/* -ms-inner px-inner: the back link's 44 px target, its words on the page edge; chevron to label 4 px (one glyph pair). */}
      <Link href="/groups" className="-ms-inner flex h-11 w-fit items-center gap-1 rounded-full px-inner text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
        <ChevronLeft aria-hidden className="size-4 rtl:-scale-x-100" />
        {tg("nav.groups")}
      </Link>

      <header className="flex items-center gap-item">
        {isAdmin ? (
          <AvatarEdit
            name={group.name}
            emoji={group.avatar_emoji}
            color={group.avatar_color}
            action={saveGroupAvatar.bind(null, group.id)}
            options={GROUP_AVATAR_EMOJI}
            title={t("avatarTitle")}
            description={t("avatarDescription")}
            className="size-16 text-3xl"
          />
        ) : (
          <Avatar name={group.name} emoji={group.avatar_emoji} color={group.avatar_color} size="lg" />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-inner">
          <RenameGroupForm name={group.name} canRename={isAdmin} action={renameGroup.bind(null, group.id)} />
          <div>
            <KindChip kind={group.kind} t={tg} />
          </div>
        </div>
      </header>

      {/* What they do together first, so Add a group habit is on the first screen at 320 (owner,
          2026-10-19); then the people, then bringing someone new. */}
      <Section title={t("habits")}>
        {habits.length > 0 ? (
          <ul className="flex flex-col">
            {habits.map((h) => (
              <li key={h.habit_id}>
                <Link href={`/habits/${h.habit_id}`} className="-mx-inner flex min-h-14 items-center gap-inner rounded-xl px-inner hover:bg-muted/60">
                  <HabitEmoji category={h.category} emoji={h.emoji} size="xs" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold">{h.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {t("habitLine", { schedule: describeSchedule(tg, h.target_count, h.period), approval: h.requires_approval ? "yes" : "no" })}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          // Only admins add group habits (private.create_group_habit_impl), so a member hears who does.
          <p className="text-sm text-muted-foreground">{isAdmin ? t("noHabits", { n: group.members.length }) : t("noHabitsMember")}</p>
        )}
        {isAdmin && (
          <Link
            href={`/habits/new?group=${group.id}`}
            className={addButtonClass}
          >
            <Plus aria-hidden className="size-4" />
            {t("addHabit")}
          </Link>
        )}
      </Section>

      <Section title={t("people")}>
        <ul className="flex flex-col gap-item">
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
              <Link href={`/kids/${c.id}`} className="-mx-inner flex min-h-11 items-center gap-item rounded-xl px-inner hover:bg-muted/60">
                <Avatar name={c.name} emoji={c.avatar_emoji} color={c.avatar_color} size="md" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{t("child")}</span>
                </span>
                <ChevronRight aria-hidden className="size-5 text-muted-foreground rtl:-scale-x-100" />
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
            {t("addChild")}
          </Link>
        )}
      </Section>

      {/* ?invite=1 still focuses the link (autoFocus scrolls it into view). */}
      {isAdmin && (
        <Section title={t("invite")}>
          {/* A demo login can't invite anyone (the database refuses it). */}
          {profile.is_demo ? (
            <Notice>{tg("demo.off")}</Notice>
          ) : (
            <InviteLink groupId={group.id} groupName={group.name} url={url} validUntil={validUntil} autoFocus={invite === "1"} />
          )}
        </Section>
      )}

      {isAdmin && (
        // A folded settings group, not a card: a row between dividers (docs/design.md: no card around
        // a headed group of controls). -mx-inner px-inner: the hover reaches past the text.
        <details className="group border-y border-border">
          <summary className="-mx-inner flex min-h-14 list-none items-center gap-inner rounded-xl px-inner py-inner hover:bg-muted/60 [&::-webkit-details-marker]:hidden">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-bold">{t("settings")}</span>
              <span className="text-xs text-muted-foreground">{t("settingsHint")}</span>
            </span>
            <ChevronDown aria-hidden className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="pb-item">
            <GroupSettingsForm
              timezone={group.timezone}
              weekStart={group.week_start === 0 ? 0 : 1}
              timezones={listTimezones()}
              action={updateGroupSettings.bind(null, group.id)}
            />
          </div>
        </details>
      )}

      <div className="flex flex-col gap-inner">
        <ConfirmGroupAction
          triggerLabel={t("leave.action")}
          title={t.rich("leave.title", { name: group.name, bdi })}
          description={alone ? t("leave.descriptionAlone") : t("leave.description")}
          confirmLabel={t("leave.action")}
          pendingLabel={t("leave.pending")}
          childrenNotice={childrenNotice}
          groupChildren={children}
          moveTargets={moveTargets}
          action={leaveGroup.bind(null, group.id)}
        />
        {isAdmin && (
          <ConfirmGroupAction
            triggerLabel={t("delete.action")}
            title={t.rich("delete.title", { name: group.name, bdi })}
            description={t("delete.description")}
            confirmLabel={t("delete.action")}
            pendingLabel={tc("deleting")}
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
