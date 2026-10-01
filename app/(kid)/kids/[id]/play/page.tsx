import { notFound } from "next/navigation";
import { KidPlay } from "@/components/kids/kid-play";
import { getProfile } from "@/lib/auth";
import { lastWeek } from "@/lib/garden";
import { todayIn } from "@/lib/dates";
import { withoutEnded } from "@/lib/habit-end";
import { getGroupTimezones, getHabitEnds } from "@/lib/habits";
import { isUuid } from "@/lib/habit-schema";
import { getChildRewards, getChildSummaries, getMyChildren } from "@/lib/kids";
import { stateOf } from "@/lib/today";

export default async function KidViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const child = (await getMyChildren()).find((c) => c.child_id === id);
  if (!child) notFound();
  const [summaries, rewards, zones, { profile }] = await Promise.all([
    getChildSummaries(id),
    getChildRewards(id),
    getGroupTimezones([child.group_id]),
    getProfile(),
  ]);
  const running = summaries.filter((h) => !h.archived_at);
  // A habit past its end (in the group's calendar) takes no more check-ins, so it leaves this view.
  const ends = await getHabitEnds(running.map((h) => h.habit_id));
  const today = todayIn(zones.get(child.group_id) ?? profile.timezone);
  // What the child can do now, and what's already done (a child likes to see those). Paused,
  // not-started and ended habits stay out of this view.
  const habits = withoutEnded(running, ends, () => today)
    .map((h) => ({ id: h.habit_id, title: h.title, emoji: h.emoji, target: h.target_count, done: h.done_count, state: stateOf(h) }))
    .filter((h) => h.state === "open" || h.state === "done" || h.state === "checked-today" || h.state === "pending");

  return (
    <KidPlay
      child={{ id, name: child.name, emoji: child.avatar_emoji, color: child.avatar_color, theme: child.kid_theme }}
      habits={habits}
      stars={rewards?.stars_this_week ?? 0}
      weekStart={rewards?.week_start}
      lastStars={rewards ? lastWeek(rewards.week_start, rewards.album)?.stars : undefined}
    />
  );
}
