import { describe, expect, it } from "vitest";
import { inProgressTab, type ProgressTab } from "./progress-lists";

const habits = [
  { habit_id: "running", archived_at: null },
  { habit_id: "ended", archived_at: null }, // past its end, not decided yet
  { habit_id: "finished", archived_at: "2026-10-01T10:00:00Z" },
  { habit_id: "archived", archived_at: "2026-10-01T10:00:00Z" },
];
const finished = new Set(["finished"]);
const ended = (h: { habit_id: string }) => h.habit_id === "ended";
const tab = (t: ProgressTab) => habits.filter((h) => inProgressTab(h, t, finished, ended)).map((h) => h.habit_id);

describe("inProgressTab", () => {
  it("Active leaves out a habit past its end, as Today does", () => {
    expect(tab("active")).toEqual(["running"]);
  });

  it("Finished has the finished ones and the ended ones still to decide", () => {
    expect(tab("finished")).toEqual(["ended", "finished"]);
  });

  it("Archived has only the plain archived ones", () => {
    expect(tab("archived")).toEqual(["archived"]);
  });
});
