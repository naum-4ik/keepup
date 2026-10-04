// lib/notification-copy.test.ts
import { describe, expect, it } from "vitest";
import * as copy from "./notification-copy";
import { BANNED_PATTERNS, BANNED_WORDS, type Copy } from "./notification-copy";

const EMOJI = /\p{Extended_Pictographic}/gu;

// Every builder with realistic inputs: the voice rules below run over all of them.
const samples: Copy[] = [
  copy.dailySummary({ todo: [{ title: "Water", done: 5, target: 8 }, { title: "Read" }], atRisk: [{ title: "Run", done: 1, target: 3, period: "week", daysLeft: 2 }] })!,
  copy.habitReminder("Vitamins"),
  copy.groupCheckIn("Family", ["Anna", "Dan"], "Read 20 min")!,
  copy.groupCheckIn("Family", ["Anna", "Dan", "Grandma"], "Read 20 min")!,
  copy.groupCheckIn("Family", ["Anna", "Dan", "Grandma", "Mary"], "Read 20 min")!,
  copy.everyoneDidIt("Family", "Family dinner"),
  copy.approvalNeeded("Family", [{ author: "Anna", habit: "Gym" }])!,
  copy.approvalNeeded("Family", [{ author: "Anna", habit: "Gym" }, { author: "Dan", habit: "Read" }, { author: "Dan", habit: "Run" }])!,
  copy.approvalExpiring("Family", "Anna", "Gym"),
  copy.checkInNotApproved("Gym", "Dan", "day"),
  copy.nudge("thinking_of_you", "Anna", "Family dinner"),
  copy.nudge("you_got_this", "Anna", "Run"),
  copy.nudge("gentle_reminder", "Anna", "Read 20 min"),
  copy.groupStreakEnded("Family", "Family dinner", 6, "week")!,
  copy.groupStreakBack("Family", "Family dinner"),
  copy.groupHabitCreated("Family", "Anna", "Family dinner", "weekly"),
  copy.groupHabitPaused("Family", "Family dinner", "Mon 12 Oct"),
  copy.groupHabitPaused("Family", "Family dinner", null),
  copy.groupHabitResumed("Family", "Family dinner"),
  copy.memberJoined("Family", "Grandma"),
  copy.restDayUsed("Read", 14, "day"),
  copy.weeklyRecap({ done: 18, possible: 21, longest: { habit: "Read 20 min", length: 12 } })!,
  copy.weeklyRecap({ done: 4, possible: 7, longest: null })!,
  copy.levelUp(6, "Sprout"),
  copy.badgeUnlocked("Bookworm"),
  copy.kidTreatGoal("Mary", "Trip to the park", "🛝"),
  copy.kidFullGarden("Mary"),
  copy.kidStreak("Mary", 7, "Brush teeth"),
  copy.kidTreatGoal("Mary", "Trip to the park", ""),
  copy.alreadyLogged("Mary", "Anna", "Brush teeth"),
  copy.alreadyLogged("Mary", null, "Brush teeth"),
  copy.syncDropped("Read", "Mon"),
  copy.undoDropped("Gym", "approved"),
  copy.undoDropped("Gym", "period_closed"),
  { title: "milestone", body: copy.milestoneCard("Read 20 min", 30, "day") },
  { title: "milestone", body: copy.milestoneCard("Family dinner", 1, "week") },
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

  it("kid copy never assumes a gender", () => {
    const kid = [copy.kidTreatGoal("Mary", "Trip to the park", "🛝"), copy.kidFullGarden("Mary"), copy.kidStreak("Mary", 7, "Brush teeth")];
    for (const s of kid) expect(s.body).not.toMatch(/\b(her|his|she|he)\b/i);
  });
});

describe("never names who missed", () => {
  it("group outcomes carry no member names", () => {
    const names = ["Anna", "Dan", "Grandma", "Mary"];
    const outcomes = [copy.everyoneDidIt("Family", "Family dinner"), copy.groupStreakEnded("Family", "Family dinner", 6, "week")!, copy.groupStreakBack("Family", "Family dinner")];
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
    expect(copy.approvalNeeded("Family", [])).toBeNull();
    expect(copy.groupCheckIn("Family", [], "Gym")).toBeNull();
    expect(copy.weeklyRecap({ done: 0, possible: 0, longest: null })).toBeNull();
  });

  it("pluralises the recap and trims an empty goal emoji", () => {
    expect(copy.weeklyRecap({ done: 1, possible: 1, longest: null })?.body).toBe("1 of 1 check-in last week.");
    expect(copy.kidTreatGoal("Mary", "Trip to the park", "").body).toBe("Mary reached a goal: Trip to the park");
  });

  it("exact bodies", () => {
    expect(copy.habitReminder("Vitamins")).toEqual({ title: "Vitamins", body: "Time for Vitamins." });
    expect(copy.everyoneDidIt("Family", "Family dinner")).toEqual({ title: "Family", body: "Everyone did it: Family dinner ✓" });
    expect(copy.approvalExpiring("Family", "Anna", "Gym")).toEqual({ title: "Family", body: "Anna's Gym check-in needs a yes within 2 hours" });
    expect(copy.groupCheckIn("Family", ["Anna", "Dan", "Grandma"], "Read")?.body).toBe("Anna, Dan and Grandma checked in: Read");
    expect(copy.groupCheckIn("Family", ["Anna", "Dan", "Grandma", "Mary"], "Read")?.body).toBe("Anna, Dan and 2 others checked in: Read");
  });
});

describe("joinNames", () => {
  it("joins one to five names", () => {
    expect(copy.joinNames(["Anna"])).toBe("Anna");
    expect(copy.joinNames(["Anna", "Dan"])).toBe("Anna and Dan");
    expect(copy.joinNames(["Anna", "Dan", "Grandma"])).toBe("Anna, Dan and Grandma");
    expect(copy.joinNames(["Anna", "Dan", "Grandma", "Mary", "Sam"])).toBe("Anna, Dan and 3 others");
  });
});

describe("copy sheet rows", () => {
  it("daily summary lists what's left and at-risk habits", () => {
    expect(copy.dailySummary({ todo: [{ title: "Water", done: 5, target: 8 }, { title: "Read" }], atRisk: [] })).toEqual({
      title: "Today",
      body: "Still to do: Water 5/8, Read 🌱",
    });
    expect(copy.dailySummary({ todo: [], atRisk: [{ title: "Run", done: 1, target: 3, period: "week", daysLeft: 2 }] })?.body).toBe(
      "Still to do: Run: 1 of 3 this week, 2 days left 🌱",
    );
    expect(copy.dailySummary({ todo: [{ title: "Read" }], atRisk: [{ title: "Run", done: 2, target: 3, period: "month", daysLeft: 1 }] })?.body).toBe(
      "Still to do: Read · Run: 2 of 3 this month, 1 day left 🌱",
    );
  });

  it("no summary when nothing is left", () => {
    expect(copy.dailySummary({ todo: [], atRisk: [] })).toBeNull();
  });

  it("group check-in coalesces names", () => {
    expect(copy.groupCheckIn("Family", ["Anna", "Dan"], "Read 20 min")).toEqual({ title: "Family", body: "Anna and Dan checked in: Read 20 min" });
  });

  it("approval: one names the person, several are counted", () => {
    expect(copy.approvalNeeded("Family", [{ author: "Anna", habit: "Gym" }])?.body).toBe("Anna did Gym. Approve?");
    expect(copy.approvalNeeded("Family", [{ author: "Anna", habit: "Gym" }, { author: "Dan", habit: "Read" }])?.body).toBe("2 check-ins waiting for you");
  });

  it("not approved says when you can try again", () => {
    expect(copy.checkInNotApproved("Gym", "Dan", "day")).toEqual({ title: "Gym", body: "Dan didn't approve your check-in. You can check in again today." });
    expect(copy.checkInNotApproved("Gym", "Dan", "week").body).toBe("Dan didn't approve your check-in. You can check in again this week.");
  });

  it("nudges are the three presets", () => {
    expect(copy.nudge("thinking_of_you", "Anna", "Family dinner")).toEqual({ title: "Family dinner", body: "Anna: Thinking of you. Family dinner today?" });
    expect(copy.nudge("you_got_this", "Anna", "Run").body).toBe("Anna: You've got this: Run");
    expect(copy.nudge("gentle_reminder", "Anna", "Read 20 min").body).toBe("Anna: Gentle reminder: Read 20 min");
  });

  it("group streak ended only from 3, never names anyone", () => {
    expect(copy.groupStreakEnded("Family", "Family dinner", 2, "week")).toBeNull();
    expect(copy.groupStreakEnded("Family", "Family dinner", 6, "week")).toEqual({
      title: "Family",
      body: "Family dinner streak ended at 6 weeks. Start a new one this week.",
    });
    expect(copy.groupStreakEnded("Family", "Walk together", 3, "day")?.body).toBe("Walk together streak ended at 3 days. Start a new one today.");
  });

  it("streak back after a late check-in", () => {
    expect(copy.groupStreakBack("Family", "Family dinner").body).toBe("A late check-in arrived. Family dinner streak is back 🔥");
  });

  it("group habit lifecycle", () => {
    expect(copy.groupHabitCreated("Family", "Anna", "Family dinner", "weekly").body).toBe("Anna added Family dinner, weekly.");
    expect(copy.groupHabitPaused("Family", "Family dinner", "Mon 12 Oct").body).toBe("Family dinner is paused until Mon 12 Oct.");
    expect(copy.groupHabitPaused("Family", "Family dinner", null).body).toBe("Family dinner is paused.");
    expect(copy.groupHabitResumed("Family", "Family dinner").body).toBe("Family dinner is back.");
    expect(copy.memberJoined("Family", "Grandma")).toEqual({ title: "Family", body: "Grandma joined Family 👋" });
  });

  it("rest day, recap, level, badge, milestone", () => {
    expect(copy.restDayUsed("Read", 14, "day")).toEqual({ title: "Read", body: "Rest day used. Your 14-day streak is safe 💤" });
    expect(copy.restDayUsed("Run", 8, "week").body).toBe("Rest week used. Your 8-week streak is safe 💤");
    expect(copy.weeklyRecap({ done: 18, possible: 21, longest: { habit: "Read 20 min", length: 12 } })).toEqual({
      title: "Your week",
      body: "18 of 21 check-ins last week. Longest streak: Read 20 min 🔥 12",
    });
    expect(copy.weeklyRecap({ done: 4, possible: 7, longest: null })?.body).toBe("4 of 7 check-ins last week.");
    expect(copy.levelUp(6, "Sprout")).toEqual({ title: "Level 6", body: "Sprout 🌱" });
    expect(copy.badgeUnlocked("Bookworm")).toEqual({ title: "Unlocked", body: "Bookworm" });
    expect(copy.milestoneCard("Read 20 min", 30, "day")).toBe("🔥 Read 20 min: 30 days in a row");
    expect(copy.milestoneCard("Family dinner", 1, "week")).toBe("🔥 Family dinner: 1 week in a row");
  });

  it("kid special moments", () => {
    expect(copy.kidTreatGoal("Mary", "Trip to the park", "🛝")).toEqual({ title: "Mary", body: "Mary reached a goal: Trip to the park 🛝" });
    expect(copy.kidFullGarden("Mary").body).toBe("Mary's garden is in full bloom this week 🌷");
    expect(copy.kidStreak("Mary", 7, "Brush teeth").body).toBe("Mary: 7 days in a row: Brush teeth 🔥");
  });
});
