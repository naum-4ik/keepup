import { describe, expect, it, vi } from "vitest";
import { isResetWord, RESET_CLEARS, RESET_DONE, RESET_KEEPS, runReset } from "./reset-my-data";

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

describe("runReset", () => {
  it("clears the phone only after the reset succeeded, then opens Today", async () => {
    const order: string[] = [];
    const message = await runReset({
      reset: async () => (order.push("reset"), { ok: true }),
      clearPhone: async () => void order.push("clear"),
      openToday: () => order.push("today"),
    });
    expect(message).toBeNull();
    expect(order).toEqual(["reset", "clear", "today"]);
  });

  it("a failed reset clears nothing and says why", async () => {
    const clearPhone = vi.fn();
    const openToday = vi.fn();
    expect(await runReset({ reset: async () => ({ ok: false, message: "Something went wrong. Try again." }), clearPhone, openToday })).toBe(
      "Something went wrong. Try again.",
    );
    expect(clearPhone).not.toHaveBeenCalled();
    expect(openToday).not.toHaveBeenCalled();
  });

  it("if clearing the phone throws after the reset, it is logged and Today still opens, with no error", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const openToday = vi.fn();
    const message = await runReset({
      reset: async () => ({ ok: true }),
      clearPhone: async () => {
        throw new Error("IndexedDB blocked");
      },
      openToday,
    });
    expect(message).toBeNull();
    expect(openToday).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
