import Link from "next/link";
import { FirstCheckinTip } from "@/components/first-checkin-tip";
import { SproutIcon } from "@/components/sprout-icon";
import { HabitCard } from "@/components/habits/habit-card";
import { Button } from "@/components/ui/button";
import { getHabitSummaries, type HabitSummary } from "@/lib/habits";
import { groupForToday } from "@/lib/today";

export default async function TodayPage() {
  const habits = (await getHabitSummaries()).filter((h) => !h.archived_at);
  const { todo, done, later } = groupForToday(habits);

  return (
    <section className="flex flex-col gap-4 py-6">
      <h1 className="text-xl font-bold">Today</h1>
      {habits.length === 0 ? (
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
        <>
          {todo.length > 0 ? (
            <HabitList habits={todo} tipFor={todo[0].habit_id} />
          ) : done.length > 0 ? (
            <p className="rounded-2xl bg-card p-4 text-center text-sm font-semibold shadow-soft">All checked off. Nice work.</p>
          ) : null}
          {done.length > 0 && <HabitList title="Done" habits={done} />}
          {later.length > 0 && <HabitList title="Later" habits={later} />}
        </>
      )}
    </section>
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
