import { describe, expect, it } from "vitest";
import { allCheckedOffKey, groupForToday } from "./today";

const h = (id: string, over: Partial<Parameters<typeof groupForToday>[0][number]> = {}) => ({
  id, target_count: 1, period: "day" as const, done_count: 0, checked_in_today: false, frozen: false, not_started: false, ...over,
});

describe("groupForToday", () => {
  it("puts open habits first, then done, then not-started and paused", () => {
    const g = groupForToday([
      h("later-start", { not_started: true }),
      h("done", { done_count: 1, checked_in_today: true }),
      h("open"),
      h("paused", { frozen: true }),
      h("weekly-checked", { period: "week", target_count: 3, done_count: 1, checked_in_today: true }),
      h("water", { target_count: 8, done_count: 3, checked_in_today: true }),
    ]);
    expect(g.todo.map((x) => x.id)).toEqual(["open", "water"]);
    expect(g.done.map((x) => x.id)).toEqual(["done", "weekly-checked"]);
    expect(g.later.map((x) => x.id)).toEqual(["later-start", "paused"]);
  });
});

describe("allCheckedOffKey", () => {
  it("picks only the first section that's all checked off", () => {
    const done = h("d", { done_count: 1, checked_in_today: true });
    expect(
      allCheckedOffKey([
        { key: "mine", habits: [h("open")] },
        { key: "family", habits: [done] },
        { key: "friends", habits: [done] },
      ]),
    ).toBe("family");
  });
  it("is null when every section still has something to do, or nothing was done", () => {
    expect(allCheckedOffKey([{ key: "mine", habits: [h("open")] }])).toBeNull();
    expect(allCheckedOffKey([{ key: "mine", habits: [h("p", { frozen: true })] }])).toBeNull();
  });
});
