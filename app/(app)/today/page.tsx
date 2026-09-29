import Link from "next/link";
import { SproutIcon } from "@/components/sprout-icon";
import { HabitCard } from "@/components/habits/habit-card";
import { Button } from "@/components/ui/button";
import { getHabitSummaries } from "@/lib/habits";

export default async function TodayPage() {
  const habits = (await getHabitSummaries()).filter((h) => !h.archived_at);

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
        <ul className="flex flex-col gap-3">
          {habits.map((h) => (
            <li key={h.habit_id}>
              <HabitCard habit={h} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
