import { FamilyRecapCard } from "@/components/celebrations/family-recap-card";
import { ApprovalList, type ApprovalRow } from "@/components/inbox/approval-list";
import { FeedList } from "@/components/inbox/feed-list";
import { InboxTabs } from "@/components/inbox/inbox-tabs";
import { MarkReadOnView } from "@/components/inbox/mark-read-on-view";
import { getProfile } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { dayLabel, reviewBy, todayIn } from "@/lib/dates";
import { getMyGroups } from "@/lib/groups";
import { getFeed, getPendingApprovals } from "@/lib/inbox";
import { recapKey, recapLine, visibleRecaps } from "@/lib/today-cards";
import { getDismissedCards, getFamilyRecaps } from "@/lib/today-cards-data";

export default async function InboxPage() {
  const [{ profile }, approvals, feed, recaps, dismissed, groups, { t, locale }] = await Promise.all([
    getProfile(), getPendingApprovals(), getFeed(), getFamilyRecaps(), getDismissedCards(), getMyGroups(), getT(),
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
    day: dayLabel(t, locale, a.local_date, today, true),
    reviewBy: reviewBy(t, locale, a.review_deadline, tz, now),
  }));

  return (
    <section className="flex flex-col gap-section py-section">
      <h1 className="text-xl font-bold">{t("inbox.title")}</h1>
      {/* New rows refresh this page through the app layout's notifications listener. */}
      <InboxTabs
        approvalsCount={rows.length}
        approvals={<ApprovalList rows={rows} />}
        activity={
          <div className="flex flex-col gap-section">
            {shownRecaps.map((r) => (
              <FamilyRecapCard key={recapKey(r)} cardKey={recapKey(r)} group={r.group_name} line={recapLine(t, r)} />
            ))}
            <FeedList items={feed} timeZone={tz} now={now} t={t} locale={locale} hasGroups={groups.length > 0} />
            <MarkReadOnView ids={feed.filter((n) => !n.read_at).map((n) => n.id)} />
          </div>
        }
      />
    </section>
  );
}
