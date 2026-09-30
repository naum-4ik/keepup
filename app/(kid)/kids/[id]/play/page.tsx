import { notFound } from "next/navigation";
import { KidPlay } from "@/components/kids/kid-play";
import { isUuid } from "@/lib/habit-schema";
import { getChildRewards, getChildSummaries, getMyChildren } from "@/lib/kids";
import { stateOf } from "@/lib/today";

export default async function KidViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const child = (await getMyChildren()).find((c) => c.child_id === id);
  if (!child) notFound();
  const [summaries, rewards] = await Promise.all([getChildSummaries(id), getChildRewards(id)]);
  // What she can do now, and what she already did (a child likes to see those). Paused and
  // not-started habits stay out of her view.
  const habits = summaries
    .filter((h) => !h.archived_at)
    .map((h) => ({ id: h.habit_id, title: h.title, emoji: h.emoji, target: h.target_count, done: h.done_count, state: stateOf(h) }))
    .filter((h) => h.state === "open" || h.state === "done" || h.state === "checked-today" || h.state === "pending");

  return (
    <KidPlay
      child={{ id, name: child.name, emoji: child.avatar_emoji, color: child.avatar_color }}
      habits={habits}
      stars={rewards?.stars_this_week ?? 0}
    />
  );
}
