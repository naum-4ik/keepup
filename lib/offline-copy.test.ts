// lib/offline-copy.test.ts
import { describe, expect, it } from "vitest";
import { BANNED_PATTERNS, BANNED_WORDS } from "./notification-copy";
import { SIGN_OUT_ANYWAY, STAY_SIGNED_IN, unsavedSignOut } from "./offline-copy";

describe("sign-out with check-ins still on the phone", () => {
  it("says how many, and what happens to them", () => {
    expect(unsavedSignOut(2)).toBe("2 check-ins haven't been saved yet. Sign out anyway? They'll be removed from this phone.");
    expect(unsavedSignOut(1)).toBe("1 check-in hasn't been saved yet. Sign out anyway? It'll be removed from this phone.");
  });

  it("uses no banned words", () => {
    for (const text of [unsavedSignOut(1), unsavedSignOut(5), SIGN_OUT_ANYWAY, STAY_SIGNED_IN].map((t) => t.toLowerCase())) {
      for (const word of BANNED_WORDS) expect(text).not.toContain(word);
      for (const re of BANNED_PATTERNS) expect(text).not.toMatch(re);
    }
  });
});
