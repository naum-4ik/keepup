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
});
