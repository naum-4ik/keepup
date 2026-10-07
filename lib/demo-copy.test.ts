import { describe, expect, it } from "vitest";
import * as copy from "./demo-copy";
import { BANNED_PATTERNS, BANNED_WORDS } from "@/lib/notification-copy";

describe("demo copy", () => {
  const strings: [string, string][] = Object.entries(copy);

  it("has every line the demo shows", () => {
    expect(strings.map(([name]) => name).sort()).toEqual(
      ["DEMO_BANNER", "DEMO_FAILED", "DEMO_OFF", "DEMO_SIGN_IN", "DEMO_SIGN_IN_TAIL", "JUST_LOOKING", "SETTING_UP", "TRY_DEMO"].sort(),
    );
  });

  it.each(strings)("%s is short and warm", (_, text) => {
    expect(text.length).toBeLessThan(60);
    for (const word of BANNED_WORDS) expect(text.toLowerCase()).not.toContain(word);
    for (const re of BANNED_PATTERNS) expect(text).not.toMatch(re);
  });
});
