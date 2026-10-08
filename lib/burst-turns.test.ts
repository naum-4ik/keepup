import { describe, expect, it } from "vitest";
import { CONFETTI_TURN_MS, takeTurn } from "./burst-turns";

describe("takeTurn", () => {
  it("plays the first burst now and each next one after the one before", () => {
    const turns = { freeAt: 0 };
    expect(takeTurn(turns, 1000).wait).toBe(0);
    expect(takeTurn(turns, 1000).wait).toBe(CONFETTI_TURN_MS);
    expect(takeTurn(turns, 1100).wait).toBe(2 * CONFETTI_TURN_MS - 100);
  });
  it("doesn't wait once the last burst is over", () => {
    const turns = { freeAt: 0 };
    takeTurn(turns, 1000);
    expect(takeTurn(turns, 1000 + CONFETTI_TURN_MS + 1).wait).toBe(0);
  });
  it("the moment holds its turn while it shows; a card's burst waits for it", () => {
    const turns = { freeAt: 0 };
    takeTurn(turns, 1000, 4800); // a level-up and a badge, 2.4 s each
    expect(takeTurn(turns, 2000).wait).toBe(3800);
  });
  it("closed early, the moment hands the rest back", () => {
    const turns = { freeAt: 0 };
    const moment = takeTurn(turns, 1000, 4800);
    moment.release(1500);
    expect(takeTurn(turns, 1600).wait).toBe(0);
  });
  it("gone before its turn, a burst hands it back whole", () => {
    const turns = { freeAt: 0 };
    takeTurn(turns, 1000);
    const second = takeTurn(turns, 1000);
    second.release(1100);
    expect(turns.freeAt).toBe(1000 + CONFETTI_TURN_MS);
  });
  it("keeps the turn when someone already queued behind it", () => {
    const turns = { freeAt: 0 };
    const first = takeTurn(turns, 1000);
    takeTurn(turns, 1000);
    first.release(1100);
    expect(takeTurn(turns, 1200).wait).toBe(2 * CONFETTI_TURN_MS + 1000 - 1200);
  });
});
