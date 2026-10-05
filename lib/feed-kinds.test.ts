import { describe, expect, it } from "vitest";
import { FEED_KINDS, feedCopy, isFeedKind, type FeedItem } from "./feed-copy";

describe("feed kinds", () => {
  it("knows every kind it has a line for", () => {
    expect(isFeedKind("group_check_in")).toBe(true);
    expect(isFeedKind("kid_garden_full")).toBe(true);
    expect(FEED_KINDS).toContain("nudge");
  });

  it("skips a kind a newer database writes before the app knows it", () => {
    expect(isFeedKind("some_future_kind")).toBe(false);
  });
});

const item = (o: Partial<FeedItem>): FeedItem => ({
  id: "n", kind: "private_streak_ended", created_at: "2026-10-05T18:00:00Z", read_at: null, seen_at: null,
  group_id: null, group_name: null, habit_id: "h", habit_title: "Read", habit_emoji: "📖", check_in_id: null,
  actor_name: null, subject_id: null, subject_name: null, subject_avatar_emoji: null, payload: {}, ...o,
});

describe("#11 private streak ended (feed only)", () => {
  it("says how long it was and, gently, the best", () => {
    expect(feedCopy(item({ payload: { streak: 12, period: "day", best: 21 } }))).toEqual({
      title: "Read", body: "Read streak ended at 12 days. Your best is still 21.", href: "/habits/h" });
  });

  it("when this was the best, it invites a new one", () => {
    expect(feedCopy(item({ payload: { streak: 3, period: "week", best: 3 } })).body).toBe("Read streak ended at 3 weeks. Start a new one this week.");
  });

  it("an unknown period reads as days", () => {
    expect(feedCopy(item({ payload: { streak: 1, period: "fortnight" } })).body).toBe("Read streak ended at 1 day. Start a new one today.");
  });
});

describe("reminder kinds in the Inbox", () => {
  it("the daily summary and a habit's own reminder", () => {
    expect(feedCopy(item({ kind: "daily_summary", habit_id: null, habit_title: null, payload: {
      todo: [{ title: "Read", done: 0, target: 1 }], at_risk: [{ title: "Run", done: 1, target: 3, period: "week", days_left: 2 }] } })))
      .toEqual({ title: "Today", body: "Still to do: Read · Run: 1 of 3 this week, 2 days left 🌱", href: "/today" });
    expect(feedCopy(item({ kind: "habit_reminder", habit_title: "Vitamins" })).body).toBe("Time for Vitamins.");
  });

  it("a summary with nothing left says so, from the shared copy", () => {
    expect(feedCopy(item({ kind: "daily_summary", habit_id: null, payload: { todo: [], at_risk: [] } })))
      .toEqual({ title: "Today", body: "All done for today 🎉", href: "/today" });
  });

  it("an approval about to close", () => {
    expect(feedCopy(item({ kind: "approval_expiring", group_name: "Family", actor_name: "Anna", habit_title: "Gym" })))
      .toEqual({ title: "Family", body: "Anna's Gym check-in needs a yes within 2 hours", href: "/inbox" });
  });
});

describe("sync notes in the Inbox (ideas/offline.md)", () => {
  it("streak is back, for a group and for a private habit", () => {
    expect(feedCopy(item({ kind: "streak_back", group_name: "Family", habit_title: "Family dinner" }))).toMatchObject({
      title: "Family", body: "A late check-in arrived. Family dinner streak is back 🔥" });
    expect(feedCopy(item({ kind: "streak_back", habit_title: "Read" })).title).toBe("Read");
  });

  it("a quiet merge, a dropped tap and a refused undo", () => {
    expect(feedCopy(item({ kind: "already_logged", actor_name: "Anna", subject_name: "Mary", habit_title: "Brush teeth" })))
      .toMatchObject({ title: "Mary", body: "Anna already logged Brush teeth for Mary ✓" });
    expect(feedCopy(item({ kind: "sync_dropped", habit_title: "Read", payload: { tapped_on: "2026-10-05" } })).body)
      .toBe("A check-in from Mon couldn't count: it was more than 3 days old when it synced.");
    expect(feedCopy(item({ kind: "sync_dropped", habit_title: "Read", payload: {} })).body)
      .toBe("A check-in from earlier couldn't count: it was more than 3 days old when it synced.");
    expect(feedCopy(item({ kind: "undo_dropped", habit_title: "Gym", payload: { reason: "approved" } })).body)
      .toBe("Couldn't undo Gym, it was already approved.");
    expect(feedCopy(item({ kind: "undo_dropped", habit_title: "Gym", payload: { reason: "period_closed" } })).body)
      .toBe("Couldn't undo Gym, its time has passed.");
  });
});

describe("M5 kinds", () => {
  it("knows the M5 rows", () => {
    for (const k of ["level_up", "badge_unlocked", "streak_milestone", "rest_day_used", "weekly_recap", "monthly_recap"]) expect(isFeedKind(k)).toBe(true);
  });
  it("leaves the family recap row out: the Inbox card shows it, the row only pushes", () => {
    expect(isFeedKind("family_recap")).toBe(false);
  });
});
