import { describe, expect, it } from "vitest";
import { startAfterSwitch, todayForGroup } from "./habit-start";

const groups = [{ id: "g-tokyo", today: "2026-10-06" }];

describe("todayForGroup", () => {
  it("is the group's own today for a group habit", () => expect(todayForGroup(groups, "g-tokyo", "2026-10-05")).toBe("2026-10-06"));
  it("is the person's today for Just me, or a group it doesn't know", () => {
    expect(todayForGroup(groups, "", "2026-10-05")).toBe("2026-10-05");
    expect(todayForGroup(groups, "g-other", "2026-10-05")).toBe("2026-10-05");
  });
});

describe("startAfterSwitch", () => {
  it("moves an untouched start (today) to the new calendar's today", () => {
    expect(startAfterSwitch("2026-10-05", "2026-10-05", "2026-10-06")).toBe("2026-10-06");
    expect(startAfterSwitch("2026-10-06", "2026-10-06", "2026-10-05")).toBe("2026-10-05");
  });
  it("never leaves a start before the new today", () => expect(startAfterSwitch("2026-10-05", "2026-10-04", "2026-10-06")).toBe("2026-10-06"));
  it("keeps a later start the person picked", () => expect(startAfterSwitch("2026-10-12", "2026-10-05", "2026-10-06")).toBe("2026-10-12"));
});
