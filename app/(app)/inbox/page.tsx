import { FamilyRecapCard } from "@/components/celebrations/family-recap-card";
import { ApprovalList, type ApprovalRow } from "@/components/inbox/approval-list";
import { FeedList } from "@/components/inbox/feed-list";
import { InboxTabs } from "@/components/inbox/inbox-tabs";
import { MarkReadOnView } from "@/components/inbox/mark-read-on-view";
import { getProfile } from "@/lib/auth";
import { dayLabel, reviewBy, todayIn } from "@/lib/dates";
import { getFeed, getPendingApprovals } from "@/lib/inbox";
import { recapKey, recapLine, visibleRecaps } from "@/lib/today-cards";
import { getDismissedCards, getFamilyRecaps } from "@/lib/today-cards-data";

export default async function InboxPage() {
  const [{ profile }, approvals, feed, recaps, dismissed] = await Promise.all([
    getProfile(), getPendingApprovals(), getFeed(), getFamilyRecaps(), getDismissedCards(),
  ]);
  // The weekly family recap (first day of the group's week), dismissible. Dismissals couldn't be read:
  // none shown, rather than bring back closed ones.
  const shownRecaps = dismissed ? visibleRecaps(recaps, dismissed) : [];
  const tz = profile.timezone;
  const now = new Date();
  const today = todayIn(tz, now);
  const rows: ApprovalRow[] = approvals.map((a) => ({
    check_in_id: a.check_in_id,
    author_name: a.author_name,
    author_avatar_emoji: a.author_avatar_emoji,
    author_avatar_color: a.author_avatar_color,
    habit_title: a.habit_title,
    group_name: a.group_name,
    day: dayLabel(a.local_date, today).replace(/^(Today|Yesterday)$/, (d) => d.toLowerCase()),
    reviewBy: reviewBy(a.review_deadline, tz, now),
  }));

  return (
    <section className="flex flex-col gap-4 py-6">
      <h1 className="text-xl font-bold">Inbox</h1>
      {/* New rows refresh this page through the app layout's notifications listener. */}
      <InboxTabs
        approvalsCount={rows.length}
        approvals={<ApprovalList rows={rows} />}
        activity={
          <>
            {shownRecaps.map((r) => (
              <FamilyRecapCard key={recapKey(r)} cardKey={recapKey(r)} group={r.group_name} line={recapLine(r)} />
            ))}
            <FeedList items={feed} timeZone={tz} now={now} />
            <MarkReadOnView ids={feed.filter((n) => !n.read_at).map((n) => n.id)} />
          </>
        }
      />
    </section>
  );
}
