import { describe, expect, it } from "vitest";
import { tEn, tFor } from "@/lib/i18n/test-t";
import { anotherGoLine } from "@/lib/habit-finish";

// The habit page's in-place lines (docs/design.md rule: action, concrete result, a number to go by).
describe("habit page copy", () => {
  it("an empty check-in list asks for the first one, with the period's target", () => {
    expect(tEn("habits.checkIns.empty", { period: "day", target: 1 })).toBe("Check in to start today: 0 of 1 done.");
    expect(tEn("habits.checkIns.empty", { period: "week", target: 3 })).toBe("Check in to start this week: 0 of 3 done.");
    expect(tFor("ru")("habits.checkIns.empty", { period: "month", target: 10 })).toBe("Отметьтесь, чтобы начать этот месяц: сделано 0 из 10.");
    expect(tFor("he")("habits.checkIns.empty", { period: "week", target: 3 })).toBe("סמנו כדי להתחיל את השבוע: 0 מתוך 3 בוצעו.");
  });

  it("pause and resume say Saved and what it means", () => {
    expect(tEn("habits.freeze.saved", { me: "no", scheduled: "no" })).toBe("Saved. No check-ins are due, and the streak waits until you resume.");
    expect(tEn("habits.freeze.saved", { me: "yes", scheduled: "no" })).toBe("Saved. You aren't counted until you resume.");
    expect(tEn("habits.freeze.saved", { me: "no", scheduled: "yes" })).toBe("Saved. Check-ins stay open until the pause starts.");
    expect(tEn("habits.freeze.resumed", { what: "resumed", me: "no" })).toBe("Resumed. Check-ins count again from today.");
    expect(tEn("habits.freeze.resumed", { what: "cancelled", me: "yes" })).toBe("Pause cancelled. Nothing changes: check in as usual.");
    for (const l of ["ru", "he"] as const) {
      expect(tFor(l)("habits.freeze.saved", { me: "yes", scheduled: "no" })).toBeTruthy();
      expect(tFor(l)("habits.freeze.resumed", { what: "resumed", me: "yes" })).toBeTruthy();
    }
  });

  it("an end change says the new last day, or that it keeps going", () => {
    expect(tEn("habits.end.saved", { end: "date", date: "Sun 15 Nov" })).toBe("Saved: the last day is Sun 15 Nov.");
    expect(tEn("habits.end.saved", { end: "none", date: "" })).toBe("Saved: no end now. It keeps going until you stop it.");
  });

  it("Finish says where the history went: Progress, or the child's page", () => {
    expect(tEn("habits.end.finished", { habit: "Read", where: "progress", name: "" })).toBe("Read is finished. Its history is in Progress → Finished.");
    expect(tEn("habits.end.finished", { habit: "Read", where: "kid", name: "Mary" })).toBe("Read is finished. Its history is in Mary's Finished.");
    expect(tEn("habits.end.openFinished", { where: "kid", name: "Mary" })).toBe("Open Mary's page");
    expect(tFor("he")("habits.end.openFinished", { where: "progress", name: "" })).toBe('פתיחת "הסתיימו"');
  });

  it("finish lines point at the buttons that are there", () => {
    expect(anotherGoLine(tEn, 0, "day")).toBe("Keep going and your streak carries on, or Finish and start again later.");
    expect(anotherGoLine(tEn, 3, "day")).toBe("Keep going and your streak of 3 days carries on, or Finish and start again later.");
    expect(anotherGoLine(tFor("ru"), 2, "week")).toBe("Продолжайте — и ваша серия (2 недели) не прервётся, или завершите и начните заново позже.");
    expect(anotherGoLine(tFor("he"), 1, "day")).toContain("המשיכו");
    expect(tEn("habits.detail.finished.note")).toBe("Start again to build a new streak. This one keeps its history.");
  });
});
