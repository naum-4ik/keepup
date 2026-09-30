import Link from "next/link";
import { ChevronRight, Clock } from "lucide-react";
import { EveryoneDidIt, type CardMember } from "@/components/celebrations/everyone-did-it";
import { FamilyRecapCard } from "@/components/celebrations/family-recap-card";
import { GroupMilestoneCard } from "@/components/celebrations/group-milestone-card";
import { FirstCheckinTip } from "@/components/first-checkin-tip";
import { SproutIcon } from "@/components/sprout-icon";
import { HabitCard } from "@/components/habits/habit-card";
import { LiveRefresh } from "@/components/habits/live-refresh";
import { KidSection } from "@/components/kids/kid-section";
import { GentleCard } from "@/components/today/gentle-card";
import { TodayCard } from "@/components/today/today-card";
import { Button } from "@/components/ui/button";
import { getProfile } from "@/lib/auth";
import { feedCopy } from "@/lib/feed-copy";
import { getMyGroups } from "@/lib/groups";
import { isUuid } from "@/lib/habit-schema";
import { getHabitEnds, getHabitSummaries, getWeekOverview, type HabitSummary } from "@/lib/habits";
import { endLabel, endProgress } from "@/lib/habit-end";
import { getPendingApprovals } from "@/lib/inbox";
import { getChildRewards, getChildSummaries, getMyChildren } from "@/lib/kids";
import { parsePurpose } from "@/lib/profile-schema";
import { groupForToday } from "@/lib/today";
import { todayProgress } from "@/lib/today-progress";
import { chooseGentleCard, milestoneToday, recapKey, recapLine, visibleRecaps } from "@/lib/today-cards";
import { getCelebrations, getDismissedCards, getFamilyRecaps, hasCheckedIn } from "@/lib/today-cards-data";
import { membersOf, sectionsForToday } from "@/lib/today-sections";
import { hasWeekData } from "@/lib/week-overview";

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ joined?: string }> }) {
  const { joined } = await searchParams;
  const [summaries, overview, groups, approvals, children, { profile }, celebrations, recaps, dismissed, checkedIn] = await Promise.all([
    getHabitSummaries(),
    getWeekOverview(),
    getMyGroups(),
    getPendingApprovals(),
    getMyChildren(),
    getProfile(),
    getCelebrations(),
    getFamilyRecaps(),
    getDismissedCards(),
    hasCheckedIn(),
  ]);
  // A section per child: her active habits and this week's stars (both fail soft).
  const kids = await Promise.all(
    children.map(async (child) => {
      const [kidHabits, rewards] = await Promise.all([getChildSummaries(child.child_id), getChildRewards(child.child_id)]);
      return { child, habits: kidHabits.filter((h) => !h.archived_at), stars: rewards?.stars_this_week ?? null };
    }),
  );
  const joinedGroup = joined && isUuid(joined) ? groups.find((g) => g.group_id === joined) : undefined;
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
  // The Today card: every adult section's to-do and done habits (kids have their own stars).
  const progress = todayProgress(sections.flatMap((s) => s.habits));
  const now = new Date();
  const date = new Intl.DateTimeFormat("en-GB", { timeZone: profile.timezone, weekday: "long", day: "numeric", month: "long" }).format(now);
  const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: profile.timezone }).format(now);
  // "Day 12 of 30" for habits with an end.
  const ends = await getHabitEnds(habits.map((h) => h.habit_id));
  const endLines = new Map<string, string>();
  for (const h of habits) {
    const endsOn = ends.get(h.habit_id);
    const p = endsOn ? endProgress(h.starts_on, endsOn, dayKey, h.period) : null;
    if (p) endLines.set(h.habit_id, endLabel(p, h.period));
  }

  // Celebration cards (ideas/achievements-and-rewards.md §7), then at most one gentle card.
  const membersFor = (habitIds: (string | null)[]): CardMember[] => {
    const seen = new Map<string, CardMember>();
    for (const id of habitIds) {
      for (const m of membersOf(summaries.find((h) => h.habit_id === id) ?? { members: null }) ?? []) {
        if (!seen.has(m.profile_id)) seen.set(m.profile_id, { id: m.profile_id, name: m.name, avatar_emoji: m.avatar_emoji, avatar_color: m.avatar_color });
      }
    }
    return [...seen.values()];
  };
  const everyone = celebrations.filter((n) => n.kind === "everyone_done" && !n.seen_at);
  const everyoneHabits = [...new Map(everyone.map((n) => [n.habit_id ?? n.id, n.habit_title ?? "A habit"])).entries()];
  const milestones = celebrations.filter((n) => n.kind === "group_milestone" && !n.seen_at);
  const shownRecaps = visibleRecaps(recaps, dismissed);
  const purpose = parsePurpose(profile.purpose ?? "");
  const gentle = chooseGentleCard({
    purpose: purpose.ok ? purpose.value : null,
    hasCheckedIn: checkedIn,
    groups,
    dismissed,
    milestoneToday: milestoneToday(celebrations, profile.timezone),
  });

  return (
    <section className="flex flex-col gap-4 py-6">
      <h1 className="text-xl font-bold">Today</h1>
      {progress.total > 0 && (
        <TodayCard
          date={date}
          dayKey={dayKey}
          done={progress.done}
          total={progress.total}
          items={progress.items}
          week={overview && hasWeekData(overview) ? { done: overview.done, possible: overview.possible, streak: overview.best_current_streak } : null}
          quiet={everyone.length > 0}
        />
      )}
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
      {everyone.length > 0 && (
        <EveryoneDidIt
          ids={everyone.map((n) => n.id)}
          habits={everyoneHabits.map(([, title]) => title)}
          members={membersFor(everyoneHabits.map(([id]) => id))}
        />
      )}
      {milestones.map((n) => (
        <GroupMilestoneCard key={n.id} id={n.id} group={n.group_name ?? "Your group"} text={feedCopy(n).body} members={membersFor([n.habit_id])} />
      ))}
      {shownRecaps.map((r) => (
        <FamilyRecapCard key={recapKey(r)} cardKey={recapKey(r)} group={r.group_name} line={recapLine(r)} />
      ))}
      {gentle && <GentleCard key={gentle.key} card={gentle} />}
      {/* Nothing due today: the week still shows on its own. */}
      {progress.total === 0 && overview && hasWeekData(overview) && (
        <TodayCard date={date} dayKey={dayKey} done={0} total={0} items={[]} week={{ done: overview.done, possible: overview.possible, streak: overview.best_current_streak }} />
      )}
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
              <TodayLists habits={s.habits} tipFor={isNewUser ? tipFor : undefined} endLines={endLines} />
            </section>
          ) : (
            <TodayLists key={s.key} habits={s.habits} tipFor={isNewUser ? tipFor : undefined} sectionDone={false} endLines={endLines} />
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
// `sectionDone`: say "All checked off" when this section is finished. Off for a lone section, where
// the Today card already says "Today's all done".
function TodayLists({
  habits,
  tipFor,
  sectionDone = true,
  endLines,
}: {
  habits: HabitSummary[];
  tipFor?: string;
  sectionDone?: boolean;
  endLines?: Map<string, string>;
}) {
  const { todo, done, later } = groupForToday(habits);
  return (
    <>
      {todo.length > 0 ? (
        <HabitList habits={todo} tipFor={tipFor} endLines={endLines} />
      ) : done.length > 0 && sectionDone ? (
        <p className="rounded-2xl bg-card p-4 text-center text-sm font-semibold shadow-soft">All checked off. Nice work.</p>
      ) : null}
      {done.length > 0 && <HabitList title="Done" habits={done} endLines={endLines} />}
      {later.length > 0 && <HabitList title="Later" habits={later} endLines={endLines} />}
    </>
  );
}

function HabitList({
  title,
  habits,
  tipFor,
  endLines,
}: {
  title?: string;
  habits: HabitSummary[];
  tipFor?: string;
  endLines?: Map<string, string>;
}) {
  if (habits.length === 0) return null;
  const list = (
    <ul className="flex flex-col gap-3">
      {habits.map((h) => (
        <li key={h.habit_id}>
          <HabitCard habit={h} endLine={endLines?.get(h.habit_id)} />
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
