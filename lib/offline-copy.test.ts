// lib/offline-copy.test.ts
import { describe, expect, it } from "vitest";
import { tEn } from "@/lib/i18n/test-t";
import { BANNED_PATTERNS, BANNED_WORDS } from "./notification-copy";
import { undoLabel, unsavedSignOut } from "./offline-copy";

describe("sign-out with check-ins still on the phone", () => {
  it("says how many, and what happens to them", () => {
    expect(unsavedSignOut(tEn, 2)).toBe("2 check-ins haven't been saved yet. Sign out anyway? They'll be removed from this phone.");
    expect(unsavedSignOut(tEn, 1)).toBe("1 check-in hasn't been saved yet. Sign out anyway? It'll be removed from this phone.");
    expect(unsavedSignOut(tEn, 1200)).toBe("1200 check-ins haven't been saved yet. Sign out anyway? They'll be removed from this phone.");
  });

  it("names the habit being undone, isolated", () => {
    expect(undoLabel(tEn, "Read")).toBe("Undo check-in for \u2068Read\u2069");
  });

  it("uses no banned words", () => {
    const texts = [unsavedSignOut(tEn, 1), unsavedSignOut(tEn, 5), tEn("offline.signOutAnyway"), tEn("offline.staySignedIn")];
    for (const text of texts.map((t) => t.toLowerCase())) {
      for (const word of BANNED_WORDS) expect(text).not.toContain(word);
      for (const re of BANNED_PATTERNS) expect(text).not.toMatch(re);
    }
  });
});
