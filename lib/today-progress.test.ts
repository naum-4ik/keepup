import { describe, expect, it } from "vitest";
import { todayLine, todayProgress } from "./today-progress";

const h = (id: string, state: "open" | "done" | "later", period: "day" | "week" = "day") => ({
  habit_id: id,
  title: id,
  emoji: null,
  category: "health" as const,
  target_count: 1,
  period,
  done_count: state === "done" ? 1 : 0,
  checked_in_today: state === "done",
  frozen: state === "later",
  not_started: false,
  pending_count: 0,
});

describe("todayProgress", () => {
  it("counts what's on today's lists: to do and done, not paused or later", () => {
    const p = todayProgress([h("read", "done"), h("water", "open"), h("walk", "later"), h("run", "open")]);
    expect(p).toMatchObject({ done: 1, total: 3 });
    expect(p.items.map((i) => `${i.habitId}:${i.done}`)).toEqual(["read:true", "water:false", "run:false"]);
  });

  it("counts a check-in waiting for approval as not done yet", () => {
    const waiting = { ...h("walk", "open"), checked_in_today: true, pending_count: 1 };
    const p = todayProgress([h("read", "done"), waiting]);
    expect(p).toMatchObject({ done: 1, total: 2 });
    expect(p.items.map((i) => `${i.habitId}:${i.done}`)).toEqual(["read:true", "walk:false"]);
    expect(todayLine(p.done, p.total)).not.toBe("Today's all done 🎉");
  });

  it("counts a weekly check-in waiting for approval as not done yet", () => {
    const weekly = { ...h("walk", "open", "week"), target_count: 3, done_count: 1, checked_in_today: true, pending_count: 1 };
    const p = todayProgress([h("read", "done"), weekly]);
    expect(p).toMatchObject({ done: 1, total: 2 });
    expect(p.items.find((i) => i.habitId === "walk")?.done).toBe(false);
  });

  it("is empty when nothing is due today", () => {
    expect(todayProgress([h("walk", "later")])).toMatchObject({ done: 0, total: 0 });
  });
});

describe("todayLine", () => {
  it.each([
    [0, 5, "5 to go today"],
    [1, 5, "4 to go"],
    [2, 4, "Halfway there 💪"],
    [3, 5, "Halfway there 💪"],
    [4, 5, "One more to go!"],
    [0, 1, "1 to go today"],
    [5, 5, "Today's all done 🎉"],
  ])("%i of %i → %s", (done, total, line) => {
    expect(todayLine(done, total)).toBe(line);
  });

  it("never uses guilt words", () => {
    const lines = [0, 1, 2, 3, 4, 5].map((d) => todayLine(d, 5)).join(" ").toLowerCase();
    for (const w of ["failed", "missed", "don't lose", "hurry", "last chance", "only", "lazy"]) expect(lines).not.toContain(w);
  });
});
