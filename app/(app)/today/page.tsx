import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronRight, Clock } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { EveryoneDidIt, type CardMember } from "@/components/celebrations/everyone-did-it";
import { EmptyState } from "@/components/ui/empty-state";
import { FirstCheckinTip } from "@/components/first-checkin-tip";
import { SproutIcon } from "@/components/sprout-icon";
import { HabitCard, type EndLine } from "@/components/habits/habit-card";
import { LiveRefresh } from "@/components/habits/live-refresh";
import { KidSection } from "@/components/kids/kid-section";
import { NeedsConnection } from "@/components/offline/needs-connection";
import { RenderedTaps } from "@/components/offline/offline-queue-provider";
import { GentleCard } from "@/components/today/gentle-card";
import { ResetNote } from "@/components/today/reset-note";
import { TodaySummary } from "@/components/today/today-summary";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Surface } from "@/components/ui/surface";
import { getProfile } from "@/lib/auth";
import { getMyGroups } from "@/lib/groups";
import { isUuid } from "@/lib/habit-schema";
import { getFinishSummary, getGroupTimezones, getHabitEnds, getHabitSummaries, getRecentTapRows, getWeekOverview, type HabitSummary } from "@/lib/habits";
import { anotherGoLine, celebrates, finishLine } from "@/lib/habit-finish";
import { getT } from "@/lib/i18n/server";
import { FinishCard } from "@/components/today/finish-card";
import { endLabel, endProgress, hasEnded, withoutEnded } from "@/lib/habit-end";
import { todayIn } from "@/lib/dates";
import { getPendingApprovals } from "@/lib/inbox";
import { getChildRewards, getChildSummaries, getMyChildren } from "@/lib/kids";
import { parsePurpose } from "@/lib/profile-schema";
import { currentPeriods, renderedTapIds, tapPeriods } from "@/lib/rendered-taps";
import { allCheckedOffKey, groupForToday } from "@/lib/today";
import { todayProgress } from "@/lib/today-progress";
import { chooseGentleCard } from "@/lib/today-cards";
import { getCelebrations, getDismissedCards, hasCheckedIn } from "@/lib/today-cards-data";
import { membersOf, sectionsForToday } from "@/lib/today-sections";
import { hasWeekData } from "@/lib/week-overview";
import { INTL_LOCALE, isolate, type T } from "@/supabase/functions/_shared/i18n";

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ joined?: string; reset?: string }> }) {
  const { joined, reset } = await searchParams;
  const { t, locale } = await getT();
  const tt = await getTranslations("today");
  const tg = await getTranslations("groups.detail");
  // One wave: each read starts as soon as what it needs is in (the ends once the habits are, a child's
  // habits once the children are), not after the slowest of the first reads. Every promise is in the one
  // Promise.all, so none is left unhandled.
  const childrenP = getMyChildren();
  const summariesP = getHabitSummaries();
  const profileP = getProfile();
  const activeP = summariesP.then((s) => s.filter((h) => !h.archived_at));
  // Habits past their end (ideas/habit-end-date.md) leave the lists (no more check-ins) for a finish card.
  // "Ended" is judged in each habit's own calendar: a group habit (and a child's) runs on the group's zone.
  // Two chains run side by side: the kids' sections (habits, stars, ends) and mine (ends, finish cards).
  const endsP = activeP.then((active) => getHabitEnds(active.map((h) => h.habit_id)));
  const zonesP = Promise.all([activeP, childrenP, profileP]).then(([active, children, { profile }]) =>
    getGroupTimezones([...active.map((h) => h.group_id), ...children.map((c) => c.group_id)]).then(
      (zones) => (groupId: string | null | undefined) => (groupId && zones.get(groupId)) || profile.timezone,
    ),
  );
  const todayOfP = zonesP.then((zoneOf) => (groupId: string | null | undefined) => todayIn(zoneOf(groupId)));
  const [summaries, overview, groups, approvals, children, { profile }, celebrations, dismissed, checkedIn, tapRows, active, kids, ends, finishes, todayOf, zoneOf] =
    await Promise.all([
      summariesP,
      getWeekOverview(),
      getMyGroups(),
      getPendingApprovals(),
      childrenP,
      profileP,
      getCelebrations(),
      getDismissedCards(),
      hasCheckedIn(),
      childrenP.then((cs) => getRecentTapRows(cs.map((c) => c.child_id))),
      activeP,
      (async () => {
        // A section per child: the child's active habits and this week's stars (both fail soft).
        const kidRows = await Promise.all(
          (await childrenP).map(async (child) => {
            const [kidHabits, rewards] = await Promise.all([getChildSummaries(child.child_id), getChildRewards(child.child_id)]);
            return { child, habits: kidHabits.filter((h) => !h.archived_at), stars: rewards?.stars_this_week ?? null };
          }),
        );
        const [kidEnds, dayOf] = await Promise.all([getHabitEnds(kidRows.flatMap((k) => k.habits).map((h) => h.habit_id)), todayOfP]);
        // A child's ended habits simply leave the child's section (an adult decides from their own finish card).
        return kidRows.map((k) => ({ ...k, habits: withoutEnded(k.habits, kidEnds, () => dayOf(k.child.group_id)) }));
      })(),
      endsP,
      (async () => {
        // The same habit objects as `active` below: the lists drop finished ones by identity.
        const [mine, myEnds, dayOf] = await Promise.all([activeP, endsP, todayOfP]);
        const ended = mine.filter((h) => hasEnded(myEnds.get(h.habit_id), dayOf(h.group_id)));
        return Promise.all(ended.map(async (h) => ({ h, summary: await getFinishSummary(h.habit_id) })));
      })(),
      todayOfP,
      zonesP,
    ]);
  const joinedGroup = joined && isUuid(joined) ? groups.find((g) => g.group_id === joined) : undefined;
  const habits = active.filter((h) => !finishes.some((f) => f.h === h));
  // The check-ins these counts include, for taps still waiting on this phone (RenderedTaps).
  const renderedTaps = renderedTapIds(
    tapRows,
    [profile.id, ...children.map((c) => c.child_id)],
    currentPeriods([...summaries, ...kids.flatMap((k) => k.habits)]),
  );
  // Each habit's shown period, so a waiting tap from an earlier one doesn't count here.
  const shownPeriods = {
    ...tapPeriods(summaries, (h) => zoneOf(h.group_id)),
    ...Object.assign({}, ...kids.map((k) => tapPeriods(k.habits, () => zoneOf(k.child.group_id)))),
  };
  const sections = sectionsForToday(t, locale, habits, groups);
  // A solo user's Today looks as before: the "Mine" heading shows only next to a group section.
  const withHeadings = sections.some((s) => s.key !== "mine") || kids.length > 0;
  // Check-ins by other members (and other adults logging for a child) refresh these cards.
  const liveHabitIds = [
    ...new Set([...habits.filter((h) => h.group_id).map((h) => h.habit_id), ...kids.flatMap((k) => k.habits.map((h) => h.habit_id))]),
  ];
  const tipFor = sections.map((s) => groupForToday(s.habits).todo[0]).find(Boolean)?.habit_id;
  // The first-check-in tip is for people who have never checked in (not for someone on a new device).
  const isNewUser = habits.every((h) => h.done_count === 0 && h.best_streak === 0);
  // The Today summary: every adult section's to-do and done habits (kids have their own stars).
  const progressHabits = sections.flatMap((s) => s.habits).map((h) => ({
    habit_id: h.habit_id, title: h.title, emoji: h.emoji, category: h.category, target_count: h.target_count, period: h.period,
    done_count: h.done_count, checked_in_today: h.checked_in_today, frozen: h.frozen, not_started: h.not_started,
    pending_count: h.pending_count, requires_approval: h.requires_approval, current_streak: h.current_streak,
  }));
  const progress = todayProgress(progressHabits);
  const now = new Date();
  const date = new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: profile.timezone, weekday: "long", day: "numeric", month: "long" }).format(now);
  const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: profile.timezone }).format(now);
  // "Day 12 of 30" for habits with an end.
  const endLines = new Map<string, EndLine>();
  for (const h of habits) {
    const endsOn = ends.get(h.habit_id);
    const p = endsOn ? endProgress(h.starts_on, endsOn, todayOf(h.group_id), h.period) : null;
    if (p) endLines.set(h.habit_id, { text: endLabel(t, p, h.period), almost: p.almost });
  }

  // "Everyone did it" (ideas/achievements-and-rewards.md §7), then at most one gentle card. No other
  // group cards on Today (owner 2026-10-04): a group milestone is an Inbox row and a push, the weekly
  // family recap tops the Inbox's Activity tab.
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
  const everyoneHabits = [...new Map(everyone.map((n) => [n.habit_id ?? n.id, n.habit_title ?? t("today.habitFallback")])).entries()];
  // Dismissals couldn't be read: show no dismissible cards rather than bring back closed ones.
  const purpose = parsePurpose(profile.purpose ?? "");
  const gentle = dismissed && chooseGentleCard({
    purpose: purpose.ok ? purpose.value : null,
    hasCheckedIn: checkedIn,
    groups,
    dismissed,
  });

  // Never two bursts at once: no finish-card confetti when "Everyone did it" or the Today summary's
  // all-done burst may play; finish cards take turns among themselves (FinishCard).
  const finishQuiet = everyone.length > 0 || (progress.total > 0 && progress.done >= progress.total);
  const checkedOffKey = withHeadings ? allCheckedOffKey(sections) : null;

  const week = overview && hasWeekData(overview) ? { done: overview.done, possible: overview.possible, streak: overview.best_current_streak } : null;

  // Spacing (docs/design.md): sections 24px apart, the title over its summary 8px. Kept short so the
  // first check-in is on the first screen of a 320×640 phone, above the bottom nav.
  // data-offline-page: this Today rendered, so the service worker may save it for offline use (public/sw.js).
  return (
    <section data-offline-page="today" className="flex flex-col gap-section py-section">
      <RenderedTaps ids={renderedTaps} periods={shownPeriods} />
      <div className="flex flex-col gap-inner">
        <div className="flex flex-wrap items-baseline justify-between gap-x-inner">
          <h1 className="text-xl font-bold">{tt("title")}</h1>
          <p className="text-sm font-semibold text-muted-foreground">{date}</p>
        </div>
        {progress.total > 0 && <TodaySummary dayKey={dayKey} habits={progressHabits} week={week} quiet={everyone.length > 0} />}
      </div>
      {/* Right after Settings → Reset my data. */}
      {reset === "1" && <ResetNote />}
      {/* Arriving from an invite (?joined=<group>): who's here, where the group's habits are, a way in. */}
      {joinedGroup && (
        <Notice
          live
          action={
            <Link
              href={`/groups/${joinedGroup.group_id}`}
              aria-label={tt("welcome.openLabel", { name: isolate(joinedGroup.name) })}
              // A 44px target kept to the Notice's line height by negative margins (docs/design.md "Buttons").
              className="-my-3 flex min-h-11 items-center rounded-lg px-inner font-bold text-primary hover:bg-background/60"
            >
              {tt("welcome.open")}
            </Link>
          }
        >
          {tt.rich("welcome.title", { name: joinedGroup.name, bdi: (c) => <bdi>{c}</bdi> })} · {tt("welcome.people", { n: joinedGroup.member_count })} ·{" "}
          {habits.some((h) => h.group_id === joinedGroup.group_id) ? tt("welcome.habitsBelow") : tt("welcome.noGroupHabits")}
        </Notice>
      )}
      {/* Opens the Inbox's approvals: a Surface (it opens something), one line. */}
      {approvals.length > 0 && (
        <Surface as="a" href="/inbox" className="flex items-center gap-inner">
          <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-pending-soft text-pending">
            <Clock aria-hidden className="size-4" />
          </span>
          <span className="flex-1 font-semibold">{tt("approvalsWaiting", { n: approvals.length })}</span>
          <ChevronRight aria-hidden className="size-5 text-muted-foreground rtl:-scale-x-100" />
        </Surface>
      )}
      {/* Always rendered, so the card survives a refresh after it was seen (EveryoneDidIt). */}
      <EveryoneDidIt
        ids={everyone.map((n) => n.id)}
        habits={everyoneHabits.map(([, title]) => title)}
        members={membersFor(everyoneHabits.map(([id]) => id))}
      />
      {/* Offline (the saved page), cards whose buttons need the server say so (ideas/offline.md §3). */}
      {gentle && (
        <NeedsConnection key={gentle.key} label={gentle.key.startsWith("add_child") ? tg("addChild") : tt("gentle.inviteFamily.cta")}>
          <GentleCard card={gentle} />
        </NeedsConnection>
      )}
      {finishes.map(({ h, summary }) => (
        <NeedsConnection key={h.habit_id} label={tt("finish.label", { title: isolate(h.title) })}>
          <FinishCard
            habitId={h.habit_id}
            endsOn={ends.get(h.habit_id) ?? ""}
            quiet={finishQuiet}
            title={h.title}
            emoji={h.emoji}
            category={h.category}
            line={summary && celebrates(summary) ? finishLine(t, summary, h.period, Boolean(h.group_id)) : anotherGoLine(t, h.current_streak, h.period)}
            celebrate={Boolean(summary && celebrates(summary))}
            canDecide={!h.group_id || h.my_role === "admin"}
          />
        </NeedsConnection>
      ))}
      {/* Nothing due today: the week still shows on its own. */}
      {progress.total === 0 && week && <TodaySummary dayKey={dayKey} habits={[]} week={week} />}
      {habits.length === 0 && kids.length === 0 && finishes.length === 0 ? (
        <EmptyState
          icon={<SproutIcon className="size-6" />}
          action={
            <Button asChild>
              <Link href="/habits/new">{tt("empty.action")}</Link>
            </Button>
          }
        >
          {tt("empty.text")}
        </EmptyState>
      ) : (
        sections.map((s) =>
          withHeadings ? (
            <section key={s.key} aria-label={s.title} className="flex flex-col gap-item">
              <h2 className="text-base font-bold">
                {s.key === "mine" ? (
                  s.title
                ) : (
                  // A group section opens its group. The avatar is decoration: the link is named by the title.
                  <Link
                    href={`/groups/${s.key}`}
                    className="-mx-inner flex min-h-11 w-fit max-w-full items-center gap-inner rounded-xl px-inner hover:bg-muted/60"
                  >
                    <span aria-hidden className="shrink-0">
                      <Avatar name={s.title} emoji={s.avatar?.emoji} color={s.avatar?.color} size="sm" />
                    </span>
                    <span className="truncate">{s.title}</span>
                    <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground rtl:-scale-x-100" />
                  </Link>
                )}
              </h2>
              <TodayLists t={t} habits={s.habits} tipFor={isNewUser ? tipFor : undefined} sectionDone={s.key === checkedOffKey} endLines={endLines} />
            </section>
          ) : (
            <TodayLists key={s.key} t={t} habits={s.habits} tipFor={isNewUser ? tipFor : undefined} sectionDone={false} endLines={endLines} />
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
// `sectionDone`: say "All checked off" when this section is finished. Only one section says it
// (allCheckedOffKey); off for a lone section, where the Today summary already says "All 3 done".
function TodayLists({
  t,
  habits,
  tipFor,
  sectionDone = true,
  endLines,
}: {
  t: T;
  habits: HabitSummary[];
  tipFor?: string;
  sectionDone?: boolean;
  endLines?: Map<string, EndLine>;
}) {
  const { todo, done, later } = groupForToday(habits);
  return (
    <>
      {todo.length > 0 ? (
        <HabitList habits={todo} tipFor={tipFor} endLines={endLines} />
      ) : done.length > 0 && sectionDone ? (
        <Notice tone="success">{t("today.sections.allCheckedOff", { total: done.length })}</Notice>
      ) : null}
      {done.length > 0 && <HabitList title={t("today.sections.doneForToday")} habits={done} endLines={endLines} />}
      {later.length > 0 && <HabitList title={t("today.sections.later")} habits={later} endLines={endLines} />}
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
  endLines?: Map<string, EndLine>;
}) {
  if (habits.length === 0) return null;
  const list = (
    <ul className="flex flex-col gap-item">
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
    <section aria-label={title} className="flex flex-col gap-inner">
      <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
      {list}
    </section>
  );
}
