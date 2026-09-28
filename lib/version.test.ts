import { describe, expect, it } from "vitest";
import { formatVersion } from "./version";

describe("formatVersion", () => {
  it("shows the version and the short commit", () => {
    expect(formatVersion("1.1.0", "a3f9c21e0b4d")).toBe("v1.1.0 · a3f9c21");
  });

  it("falls back to dev when there is no commit", () => {
    expect(formatVersion("0.1.0", undefined)).toBe("v0.1.0 · dev");
    expect(formatVersion("0.1.0", "")).toBe("v0.1.0 · dev");
    expect(formatVersion("0.1.0", null)).toBe("v0.1.0 · dev");
  });
});
