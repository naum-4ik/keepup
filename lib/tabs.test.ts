import { describe, expect, it } from "vitest";
import { tEn } from "@/lib/i18n/test-t";
import { approvalsLabel, tabFromKey } from "./tabs";

describe("tabFromKey", () => {
  it("moves with the arrows and wraps at both ends", () => {
    expect(tabFromKey("ArrowRight", 0, 2, "ltr")).toBe(1);
    expect(tabFromKey("ArrowRight", 1, 2, "ltr")).toBe(0);
    expect(tabFromKey("ArrowLeft", 0, 2, "ltr")).toBe(1);
    expect(tabFromKey("ArrowLeft", 1, 2, "ltr")).toBe(0);
  });
  it("swaps the arrows in right-to-left text", () => {
    expect(tabFromKey("ArrowLeft", 0, 3, "rtl")).toBe(1);
    expect(tabFromKey("ArrowLeft", 2, 3, "rtl")).toBe(0);
    expect(tabFromKey("ArrowRight", 0, 3, "rtl")).toBe(2);
    expect(tabFromKey("ArrowRight", 2, 3, "rtl")).toBe(1);
    expect(tabFromKey("Home", 2, 3, "rtl")).toBe(0);
  });
  it("jumps with Home and End, and ignores other keys", () => {
    expect(tabFromKey("Home", 2, 3, "ltr")).toBe(0);
    expect(tabFromKey("End", 0, 3, "ltr")).toBe(2);
    expect(tabFromKey("Enter", 1, 3, "ltr")).toBeNull();
    expect(tabFromKey("ArrowDown", 1, 3, "ltr")).toBeNull();
  });
});

describe("approvalsLabel", () => {
  it("counts what's waiting, and says nothing about zero", () => {
    expect(approvalsLabel(tEn, 2)).toBe("Approvals (2)");
    expect(approvalsLabel(tEn, 1)).toBe("Approvals (1)");
    expect(approvalsLabel(tEn, 0)).toBe("Approvals");
  });
});
