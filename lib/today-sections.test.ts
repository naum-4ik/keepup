import { describe, expect, it } from "vitest";
import { everyoneDidIt, memberStatus, sectionsForToday } from "@/lib/today-sections";

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

describe("everyoneDidIt", () => {
  const g = (o: Record<string, unknown>) => ({ members: [], group_done: true, done_count: 1, target_count: 1, frozen: false, ...o }) as never;
  it("is true when the group is done and so am I", () => expect(everyoneDidIt(g({}))).toBe(true));
  it("is true when the group is done and I'm paused", () => expect(everyoneDidIt(g({ done_count: 0, frozen: true }))).toBe(true));
  it("is false for someone who joined mid-period and hasn't checked in", () => expect(everyoneDidIt(g({ done_count: 0 }))).toBe(false));
  it("is false for private habits and unfinished groups", () => {
    expect(everyoneDidIt(g({ members: null }))).toBe(false);
    expect(everyoneDidIt(g({ group_done: false }))).toBe(false);
  });
});
