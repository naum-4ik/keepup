// supabase/functions/send-push/build.test.ts
import { assertEquals } from "jsr:@std/assert@1";
import { buildPush, type PushJob } from "./build.ts";
import { makeTranslator, translatorFor } from "./i18n.ts";
import { isolate } from "../_shared/i18n.ts";

const { t } = translatorFor("en");

const job = (o: Partial<PushJob>): PushJob => ({
  id: "n1", kind: "nudge", user_id: "u1", pushed: false, group_id: "g1", group: "Family", habit_id: "h1", habit: "Read 20 min",
  period: "day", target: 1, check_in_id: null, check_in_status: null, actor: "Anna", subject_id: null, subject: null,
  payload: {}, names: [], pending: [], subscriptions: [], ...o,
});

Deno.test("a group check-in names everyone so far, under the habit's tag", () => {
  const p = buildPush(job({ kind: "group_check_in", names: ["Anna", "Dan"] }), t)!;
  assertEquals([p.title, p.body, p.tag, p.url], ["Family", "\u2068Anna\u2069 and \u2068Dan\u2069 checked in: \u2068Read 20 min\u2069", "habit:h1", "/habits/h1"]);
});

Deno.test("Everyone did it replaces the check-in push (same tag)", () => {
  assertEquals(buildPush(job({ kind: "everyone_done" }), t)!.tag, "habit:h1");
});

Deno.test("a group milestone names the streak, under the habit's tag", () => {
  const p = buildPush(job({ kind: "group_milestone", habit: "Family dinner", payload: { streak: 7, period: "day" } }), t)!;
  assertEquals([p.title, p.body, p.tag, p.url], ["Family", "🔥 \u2068Family dinner\u2069: 7 days in a row, together", "habit:h1", "/habits/h1"]);
});

Deno.test("one approval gets Approve / Don't approve buttons; iPhone taps open the Inbox", () => {
  const p = buildPush(job({ kind: "approval_needed", habit: "Gym", pending: [{ check_in_id: "c1", author: "Anna", habit: "Gym" }] }), t)!;
  assertEquals([p.body, p.tag, p.url, p.checkInId], ["\u2068Anna\u2069 did \u2068Gym\u2069. Approve?", "approvals", "/inbox", "c1"]);
  assertEquals(p.actions.map((a) => a.action), ["approve", "reject"]);
});

Deno.test("several approvals are counted, without buttons", () => {
  const p = buildPush(job({ kind: "approval_needed", pending: [{ check_in_id: "c1", author: "Anna", habit: "Gym" }, { check_in_id: "c2", author: "Dan", habit: "Read" }] }), t)!;
  assertEquals([p.body, p.actions.length, p.checkInId], ["2 check-ins waiting for you", 0, null]);
});

Deno.test("nothing to show once the approval is gone", () => {
  assertEquals(buildPush(job({ kind: "approval_needed", pending: [] }), t), null);
  assertEquals(buildPush(job({ kind: "approval_expiring", check_in_status: "approved" }), t), null);
});

Deno.test("the daily summary uses the reminder tag", () => {
  const p = buildPush(job({ kind: "daily_summary", habit_id: null, group: null, payload: {
    todo: [{ title: "Read", done: 0, target: 1 }, { title: "Water", done: 5, target: 8 }],
    at_risk: [{ title: "Run", done: 1, target: 3, period: "week", days_left: 2 }],
  } }), t)!;
  assertEquals([p.title, p.body, p.tag, p.url], ["Today", "Still to do: \u2068Read\u2069, \u2068Water\u2069 5/8 · \u2068Run\u2069: 1 of 3 this week, 2 days left 🌱", "reminder", "/today"]);
});

Deno.test("a habit's own reminder doesn't replace the summary", () => {
  const p = buildPush(job({ kind: "habit_reminder", habit: "Vitamins" }), t)!;
  assertEquals([p.body, p.tag], ["Time for \u2068Vitamins\u2069.", "reminder:h1"]);
});

Deno.test("a short group streak ending is not pushed", () => {
  assertEquals(buildPush(job({ kind: "group_streak_ended", payload: { streak: 2, period: "week" } }), t), null);
  assertEquals(buildPush(job({ kind: "group_streak_ended", habit: "Family dinner", payload: { streak: 6, period: "week" } }), t)!.body,
    "\u2068Family dinner\u2069 streak ended at 6 weeks. Start a new one this week.");
});

Deno.test("pauses show the end date the copy sheet way", () => {
  assertEquals(buildPush(job({ kind: "group_habit_paused", habit: "Family dinner", payload: { ends_on: "2026-10-12" } }), t)!.body,
    "\u2068Family dinner\u2069 is paused until Mon 12 Oct.");
  assertEquals(buildPush(job({ kind: "group_habit_created", habit: "Family dinner", payload: { period: "week", target_count: 1 } }), t)!.body,
    "\u2068Anna\u2069 added \u2068Family dinner\u2069, weekly.");
});

Deno.test("kid moments name the child and open the kid page", () => {
  const p = buildPush(job({ kind: "kid_streak", habit: "Brush teeth", subject: "Mary", subject_id: "k1", payload: { streak: 7 } }), t)!;
  assertEquals([p.title, p.body, p.url], ["Mary", "\u2068Mary\u2069: 7 days in a row: \u2068Brush teeth\u2069 🔥", "/kids/k1"]);
});

Deno.test("silent unless the person chose Sound; a job without the field stays quiet", () => {
  assertEquals(buildPush(job({ kind: "nudge" }), t)!.silent, true);
  assertEquals(buildPush(job({ kind: "nudge", silent: true }), t)!.silent, true);
  assertEquals(buildPush(job({ kind: "nudge", silent: false }), t)!.silent, false);
});

Deno.test("a kind send-push doesn't know is skipped", () => {
  assertEquals(buildPush(job({ kind: "cheer" }), t), null);
});

Deno.test("every payload keeps the voice: at most one emoji", () => {
  const kinds = ["nudge", "check_in_rejected", "group_check_in", "everyone_done", "habit_reminder", "streak_back", "group_habit_resumed", "member_joined", "kid_garden_full"];
  for (const kind of kinds) {
    const p = buildPush(job({ kind, names: ["Anna"], subject: "Mary", payload: { kind: "you_got_this" } }), t)!;
    assertEquals((`${p.title} ${p.body}`.match(/\p{Extended_Pictographic}/gu) ?? []).length <= 1, true, kind);
  }
});

Deno.test("M5: a level-up names the level, opens Profile", () => {
  const p = buildPush(job({ kind: "level_up", habit_id: null, habit: null, group: null, payload: { level: 6 } }), t)!;
  assertEquals([p.title, p.body, p.url, p.tag], ["Level 6", "Sprout 🌿", "/profile", "level_up:n1"]);
});

Deno.test("M5: a new badge (opens Achievements), and a personal milestone with its Back to wording", () => {
  const b = buildPush(job({ kind: "badge_unlocked", habit_id: null, payload: { code: "bookworm", name: "Bookworm" } }), t)!;
  assertEquals([b.body, b.url], ["Bookworm", "/profile/achievements"]);
  const m = buildPush(job({ kind: "streak_milestone", group: null, payload: { streak: 30, period: "day", back: true } }), t)!;
  assertEquals([m.title, m.body, m.url], ["Read 20 min", "Back to 30 days of \u2068Read 20 min\u2069 🔥", "/habits/h1"]);
});

Deno.test("M5: rest day used, and the recaps", () => {
  assertEquals(buildPush(job({ kind: "rest_day_used", group: null, payload: { streak: 14, period: "day" } }), t)!.body,
    "Rest day used. Your 14-day streak is safe 💤");
  const week = buildPush(job({ kind: "weekly_recap", habit_id: null, payload: { kind: "week", done: 18, possible: 21, longest: null } }), t)!;
  assertEquals([week.title, week.body, week.url], ["Your week", "18 of 21 check-ins last week.", "/progress/recaps"]);
  const fam = buildPush(job({ kind: "family_recap", habit_id: null, payload: { check_ins: 34, best: { title: "Family dinner", length: 5, period: "week" } } }), t)!;
  assertEquals([fam.title, fam.body, fam.url], ["Family", "Together last week: 34 check-ins · \u2068Family dinner\u2069 5 weeks 🔥", "/inbox"]);
});

Deno.test("M5: an empty recap sends nothing", () => {
  assertEquals(buildPush(job({ kind: "weekly_recap", payload: { kind: "week", done: 0, possible: 0 } }), t), null);
  assertEquals(buildPush(job({ kind: "family_recap", payload: { check_ins: 0 } }), t), null);
});

Deno.test("a job without locale renders in English", () => {
  const { t } = translatorFor(undefined);
  assertEquals(buildPush(job({ kind: "everyone_done", group: "Family", habit: "Read" }), t)?.body, "Everyone did it: \u2068Read\u2069 ✓");
});

Deno.test("an unknown locale falls back to English", () => {
  assertEquals(translatorFor("fr").locale, "en");
});

Deno.test("a locale that is not enabled renders English", () => {
  const j = job({ kind: "everyone_done", group: "Family", habit: "Read" });
  const en = "Everyone did it: \u2068Read\u2069 ✓";
  assertEquals(buildPush(j, translatorFor("ru").t)?.body, en);
  assertEquals(translatorFor("ru", ["en"]).locale, "en");
  const ru = translatorFor("ru", ["en", "ru"]);
  assertEquals(ru.locale, "ru");
  assertEquals(buildPush(j, ru.t)?.body === en, false);
});

Deno.test("catalog words: buttons, fallbacks, schedules and a kid's gender keep today's English", () => {
  const one = buildPush(job({ kind: "approval_needed", pending: [{ check_in_id: "c1", author: "Anna", habit: "Gym" }] }), t)!;
  assertEquals(one.actions.map((a) => a.title), ["Approve", "Don't approve"]);
  assertEquals(buildPush(job({ kind: "everyone_done", group: null, habit: null }), t)!.title, "Your group");
  assertEquals(buildPush(job({ kind: "nudge", actor: null, habit: null, payload: { kind: "you_got_this" } }), t)!.body,
    "⁨Someone⁩: You've got this: ⁨a habit⁩");
  assertEquals(buildPush(job({ kind: "group_habit_created", habit: "Gym", payload: { period: "week", target_count: 3 } }), t)!.body,
    "⁨Anna⁩ added ⁨Gym⁩, 3× a week.");
  assertEquals(buildPush(job({ kind: "badge_unlocked", payload: {} }), t)!.body, "A new badge");
  for (const subject_gender of ["boy", "girl", null] as const) {
    assertEquals(buildPush(job({ kind: "kid_garden_full", subject: null, subject_gender }), t)!.body,
      "⁨Your child⁩'s garden is in full bloom this week 🌷");
  }
});

Deno.test("a badge's name comes from the catalog by code; an unknown code shows the payload's name", () => {
  const known = job({ kind: "badge_unlocked", habit_id: null, payload: { code: "bookworm", name: "Old DB name" } });
  assertEquals(buildPush(known, t)!.body, "Bookworm");
  const { t: tr } = makeTranslator("en", { badges: { bookworm: { name: "Translated" } } });
  assertEquals(buildPush(known, tr)!.body, "Translated");
  assertEquals(buildPush(job({ kind: "badge_unlocked", habit_id: null, payload: { code: "from_the_future", name: "Future" } }), t)!.body, "Future");
});

Deno.test("subject_gender reaches the ICU select of a kid push", () => {
  const { t: g } = makeTranslator("en", { push: { kidFullGarden: "{gender, select, boy {B} girl {G} other {O}}" } });
  const body = (subject_gender: "boy" | "girl" | null) => buildPush(job({ kind: "kid_garden_full", subject: "Noa", subject_gender }), g)!.body;
  assertEquals([body("boy"), body("girl"), body(null)], ["B", "G", "O"]);
});

Deno.test("a key missing from a translation falls back to English, with its values", () => {
  const { t } = makeTranslator("ru", { push: { today: "Сегодня" } });
  assertEquals(t("push.everyoneDidIt", { habit: isolate("Read") }), "Everyone did it: \u2068Read\u2069 ✓");
  assertEquals(t("push.today"), "Сегодня");
});
