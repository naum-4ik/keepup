// lib/notification-copy.test.ts
import { describe, expect, it } from "vitest";
import { tEn } from "@/lib/i18n/test-t";
import * as copy from "./notification-copy";
import { levelName } from "./levels";
import { BANNED_PATTERNS, BANNED_WORDS, type Copy } from "./notification-copy";

const EMOJI = /\p{Extended_Pictographic}/gu;

// Every builder with realistic inputs: the voice rules below run over all of them.
const samples: Copy[] = [
  copy.dailySummary(tEn, { todo: [{ title: "Water", done: 5, target: 8 }, { title: "Read" }], atRisk: [{ title: "Run", done: 1, target: 3, period: "week", daysLeft: 2 }] })!,
  copy.habitReminder(tEn, "Vitamins"),
  copy.groupCheckIn(tEn, "en", "Family", ["Anna", "Dan"], "Read 20 min")!,
  copy.groupCheckIn(tEn, "en", "Family", ["Anna", "Dan", "Grandma"], "Read 20 min")!,
  copy.groupCheckIn(tEn, "en", "Family", ["Anna", "Dan", "Grandma", "Mary"], "Read 20 min")!,
  copy.everyoneDidIt(tEn, "Family", "Family dinner"),
  copy.approvalNeeded(tEn, "Family", [{ author: "Anna", habit: "Gym" }])!,
  copy.approvalNeeded(tEn, "Family", [{ author: "Anna", habit: "Gym" }, { author: "Dan", habit: "Read" }, { author: "Dan", habit: "Run" }])!,
  copy.approvalExpiring(tEn, "Family", "Anna", "Gym"),
  copy.approvalDecided(tEn, "Family", "Anna", "Gym", "approved"),
  copy.approvalDecided(tEn, "Family", "Anna", "Gym", "rejected"),
  copy.approvalDecided(tEn, "Family", "Anna", "Gym", "expired"),
  copy.checkInNotApproved(tEn, "Gym", "Dan", "day"),
  copy.nudge(tEn, "thinking_of_you", "Anna", "Family dinner"),
  copy.nudge(tEn, "you_got_this", "Anna", "Run"),
  copy.nudge(tEn, "gentle_reminder", "Anna", "Read 20 min"),
  copy.groupStreakEnded(tEn, "Family", "Family dinner", 6, "week")!,
  copy.groupStreakBack(tEn, "Family", "Family dinner"),
  copy.groupHabitCreated(tEn, "Family", "Anna", "Family dinner", "weekly"),
  copy.groupHabitPaused(tEn, "Family", "Family dinner", "Mon 12 Oct"),
  copy.groupHabitPaused(tEn, "Family", "Family dinner", null),
  copy.groupHabitResumed(tEn, "Family", "Family dinner"),
  copy.memberJoined(tEn, "Family", "Grandma"),
  copy.restDayUsed(tEn, "Read", 14, "day"),
  copy.weeklyRecap(tEn, { done: 18, possible: 21, longest: { habit: "Read 20 min", length: 12 } })!,
  copy.weeklyRecap(tEn, { done: 4, possible: 7, longest: null })!,
  copy.levelUp(tEn, 6, "Sprout"),
  copy.badgeUnlocked(tEn, "Bookworm"),
  copy.kidTreatGoal(tEn, "Mary", "Trip to the park", "🛝"),
  copy.kidFullGarden(tEn, "Mary"),
  copy.kidStreak(tEn, "Mary", 7, "Brush teeth"),
  copy.kidTreatGoal(tEn, "Mary", "Trip to the park", ""),
  copy.alreadyLogged(tEn, "Mary", "Anna", "Brush teeth"),
  copy.alreadyLogged(tEn, "Mary", null, "Brush teeth"),
  copy.syncDropped(tEn, "Read", "Mon"),
  copy.privateStreakEnded(tEn, "Read", 12, "day", 21),
  copy.privateStreakEnded(tEn, "Read", 3, "week", 3),
  copy.undoDropped(tEn, "Gym", "approved"),
  copy.undoDropped(tEn, "Gym", "period_closed"),
  copy.groupMilestone(tEn, "Family", "Family dinner", 7, "day"),
  copy.groupMilestone(tEn, "Family", "Family dinner", 1, "week"),
  { title: "milestone", body: copy.milestoneCard(tEn, "Read 20 min", 30, "day") },
  { title: "milestone", body: copy.milestoneCard(tEn, "Family dinner", 1, "week") },
  copy.streakMilestone(tEn, "Read 20 min", 1, "day", false),
  copy.streakMilestone(tEn, "Read 20 min", 1, "day", true),
  copy.streakMilestone(tEn, "Read 20 min", 2, "day", false),
  copy.streakMilestone(tEn, "Read 20 min", 2, "day", true),
  copy.streakMilestone(tEn, "Read 20 min", 30, "day", false),
  copy.streakMilestone(tEn, "Read 20 min", 30, "day", true),
  copy.streakMilestone(tEn, "Gym", 4, "week", true),
  copy.monthlyRecap(tEn, { month: "September", done: 70, possible: 84, longest: { habit: "Read 20 min", length: 21 } })!,
  copy.familyRecap(tEn, "Family", 34, { habit: "Family dinner", length: 5, period: "week" })!,
  copy.familyRecap(tEn, "Family", 1, null)!,
];

describe("voice rules over every notification", () => {
  it.each(samples.map((s) => [s.title, s]))("%s: no banned words", (_t, s) => {
    const text = `${s.title} ${s.body}`.toLowerCase();
    for (const word of BANNED_WORDS) expect(text).not.toContain(word);
    for (const re of BANNED_PATTERNS) expect(text).not.toMatch(re);
  });

  it.each(samples.map((s) => [s.title, s]))("%s: at most one emoji", (_t, s) => {
    expect(`${s.title} ${s.body}`.match(EMOJI)?.length ?? 0).toBeLessThanOrEqual(1);
  });

  it.each(samples.map((s) => [s.title, s]))("%s: a one-line body", (_t, s) => {
    expect(s.body).not.toContain("\n");
    expect(s.title.length).toBeGreaterThan(0);
  });

  it("kid copy takes the child's gender; English reads the same for each", () => {
    for (const g of ["boy", "girl", "other"] as const) {
      expect(copy.kidStreak(tEn, "Mary", 7, "Brush teeth", g).body).toBe(copy.kidStreak(tEn, "Mary", 7, "Brush teeth").body);
      expect(copy.kidFullGarden(tEn, "Mary", g).body).toBe(copy.kidFullGarden(tEn, "Mary").body);
      expect(copy.kidTreatGoal(tEn, "Mary", "Park", "🛝", g).body).toBe(copy.kidTreatGoal(tEn, "Mary", "Park", "🛝").body);
    }
  });

  it("kid copy never assumes a gender", () => {
    const kid = [copy.kidTreatGoal(tEn, "Mary", "Trip to the park", "🛝"), copy.kidFullGarden(tEn, "Mary"), copy.kidStreak(tEn, "Mary", 7, "Brush teeth")];
    for (const s of kid) expect(s.body).not.toMatch(/\b(her|his|she|he)\b/i);
  });
});

describe("never names who missed", () => {
  it("group outcomes carry no member names", () => {
    const names = ["Anna", "Dan", "Grandma", "Mary"];
    const outcomes = [copy.everyoneDidIt(tEn, "Family", "Family dinner"), copy.groupStreakEnded(tEn, "Family", "Family dinner", 6, "week")!, copy.groupStreakBack(tEn, "Family", "Family dinner")];
    for (const o of outcomes) for (const n of names) expect(`${o.title} ${o.body}`).not.toContain(n);
  });
});

describe("banned patterns", () => {
  it("catches any 'only N left'", () => {
    expect(BANNED_PATTERNS.some((re) => re.test("Only 2 left!"))).toBe(true);
  });
});

describe("edge cases", () => {
  it("empty inputs return null so callers skip", () => {
    expect(copy.approvalNeeded(tEn, "Family", [])).toBeNull();
    expect(copy.groupCheckIn(tEn, "en", "Family", [], "Gym")).toBeNull();
    expect(copy.weeklyRecap(tEn, { done: 0, possible: 0, longest: null })).toBeNull();
  });

  it("pluralises the recap and trims an empty goal emoji", () => {
    expect(copy.weeklyRecap(tEn, { done: 1, possible: 1, longest: null })?.body).toBe("1 of 1 check-in last week.");
    expect(copy.kidTreatGoal(tEn, "Mary", "Trip to the park", "").body).toBe("\u2068Mary\u2069 reached a goal: \u2068Trip to the park\u2069");
  });

  it("exact bodies", () => {
    expect(copy.habitReminder(tEn, "Vitamins")).toEqual({ title: "Vitamins", body: "Time for \u2068Vitamins\u2069." });
    expect(copy.everyoneDidIt(tEn, "Family", "Family dinner")).toEqual({ title: "Family", body: "Everyone did it: \u2068Family dinner\u2069 ✓" });
    expect(copy.approvalExpiring(tEn, "Family", "Anna", "Gym")).toEqual({ title: "Family", body: "\u2068Anna\u2069's \u2068Gym\u2069 check-in needs a yes within 2 hours" });
    expect(copy.approvalDecided(tEn, "Family", "Anna", "Gym", "approved")).toEqual({ title: "Family", body: "\u2068Anna\u2069 did \u2068Gym\u2069: approved" });
    expect(copy.approvalDecided(tEn, "Family", "Anna", "Gym", "rejected")).toEqual({ title: "Family", body: "\u2068Anna\u2069 did \u2068Gym\u2069: not approved" });
    expect(copy.approvalDecided(tEn, "Family", "Anna", "Gym", "expired")).toEqual({ title: "Family", body: "\u2068Anna\u2069 did \u2068Gym\u2069: not reviewed in time" });
    expect(copy.groupCheckIn(tEn, "en", "Family", ["Anna", "Dan", "Grandma"], "Read")?.body).toBe("\u2068Anna\u2069, \u2068Dan\u2069 and \u2068Grandma\u2069 checked in: \u2068Read\u2069");
    expect(copy.groupCheckIn(tEn, "en", "Family", ["Anna", "Dan", "Grandma", "Mary"], "Read")?.body).toBe("\u2068Anna\u2069, \u2068Dan\u2069 and 2 others checked in: \u2068Read\u2069");
  });
});

describe("joinNames", () => {
  it("joins one to five names", () => {
    expect(copy.joinNames(tEn, "en", ["Anna"])).toBe("Anna");
    expect(copy.joinNames(tEn, "en", ["Anna", "Dan"])).toBe("Anna and Dan");
    expect(copy.joinNames(tEn, "en", ["Anna", "Dan", "Grandma"])).toBe("Anna, Dan and Grandma");
    expect(copy.joinNames(tEn, "en", ["Anna", "Dan", "Grandma", "Mary", "Sam"])).toBe("Anna, Dan and 3 others");
  });
});

describe("copy sheet rows", () => {
  it("daily summary lists what's left and at-risk habits", () => {
    expect(copy.dailySummary(tEn, { todo: [{ title: "Water", done: 5, target: 8 }, { title: "Read" }], atRisk: [] })).toEqual({
      title: "Today",
      body: "Still to do: \u2068Water\u2069 5/8, \u2068Read\u2069 🌱",
    });
    expect(copy.dailySummary(tEn, { todo: [], atRisk: [{ title: "Run", done: 1, target: 3, period: "week", daysLeft: 2 }] })?.body).toBe(
      "Still to do: \u2068Run\u2069: 1 of 3 this week, 2 days left 🌱",
    );
    expect(copy.dailySummary(tEn, { todo: [{ title: "Read" }], atRisk: [{ title: "Run", done: 2, target: 3, period: "month", daysLeft: 1 }] })?.body).toBe(
      "Still to do: \u2068Read\u2069 · \u2068Run\u2069: 2 of 3 this month, 1 day left 🌱",
    );
  });

  it("no summary when nothing is left", () => {
    expect(copy.dailySummary(tEn, { todo: [], atRisk: [] })).toBeNull();
  });

  it("group check-in coalesces names", () => {
    expect(copy.groupCheckIn(tEn, "en", "Family", ["Anna", "Dan"], "Read 20 min")).toEqual({ title: "Family", body: "\u2068Anna\u2069 and \u2068Dan\u2069 checked in: \u2068Read 20 min\u2069" });
  });

  it("approval: one names the person, several are counted", () => {
    expect(copy.approvalNeeded(tEn, "Family", [{ author: "Anna", habit: "Gym" }])?.body).toBe("\u2068Anna\u2069 did \u2068Gym\u2069. Approve?");
    expect(copy.approvalNeeded(tEn, "Family", [{ author: "Anna", habit: "Gym" }, { author: "Dan", habit: "Read" }])?.body).toBe("2 check-ins waiting for you");
  });

  it("not approved says when you can try again", () => {
    expect(copy.checkInNotApproved(tEn, "Gym", "Dan", "day")).toEqual({ title: "Gym", body: "\u2068Dan\u2069 didn't approve your check-in. You can check in again today." });
    expect(copy.checkInNotApproved(tEn, "Gym", "Dan", "week").body).toBe("\u2068Dan\u2069 didn't approve your check-in. You can check in again this week.");
  });

  it("nudges are the three presets", () => {
    expect(copy.nudge(tEn, "thinking_of_you", "Anna", "Family dinner")).toEqual({ title: "Family dinner", body: "\u2068Anna\u2069: Thinking of you. \u2068Family dinner\u2069 today?" });
    expect(copy.nudge(tEn, "you_got_this", "Anna", "Run").body).toBe("\u2068Anna\u2069: You've got this: \u2068Run\u2069");
    expect(copy.nudge(tEn, "gentle_reminder", "Anna", "Read 20 min").body).toBe("\u2068Anna\u2069: Gentle reminder: \u2068Read 20 min\u2069");
  });

  it("group streak ended only from 3, never names anyone", () => {
    expect(copy.groupStreakEnded(tEn, "Family", "Family dinner", 2, "week")).toBeNull();
    expect(copy.groupStreakEnded(tEn, "Family", "Family dinner", 6, "week")).toEqual({
      title: "Family",
      body: "\u2068Family dinner\u2069 streak ended at 6 weeks. Start a new one this week.",
    });
    expect(copy.groupStreakEnded(tEn, "Family", "Walk together", 3, "day")?.body).toBe("\u2068Walk together\u2069 streak ended at 3 days. Start a new one today.");
  });

  it("streak back after a late check-in", () => {
    expect(copy.groupStreakBack(tEn, "Family", "Family dinner").body).toBe("A late check-in arrived. \u2068Family dinner\u2069 streak is back 🔥");
  });

  it("group habit lifecycle", () => {
    expect(copy.groupHabitCreated(tEn, "Family", "Anna", "Family dinner", "weekly").body).toBe("\u2068Anna\u2069 added \u2068Family dinner\u2069, weekly.");
    expect(copy.groupHabitPaused(tEn, "Family", "Family dinner", "Mon 12 Oct").body).toBe("\u2068Family dinner\u2069 is paused until Mon 12 Oct.");
    expect(copy.groupHabitPaused(tEn, "Family", "Family dinner", null).body).toBe("\u2068Family dinner\u2069 is paused.");
    expect(copy.groupHabitResumed(tEn, "Family", "Family dinner").body).toBe("\u2068Family dinner\u2069 is back.");
    expect(copy.memberJoined(tEn, "Family", "Grandma")).toEqual({ title: "Family", body: "\u2068Grandma\u2069 joined \u2068Family\u2069 👋" });
  });

  it("rest day, recap, level, badge, milestone", () => {
    expect(copy.restDayUsed(tEn, "Read", 14, "day")).toEqual({ title: "Read", body: "Rest day used. Your 14-day streak is safe 💤" });
    expect(copy.restDayUsed(tEn, "Run", 8, "week").body).toBe("Rest week used. Your 8-week streak is safe 💤");
    expect(copy.weeklyRecap(tEn, { done: 18, possible: 21, longest: { habit: "Read 20 min", length: 12 } })).toEqual({
      title: "Your week",
      body: "18 of 21 check-ins last week. Longest streak: \u2068Read 20 min\u2069 🔥 12 days",
    });
    expect(copy.weeklyRecap(tEn, { done: 4, possible: 7, longest: null })?.body).toBe("4 of 7 check-ins last week.");
    expect(copy.levelUp(tEn, 6, "Sprout")).toEqual({ title: "Level 6", body: "Sprout 🌿" });
    expect(copy.badgeUnlocked(tEn, "Bookworm")).toEqual({ title: "Unlocked", body: "Bookworm" });
    expect(copy.milestoneCard(tEn, "Read 20 min", 30, "day")).toBe("🔥 \u2068Read 20 min\u2069: 30 days in a row");
    expect(copy.milestoneCard(tEn, "Family dinner", 1, "week")).toBe("🔥 \u2068Family dinner\u2069: 1 week in a row");
    expect(copy.groupMilestone(tEn, "Family", "Family dinner", 7, "day")).toEqual({ title: "Family", body: "🔥 \u2068Family dinner\u2069: 7 days in a row, together" });
    expect(copy.groupMilestone(tEn, "Family", "Family dinner", 1, "week").body).toBe("🔥 \u2068Family dinner\u2069: 1 week in a row, together");
  });

  it("kid special moments", () => {
    expect(copy.kidTreatGoal(tEn, "Mary", "Trip to the park", "🛝")).toEqual({ title: "Mary", body: "\u2068Mary\u2069 reached a goal: \u2068Trip to the park\u2069 🛝" });
    expect(copy.kidFullGarden(tEn, "Mary").body).toBe("\u2068Mary\u2069's garden is in full bloom this week 🌷");
    expect(copy.kidStreak(tEn, "Mary", 7, "Brush teeth").body).toBe("\u2068Mary\u2069: 7 days in a row: \u2068Brush teeth\u2069 🔥");
  });
});

describe("M5 copy", () => {
  it("milestones: first time, early days, and coming back after a break", () => {
    expect(copy.streakMilestone(tEn, "Read", 1, "day", false)).toEqual({ title: "Read", body: "First day of \u2068Read\u2069 ✨" });
    expect(copy.streakMilestone(tEn, "Gym", 1, "week", false).body).toBe("First week of \u2068Gym\u2069 ✨");
    expect(copy.streakMilestone(tEn, "Read", 1, "day", true).body).toBe("A fresh start: \u2068Read\u2069 ✨");
    expect(copy.streakMilestone(tEn, "Read", 2, "day", false).body).toBe("Day 2 in a row. Nice start 🌱");
    expect(copy.streakMilestone(tEn, "Read", 2, "day", true).body).toBe("Day 2 in a row again 🌱");
    expect(copy.streakMilestone(tEn, "Read", 30, "day", false).body).toBe("🔥 \u2068Read\u2069: 30 days in a row");
    expect(copy.streakMilestone(tEn, "Read", 30, "day", true).body).toBe("Back to 30 days of \u2068Read\u2069 🔥");
    expect(copy.streakMilestone(tEn, "Gym", 2, "week", false).body).toBe("🔥 \u2068Gym\u2069: 2 weeks in a row");
  });
  it("the monthly recap names the month and stays quiet about misses", () => {
    expect(copy.monthlyRecap(tEn, { month: "September", done: 70, possible: 84, longest: { habit: "Read", length: 21 } })).toEqual({
      title: "Your month", body: "70 of 84 check-ins in September. Longest streak: \u2068Read\u2069 🔥 21 days" });
    expect(copy.monthlyRecap(tEn, { month: "September", done: 0, possible: 0, longest: null })).toBeNull();
  });
  it("the family recap matches the Inbox card's words", () => {
    expect(copy.familyRecap(tEn, "Family", 34, { habit: "Family dinner", length: 5, period: "week" })).toEqual({
      title: "Family", body: "Together last week: 34 check-ins · \u2068Family dinner\u2069 5 weeks 🔥" });
    expect(copy.familyRecap(tEn, "Family", 0, null)).toBeNull();
  });
  it("reads recap payloads written by the database", () => {
    const week = { kind: "week", start: "2026-09-28", end: "2026-10-05", done: 18, possible: 21,
      longest: { title: "Read 20 min", emoji: "📚", length: 12, period: "day" }, top: [], badges: [], days: [] };
    expect(copy.recapCopy(tEn, "en", week)).toEqual({ title: "Your week", body: "18 of 21 check-ins last week. Longest streak: \u2068Read 20 min\u2069 🔥 12 days" });
    expect(copy.recapCopy(tEn, "en", { ...week, kind: "month", start: "2026-09-01", end: "2026-10-01" })?.body)
      .toBe("18 of 21 check-ins in September. Longest streak: \u2068Read 20 min\u2069 🔥 12 days");
    expect(copy.recapCopy(tEn, "en", { kind: "week", done: "x" })).toBeNull();
    expect(copy.familyRecapCopy(tEn, "Family", { check_ins: 3, best: null })?.body).toBe("Together last week: 3 check-ins");
  });
});

describe("levelUp", () => {
  it("uses the level's own stage emoji, one per stage", () => {
    const bodies = [1, 5, 6, 10, 11, 15, 16, 20, 21, 40].map((l) => copy.levelUp(tEn, l, levelName(l)).body);
    expect(bodies).toEqual([
      "Seedling 🌱", "Seedling 🌱", "Sprout 🌿", "Sprout 🌿", "Sapling 🪴", "Sapling 🪴", "Tree 🌲", "Tree 🌲", "Forest 🌳", "Forest 🌳",
    ]);
    for (const b of bodies) expect(b.match(/\p{Extended_Pictographic}/gu)).toHaveLength(1);
  });
});
