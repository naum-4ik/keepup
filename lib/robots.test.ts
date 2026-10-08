import { describe, expect, it } from "vitest";
import { isPublicPath } from "./paths";
import { DISALLOWED, robotsRules } from "./robots";

const blocked = (path: string) => DISALLOWED.some((prefix) => path === prefix || path.startsWith(prefix));

describe("robots.txt", () => {
  it.each(["/", "/privacy", "/install", "/whats-new"])("lets crawlers read %s", (p) => {
    expect(blocked(p)).toBe(false);
    expect(isPublicPath(p)).toBe(true);
  });

  it.each(["/today", "/progress/recaps", "/habits/new", "/groups", "/inbox", "/kids/abc", "/profile/settings", "/onboarding", "/login", "/signup", "/auth/callback", "/invite/abc", "/api/check-ins/tap"])(
    "keeps crawlers out of %s",
    (p) => {
      expect(blocked(p)).toBe(true);
    },
  );

  it("allows everything else, for every crawler, with no sitemap", () => {
    expect(robotsRules()).toEqual({ rules: { userAgent: "*", allow: "/", disallow: DISALLOWED } });
  });
});
