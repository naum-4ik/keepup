import { describe, expect, it } from "vitest";
import { approvalsLabel, tabFromKey } from "./tabs";

describe("tabFromKey", () => {
  it("moves with the arrows and wraps at both ends", () => {
    expect(tabFromKey("ArrowRight", 0, 2)).toBe(1);
    expect(tabFromKey("ArrowRight", 1, 2)).toBe(0);
    expect(tabFromKey("ArrowLeft", 0, 2)).toBe(1);
    expect(tabFromKey("ArrowLeft", 1, 2)).toBe(0);
  });
  it("jumps with Home and End, and ignores other keys", () => {
    expect(tabFromKey("Home", 2, 3)).toBe(0);
    expect(tabFromKey("End", 0, 3)).toBe(2);
    expect(tabFromKey("Enter", 1, 3)).toBeNull();
    expect(tabFromKey("ArrowDown", 1, 3)).toBeNull();
  });
});

describe("approvalsLabel", () => {
  it("counts what's waiting, and says nothing about zero", () => {
    expect(approvalsLabel(2)).toBe("Approvals (2)");
    expect(approvalsLabel(1)).toBe("Approvals (1)");
    expect(approvalsLabel(0)).toBe("Approvals");
  });
});
