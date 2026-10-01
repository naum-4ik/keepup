// supabase/functions/send-push/build.test.ts
import { assertEquals } from "jsr:@std/assert@1";
import { buildPush, type PushJob } from "./build.ts";

const job = (o: Partial<PushJob>): PushJob => ({
  id: "n1", kind: "nudge", user_id: "u1", pushed: false, group_id: "g1", group: "Family", habit_id: "h1", habit: "Read 20 min",
  period: "day", target: 1, check_in_id: null, check_in_status: null, actor: "Anna", subject_id: null, subject: null,
  payload: {}, names: [], pending: [], subscriptions: [], ...o,
});

Deno.test("a group check-in names everyone so far, under the habit's tag", () => {
  const p = buildPush(job({ kind: "group_check_in", names: ["Anna", "Dan"] }))!;
  assertEquals([p.title, p.body, p.tag, p.url], ["Family", "Anna and Dan checked in: Read 20 min", "habit:h1", "/habits/h1"]);
});

Deno.test("Everyone did it replaces the check-in push (same tag)", () => {
  assertEquals(buildPush(job({ kind: "everyone_done" }))!.tag, "habit:h1");
});

Deno.test("one approval gets Approve / Don't approve buttons; iPhone taps open the Inbox", () => {
  const p = buildPush(job({ kind: "approval_needed", habit: "Gym", pending: [{ check_in_id: "c1", author: "Anna", habit: "Gym" }] }))!;
  assertEquals([p.body, p.tag, p.url, p.checkInId], ["Anna did Gym. Approve?", "approvals", "/inbox", "c1"]);
  assertEquals(p.actions.map((a) => a.action), ["approve", "reject"]);
});

Deno.test("several approvals are counted, without buttons", () => {
  const p = buildPush(job({ kind: "approval_needed", pending: [{ check_in_id: "c1", author: "Anna", habit: "Gym" }, { check_in_id: "c2", author: "Dan", habit: "Read" }] }))!;
  assertEquals([p.body, p.actions.length, p.checkInId], ["2 check-ins waiting for you", 0, null]);
});

Deno.test("nothing to show once the approval is gone", () => {
  assertEquals(buildPush(job({ kind: "approval_needed", pending: [] })), null);
  assertEquals(buildPush(job({ kind: "approval_expiring", check_in_status: "approved" })), null);
});

Deno.test("the daily summary uses the reminder tag", () => {
  const p = buildPush(job({ kind: "daily_summary", habit_id: null, group: null, payload: {
    todo: [{ title: "Read", done: 0, target: 1 }, { title: "Water", done: 5, target: 8 }],
    at_risk: [{ title: "Run", done: 1, target: 3, period: "week", days_left: 2 }],
  } }))!;
  assertEquals([p.title, p.body, p.tag, p.url], ["Today", "Still to do: Read, Water 5/8 · Run: 1 of 3 this week, 2 days left 🌱", "reminder", "/today"]);
});

Deno.test("a habit's own reminder doesn't replace the summary", () => {
  const p = buildPush(job({ kind: "habit_reminder", habit: "Vitamins" }))!;
  assertEquals([p.body, p.tag], ["Time for Vitamins.", "reminder:h1"]);
});

Deno.test("a short group streak ending is not pushed", () => {
  assertEquals(buildPush(job({ kind: "group_streak_ended", payload: { streak: 2, period: "week" } })), null);
  assertEquals(buildPush(job({ kind: "group_streak_ended", habit: "Family dinner", payload: { streak: 6, period: "week" } }))!.body,
    "Family dinner streak ended at 6 weeks. Start a new one this week.");
});

Deno.test("pauses show the end date the copy sheet way", () => {
  assertEquals(buildPush(job({ kind: "group_habit_paused", habit: "Family dinner", payload: { ends_on: "2026-10-12" } }))!.body,
    "Family dinner is paused until Mon 12 Oct.");
  assertEquals(buildPush(job({ kind: "group_habit_created", habit: "Family dinner", payload: { period: "week", target_count: 1 } }))!.body,
    "Anna added Family dinner, weekly.");
});

Deno.test("kid moments name the child and open the kid page", () => {
  const p = buildPush(job({ kind: "kid_streak", habit: "Brush teeth", subject: "Mary", subject_id: "k1", payload: { streak: 7 } }))!;
  assertEquals([p.title, p.body, p.url], ["Mary", "Mary: 7 days in a row: Brush teeth 🔥", "/kids/k1"]);
});

Deno.test("a kind send-push doesn't know is skipped", () => {
  assertEquals(buildPush(job({ kind: "cheer" })), null);
});

Deno.test("every payload keeps the voice: at most one emoji", () => {
  const kinds = ["nudge", "check_in_rejected", "group_check_in", "everyone_done", "habit_reminder", "streak_back", "group_habit_resumed", "member_joined", "kid_garden_full"];
  for (const kind of kinds) {
    const p = buildPush(job({ kind, names: ["Anna"], subject: "Mary", payload: { kind: "you_got_this" } }))!;
    assertEquals((`${p.title} ${p.body}`.match(/\p{Extended_Pictographic}/gu) ?? []).length <= 1, true, kind);
  }
});
