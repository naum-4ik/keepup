import { describe, expect, it } from "vitest";
import { isPublicPath, safeNextPath, withNext } from "./paths";

describe("isPublicPath", () => {
  it.each(["/", "/login", "/signup", "/auth/callback", "/auth/error", "/whats-new"])("%s is public", (p) => {
    expect(isPublicPath(p)).toBe(true);
  });

  it.each(["/today", "/profile", "/profile/settings", "/onboarding", "/loginx", "/signupx", "/authx"])(
    "%s is private",
    (p) => {
      expect(isPublicPath(p)).toBe(false);
    },
  );
});

describe("safeNextPath", () => {
  it("keeps same-site paths", () => {
    expect(safeNextPath("/today")).toBe("/today");
    expect(safeNextPath("/profile/settings?tab=1")).toBe("/profile/settings?tab=1");
  });

  it.each([
    null,
    undefined,
    "",
    "today",
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
  ])("rejects %j and falls back to /today", (value) => {
    expect(safeNextPath(value)).toBe("/today");
  });

  it("uses a custom fallback", () => {
    expect(safeNextPath("//evil.com", "/")).toBe("/");
  });
});

describe("withNext", () => {
  it("adds next only when it isn't the default", () => {
    expect(withNext("/signup", "/today")).toBe("/signup");
    expect(withNext("/signup", "/progress")).toBe("/signup?next=%2Fprogress");
  });
});
