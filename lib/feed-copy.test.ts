import { describe, expect, it } from "vitest";
import { feedCopy, type FeedItem } from "@/lib/feed-copy";
import { BANNED_PATTERNS, BANNED_WORDS } from "@/lib/notification-copy";

const item = (o: Partial<FeedItem>): FeedItem => ({
  id: "n", kind: "group_check_in", created_at: "2026-10-05T18:00:00Z", read_at: null, seen_at: null,
  group_id: "g", group_name: "Family", habit_id: "h", habit_title: "Read 20 min", habit_emoji: "📚", check_in_id: "c",
  actor_name: "Anna", subject_id: null, subject_name: null, subject_avatar_emoji: null, payload: {}, ...o,
});

describe("feedCopy", () => {
  it("follows the copy sheet", () => {
    expect(feedCopy(item({}))).toMatchObject({ title: "Family", body: "Anna checked in: Read 20 min" });
    expect(feedCopy(item({ kind: "everyone_done", habit_title: "Family dinner" })).body).toBe("Everyone did it: Family dinner ✓");
    expect(feedCopy(item({ kind: "approval_needed", habit_title: "Gym" })).body).toBe("Anna did Gym. Approve?");
    expect(feedCopy(item({ kind: "check_in_rejected", habit_title: "Gym", actor_name: "Dan" }))).toMatchObject({
      title: "Gym", body: "Dan didn't approve your check-in. You can check in again today." });
    expect(feedCopy(item({ kind: "check_in_rejected", habit_title: "Gym", actor_name: "Dan", payload: { period: "week" } })).body)
      .toBe("Dan didn't approve your check-in. You can check in again this week.");
    expect(feedCopy(item({ kind: "group_habit_created", habit_title: "Family dinner", payload: { period: "week", target_count: 1 } })).body)
      .toBe("Anna added Family dinner, weekly.");
    expect(feedCopy(item({ kind: "group_habit_created", habit_title: "Gym", payload: { period: "week", target_count: 3 } })).body)
      .toBe("Anna added Gym.");
    expect(feedCopy(item({ kind: "group_habit_paused", habit_title: "Family dinner", payload: { ends_on: "2026-10-12" } })).body)
      .toBe("Family dinner is paused until Mon 12 Oct.");
    expect(feedCopy(item({ kind: "group_habit_created", habit_title: "Family dinner" })).body).toBe("Anna added Family dinner.");
    expect(feedCopy(item({ kind: "group_streak_ended", habit_title: "Family dinner", payload: { streak: 6, period: "week" } })).body)
      .toBe("Family dinner streak ended at 6 weeks. Start a new one this week.");
    expect(feedCopy(item({ kind: "member_joined", actor_name: "Grandma" })).body).toBe("Grandma joined Family 👋");
    expect(feedCopy(item({ kind: "nudge", habit_title: "Run", payload: { kind: "you_got_this" } }))).toMatchObject({
      title: "Run", body: "Anna: You've got this: Run" });
    expect(feedCopy(item({ kind: "nudge", habit_title: "Read 20 min", payload: { kind: "gentle_reminder" } })).body)
      .toBe("Anna: Gentle reminder: Read 20 min");
    // Copy sheet + owner decision (2026-09-29): "Thinking of you" asks about today.
    expect(feedCopy(item({ kind: "nudge", habit_title: "Family dinner", payload: { kind: "thinking_of_you" } })).body)
      .toBe("Anna: Thinking of you. Family dinner today?");
    expect(feedCopy(item({ kind: "kid_check_in", actor_name: null, subject_name: "Mary", habit_title: "Brush teeth" })).body)
      .toBe("Mary did it: Brush teeth ⭐");
    expect(feedCopy(item({ kind: "kid_check_in", actor_name: "Dan", subject_name: "Mary", habit_title: "Brush teeth" })).body)
      .toBe("Dan logged Brush teeth for Mary ⭐");
    expect(feedCopy(item({ kind: "kid_goal_reached", subject_name: "Mary", payload: { title: "Trip to the park", emoji: "🛝" } })))
      .toMatchObject({ title: "Mary", body: "Mary reached a goal: Trip to the park 🛝" });
    expect(feedCopy(item({ kind: "kid_garden_full", subject_name: "Mary" })).body).toBe("Mary's garden is in full bloom this week 🌷");
    expect(feedCopy(item({ kind: "kid_streak", subject_name: "Mary", habit_title: "Brush teeth", payload: { streak: 7 } })).body)
      .toBe("Mary: 7 days in a row: Brush teeth 🔥");
  });

  it("never names anyone in group streak and everyone-done messages", () => {
    for (const kind of ["everyone_done", "group_streak_ended", "group_milestone"] as const) {
      expect(feedCopy(item({ kind, payload: { streak: 3, period: "day" } })).body).not.toContain("Anna");
    }
  });

  it("uses no banned words and at most one emoji, for every kind", () => {
    const kinds: FeedItem["kind"][] = ["group_check_in", "approval_needed", "check_in_approved", "check_in_rejected", "everyone_done",
      "group_streak_ended", "group_milestone", "group_habit_created", "group_habit_paused", "group_habit_resumed", "group_habit_archived",
      "member_paused", "member_joined", "member_left", "role_changed", "nudge", "cheer", "kid_check_in", "kid_streak", "kid_goal_reached", "kid_garden_full",
      "daily_summary", "habit_reminder", "approval_expiring"];
    const emoji = /\p{Extended_Pictographic}/gu;
    for (const kind of kinds) {
      const { title, body } = feedCopy(item({ kind, subject_name: "Mary", payload: { streak: 3, period: "day", kind: "thinking_of_you", role: "admin", title: "Park", emoji: "🛝" } }));
      const text = `${title} ${body}`.toLowerCase();
      for (const w of BANNED_WORDS) expect(text).not.toContain(w);
      for (const re of BANNED_PATTERNS) expect(text).not.toMatch(re);
      expect((body.match(emoji) ?? []).length).toBeLessThanOrEqual(1);
    }
  });
});
