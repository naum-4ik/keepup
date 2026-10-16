import { createElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { weekdayLabels } from "@/lib/weekdays";
import { markup, richEn, tEn } from "./test-t";

// PR 7 prep: messages restructured so ru/he can be written without code changes. Each case pins the
// English the code produced before the change (built from pieces then, one message now).
const sr = (c: ReactNode) => createElement("span", { className: "sr-only" }, c);

describe("lists and separators are catalog words", () => {
  it("joins lists with the catalog separator", () => {
    expect(["A done", "B to do"].join(tEn("common.listSeparator"))).toBe("A done, B to do");
    expect(tEn("celebrations.habitSeparator")).toBe(" · ");
  });

  it("Progress row: ended note, schedule and best streak in one message", () => {
    const line = (ended: boolean, best: string | null) =>
      tEn("progress.habitLine", { ended: ended ? "yes" : "no", schedule: "daily", best: best ? "yes" : "no", span: best ?? "" });
    expect(line(false, null)).toBe("daily");
    expect(line(false, "5 days")).toBe("daily · best 5 days");
    expect(line(true, null)).toBe("Ended · decide on Today · daily");
    expect(line(true, "2 weeks")).toBe("Ended · decide on Today · daily · best 2 weeks");
  });

  it("habit page subtitle carries Archived inside the message", () => {
    expect(tEn("habits.detail.scheduleLine", { schedule: "daily", archived: "no" })).toBe("daily");
    expect(tEn("habits.detail.scheduleLine", { schedule: "daily", archived: "yes" })).toBe("daily · Archived");
    expect(tEn("habits.detail.categoryLine", { schedule: "daily", category: "Health", archived: "yes" })).toBe("daily · Health · Archived");
    expect(markup(richEn("habits.detail.groupLine", { group: "Levis", schedule: "weekly", approval: "yes", archived: "yes" })))
      .toBe("<bdi>Levis</bdi> · weekly · needs approval · Archived");
    expect(markup(richEn("habits.detail.groupLine", { group: "Levis", schedule: "weekly", approval: "no", archived: "no" })))
      .toBe("<bdi>Levis</bdi> · weekly");
  });

  it("Needs a connection names the card for screen readers in one message", () => {
    expect(markup(richEn("offline.needsConnectionFor", { label: "Invite", sr })))
      .toBe('Needs a connection<span class="sr-only">: Invite</span>');
  });
});

describe("weekdays inside a phrase are a select with the English day words", () => {
  it("Next <weekday> reads as before for every day index", () => {
    const short = weekdayLabels("en", "short");
    for (let day = 0; day < 7; day++) expect(tEn("habits.datePicker.next", { day })).toBe(`Next ${short[day]}`);
  });

  it("city and week start (Profile and onboarding share it), the city its own element", () => {
    const long = weekdayLabels("en", "long");
    const span = (c: ReactNode) => createElement("span", null, c);
    const plain = { place: span, dot: (c: ReactNode) => c, week: (c: ReactNode) => c };
    expect(markup(richEn("profile.summary", { city: "Tokyo", weekStart: "sun", ...plain }))).toBe(`<span>Tokyo</span> · weeks start ${long[0]}`);
    expect(markup(richEn("profile.summary", { city: "Rome", weekStart: "mon", ...plain }))).toBe(`<span>Rome</span> · weeks start ${long[1]}`);
    const hidden = (c: ReactNode) => createElement("span", { "aria-hidden": true }, c);
    expect(markup(richEn("profile.summary", { city: "Rome", weekStart: "sun", place: span, dot: hidden, week: span })))
      .toBe(`<span>Rome</span> <span aria-hidden="true">·</span> <span>weeks start ${long[0]}</span>`);
  });
});

describe("counts before nouns are plurals (numeric args), English unchanged", () => {
  it.each([
    ["validation.maxChars", { max: 40 }, "Keep it to 40 characters."],
    ["validation.stars", { max: 200 }, "Pick 1–200 stars."],
    ["validation.targetCount.day", { limit: 20 }, "Pick 1–20 times a day."],
    ["validation.targetCount.week", { limit: 7 }, "Pick 1–7 times a week."],
    ["validation.targetCount.month", { limit: 31 }, "Pick 1–31 times a month."],
    ["errors.groupNameLength", { max: 40 }, "Give the group a name up to 40 characters."],
    ["auth.passwordMin", { min: 8 }, "Use at least 8 characters."],
    ["auth.signup.passwordRule", { min: 8 }, "At least 8 characters."],
    ["onboarding.habits.title", { max: 3 }, "Pick 1–3 habits to start"],
    ["onboarding.habits.pickRange", { max: 3 }, "Pick 1–3 habits."],
    ["onboarding.habits.joinedSubtitle", { max: 3 }, "Pick up to 3. Each starts today."],
    ["onboarding.habits.atLimit", { max: 3 }, "Pick up to 3"],
    ["onboarding.habits.picked", { n: 1, max: 3 }, "1 of 3 picked"],
    ["onboarding.habits.picked", { n: 2, max: 3 }, "2 of 3 picked"],
    ["kids.form.donePicked", { count: 1 }, "Done · 1 picked"],
    ["kids.form.donePicked", { count: 5 }, "Done · 5 picked"],
    ["achievements.earnedCount", { earned: 1, total: 24 }, "1 of 24 earned"],
    ["achievements.earnedCount", { earned: 0, total: 24 }, "0 of 24 earned"],
    ["push.restDayUsed", { period: "day", n: 14 }, "Rest day used. Your 14-day streak is safe 💤"],
    ["push.restDayUsed", { period: "week", n: 1 }, "Rest week used. Your 1-week streak is safe 💤"],
    ["push.restDayUsed", { period: "day", n: 1200 }, "Rest day used. Your 1200-day streak is safe 💤"],
    ["push.dailySummary.atRisk", { habit: "Run", done: "1", target: "3", period: "week", days: 1 }, "Run: 1 of 3 this week, 1 day left"],
    ["push.dailySummary.atRisk", { habit: "Run", done: "1", target: "3", period: "month", days: 2 }, "Run: 1 of 3 this month, 2 days left"],
  ] as const)("%s %j", (key, values, english) => expect(tEn(key, values)).toBe(english));

  it("the level percent is a locale percent", () => {
    for (const p of [0, 7, 29, 45, 99]) {
      expect(tEn("nav.profileLevelProgress", { level: 3, percent: p / 100, next: 4 })).toBe(`Profile, level 3, ${p}% to level 4`);
    }
  });
});

describe("one message where code composed pieces", () => {
  it("paused until turned back on is its own sentence", () => {
    expect(tEn("notifications.card.pausedUntil", { until: "Mon 08:00" })).toBe("Paused until Mon 08:00");
    expect(tEn("notifications.card.pausedUntilOn")).toBe("Paused until you turn them back on");
  });

  it("the demo banner's Sign in is part of its sentence", () => {
    const signIn = (c: ReactNode) => createElement("button", null, c);
    expect(markup(richEn("demo.signInLine", { signIn }))).toBe("<button>Sign in</button> to start your own.");
  });

  it.each([
    ["habits.cheer.cta", "Cheer ❤️"],
    ["habits.cheer.done", "Cheered"],
    ["habits.nudge.cta", "Nudge"],
    ["habits.nudge.done", "Nudged ✓"],
  ])("%s names the person for screen readers inside the message", (key, word) => {
    expect(markup(richEn(key, { name: "Anna", sr }))).toBe(`${word}<span class="sr-only"> <bdi>Anna</bdi></span>`);
  });

  it("history squares: date and outcome", () => {
    expect(tEn("habits.history.cell", { date: "Thu 1 Oct", outcome: "Done" })).toBe("Thu 1 Oct: Done");
  });

  it("Forgot password? quotes the button's own label", () => {
    expect(tEn("auth.login.needEmail", { forgot: tEn("auth.login.forgot") })).toBe("Type your email above, then tap Forgot password? again.");
  });

  it("install steps name the app's labels from the catalog", () => {
    const menu = { profile: tEn("nav.profile"), settings: tEn("settings.title"), turnOn: tEn("notifications.turnOn.label") };
    expect(tEn("install.iphone.step6", menu)).toBe("Profile → Settings → Turn on reminders.");
    expect(tEn("install.android.step3", menu)).toBe("Open Keepup from the new icon, then turn reminders on in Profile → Settings.");
    expect(tEn("install.computer.step2", menu)).toBe("Then turn reminders on in Profile → Settings.");
  });
});
