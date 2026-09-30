import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { HabitCard } from "@/components/habits/habit-card";
import type { HabitSummary } from "@/lib/habits";
import type { MyChild } from "@/lib/kids";
import { groupForToday } from "@/lib/today";

// Today: a section per child. Any adult of her group checks in for her inline.
export function KidSection({ child, habits, stars }: { child: MyChild; habits: HabitSummary[]; stars: number | null }) {
  const { todo, done, later } = groupForToday(habits);
  const ordered = [...todo, ...done, ...later];
  return (
    <section aria-label={child.name} className="flex flex-col gap-3 pt-2">
      <Link href={`/kids/${child.child_id}`} className="-mx-2 flex min-h-11 items-center gap-2 rounded-xl px-2 hover:bg-muted/60">
        <Avatar name={child.name} emoji={child.avatar_emoji} color={child.avatar_color} size="md" />
        <h2 className="min-w-0 flex-1 truncate text-base font-bold">{child.name}</h2>
        {stars !== null && <span className="text-sm font-bold tabular-nums">⭐ {stars}</span>}
        <ChevronRight aria-hidden className="size-5 text-muted-foreground" />
      </Link>
      {ordered.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {ordered.map((h) => (
            <li key={h.habit_id}>
              <HabitCard habit={h} kid={{ id: child.child_id, name: child.name }} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl bg-card p-4 text-center text-sm text-muted-foreground shadow-soft">No habits yet.</p>
      )}
    </section>
  );
}
