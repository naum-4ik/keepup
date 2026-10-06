import { describe, expect, it } from "vitest";
import { isResetWord, RESET_CLEARS, RESET_DONE, RESET_KEEPS } from "./reset-my-data";

describe("Reset my data", () => {
  it("asks for the word reset, in any case", () => {
    expect(isResetWord("reset")).toBe(true);
    expect(isResetWord("  Reset ")).toBe(true);
    expect(isResetWord("")).toBe(false);
    expect(isResetWord("rese")).toBe(false);
    expect(isResetWord("reset please")).toBe(false);
  });

  it("says what goes and what stays, calmly: no guilt words, at most one emoji per line", () => {
    for (const line of [RESET_CLEARS, RESET_KEEPS, RESET_DONE]) {
      const lower = line.toLowerCase();
      for (const w of ["failed", "missed out", "don't lose", "hurry", "last chance", "only", "lazy", "you missed"]) expect(lower).not.toContain(w);
      expect(line.match(/\p{Extended_Pictographic}/gu)?.length ?? 0).toBeLessThanOrEqual(1);
    }
    expect(RESET_KEEPS).toContain("group habits");
  });
});
