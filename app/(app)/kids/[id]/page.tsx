import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { RenderedTaps } from "@/components/offline/offline-queue-provider";
import { ChevronLeft, ChevronRight, ListPlus } from "lucide-react";
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
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { Section } from "@/components/ui/section";
import { getProfile } from "@/lib/auth";
import { getGroupDetail, getMyGroups } from "@/lib/groups";
import { todayIn } from "@/lib/dates";
import { withoutEnded } from "@/lib/habit-end";
import { getFinishedIds, getHabitEnds, getRecentTapRows, type HabitSummary } from "@/lib/habits";
import { isUuid } from "@/lib/habit-schema";
import { getT } from "@/lib/i18n/server";
import { INTL_LOCALE, isolate } from "@/supabase/functions/_shared/i18n";
import { kidTemplateTitlesAllLocales } from "@/lib/kid-template-titles";
import { currentPeriods, renderedTapIds, tapPeriods } from "@/lib/rendered-taps";
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
  const { t: tg, locale } = await getT();
  const tk = await getTranslations("kids.detail");
  const tp = await getTranslations("progress.tabs");
  const bdi = (c: React.ReactNode) => <bdi>{c}</bdi>;
  // Profiles are read-own under RLS: the child's name and group come from my_children().
  const child = (await getMyChildren()).find((c) => c.child_id === id);
  if (!child) notFound();

  const [{ userId, profile }, group, groups, summaries, rewards, tapRows, templateTitles] = await Promise.all([
    getProfile(),
    getGroupDetail(child.group_id),
    getMyGroups(),
    getChildSummaries(id),
    getChildRewards(id),
    getRecentTapRows([id]),
    kidTemplateTitlesAllLocales(),
  ]);
  const unarchived = summaries.filter((h) => !h.archived_at);
  const archivedHabits = summaries.filter((h) => h.archived_at && !h.group_id);
  // A habit past its end (in the group's calendar) takes no more check-ins, so it leaves the list.
  // Both need only the habits list, so they load together.
  const [finishedIds, ends] = await Promise.all([
    archivedHabits.length > 0 ? getFinishedIds() : new Set<string>(),
    getHabitEnds(unarchived.map((h) => h.habit_id)),
  ]);
  const today = todayIn(group?.timezone ?? profile.timezone);
  const habits = withoutEnded(unarchived, ends, () => today);
  const checkIns = await getChildCheckIns(id, habits);
  // The check-ins this page counts, for taps still waiting on this phone (RenderedTaps).
  const renderedTaps = renderedTapIds(tapRows, [id], currentPeriods(habits));
  const isAdmin = group?.my_role === "admin";
  const moveTargets = isAdmin
    ? groups.filter((g) => g.role === "admin" && g.group_id !== child.group_id).map((g) => ({ id: g.group_id, name: g.name }))
    : [];
  const names = new Map((group?.members ?? []).map((m) => [m.id, m.name]));
  const time = new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: group?.timezone ?? "UTC", hour: "2-digit", minute: "2-digit" });
  const logged = (loggedBy: string | null, at: string) => {
    const who = loggedBy === null ? { by: "child", name: child.name } : loggedBy === userId ? { by: "you", name: "" } : names.has(loggedBy) ? { by: "member", name: names.get(loggedBy)! } : { by: "former", name: "" };
    return tk.rich("logged", { ...who, gender: child.gender ?? "other", time: time.format(new Date(at)), bdi });
  };

  return (
    <div className="flex flex-col gap-section py-section">
      <RenderedTaps ids={renderedTaps} periods={tapPeriods(habits, () => group?.timezone ?? profile.timezone)} />
      <div className="flex flex-col gap-item">
        {/* -ms-inner: the chevron lines up with the page edge; 4 px icon to label (one glyph pair). */}
        <Link
          href={`/groups/${child.group_id}`}
          className="-ms-inner flex h-11 w-fit max-w-full min-w-0 items-center gap-1 rounded-full px-inner text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft aria-hidden className="size-4 shrink-0 rtl:-scale-x-100" />
          <span className="truncate">{child.group_name}</span>
        </Link>

        {/* The name wraps, never "Mar…": it is who this page is about. */}
        <header className="flex items-center gap-item">
          {/* The h1 beside it names her, so the avatar is decoration here. */}
          <span aria-hidden className="flex shrink-0">
            <Avatar name={child.name} emoji={child.avatar_emoji} color={child.avatar_color} size="lg" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <h1 className="text-xl font-bold wrap-break-word">{child.name}</h1>
            <p className="truncate text-sm text-muted-foreground">{child.group_name}</p>
          </div>
          <EditChildButton childId={id} name={child.name} emoji={child.avatar_emoji} color={child.avatar_color} gender={child.gender} />
        </header>

        {habitsFailed === "1" && <Notice tone="error">{tk("habitsFailed")}</Notice>}

        <Link
          href={`/kids/${id}/play`}
          className="flex min-h-14 items-center justify-center rounded-2xl bg-primary px-item text-center text-base font-bold text-primary-foreground shadow-soft hover:brightness-95"
        >
          {tk("openView", { name: isolate(child.name) })}
        </Link>

        {rewards && lastWeek(rewards.week_start, rewards.album) && (
          <NewWeekCard
            childId={id}
            weekStart={rewards.week_start}
            lastStars={lastWeek(rewards.week_start, rewards.album)!.stars}
            theme={child.kid_theme}
            gender={child.gender}
            albumHref="#album"
          />
        )}
      </div>

      {rewards && <Garden t={tg} stars={rewards.stars_this_week} theme={child.kid_theme} weekStart={rewards.week_start} gender={child.gender} />}
      <ThemePicker childId={id} childName={child.name} theme={child.kid_theme} />
      {rewards && <GardenAlbum t={tg} locale={locale} weeks={rewards.album} theme={child.kid_theme} />}
      {rewards && <TreatGoal childId={id} childName={child.name} gender={child.gender} goal={rewards.goal} />}

      <Section title={tk("habits")}>
        {habits.length > 0 ? (
          <>
            <ul className="flex flex-col gap-item">
              {habits.map((h) => {
                const mine = checkIns.filter((c) => c.habit_id === h.habit_id);
                return (
                  // A habit to open, with its check-in and Undo buttons beside the link: the card look of
                  // Today's habit card, not a Surface (a button can't sit inside a link).
                  <li key={h.habit_id} className="flex flex-col gap-inner rounded-2xl bg-card p-item shadow-soft">
                    <div className="flex items-center gap-inner">
                      <Link href={`/habits/${h.habit_id}`} className="group flex min-h-11 min-w-0 flex-1 items-center gap-inner">
                        <HabitEmoji category={h.category} emoji={h.emoji} size="lg" />
                        {/* Title over its meta: line-height, not a gap. The title wraps ("Brush tee…" at 320 hid it). */}
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="font-bold group-hover:underline">{h.title}</span>
                          <span className="text-sm text-muted-foreground">
                            {h.group_name ? tk.rich("progressInGroup", { progress: kidProgressText(tg, locale, h), group: h.group_name, bdi }) : kidProgressText(tg, locale, h)}
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
                      // 12 px start padding to match the 12 px radius (as Notice does); the Undo button ends flush.
                      <div key={c.id} className="flex min-h-11 items-center justify-between gap-inner rounded-xl bg-muted ps-3 text-sm">
                        <span>{logged(c.logged_by, c.created_at)}</span>
                        <UndoForChildButton
                          checkInId={c.id}
                          habitId={h.habit_id}
                          childId={id}
                          label={tk("undo", { title: isolate(h.title), time: time.format(new Date(c.created_at)) })}
                          title={h.title}
                        />
                      </div>
                    ))}
                  </li>
                );
              })}
            </ul>
            <AddKidHabit childId={id} childName={child.name} existingTitles={unarchived.map((h) => h.title)} templateTitles={templateTitles} gender={child.gender} />
          </>
        ) : (
          <EmptyState
            icon={<ListPlus aria-hidden className="size-6" />}
            action={<AddKidHabit childId={id} childName={child.name} existingTitles={unarchived.map((h) => h.title)} templateTitles={templateTitles} gender={child.gender} />}
          >
            {tk.rich("noHabits", { name: child.name, bdi })}
          </EmptyState>
        )}
      </Section>

      {/* Archived habits open their page, where a guardian restores them. Finished ones (an end that
          was reached and closed) are listed apart: they don't restore. */}
      <HabitLinks title={tp("archived")} habits={archivedHabits.filter((h) => !finishedIds.has(h.habit_id))} />
      <HabitLinks title={tp("finished")} habits={archivedHabits.filter((h) => finishedIds.has(h.habit_id))} />

      {/* Taking a copy isn't dangerous: it sits on its own, for every adult in the group. */}
      <Section title={tk("data")}>
        <p className="text-sm text-muted-foreground">{tk.rich("dataText", { name: child.name, bdi })}</p>
        <ExportChildButton childId={id} childName={child.name} />
      </Section>

      <ChildDangerZone childId={id} childName={child.name} isAdmin={isAdmin} moveTargets={moveTargets} />

      {/* Another adult logging for the child (or the child's own taps in the kid view) refreshes this page. */}
      {habits.length > 0 && <LiveRefresh table="check_ins" filter={`user_id=eq.${id}`} />}
    </div>
  );
}

// The child's archived or finished habits, each opening its page.
function HabitLinks({ title, habits }: { title: string; habits: HabitSummary[] }) {
  if (habits.length === 0) return null;
  return (
    <Section title={title}>
      {/* Rows on dividers, no cards: py-inner + the divider keep the texts 16 px apart. -mx-inner px-inner:
          the hover tint reaches past the text without moving it. */}
      <ul className="-my-inner flex flex-col divide-y divide-border">
        {habits.map((h) => (
          <li key={h.habit_id}>
            <Link href={`/habits/${h.habit_id}`} className="-mx-inner flex min-h-11 items-center gap-inner rounded-xl px-inner py-inner hover:bg-muted/60">
              <HabitEmoji category={h.category} emoji={h.emoji} size="xs" />
              <span className="min-w-0 flex-1 font-semibold">{h.title}</span>
              <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground rtl:-scale-x-100" />
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}
