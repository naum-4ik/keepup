import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APP_PREFIXES, needsSignIn, safeNextPath, withNext } from "./paths";

describe("needsSignIn", () => {
  it.each(["/today", "/progress/recaps", "/habits/new", "/groups/abc", "/inbox", "/kids/abc/play", "/profile/settings", "/onboarding"])(
    "%s is an app screen: signed out, it goes to /login",
    (p) => {
      expect(needsSignIn(p)).toBe(true);
    },
  );

  it.each(["/", "/login", "/signup", "/auth/callback", "/auth/new-password", "/whats-new", "/offline", "/privacy", "/terms", "/install", "/invite/abc"])(
    "%s is public",
    (p) => {
      expect(needsSignIn(p)).toBe(false);
    },
  );

  it("lets files and API routes answer for themselves", () => {
    for (const p of ["/manifest.webmanifest", "/sw.js", "/robots.txt", "/sitemap.xml", "/api/check-ins/abc/review"]) {
      expect(needsSignIn(p)).toBe(false);
    }
  });

  it.each(["/nope", "/todayx", "/profiles", "/kidsx/1", "/wp-login.php"])("%s is unknown, so it gets the real 404", (p) => {
    expect(needsSignIn(p)).toBe(false);
  });

  // A new screen under app/ must be either listed as an app screen or known to be public, so a
  // signed-out visit never lands on a page that expects a session (or a public page behind a sign-in).
  it("knows every top-level route under app/", () => {
    const PUBLIC = new Set(["login", "signup", "auth", "whats-new", "privacy", "terms", "install", "invite", "offline", "api", "demo"]);
    const segments = new Set<string>();
    const collect = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
        if (entry.name.startsWith("(")) collect(join(dir, entry.name));
        else segments.add(entry.name);
      }
    };
    collect(join(process.cwd(), "app"));
    const NOT_ROUTES = new Set(["fonts"]); // next/font/local files, no page
    const known = new Set([...PUBLIC, ...NOT_ROUTES, ...APP_PREFIXES.map((p) => p.slice(1))]);
    expect([...segments].filter((s) => !known.has(s))).toEqual([]);
  });
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
