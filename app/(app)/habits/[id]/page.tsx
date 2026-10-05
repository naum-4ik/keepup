import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronDown, ChevronLeft, Flame, Trophy } from "lucide-react";
import { KidCheckInButton } from "@/components/kids/kid-check-in-button";
import { ArchiveHabitButton } from "@/components/habits/archive-habit-button";
import { HabitEmoji } from "@/components/habits/category-icon";
import { CheckInButton } from "@/components/habits/check-in-button";
import { CheerButton } from "@/components/habits/cheer-button";
import { CheckInList } from "@/components/habits/check-in-list";
import { DeleteHabitButton } from "@/components/habits/delete-habit-button";
import { FreezeForm } from "@/components/habits/freeze-form";
import { HabitDetailsForm } from "@/components/habits/habit-details-form";
import { HistoryGrid } from "@/components/habits/history-grid";
import { LiveRefresh } from "@/components/habits/live-refresh";
import { MEMBER_STATUS_LABEL, MemberAvatar } from "@/components/habits/member-status-row";
import { NudgeButton } from "@/components/habits/nudge-button";
import { PauseMeForm } from "@/components/habits/pause-me-form";
import { getProfile } from "@/lib/auth";
import { CATEGORIES } from "@/lib/categories";
import { todayIn } from "@/lib/dates";
import { isUuid, type HabitPeriod } from "@/lib/habit-schema";
import { getGroupDetail } from "@/lib/groups";
import { getFinishedIds, getHabitDetail, getHabitEnds, type HabitFreeze } from "@/lib/habits";
import { ReminderControl } from "@/components/habits/reminder-control";
import { getHabitSettings } from "@/lib/habit-settings";
import { reminderHint } from "@/lib/reminder-mode";
import { RestoreHabitButton } from "@/components/habits/restore-habit-button";
import { EndControl } from "@/components/habits/end-control";
import { endLabel, endProgress, hasEnded } from "@/lib/habit-end";
import { formatLocalDate } from "@/lib/dates";
import { describeProgress, describeSchedule } from "@/lib/schedule";
import { everyoneDidIt, memberStatus, membersOf, openChildrenOf } from "@/lib/today-sections";
import { ringOf, stateOf } from "@/lib/today";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3 rounded-2xl bg-card p-5 shadow-soft">
      <h2 className="text-sm font-bold text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

// Settings the user rarely needs sit behind a row they can open, so the page leads with today.
function Manage({ title, hint, danger, children }: { title: string; hint: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <details className="group border-t border-border first:border-t-0">
      <summary className="flex min-h-14 list-none items-center gap-3 px-5 py-3 hover:bg-muted/60 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={danger ? "font-bold text-destructive" : "font-bold"}>{title}</span>
          <span className="text-xs text-muted-foreground">{hint}</span>
        </span>
        <ChevronDown aria-hidden className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-5 pt-1 pb-5">{children}</div>
    </details>
  );
}

const UNIT: Record<HabitPeriod, [string, string]> = { day: ["day", "days"], week: ["week", "weeks"], month: ["month", "months"] };
const unit = (n: number, period: HabitPeriod) => UNIT[period][n === 1 ? 0 : 1];
const PERIOD_TITLE: Record<HabitPeriod, string> = { day: "Today", week: "This week", month: "This month" };

const covers = (f: HabitFreeze, day: string) => f.starts_on <= day && (!f.ends_on || f.ends_on >= day);
// The pause to show: the current one (when paused now), else the next scheduled one.
const shownFreeze = (freezes: HabitFreeze[], today: string, pausedNow: boolean) =>
  (pausedNow ? freezes.find((f) => covers(f, today)) : freezes.find((f) => f.starts_on > today)) ?? null;

export default async function HabitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  // The end needs only the id, so it loads with the habit.
  const [{ profile, userId }, detail, ends] = await Promise.all([getProfile(), getHabitDetail(id), getHabitEnds([id])]);
  if (!detail) notFound();

  const { summary: h, child, history, freezes, checkIns, totalCheckIns, memberCheckIns, myCheers, myNudges } = detail;
  const members = membersOf(h);
  // Only the owner of a private habit, or an admin of a group habit, edits, pauses it for everyone,
  // archives or deletes it (RLS and the RPCs enforce the same). A child's own habit (child is set,
  // so the viewer is a guardian: habit_role 'guardian') is managed by any adult of the child's group.
  const canManage = child !== null || !h.group_id || h.my_role === "admin";
  const archived = Boolean(h.archived_at);
  // A child's own habit may have no category (kid templates); the page and the edit form need one.
  const category = h.category ?? "home";
  // A group habit runs on its group's calendar (time zone and week start). Finished habits use Start
  // again (Progress → Finished); only plain archived ones restore, so that list is read only then.
  const [group, finishedIds, settings] = await Promise.all([
    h.group_id || child?.groupId ? getGroupDetail((h.group_id ?? child?.groupId)!) : null,
    archived && canManage ? getFinishedIds() : null,
    getHabitSettings(h.habit_id),
  ]);
  // Reminders are for people who do the habit: its owner, or anyone in its group (adults always take part).
  const takesPart = !child && (Boolean(h.group_id) || h.my_role === "owner");
  const today = todayIn(group?.timezone ?? profile.timezone);
  const weekStart = (group?.week_start ?? profile.week_start) === 0 ? 0 : 1;
  const wholeFreezes = freezes.filter((f) => !f.user_id);
  const myFreezes = freezes.filter((f) => f.user_id === userId);
  const me = members?.find((m) => m.profile_id === userId);
  // "Paused now" comes from the summary (the same rule that gates check-ins); for a group habit the
  // summary's `frozen` also covers the viewer's own pause, so the whole-habit one is read from its rows.
  const wholePaused = members ? wholeFreezes.some((f) => covers(f, today)) : h.frozen;
  const activeFreeze = shownFreeze(wholeFreezes, today, wholePaused);
  const myFreeze = shownFreeze(myFreezes, today, Boolean(me?.paused));
  const endsOn = ends.get(h.habit_id) ?? null;
  const endNow = endsOn ? endProgress(h.starts_on, endsOn, today, h.period) : null;
  const restorable = archived && canManage && !child && !finishedIds?.has(h.habit_id);
  const progress = describeProgress({
    targetCount: h.target_count,
    period: h.period,
    doneCount: h.done_count,
    daysLeft: h.days_left,
    frozen: h.frozen,
    frozenUntil: h.frozen_until,
    notStarted: h.not_started,
    startsOn: h.starts_on,
  });

  const everyone = everyoneDidIt(h);
  // Nudge and Cheer are between adults only (M3 decision). Nudge: required, not there yet and no
  // check-in today (nudge()'s own rule). Cheer: today's counted check-in.
  const todays = (memberId: string) => memberCheckIns.filter((c) => c.user_id === memberId && c.local_date === today);
  const actionFor = (m: NonNullable<typeof members>[number]) => {
    if (m.profile_id === userId || m.kind !== "adult") return null;
    const counted = todays(m.profile_id).filter((c) => c.status === "approved").at(-1);
    if (counted) return <CheerButton checkInId={counted.id} habitId={h.habit_id} name={m.name} cheered={myCheers.includes(counted.id)} />;
    if (memberStatus(m, h.target_count) === "open" && !todays(m.profile_id).some((c) => c.status !== "rejected")) {
      const sent = myNudges.some((n) => n.recipient_id === m.profile_id && n.local_date === today);
      return <NudgeButton habitId={h.habit_id} recipientId={m.profile_id} name={m.name} sent={sent} />;
    }
    return null;
  };
  const isDone = h.done_count >= h.target_count || everyone;

  return (
    <section className="flex flex-col gap-4 pt-2 pb-6">
      <Link
        href={child ? `/kids/${child.id}` : "/today"}
        className="-ml-2 flex h-11 w-fit max-w-full min-w-0 items-center gap-1 rounded-full px-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <ChevronLeft aria-hidden className="size-4 shrink-0" />
        <span className="truncate">{child ? child.name : "Today"}</span>
      </Link>

      <header className="flex items-center gap-4">
        <HabitEmoji category={h.category} emoji={h.emoji} size="lg" />
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate text-xl font-bold">{h.title}</h1>
          <p className="text-sm text-muted-foreground">
            {h.group_id
              ? `${h.group_name} · ${describeSchedule(h.target_count, h.period)}${h.requires_approval ? " · needs approval" : ""}`
              : `${describeSchedule(h.target_count, h.period)} · ${CATEGORIES[category].label}`}
            {archived && " · Archived"}
          </p>
        </div>
      </header>

      {restorable && (
        <Card title="Archived">
          <p className="text-sm text-muted-foreground">Restore it to put it back on Today. The days it was archived don&apos;t count against you.</p>
          <RestoreHabitButton habitId={h.habit_id} title={h.title} />
        </Card>
      )}

      {!archived && (
        <Card title={PERIOD_TITLE[h.period]}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1.5">
              <p className={isDone ? "font-bold text-done" : "font-bold"}>{everyone ? "Everyone did it ✓" : progress.text}</p>
              {h.target_count > 1 && (
                <div className="h-2 w-40 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div className={`h-full rounded-full bg-current ${CATEGORIES[category].iconClass}`} style={{ width: `${Math.min(100, (h.done_count / h.target_count) * 100)}%` }} />
                </div>
              )}
            </div>
            {child ? (
              <KidCheckInButton
                habitId={h.habit_id}
                title={h.title}
                childId={child.id}
                childName={child.name}
                multi={h.target_count > 1}
                state={stateOf(h)}
              />
            ) : (
              <CheckInButton
                habitId={h.habit_id}
                title={h.title}
                multi={h.target_count > 1}
                state={stateOf(h)}
                withChildren={openChildrenOf(h)}
                ring={ringOf(h)}
              />
            )}
          </div>
          {!child && <CheckInList habitId={h.habit_id} checkIns={checkIns} timeZone={profile.timezone} period={h.period} />}
        </Card>
      )}

      {members && !archived && (
        <Card title="Together">
          <ul className="flex flex-col gap-2">
            {members.map((m) => {
              const status = memberStatus(m, h.target_count);
              return (
                <li key={m.profile_id} className="flex min-h-11 items-center gap-3">
                  <MemberAvatar member={m} status={status} size="md" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold">
                      {m.name}
                      {m.profile_id === userId && <span className="font-normal text-muted-foreground"> (you)</span>}
                    </span>
                    <span className="text-sm text-muted-foreground">{MEMBER_STATUS_LABEL[status]}</span>
                  </span>
                  {actionFor(m)}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <section aria-label="Streaks" className="grid grid-cols-2 divide-x divide-border rounded-2xl bg-card py-4 shadow-soft">
        <div className="flex flex-col items-center gap-0.5">
          <p className="flex items-center gap-1 text-2xl font-extrabold tabular-nums text-flame">
            <Flame aria-hidden className="size-5" />
            {h.current_streak}
            <span className="text-sm font-bold">{unit(h.current_streak, h.period)}</span>
          </p>
          <p className="text-xs font-semibold text-muted-foreground">{members ? "Together" : "Your streak"}</p>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <p className="flex items-center gap-1 text-2xl font-extrabold tabular-nums">
            <Trophy aria-hidden className="size-5 text-muted-foreground" />
            {h.best_streak}
            <span className="text-sm font-bold">{unit(h.best_streak, h.period)}</span>
          </p>
          <p className="text-xs font-semibold text-muted-foreground">Best streak</p>
        </div>
      </section>

      <Card title="History">
        <HistoryGrid cells={history} period={h.period} />
      </Card>

      {!archived && (
        <section aria-label="Manage habit" className="overflow-hidden rounded-2xl bg-card shadow-soft">
          {takesPart && (
            <Manage title="Reminders" hint={reminderHint(settings)}>
              <ReminderControl habitId={h.habit_id} settings={settings} />
            </Manage>
          )}
          {members && (
            <Manage
              title="Pause just me"
              hint={myFreeze ? (me?.paused ? "You're paused. Resume any time" : "Your pause is scheduled") : "Away for a while? The others carry on"}
            >
              <PauseMeForm habitId={h.habit_id} today={today} weekStart={weekStart} activeFreeze={myFreeze} paused={Boolean(me?.paused)} />
            </Manage>
          )}
          {canManage && (
            <>
              <Manage
                title="Ends"
                hint={
                  endNow
                    ? endLabel(endNow, h.period)
                    : hasEnded(endsOn, today)
                      ? "Reached its end. Keep going or finish"
                      : endsOn
                        ? `Last day ${formatLocalDate(endsOn)}`
                        : "No end yet"
                }
              >
                <EndControl habitId={h.habit_id} period={h.period} startsOn={h.starts_on} endsOn={endsOn} today={today} />
              </Manage>
              <Manage
                title={members ? "Pause for everyone" : wholePaused ? "Paused" : activeFreeze ? "Pause scheduled" : "Pause"}
                hint={
                  activeFreeze
                    ? "Resume or cancel the pause"
                    : members
                      ? "Going away together? Pausing keeps the group's streak safe"
                      : "Going away? Your streak waits for you"
                }
              >
                <FreezeForm
                  habitId={h.habit_id}
                  today={today}
                  weekStart={weekStart}
                  activeFreeze={activeFreeze}
                  paused={wholePaused}
                  submitLabel={members ? "Pause for everyone" : undefined}
                />
              </Manage>
              <Manage title="Edit details" hint={totalCheckIns === 0 ? "Title, emoji, category and start date" : "Title, emoji and category"}>
                <HabitDetailsForm
                  habitId={h.habit_id}
                  title={h.title}
                  emoji={h.emoji}
                  category={category}
                  startsOn={h.starts_on}
                  canEditStart={totalCheckIns === 0}
                  today={today}
                  weekStart={weekStart}
                />
              </Manage>
              {totalCheckIns === 0 ? (
                <Manage title="Delete" hint="It has no check-ins yet, so nothing is lost" danger>
                  <DeleteHabitButton habitId={h.habit_id} title={h.title} />
                </Manage>
              ) : (
                <Manage title="Archive" hint="Keeps its history, leaves Today">
                  <ArchiveHabitButton habitId={h.habit_id} title={h.title} />
                </Manage>
              )}
            </>
          )}
        </section>
      )}
      {h.group_id && <LiveRefresh table="check_ins" filter={`habit_id=eq.${h.habit_id}`} />}
    </section>
  );
}
