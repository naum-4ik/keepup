import { describe, expect, it } from "vitest";
import { memberStatus, sectionsForToday } from "@/lib/today-sections";

const h = (o: Record<string, unknown>) => ({ habit_id: crypto.randomUUID(), group_id: null, group_name: null, ...o }) as never;

describe("sectionsForToday", () => {
  it("puts private habits under Mine, then one section per group by name", () => {
    const s = sectionsForToday([h({ title: "Read" }), h({ title: "Dinner", group_id: "g2", group_name: "Family" }), h({ title: "Gym", group_id: "g1", group_name: "Buddies" })]);
    expect(s.map((x) => x.title)).toEqual(["Mine", "Buddies", "Family"]);
  });
  it("drops empty sections", () => {
    expect(sectionsForToday([h({ group_id: "g", group_name: "Family" })]).map((x) => x.title)).toEqual(["Family"]);
  });
});

describe("memberStatus", () => {
  const m = (o: Record<string, unknown>) => ({ required: true, done_count: 0, pending_count: 0, paused: false, ...o }) as never;
  it("reads done, pending, paused, open and not required", () => {
    expect(memberStatus(m({ done_count: 1 }), 1)).toBe("done");
    expect(memberStatus(m({ pending_count: 1 }), 1)).toBe("pending");
    expect(memberStatus(m({ paused: true }), 1)).toBe("paused");
    expect(memberStatus(m({}), 1)).toBe("open");
    expect(memberStatus(m({ required: false }), 1)).toBe("not_required");
  });
});
