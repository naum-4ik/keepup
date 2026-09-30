import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronDown, ChevronLeft, Flame, Trophy } from "lucide-react";
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
import { getHabitDetail, getHabitEnds, type HabitFreeze } from "@/lib/habits";
import { EndControl } from "@/components/habits/end-control";
import { endLabel, endProgress } from "@/lib/habit-end";
import { formatLocalDate } from "@/lib/dates";
import { describeProgress, describeSchedule } from "@/lib/schedule";
import { everyoneDidIt, memberStatus, membersOf } from "@/lib/today-sections";
import { stateOf } from "@/lib/today";

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
  const [{ profile, userId }, detail] = await Promise.all([getProfile(), getHabitDetail(id)]);
  if (!detail) notFound();

  const { summary: h, history, freezes, checkIns, totalCheckIns, memberCheckIns, myCheers, myNudges } = detail;
  const members = membersOf(h);
  // A group habit runs on its group's calendar (time zone and week start).
  const group = h.group_id ? await getGroupDetail(h.group_id) : null;
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
  // Only the owner of a private habit, or an admin of a group habit, edits, pauses it for everyone,
  // archives or deletes it (RLS and the RPCs enforce the same).
  const canManage = !h.group_id || h.my_role === "admin";
  const endsOn = (await getHabitEnds([h.habit_id])).get(h.habit_id) ?? null;
  const endNow = endsOn ? endProgress(h.starts_on, endsOn, today, h.period) : null;
  const archived = Boolean(h.archived_at);
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
      <Link href="/today" className="-ml-2 flex h-11 w-fit items-center gap-1 rounded-full px-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
        <ChevronLeft aria-hidden className="size-4" />
        Today
      </Link>

      <header className="flex items-center gap-4">
        <HabitEmoji category={h.category} emoji={h.emoji} size="lg" />
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate text-xl font-bold">{h.title}</h1>
          <p className="text-sm text-muted-foreground">
            {h.group_id
              ? `${h.group_name} · ${describeSchedule(h.target_count, h.period)}${h.requires_approval ? " · needs approval" : ""}`
              : `${describeSchedule(h.target_count, h.period)} · ${CATEGORIES[h.category].label}`}
            {archived && " · Archived"}
          </p>
        </div>
      </header>

      {!archived && (
        <Card title={PERIOD_TITLE[h.period]}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1.5">
              <p className={isDone ? "font-bold text-[#4F8A5B]" : "font-bold"}>{everyone ? "Everyone did it ✓" : progress.text}</p>
              {h.target_count > 1 && (
                <div className="h-2 w-40 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div className={`h-full rounded-full bg-current ${CATEGORIES[h.category].iconClass}`} style={{ width: `${Math.min(100, (h.done_count / h.target_count) * 100)}%` }} />
                </div>
              )}
            </div>
            <CheckInButton
              habitId={h.habit_id}
              title={h.title}
              multi={h.target_count > 1}
              state={stateOf(h)}
            />
          </div>
          <CheckInList habitId={h.habit_id} checkIns={checkIns} timeZone={profile.timezone} period={h.period} />
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
          <p className="text-sm font-semibold">Group streak 🔥 {h.current_streak}</p>
        </Card>
      )}

      <section aria-label="Streaks" className="grid grid-cols-2 divide-x divide-border rounded-2xl bg-card py-4 shadow-soft">
        <div className="flex flex-col items-center gap-0.5">
          <p className="flex items-center gap-1 text-2xl font-extrabold tabular-nums text-[#E8804F]">
            <Flame aria-hidden className="size-5" />
            {h.current_streak}
            <span className="text-sm font-bold">{unit(h.current_streak, h.period)}</span>
          </p>
          <p className="text-xs font-semibold text-muted-foreground">Current streak</p>
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
              <Manage title="Ends" hint={endNow ? endLabel(endNow, h.period) : endsOn ? `Last day ${formatLocalDate(endsOn)}` : "No end yet"}>
                <EndControl habitId={h.habit_id} period={h.period} startsOn={h.starts_on} endsOn={endsOn} today={today} />
              </Manage>
              <Manage
                title={members ? "Pause for everyone" : wholePaused ? "Paused" : activeFreeze ? "Pause scheduled" : "Pause"}
                hint={activeFreeze ? "Resume or cancel the pause" : "Going away? Your streak waits for you"}
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
                  category={h.category}
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
                <Manage title="Archive" hint="Keeps its history, leaves Today" danger>
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
