import { describe, expect, it } from "vitest";
import { celebrates, CONFETTI_TURN_MS, finishLine, startAgainEnd, takeConfettiTurn } from "./habit-finish";

describe("finishLine", () => {
  it("counts what was done, in the habit's unit, with the best streak", () => {
    expect(finishLine({ done: 27, total: 30, best_streak: 14 }, "day", false)).toBe("You did 27 of 30 days · best streak 14 🔥");
    expect(finishLine({ done: 8, total: 8, best_streak: 8 }, "week", false)).toBe("You did 8 of 8 weeks · best streak 8 🔥");
    expect(finishLine({ done: 1, total: 1, best_streak: 1 }, "month", false)).toBe("You did 1 of 1 month · best streak 1 🔥");
  });
  it("says together for a group, and skips a zero streak", () => {
    expect(finishLine({ done: 26, total: 30, best_streak: 0 }, "day", true)).toBe("Together you did 26 of 30 days");
  });
  it("never uses guilt words", () => {
    const line = finishLine({ done: 0, total: 30, best_streak: 0 }, "day", false).toLowerCase();
    for (const w of ["missed", "failed", "only"]) expect(line).not.toContain(w);
  });
});

describe("celebrates", () => {
  it("cheers at half done or more, not below", () => {
    expect(celebrates({ done: 15, total: 30 })).toBe(true);
    expect(celebrates({ done: 14, total: 30 })).toBe(false);
    expect(celebrates({ done: 0, total: 2 })).toBe(false);
    expect(celebrates({ done: 0, total: 0 })).toBe(false);
  });
});

describe("startAgainEnd", () => {
  it("keeps the same length, starting today", () => {
    expect(startAgainEnd("2026-10-01", "2026-10-30", "2026-11-05")).toBe("2026-12-04");
    expect(startAgainEnd("2026-10-01", "2026-10-01", "2026-11-05")).toBe("2026-11-05");
  });
});

describe("takeConfettiTurn", () => {
  it("plays the first burst now and each next one after the one before", () => {
    const turns = { freeAt: 0 };
    expect(takeConfettiTurn(turns, 1000)).toBe(0);
    expect(takeConfettiTurn(turns, 1000)).toBe(CONFETTI_TURN_MS);
    expect(takeConfettiTurn(turns, 1100)).toBe(2 * CONFETTI_TURN_MS - 100);
  });
  it("doesn't wait once the last burst is over", () => {
    const turns = { freeAt: 0 };
    takeConfettiTurn(turns, 1000);
    expect(takeConfettiTurn(turns, 1000 + CONFETTI_TURN_MS + 1)).toBe(0);
  });
});
