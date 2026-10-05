import Link from "next/link";
import { notFound } from "next/navigation";
import { RenderedTaps } from "@/components/offline/offline-queue-provider";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { HabitEmoji } from "@/components/habits/category-icon";
import { kidProgressText } from "@/components/habits/habit-card";
import { LiveRefresh } from "@/components/habits/live-refresh";
import { StreakBadge } from "@/components/habits/streak-badge";
import { AddKidHabit } from "@/components/kids/add-kid-habit";
import { ChildDangerZone, ExportChildButton } from "@/components/kids/child-danger-zone";
import { EditChildButton } from "@/components/kids/edit-child-form";
import { Garden } from "@/components/kids/garden";
import { ThemePicker } from "@/components/kids/theme-picker";
import { NewWeekCard } from "@/components/kids/new-week-card";
import { lastWeek } from "@/lib/garden";
import { GardenAlbum } from "@/components/kids/garden-album";
import { KidCheckInButton, UndoForChildButton } from "@/components/kids/kid-check-in-button";
import { TreatGoal } from "@/components/kids/treat-goal";
import { getProfile } from "@/lib/auth";
import { getGroupDetail, getMyGroups } from "@/lib/groups";
import { todayIn } from "@/lib/dates";
import { withoutEnded } from "@/lib/habit-end";
import { getFinishedIds, getHabitEnds, getRenderedTapIds, type HabitSummary } from "@/lib/habits";
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

  const [{ userId, profile }, group, groups, summaries, rewards, renderedTaps] = await Promise.all([
    getProfile(),
    getGroupDetail(child.group_id),
    getMyGroups(),
    getChildSummaries(id),
    getChildRewards(id),
    getRenderedTapIds(),
  ]);
  const unarchived = summaries.filter((h) => !h.archived_at);
  const archivedHabits = summaries.filter((h) => h.archived_at && !h.group_id);
  const finishedIds = archivedHabits.length > 0 ? await getFinishedIds() : new Set<string>();
  // A habit past its end (in the group's calendar) takes no more check-ins, so it leaves the list.
  const ends = await getHabitEnds(unarchived.map((h) => h.habit_id));
  const today = todayIn(group?.timezone ?? profile.timezone);
  const habits = withoutEnded(unarchived, ends, () => today);
  const checkIns = await getChildCheckIns(id, habits);
  const isAdmin = group?.my_role === "admin";
  const moveTargets = isAdmin
    ? groups.filter((g) => g.role === "admin" && g.group_id !== child.group_id).map((g) => ({ id: g.group_id, name: g.name }))
    : [];
  const names = new Map((group?.members ?? []).map((m) => [m.id, m.name]));
  const whoLogged = (loggedBy: string | null) =>
    loggedBy === null ? `${child.name} did it` : loggedBy === userId ? "Logged by you" : `Logged by ${names.get(loggedBy) ?? "a former member"}`;
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: group?.timezone ?? "UTC", hour: "2-digit", minute: "2-digit" });

  return (
    <section className="flex flex-col gap-4 pt-2 pb-6">
      <RenderedTaps ids={renderedTaps} />
      <Link
        href={`/groups/${child.group_id}`}
        className="-ml-2 flex h-11 w-fit max-w-full min-w-0 items-center gap-1 rounded-full px-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <ChevronLeft aria-hidden className="size-4 shrink-0" />
        <span className="truncate">{child.group_name}</span>
      </Link>

      <header className="flex items-center gap-3">
        <Avatar name={child.name} emoji={child.avatar_emoji} color={child.avatar_color} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="truncate text-xl font-bold">{child.name}</h1>
          <p className="truncate text-sm text-muted-foreground">{child.group_name}</p>
        </div>
        <EditChildButton childId={id} name={child.name} emoji={child.avatar_emoji} color={child.avatar_color} />
      </header>

      {habitsFailed === "1" && (
        <p role="status" className="rounded-2xl bg-pending-soft p-4 text-sm font-semibold text-pending">
          Some habits couldn&apos;t be added. Add them from here.
        </p>
      )}

      <Link
        href={`/kids/${id}/play`}
        className="flex min-h-14 items-center justify-center rounded-2xl bg-primary px-5 text-base font-bold text-primary-foreground shadow-soft hover:brightness-95"
      >
        Open {child.name}&apos;s view
      </Link>

      {rewards && lastWeek(rewards.week_start, rewards.album) && (
        <NewWeekCard
          childId={id}
          weekStart={rewards.week_start}
          lastStars={lastWeek(rewards.week_start, rewards.album)!.stars}
          theme={child.kid_theme}
          albumHref="#album"
        />
      )}
      {rewards && <Garden stars={rewards.stars_this_week} theme={child.kid_theme} weekStart={rewards.week_start} />}
      <ThemePicker childId={id} childName={child.name} theme={child.kid_theme} />
      {rewards && <GardenAlbum weeks={rewards.album} theme={child.kid_theme} />}
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
                    <Link
                      href={`/habits/${h.habit_id}`}
                      className="-my-1 flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl py-1 hover:bg-muted/60"
                    >
                      <HabitEmoji category={h.category} emoji={h.emoji} size="lg" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-bold">{h.title}</span>
                        <span className="text-sm text-muted-foreground">
                          {kidProgressText(h)}
                          {h.group_name && ` · ${h.group_name}`}
                        </span>
                      </span>
                    </Link>
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
        <AddKidHabit childId={id} childName={child.name} existingTitles={unarchived.map((h) => h.title)} />
      </section>

      {/* Archived habits open their page, where a guardian restores them. Finished ones (an end that
          was reached and closed) are listed apart: they don't restore. */}
      <HabitLinks title="Archived" habits={archivedHabits.filter((h) => !finishedIds.has(h.habit_id))} />
      <HabitLinks title="Finished" habits={archivedHabits.filter((h) => finishedIds.has(h.habit_id))} />

      {/* Taking a copy isn't dangerous: it sits on its own, for every adult in the group. */}
      <section aria-label="Data" className="flex flex-col gap-3 rounded-2xl bg-card p-5 shadow-soft">
        <h2 className="text-sm font-bold text-muted-foreground">Data</h2>
        <p className="text-sm text-muted-foreground">Everything Keepup keeps about {child.name}, in one file.</p>
        <ExportChildButton childId={id} childName={child.name} />
      </section>

      <ChildDangerZone childId={id} childName={child.name} isAdmin={isAdmin} moveTargets={moveTargets} />

      {/* Another adult logging for the child (or the child's own taps in the kid view) refreshes this page. */}
      {habits.length > 0 && <LiveRefresh table="check_ins" filter={`user_id=eq.${id}`} />}
    </section>
  );
}

// The child's archived or finished habits, each opening its page.
function HabitLinks({ title, habits }: { title: string; habits: HabitSummary[] }) {
  if (habits.length === 0) return null;
  return (
    <section aria-label={title} className="flex flex-col gap-2 rounded-2xl bg-card p-5 shadow-soft">
      <h2 className="text-sm font-bold text-muted-foreground">{title}</h2>
      <ul className="flex flex-col gap-1">
        {habits.map((h) => (
          <li key={h.habit_id}>
            <Link href={`/habits/${h.habit_id}`} className="-mx-2 flex min-h-11 items-center gap-3 rounded-xl px-2 py-1 hover:bg-muted/60">
              <HabitEmoji category={h.category} emoji={h.emoji} size="xs" />
              <span className="min-w-0 flex-1 truncate font-semibold">{h.title}</span>
              <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
