import { describe, expect, it } from "vitest";
import { tEn } from "@/lib/i18n/test-t";
import { FEED_KINDS, NUDGE_KINDS, feedCopy, type FeedItem } from "@/lib/feed-copy";
import { BANNED_PATTERNS, BANNED_WORDS } from "@/lib/notification-copy";

const item = (o: Partial<FeedItem>): FeedItem => ({
  id: "n", kind: "group_check_in", created_at: "2026-10-05T18:00:00Z", read_at: null, seen_at: null,
  group_id: "g", group_name: "Family", habit_id: "h", habit_title: "Read 20 min", habit_emoji: "📚", check_in_id: "c",
  actor_name: "Anna", actor_avatar_emoji: null, actor_avatar_color: null, subject_id: null, subject_name: null, subject_avatar_emoji: null, payload: {}, ...o,
});

describe("feedCopy", () => {
  it("follows the copy sheet", () => {
    expect(feedCopy(tEn, "en", item({}))).toMatchObject({ title: "Family", body: "\u2068Anna\u2069 checked in: \u2068Read 20 min\u2069" });
    expect(feedCopy(tEn, "en", item({ kind: "everyone_done", habit_title: "Family dinner" })).body).toBe("Everyone did it: \u2068Family dinner\u2069 ✓");
    expect(feedCopy(tEn, "en", item({ kind: "approval_needed", habit_title: "Gym" })).body).toBe("\u2068Anna\u2069 did \u2068Gym\u2069. Approve?");
    // Once decided (the database stamps the outcome and marks the row read), the row reads the outcome.
    expect(feedCopy(tEn, "en", item({ kind: "approval_needed", habit_title: "Gym", payload: { outcome: "approved" } }))).toEqual({
      title: "Family", body: "\u2068Anna\u2069 did \u2068Gym\u2069: approved", href: "/habits/h" });
    expect(feedCopy(tEn, "en", item({ kind: "approval_needed", habit_title: "Gym", payload: { outcome: "rejected" } })).body).toBe("\u2068Anna\u2069 did \u2068Gym\u2069: not approved");
    expect(feedCopy(tEn, "en", item({ kind: "approval_needed", habit_title: "Gym", payload: { outcome: "expired" } })).body).toBe("\u2068Anna\u2069 did \u2068Gym\u2069: not reviewed in time");
    expect(feedCopy(tEn, "en", item({ kind: "approval_expiring", habit_title: "Gym", payload: { outcome: "approved" } })).body).toBe("\u2068Anna\u2069 did \u2068Gym\u2069: approved");
    expect(feedCopy(tEn, "en", item({ kind: "approval_needed", habit_title: "Gym", payload: { outcome: "pending" } })).body).toBe("\u2068Anna\u2069 did \u2068Gym\u2069. Approve?");
    expect(feedCopy(tEn, "en", item({ kind: "check_in_rejected", habit_title: "Gym", actor_name: "Dan" }))).toMatchObject({
      title: "Gym", body: "\u2068Dan\u2069 didn't approve your check-in. You can check in again today." });
    expect(feedCopy(tEn, "en", item({ kind: "check_in_rejected", habit_title: "Gym", actor_name: "Dan", payload: { period: "week" } })).body)
      .toBe("\u2068Dan\u2069 didn't approve your check-in. You can check in again this week.");
    expect(feedCopy(tEn, "en", item({ kind: "group_habit_created", habit_title: "Family dinner", payload: { period: "week", target_count: 1 } })).body)
      .toBe("\u2068Anna\u2069 added \u2068Family dinner\u2069, weekly.");
    expect(feedCopy(tEn, "en", item({ kind: "group_habit_created", habit_title: "Gym", payload: { period: "week", target_count: 3 } })).body)
      .toBe("\u2068Anna\u2069 added \u2068Gym\u2069.");
    expect(feedCopy(tEn, "en", item({ kind: "group_habit_paused", habit_title: "Family dinner", payload: { ends_on: "2026-10-12" } })).body)
      .toBe("\u2068Family dinner\u2069 is paused until Mon 12 Oct.");
    expect(feedCopy(tEn, "en", item({ kind: "group_habit_created", habit_title: "Family dinner" })).body).toBe("\u2068Anna\u2069 added \u2068Family dinner\u2069.");
    expect(feedCopy(tEn, "en", item({ kind: "group_streak_ended", habit_title: "Family dinner", payload: { streak: 6, period: "week" } })).body)
      .toBe("\u2068Family dinner\u2069 streak ended at 6 weeks. Start a new one this week.");
    expect(feedCopy(tEn, "en", item({ kind: "member_joined", actor_name: "Grandma" })).body).toBe("\u2068Grandma\u2069 joined \u2068Family\u2069 👋");
    expect(feedCopy(tEn, "en", item({ kind: "nudge", habit_title: "Run", payload: { kind: "you_got_this" } }))).toMatchObject({
      title: "Run", body: "\u2068Anna\u2069: You've got this: \u2068Run\u2069" });
    expect(feedCopy(tEn, "en", item({ kind: "nudge", habit_title: "Read 20 min", payload: { kind: "gentle_reminder" } })).body)
      .toBe("\u2068Anna\u2069: Gentle reminder: \u2068Read 20 min\u2069");
    // Copy sheet + owner decision (2026-09-29): "Thinking of you" asks about today.
    expect(feedCopy(tEn, "en", item({ kind: "nudge", habit_title: "Family dinner", payload: { kind: "thinking_of_you" } })).body)
      .toBe("\u2068Anna\u2069: Thinking of you. \u2068Family dinner\u2069 today?");
    expect(feedCopy(tEn, "en", item({ kind: "kid_check_in", actor_name: null, subject_name: "Mary", habit_title: "Brush teeth" })).body)
      .toBe("\u2068Mary\u2069 did it: \u2068Brush teeth\u2069 ⭐");
    expect(feedCopy(tEn, "en", item({ kind: "kid_check_in", actor_name: "Dan", subject_name: "Mary", habit_title: "Brush teeth" })).body)
      .toBe("\u2068Dan\u2069 logged \u2068Brush teeth\u2069 for \u2068Mary\u2069 ⭐");
    expect(feedCopy(tEn, "en", item({ kind: "kid_goal_reached", subject_name: "Mary", payload: { title: "Trip to the park", emoji: "🛝" } })))
      .toMatchObject({ title: "Mary", body: "\u2068Mary\u2069 reached a goal: \u2068Trip to the park\u2069 🛝" });
    expect(feedCopy(tEn, "en", item({ kind: "kid_garden_full", subject_name: "Mary" })).body).toBe("\u2068Mary\u2069's garden is in full bloom this week 🌷");
    expect(feedCopy(tEn, "en", item({ kind: "kid_streak", subject_name: "Mary", habit_title: "Brush teeth", payload: { streak: 7 } })).body)
      .toBe("\u2068Mary\u2069: 7 days in a row: \u2068Brush teeth\u2069 🔥");
  });

  it("never names anyone in group streak and everyone-done messages", () => {
    for (const kind of ["everyone_done", "group_streak_ended", "group_milestone"] as const) {
      expect(feedCopy(tEn, "en", item({ kind, payload: { streak: 3, period: "day" } })).body).not.toContain("Anna");
    }
  });

  // Every kind in FEED_KINDS × payloads that take different branches, so a new kind is checked
  // without anyone remembering to list it here.
  const PAYLOADS: Record<string, unknown>[] = [
    {},
    { streak: 1, period: "day" },
    { streak: 3, period: "week", best: 5 },
    { streak: 6, period: "month", best: 6 },
    { period: "week", target_count: 1 },
    { period: "month", target_count: 3 },
    { removed: true },
    { role: "admin" },
    { role: "member" },
    ...NUDGE_KINDS.map((k) => ({ kind: k.kind })),
    { reason: "approved" },
    { reason: "period_closed", tapped_on: "2026-10-05" },
    { todo: [{ title: "Read", done: 1, target: 3 }], at_risk: [{ title: "Gym", done: 1, target: 3, period: "week", days_left: 1 }] },
    { title: "Park", emoji: "🛝" },
    { ends_on: "2026-10-12" },
    { level: 6 },
    { code: "bookworm", name: "Bookworm" },
    { streak: 30, period: "day", back: true },
    { streak: 14, period: "week" },
    { kind: "week", done: 4, possible: 7, longest: null },
  ];
  const cases = FEED_KINDS.flatMap((kind) => PAYLOADS.map((payload): [FeedItem["kind"], Record<string, unknown>] => [kind, payload]));
  const emoji = /\p{Extended_Pictographic}/gu;
  it.each(cases)("%s with %j: no banned words, at most one emoji", (kind, payload) => {
    const { title, body } = feedCopy(tEn, "en", item({ kind, subject_name: "Mary", payload }));
    const text = `${title} ${body}`.toLowerCase();
    for (const w of BANNED_WORDS) expect(text).not.toContain(w);
    for (const re of BANNED_PATTERNS) expect(text).not.toMatch(re);
    expect((body.match(emoji) ?? []).length).toBeLessThanOrEqual(1);
  });
});

describe("M5 feed lines", () => {
  it("level-ups open Profile, badges open Achievements", () => {
    expect(feedCopy(tEn, "en", item({ kind: "level_up", habit_id: null, habit_title: null, group_name: null, payload: { level: 6 } })))
      .toEqual({ title: "Level 6", body: "Sprout 🌿", href: "/profile" });
    expect(feedCopy(tEn, "en", item({ kind: "badge_unlocked", habit_id: null, payload: { code: "bookworm", name: "Bookworm" } })))
      .toEqual({ title: "Unlocked", body: "Bookworm", href: "/profile/achievements" });
  });
  it("a personal milestone, a rest day and the recaps", () => {
    expect(feedCopy(tEn, "en", item({ kind: "streak_milestone", group_name: null, payload: { streak: 30, period: "day", back: false } })))
      .toEqual({ title: "Read 20 min", body: "🔥 \u2068Read 20 min\u2069: 30 days in a row", href: "/habits/h" });
    expect(feedCopy(tEn, "en", item({ kind: "rest_day_used", group_name: null, payload: { streak: 3, period: "week" } })).body)
      .toBe("Rest week used. Your 3-week streak is safe 💤");
    expect(feedCopy(tEn, "en", item({ kind: "weekly_recap", habit_id: null, payload: { kind: "week", done: 4, possible: 7, longest: null } })))
      .toEqual({ title: "Your week", body: "4 of 7 check-ins last week.", href: "/progress/recaps" });
    expect(feedCopy(tEn, "en", item({ kind: "monthly_recap", habit_id: null, payload: { kind: "month", start: "2026-09-01", done: 1, possible: 1 } })).body)
      .toBe("1 of 1 check-in in September.");
  });
  it("a malformed recap still reads as a gentle line", () => {
    expect(feedCopy(tEn, "en", item({ kind: "weekly_recap", habit_id: null, payload: {} })).body).toBe("Your recap is ready.");
  });
});

describe("plain feed lines", () => {
  const I = (s: string) => `⁨${s}⁩`;
  it("reads each kind from the catalog", () => {
    expect(feedCopy(tEn, "en", item({ kind: "check_in_approved", actor_name: "Dan" })).body).toBe(`${I("Dan")} approved your check-in.`);
    expect(feedCopy(tEn, "en", item({ kind: "group_habit_archived" })).body).toBe(`${I("Read 20 min")} was archived.`);
    expect(feedCopy(tEn, "en", item({ kind: "member_paused" })).body).toBe(`${I("Anna")} paused ${I("Read 20 min")} for a while.`);
    expect(feedCopy(tEn, "en", item({ kind: "member_left" })).body).toBe(`${I("Anna")} left ${I("Family")}.`);
    expect(feedCopy(tEn, "en", item({ kind: "member_left", payload: { removed: true } })).body).toBe(`${I("Anna")} was removed from ${I("Family")}.`);
    expect(feedCopy(tEn, "en", item({ kind: "role_changed", payload: { role: "admin" } })).body).toBe(`You're now an admin of ${I("Family")}.`);
    expect(feedCopy(tEn, "en", item({ kind: "role_changed", payload: { role: "member" } })).body).toBe(`You're now a member of ${I("Family")}.`);
    expect(feedCopy(tEn, "en", item({ kind: "cheer" })).body).toBe(`${I("Anna")} cheered your check-in ❤️`);
    expect(feedCopy(tEn, "en", item({ kind: "group_streak_ended", payload: { streak: 2, period: "day" } })).body)
      .toBe(`${I("Read 20 min")} streak ended at 2 days. Start a new one today.`);
    expect(feedCopy(tEn, "en", item({ kind: "sync_dropped", payload: { tapped_on: "2026-10-05" } })).body).toContain("Mon");
    expect(feedCopy(tEn, "en", item({ kind: "sync_dropped", payload: {} })).body).toContain("earlier");
  });
  it("falls back to gentle names", () => {
    const body = feedCopy(tEn, "en", item({ kind: "member_joined", group_name: null, actor_name: null })).body;
    expect(body).toBe(`${I("Someone")} joined ${I("Your group")} 👋`);
  });
});
