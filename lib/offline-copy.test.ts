// lib/offline-copy.test.ts
import { describe, expect, it } from "vitest";
import { tEn } from "@/lib/i18n/test-t";
import { BANNED_PATTERNS, BANNED_WORDS } from "./notification-copy";
import { offlinePageLocale, undoLabel, unsavedSignOut } from "./offline-copy";

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

describe("the offline page's language", () => {
  const all = ["en", "ru", "he"] as const;
  const pick = (cookie: string, phone: string | undefined, available: ("en" | "ru" | "he")[] = [...all]) =>
    offlinePageLocale(cookie, phone, available);

  it("takes the locale cookie first", () => {
    expect(pick("theme=x; locale=he; other=1", "ru-RU")).toBe("he");
    expect(pick("locale=ru", "en-GB")).toBe("ru");
  });

  it("then the phone's language, by its first two letters (iw is he)", () => {
    expect(pick("", "ru-RU")).toBe("ru");
    expect(pick("theme=x", "iw-IL")).toBe("he");
    expect(pick("", "HE")).toBe("he");
  });

  it("skips a cookie this build has no words for", () => {
    expect(pick("locale=fr", "ru")).toBe("ru");
    expect(pick("locale=ru", "he-IL", ["en", "he"])).toBe("he");
  });

  it("falls back to English", () => {
    expect(pick("", undefined)).toBe("en");
    expect(pick("locale=de", "fr-FR")).toBe("en");
    expect(pick("locale=ru", "ru-RU", ["en"])).toBe("en");
    expect(pick("xlocale=ru", "")).toBe("en");
  });
});
