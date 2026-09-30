import Link from "next/link";
import { ChevronRight, Clock } from "lucide-react";
import { FirstCheckinTip } from "@/components/first-checkin-tip";
import { SproutIcon } from "@/components/sprout-icon";
import { HabitCard } from "@/components/habits/habit-card";
import { LiveRefresh } from "@/components/habits/live-refresh";
import { KidSection } from "@/components/kids/kid-section";
import { WeekStrip } from "@/components/overview/week-overview";
import { Button } from "@/components/ui/button";
import { getMyGroups } from "@/lib/groups";
import { isUuid } from "@/lib/habit-schema";
import { getHabitSummaries, getWeekOverview, type HabitSummary } from "@/lib/habits";
import { getPendingApprovals } from "@/lib/inbox";
import { getChildRewards, getChildSummaries, getMyChildren } from "@/lib/kids";
import { groupForToday } from "@/lib/today";
import { sectionsForToday } from "@/lib/today-sections";
import { hasWeekData } from "@/lib/week-overview";

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ joined?: string }> }) {
  const { joined } = await searchParams;
  const [summaries, overview, groups, approvals, children] = await Promise.all([
    getHabitSummaries(),
    getWeekOverview(),
    joined && isUuid(joined) ? getMyGroups() : Promise.resolve([]),
    getPendingApprovals(),
    getMyChildren(),
  ]);
  // A section per child: her active habits and this week's stars (both fail soft).
  const kids = await Promise.all(
    children.map(async (child) => {
      const [kidHabits, rewards] = await Promise.all([getChildSummaries(child.child_id), getChildRewards(child.child_id)]);
      return { child, habits: kidHabits.filter((h) => !h.archived_at), stars: rewards?.stars_this_week ?? null };
    }),
  );
  const joinedGroup = groups.find((g) => g.group_id === joined);
  const habits = summaries.filter((h) => !h.archived_at);
  const sections = sectionsForToday(habits);
  // A solo user's Today looks as before: the "Mine" heading shows only next to a group section.
  const withHeadings = sections.some((s) => s.key !== "mine") || kids.length > 0;
  // Check-ins by other members (and other adults logging for a child) refresh these cards.
  const liveHabitIds = [
    ...new Set([...habits.filter((h) => h.group_id).map((h) => h.habit_id), ...kids.flatMap((k) => k.habits.map((h) => h.habit_id))]),
  ];
  const tipFor = sections.map((s) => groupForToday(s.habits).todo[0]).find(Boolean)?.habit_id;
  // The first-check-in tip is for people who have never checked in (not for someone on a new device).
  const isNewUser = habits.every((h) => h.done_count === 0 && h.best_streak === 0);

  return (
    <section className="flex flex-col gap-4 py-6">
      <h1 className="text-xl font-bold">Today</h1>
      {joinedGroup && (
        <p role="status" className="rounded-2xl bg-card p-4 text-center text-sm font-semibold shadow-soft">
          You joined {joinedGroup.name} ✓
        </p>
      )}
      {approvals.length > 0 && (
        <Link href="/inbox" className="flex min-h-14 items-center gap-3 rounded-2xl bg-card p-4 shadow-soft hover:bg-muted">
          <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#FBF3D9] text-[#9A6A10]">
            <Clock className="size-5" />
          </span>
          <span className="flex-1 font-semibold">
            {approvals.length} {approvals.length === 1 ? "check-in" : "check-ins"} waiting for you
          </span>
          <ChevronRight aria-hidden className="size-5 text-muted-foreground" />
        </Link>
      )}
      {overview && hasWeekData(overview) && <WeekStrip overview={overview} />}
      {habits.length === 0 && kids.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-card p-8 text-center shadow-soft">
          <div className="flex size-12 items-center justify-center rounded-full bg-accent text-primary">
            <SproutIcon className="size-6" aria-hidden />
          </div>
          <p className="text-sm text-muted-foreground">Nothing to do yet. Add a habit to get started.</p>
          <Button asChild>
            <Link href="/habits/new">Add your first habit</Link>
          </Button>
        </div>
      ) : (
        sections.map((s) =>
          withHeadings ? (
            <section key={s.key} aria-label={s.title} className="flex flex-col gap-3 pt-2">
              <h2 className="text-base font-bold">{s.title}</h2>
              <TodayLists habits={s.habits} tipFor={isNewUser ? tipFor : undefined} />
            </section>
          ) : (
            <TodayLists key={s.key} habits={s.habits} tipFor={isNewUser ? tipFor : undefined} />
          ),
        )
      )}
      {kids.map((k) => (
        <KidSection key={k.child.child_id} child={k.child} habits={k.habits} stars={k.stars} />
      ))}
      {/* Other members' check-ins change group cards; Realtime (RLS applies) triggers a refresh. */}
      {liveHabitIds.length > 0 && <LiveRefresh table="check_ins" filter={`habit_id=in.(${liveHabitIds.join(",")})`} />}
    </section>
  );
}

// Inside each section: what's left to do, what's done, what isn't active yet.
function TodayLists({ habits, tipFor }: { habits: HabitSummary[]; tipFor?: string }) {
  const { todo, done, later } = groupForToday(habits);
  return (
    <>
      {todo.length > 0 ? (
        <HabitList habits={todo} tipFor={tipFor} />
      ) : done.length > 0 ? (
        <p className="rounded-2xl bg-card p-4 text-center text-sm font-semibold shadow-soft">All checked off. Nice work.</p>
      ) : null}
      {done.length > 0 && <HabitList title="Done" habits={done} />}
      {later.length > 0 && <HabitList title="Later" habits={later} />}
    </>
  );
}

function HabitList({ title, habits, tipFor }: { title?: string; habits: HabitSummary[]; tipFor?: string }) {
  if (habits.length === 0) return null;
  const list = (
    <ul className="flex flex-col gap-3">
      {habits.map((h) => (
        <li key={h.habit_id}>
          <HabitCard habit={h} />
          {h.habit_id === tipFor && <FirstCheckinTip />}
        </li>
      ))}
    </ul>
  );
  if (!title) return list;
  return (
    <section aria-label={title} className="flex flex-col gap-2 pt-2">
      <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
      {list}
    </section>
  );
}
