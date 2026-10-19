import { describe, expect, it } from "vitest";
import { saveTracker } from "./save-tracker";

describe("saveTracker", () => {
  it("a lone success is current and becomes the confirmed value", () => {
    const s = saveTracker("Rome");
    const n = s.begin();
    expect(s.answer(n, "Tokyo", true)).toEqual({ current: true, revertTo: null });
    expect(s.confirmed()).toBe("Tokyo");
  });

  it("a lone failure goes back to what the server confirmed", () => {
    const s = saveTracker("Rome");
    expect(s.answer(s.begin(), "Tokyo", false)).toEqual({ current: true, revertTo: "Rome" });
    expect(s.confirmed()).toBe("Rome");
  });

  it("ignores an answer a newer request overtook, but keeps its success as saved", () => {
    const s = saveTracker("Rome");
    const first = s.begin();
    const second = s.begin();
    expect(s.answer(first, "Tokyo", true)).toEqual({ current: false, revertTo: null });
    expect(s.confirmed()).toBe("Tokyo");
    expect(s.answer(second, "Paris", false)).toEqual({ current: true, revertTo: "Tokyo" });
  });

  it("a late failure of an older request changes nothing", () => {
    const s = saveTracker("Rome");
    const first = s.begin();
    const second = s.begin();
    expect(s.answer(second, "Paris", true)).toEqual({ current: true, revertTo: null });
    expect(s.answer(first, "Tokyo", false)).toEqual({ current: false, revertTo: null });
    expect(s.confirmed()).toBe("Paris");
  });

  it("an older success arriving after a newer one doesn't undo it", () => {
    const s = saveTracker("Rome");
    const first = s.begin();
    const second = s.begin();
    s.answer(second, "Paris", true);
    s.answer(first, "Tokyo", true);
    expect(s.confirmed()).toBe("Paris");
  });

  it("after a failure, the next failure still goes back to the confirmed value, not the failed one", () => {
    const s = saveTracker(1);
    expect(s.answer(s.begin(), 0, false).revertTo).toBe(1);
    expect(s.answer(s.begin(), 0, false).revertTo).toBe(1);
  });
});
