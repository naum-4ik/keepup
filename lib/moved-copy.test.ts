import { describe, expect, it } from "vitest";
import * as copy from "./moved-copy";
import { BANNED_PATTERNS, BANNED_WORDS } from "@/lib/notification-copy";

describe("moved copy", () => {
  const strings: [string, string][] = Object.entries(copy);

  it("tells people to install again and turn reminders back on", () => {
    expect(copy.MOVED_NOTICE).toMatch(/new address/);
    expect(copy.MOVED_NOTICE).toMatch(/reminders/);
    expect(copy.INSTALL_REMINDERS).toMatch(/Turn on reminders/);
  });

  it.each(strings)("%s is short and warm", (_, text) => {
    expect(text.length).toBeLessThan(140);
    for (const word of BANNED_WORDS) expect(text.toLowerCase()).not.toContain(word);
    for (const re of BANNED_PATTERNS) expect(text).not.toMatch(re);
  });
});
