"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { HabitEmoji } from "@/components/habits/category-icon";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/lib/categories";
import { MAX_STARTER_HABITS, type HabitTemplate } from "@/lib/habit-templates";
import { describeSchedule } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import { startWithHabits, type PickHabitsState } from "./actions";

const initialState: PickHabitsState = { status: "idle" };

// `joined`: the group an invited user just joined; skipping is the expected path, so Skip is a real button.
export function PickHabits({ templates, joined }: { templates: HabitTemplate[]; joined?: string }) {
  const [state, formAction, pending] = useActionState(startWithHabits, initialState);
  const [picked, setPicked] = useState<string[]>([]);
  const [atLimit, setAtLimit] = useState(false);

  const toggle = (id: string) => {
    if (picked.includes(id)) {
      setPicked(picked.filter((p) => p !== id));
      setAtLimit(false);
    } else if (picked.length >= MAX_STARTER_HABITS) {
      setAtLimit(true); // a fourth tap changes nothing, it only explains why
    } else {
      setPicked([...picked, id]);
    }
  };

  // Popular first; with a family/friends purpose the People and Home extras follow in their own groups.
  const groups: { title: string; items: HabitTemplate[] }[] = [
    { title: "Popular", items: templates.filter((t) => t.popular) },
    ...(["people", "home"] as const).map((c) => ({
      title: CATEGORIES[c].label,
      items: templates.filter((t) => !t.popular && t.category === c),
    })),
  ].filter((g) => g.items.length > 0);
  const n = picked.length;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {joined && <input type="hidden" name="joined" value={joined} />}
      {picked.map((id) => (
        <input key={id} type="hidden" name="templateId" value={id} />
      ))}

      {groups.map((g) => (
        <section key={g.title} aria-label={g.title} className="flex flex-col gap-2">
          {groups.length > 1 && <h2 className="text-sm font-semibold text-muted-foreground">{g.title}</h2>}
          <div className="grid grid-cols-2 gap-2.5">
            {g.items.map((t) => {
              const on = picked.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(t.id)}
                  className={cn(
                    "relative flex min-h-[4.75rem] items-center gap-2.5 rounded-2xl bg-card py-2.5 pr-8 pl-3 text-left shadow-soft transition-colors",
                    on ? "bg-accent ring-2 ring-primary hover:brightness-[0.98]" : "hover:bg-muted",
                  )}
                >
                  <HabitEmoji category={t.category} emoji={t.emoji} size="xs" />
                  <span className="flex min-w-0 flex-col">
                    <span className="line-clamp-3 text-[0.9375rem] leading-snug font-bold">{t.title}</span>
                    <span className="text-xs text-muted-foreground">{describeSchedule(t.targetCount, t.period)}</span>
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "absolute top-2 right-2 flex size-5 items-center justify-center rounded-full border-2",
                      on ? "border-primary bg-primary text-primary-foreground" : "border-input",
                    )}
                  >
                    {on && <Check className="size-3" strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {/* Stays in reach under a long list (family/friends adds 12 more cards). */}
      <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 bg-background/95 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
        <p role="status" className="min-h-5 text-center text-sm font-semibold text-muted-foreground">
          {atLimit ? `Pick up to ${MAX_STARTER_HABITS}` : n > 0 ? `${n} of ${MAX_STARTER_HABITS} picked` : ""}
        </p>
        {state.status === "error" && (
          <p role="alert" className="text-center text-sm text-destructive">
            {state.message}
          </p>
        )}
        <Button type="submit" disabled={n === 0 || pending} className="h-11 text-base">
          {pending ? "Adding…" : n === 0 ? "Pick a habit to start" : `Start with ${n} ${n === 1 ? "habit" : "habits"}`}
        </Button>
        {joined ? (
          <Button asChild variant="secondary" className="h-11 w-full text-base">
            <Link href={`/today?joined=${joined}`}>Skip</Link>
          </Button>
        ) : (
          <Button asChild variant="ghost" className="h-11 text-base text-muted-foreground">
            <Link href="/today">Skip for now</Link>
          </Button>
        )}
      </div>
    </form>
  );
}
