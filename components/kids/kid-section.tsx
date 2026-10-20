import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Avatar } from "@/components/avatar";
import { HabitCard } from "@/components/habits/habit-card";
import { LinkPending } from "@/components/ui/link-pending";
import { Notice } from "@/components/ui/notice";
import type { HabitSummary } from "@/lib/habits";
import type { MyChild } from "@/lib/kids";
import { groupForToday } from "@/lib/today";

// Today: a section per child. Any adult of her group checks in for her inline.
export async function KidSection({ child, habits, stars }: { child: MyChild; habits: HabitSummary[]; stars: number | null }) {
  const t = await getTranslations();
  const { todo, done, later } = groupForToday(habits);
  const ordered = [...todo, ...done, ...later];
  return (
    <section aria-label={child.name} className="flex flex-col gap-item">
      <Link href={`/kids/${child.child_id}`} className="relative -mx-inner flex min-h-11 items-center gap-inner rounded-xl px-inner hover:bg-muted/60">
        {/* The heading beside it names her, so the avatar is decoration here. */}
        <span aria-hidden className="flex shrink-0">
          <Avatar name={child.name} emoji={child.avatar_emoji} color={child.avatar_color} size="md" />
        </span>
        <h2 className="min-w-0 flex-1 truncate text-base font-bold">{child.name}</h2>
        {/* "⭐ 4" reads as "star 4": screen readers get the words instead. */}
        {stars !== null && (
          <span className="text-sm font-bold tabular-nums">
            <span aria-hidden>⭐ {stars}</span>
            <span className="sr-only">{t("kidView.starsThisWeek", { count: stars })}</span>
          </span>
        )}
        <ChevronRight aria-hidden className="size-5 text-muted-foreground rtl:-scale-x-100" />
        <LinkPending className="rounded-xl" />
      </Link>
      {ordered.length > 0 ? (
        <ul className="flex flex-col gap-item">
          {ordered.map((h) => (
            <li key={h.habit_id}>
              <HabitCard habit={h} kid={{ id: child.child_id, name: child.name }} />
            </li>
          ))}
        </ul>
      ) : (
        // A sentence, not a card (docs/design.md "Notices"), with the step that fills it: her page, where
        // her habits are added.
        <Notice
          action={
            <Link
              href={`/kids/${child.child_id}`}
              // A 44px target kept to the Notice's line height by negative margins (docs/design.md "Buttons").
              className="relative -my-3 flex min-h-11 items-center rounded-lg px-inner font-bold text-primary hover:bg-background/60"
            >
              {t("common.addHabit")}
              <LinkPending className="rounded-lg" />
            </Link>
          }
        >
          {t.rich("kids.detail.noHabits", { name: child.name, bdi: (c) => <bdi>{c}</bdi> })}
        </Notice>
      )}
    </section>
  );
}
