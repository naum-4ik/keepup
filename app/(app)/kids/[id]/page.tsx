import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { HabitEmoji } from "@/components/habits/category-icon";
import { kidProgressText } from "@/components/habits/habit-card";
import { LiveRefresh } from "@/components/habits/live-refresh";
import { StreakBadge } from "@/components/habits/streak-badge";
import { AddKidHabit } from "@/components/kids/add-kid-habit";
import { ChildDangerZone } from "@/components/kids/child-danger-zone";
import { EditChildButton } from "@/components/kids/edit-child-form";
import { Garden } from "@/components/kids/garden";
import { GardenAlbum } from "@/components/kids/garden-album";
import { KidCheckInButton, UndoForChildButton } from "@/components/kids/kid-check-in-button";
import { TreatGoal } from "@/components/kids/treat-goal";
import { getProfile } from "@/lib/auth";
import { getGroupDetail, getMyGroups } from "@/lib/groups";
import { isUuid } from "@/lib/habit-schema";
import { getChildCheckIns, getChildRewards, getChildSummaries, getMyChildren } from "@/lib/kids";
import { stateOf } from "@/lib/today";

export default async function KidPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ habitsFailed?: string }>;
}) {
  const [{ id }, { habitsFailed }] = await Promise.all([params, searchParams]);
  if (!isUuid(id)) notFound();
  // Profiles are read-own under RLS: the child's name and group come from my_children().
  const child = (await getMyChildren()).find((c) => c.child_id === id);
  if (!child) notFound();

  const [{ userId }, group, groups, summaries, rewards] = await Promise.all([
    getProfile(),
    getGroupDetail(child.group_id),
    getMyGroups(),
    getChildSummaries(id),
    getChildRewards(id),
  ]);
  const habits = summaries.filter((h) => !h.archived_at);
  const checkIns = await getChildCheckIns(id, habits);
  const isAdmin = group?.my_role === "admin";
  const moveTargets = isAdmin
    ? groups.filter((g) => g.role === "admin" && g.group_id !== child.group_id).map((g) => ({ id: g.group_id, name: g.name }))
    : [];
  const names = new Map((group?.members ?? []).map((m) => [m.id, m.name]));
  const whoLogged = (loggedBy: string | null) =>
    loggedBy === null ? `${child.name} did it` : loggedBy === userId ? "logged by you" : `logged by ${names.get(loggedBy) ?? "a former member"}`;
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: group?.timezone ?? "UTC", hour: "2-digit", minute: "2-digit" });

  return (
    <section className="flex flex-col gap-4 pt-2 pb-6">
      <Link
        href={`/groups/${child.group_id}`}
        className="-ml-2 flex h-11 w-fit items-center gap-1 rounded-full px-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <ChevronLeft aria-hidden className="size-4" />
        {child.group_name}
      </Link>

      <header className="flex items-center gap-3">
        <Avatar name={child.name} emoji={child.avatar_emoji} color={child.avatar_color} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="truncate text-xl font-bold">{child.name}</h1>
          <p className="text-sm text-muted-foreground">{child.group_name}</p>
        </div>
        <EditChildButton childId={id} name={child.name} emoji={child.avatar_emoji} color={child.avatar_color} />
      </header>

      {habitsFailed === "1" && (
        <p role="status" className="rounded-2xl bg-[#FBF3D9] p-4 text-sm font-semibold text-[#6B4A0A]">
          Some habits couldn&apos;t be added. Add them from here.
        </p>
      )}

      <Link
        href={`/kids/${id}/play`}
        className="flex min-h-14 items-center justify-center rounded-2xl bg-primary px-5 text-base font-bold text-primary-foreground shadow-soft hover:brightness-95"
      >
        Open {child.name}&apos;s view
      </Link>

      {rewards && <Garden stars={rewards.stars_this_week} />}
      {rewards && <GardenAlbum weeks={rewards.album} />}
      {rewards && <TreatGoal childId={id} childName={child.name} goal={rewards.goal} />}

      <section aria-label="Habits" className="flex flex-col gap-3 rounded-2xl bg-card p-5 shadow-soft">
        <h2 className="text-sm font-bold text-muted-foreground">Habits</h2>
        {habits.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {habits.map((h) => {
              const mine = checkIns.filter((c) => c.habit_id === h.habit_id);
              return (
                <li key={h.habit_id} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-3">
                    <HabitEmoji category={h.category} emoji={h.emoji} size="lg" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-bold">{h.title}</span>
                      <span className="text-sm text-muted-foreground">
                        {kidProgressText(h)}
                        {h.group_name && ` · ${h.group_name}`}
                      </span>
                    </span>
                    <StreakBadge count={h.current_streak} />
                    <KidCheckInButton
                      habitId={h.habit_id}
                      title={h.title}
                      childId={id}
                      childName={child.name}
                      multi={h.target_count > 1}
                      state={stateOf(h)}
                    />
                  </div>
                  {mine.map((c) => (
                    <div key={c.id} className="ml-17 flex min-h-11 items-center justify-between gap-2 rounded-xl bg-muted py-1 pr-1 pl-3 text-sm">
                      <span>
                        {whoLogged(c.logged_by)} · {time.format(new Date(c.created_at))}
                      </span>
                      <UndoForChildButton
                        checkInId={c.id}
                        habitId={h.habit_id}
                        childId={id}
                        label={`Undo ${h.title} at ${time.format(new Date(c.created_at))}`}
                      />
                    </div>
                  ))}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No habits yet.</p>
        )}
        <AddKidHabit childId={id} existingTitles={habits.map((h) => h.title)} />
      </section>

      <ChildDangerZone childId={id} childName={child.name} isAdmin={isAdmin} moveTargets={moveTargets} />

      {/* Another adult logging for her (or her own taps in the kid view) refreshes this page. */}
      {habits.length > 0 && <LiveRefresh table="check_ins" filter={`user_id=eq.${id}`} />}
    </section>
  );
}
