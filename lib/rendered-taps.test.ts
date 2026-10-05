import { describe, expect, it } from "vitest";
import { currentPeriods, renderedTapIds, type TapRow } from "./rendered-taps";

const row = (client_id: string | null, user_id: string, period_start: string, habit_id = "h1"): TapRow => ({ client_id, habit_id, user_id, period_start });

describe("renderedTapIds", () => {
  const periods = currentPeriods([
    { habit_id: "h1", period_start: "2026-10-05" },
    { habit_id: "h2", period_start: "2026-10-08" },
  ]);

  it("keeps the viewer's and their children's check-ins in each habit's current period", () => {
    const rows = [row("a", "me", "2026-10-05"), row("b", "kid", "2026-10-05"), row("c", "me", "2026-10-08", "h2")];
    expect(renderedTapIds(rows, ["me", "kid"], periods)).toEqual(["a", "b", "c"]);
  });

  it("leaves out other members' check-ins", () => {
    expect(renderedTapIds([row("a", "dan", "2026-10-05")], ["me"], periods)).toEqual([]);
  });

  it("leaves out last period's check-ins, so a waiting undo of one takes nothing from this period", () => {
    expect(renderedTapIds([row("a", "me", "2026-09-28"), row("b", "me", "2026-10-07", "h2")], ["me"], periods)).toEqual([]);
  });

  it("leaves out habits the page doesn't show, and rows without a client id", () => {
    expect(renderedTapIds([row("a", "me", "2026-10-05", "h9"), row(null, "me", "2026-10-05")], ["me"], periods)).toEqual([]);
  });
});
