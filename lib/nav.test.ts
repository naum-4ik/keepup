// lib/nav.test.ts
import { describe, expect, it } from "vitest";
import { isNavActive, tabTone } from "./nav";

describe("bottom nav tabs", () => {
  it("marks a section's tab on its page and the pages under it", () => {
    expect(isNavActive("/profile", "/profile")).toBe(true);
    expect(isNavActive("/profile/settings", "/profile")).toBe(true);
    expect(isNavActive("/progress/calendar", "/progress")).toBe(true);
  });
  it("doesn't mark a tab whose path is only a prefix of the word", () => {
    expect(isNavActive("/profiles", "/profile")).toBe(false);
    expect(isNavActive("/today", "/progress")).toBe(false);
  });
  it("shows a tapped tab as pending until its page commits, then as current", () => {
    expect(tabTone(false, true)).toBe("pending");
    expect(tabTone(true, false)).toBe("current");
    expect(tabTone(true, true)).toBe("current");
    expect(tabTone(false, false)).toBe("idle");
  });
});
