import { describe, expect, it } from "vitest";
import { LANDING } from "./landing-copy";
import { BANNED_PATTERNS, BANNED_WORDS } from "@/lib/notification-copy";

// Every string in the landing copy, however deep.
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

describe("landing copy", () => {
  const all = strings(LANDING);

  it("has no hype or guilt words", () => {
    expect(all.length).toBeGreaterThan(10);
    for (const text of all) {
      for (const word of BANNED_WORDS) expect(text.toLowerCase()).not.toContain(word);
      for (const re of BANNED_PATTERNS) expect(text).not.toMatch(re);
    }
  });

  it("never promises no tracking: traces go to Grafana for fixing bugs", () => {
    for (const text of all) expect(text.toLowerCase()).not.toContain("no tracking");
  });

  it("lists the four privacy points", () => {
    expect(LANDING.privacy.points).toEqual([
      "No ads. Nothing sold or shared for marketing.",
      "Kids are a nickname only, never photos.",
      "Your private habits are only yours.",
      "Export or delete your data anytime.",
    ]);
  });

  it("has the hero buttons", () => {
    expect(LANDING.hero).toMatchObject({ primary: "Try it", secondary: "Get started", signIn: "Sign in" });
  });

  it("gives every section a landing picture with alt text", () => {
    expect(LANDING.sections.map((s) => s.key)).toEqual(["habits", "together", "kids"]);
    for (const section of LANDING.sections) {
      expect(section.image).toMatch(/^\/landing\/.+\.png$/);
      expect(section.alt.trim()).not.toBe("");
    }
  });
});
