import { describe, expect, it } from "vitest";
import { BANNED_PATTERNS, BANNED_WORDS } from "@/lib/notification-copy";
import en from "@/supabase/functions/_shared/messages/en.json";

// The demo's lines (M6 PR 3; the one-line header note and its X: design pass PR 1) are the catalog's `demo` section. Voice: short, warm, no hype.
describe("demo copy", () => {
  const strings: [string, string][] = Object.entries(en.demo);

  it("has every line the demo shows", () => {
    expect(strings.map(([name]) => name).sort()).toEqual(
      ["banner", "compact", "dismiss", "failed", "justLooking", "loading", "off", "settingUp", "signInLine", "tryDemo"].sort(),
    );
  });

  it.each(strings)("%s is short and warm", (_, text) => {
    expect(text.length).toBeLessThan(60);
    for (const word of BANNED_WORDS) expect(text.toLowerCase()).not.toContain(word);
    for (const re of BANNED_PATTERNS) expect(text).not.toMatch(re);
  });
});
