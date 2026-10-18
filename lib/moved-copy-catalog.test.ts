import { describe, expect, it } from "vitest";
import { BANNED_PATTERNS, BANNED_WORDS } from "@/lib/notification-copy";
import { tEn } from "@/lib/i18n/test-t";
import en from "@/supabase/functions/_shared/messages/en.json";

// The "Keepup moved" notice and the /install page: the catalog's `moved` section. Voice: short, warm, no hype.
describe("moved copy", () => {
  const strings: [string, string][] = Object.entries(en.moved);

  it("tells people to install again and turn reminders back on", () => {
    expect(en.moved.notice).toMatch(/new address/);
    expect(en.moved.notice).toMatch(/reminders/);
    const menu = { profile: tEn("nav.profile"), settings: tEn("settings.title"), turnOn: tEn("notifications.turnOn.label") };
    expect(tEn("moved.installReminders", menu)).toBe("Reinstalled? Reminders don't move with the app. Turn them on again: Profile → Settings → Turn on reminders.");
  });

  it.each(strings)("%s is short and warm", (_, text) => {
    expect(text.length).toBeLessThan(140);
    for (const word of BANNED_WORDS) expect(text.toLowerCase()).not.toContain(word);
    for (const re of BANNED_PATTERNS) expect(text).not.toMatch(re);
  });
});
