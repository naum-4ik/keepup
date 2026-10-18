// lib/offline-copy.test.ts
import { describe, expect, it } from "vitest";
import { tEn } from "@/lib/i18n/test-t";
import { BANNED_PATTERNS, BANNED_WORDS } from "./notification-copy";
import { LOCALE_COOKIE, asLocale, pickLocale, type Locale } from "@/i18n/config";
import { offlineLocaleScript, offlinePageLocale, undoLabel, unsavedSignOut } from "./offline-copy";

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
  // The app's own rules for the same inputs: the locale cookie through asLocale, else Accept-Language through pickLocale.
  const appRule = (cookie: string, phone: string | undefined, available: Locale[]): Locale => {
    const fromCookie = cookie.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${LOCALE_COOKIE}=`))?.slice(LOCALE_COOKIE.length + 1);
    return asLocale(fromCookie, available) ?? pickLocale(phone ?? null, available);
  };
  // Every case below runs through both, so a change to either side fails here.
  const pick = (cookie: string, phone: string | undefined, available: Locale[] = [...all]) => {
    const got = offlinePageLocale(cookie, phone, available);
    expect(got, `app rules for ${cookie} | ${phone}`).toBe(appRule(cookie, phone, available));
    return got;
  };

  it("takes the locale cookie first", () => {
    expect(pick("theme=x; locale=he; other=1", "ru-RU")).toBe("he");
    expect(pick("locale=ru", "en-GB")).toBe("ru");
  });

  it("then the phone's language, by its first two letters (iw is he)", () => {
    expect(pick("", "ru-RU")).toBe("ru");
    expect(pick("theme=x", "iw-IL")).toBe("he");
    expect(pick("", "HE")).toBe("he");
  });

  it("walks the phone's languages in order, as the server reads Accept-Language", () => {
    expect(pick("", "fr-FR,ru-RU,en")).toBe("ru");
    expect(pick("", "de,iw-IL")).toBe("he");
    expect(pick("", "fr-FR,de")).toBe("en");
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

describe("the offline page's inline language script", () => {
  // Runs the script as the browser would, with a fake document and navigator; returns the data-locale it set.
  const run = (cookie: string, languages: string[] | undefined, language: string, available: ("en" | "ru" | "he")[] = ["en", "ru", "he"]) => {
    const attrs: Record<string, string> = {};
    const parentNode = { setAttribute: (k: string, v: string) => { attrs[k] = v; } };
    new Function("document", "navigator", offlineLocaleScript(available))({ cookie, currentScript: { parentNode } }, { languages, language });
    return attrs["data-locale"];
  };

  it("picks like offlinePageLocale, from the cookie, then the phone's languages", () => {
    const cases: [string, string[] | undefined, string][] = [
      ["theme=x; locale=he; other=1", ["ru-RU"], "ru-RU"], ["locale=fr", ["ru"], "ru"], ["", ["fr-FR", "ru-RU", "en"], "fr-FR"],
      ["", ["de", "iw-IL"], "de"], ["", undefined, "HE"], ["", [], ""], ["xlocale=ru", ["fr"], "fr"], ["", undefined, ""],
    ];
    for (const [cookie, languages, language] of cases) {
      const phone = languages?.join(",") || language;
      expect(run(cookie, languages, language), `${cookie} | ${phone}`).toBe(offlinePageLocale(cookie, phone, ["en", "ru", "he"]));
    }
    expect(run("locale=ru", ["he-IL"], "he-IL", ["en", "he"])).toBe("he");
  });

  it("follows the app's own rules (cookie name, asLocale, pickLocale)", () => {
    expect(run(`${LOCALE_COOKIE}=ru`, ["he"], "he")).toBe("ru");
    for (const phone of ["fr-FR,ru-RU,en", "de,iw-IL", "fr-FR,de", "HE", ""]) {
      expect(offlinePageLocale("", phone, ["en", "ru", "he"])).toBe(pickLocale(phone, ["en", "ru", "he"]));
    }
    expect(offlinePageLocale("locale=he", "ru", ["en", "ru", "he"])).toBe(asLocale("he", ["en", "ru", "he"]));
  });

  it("never throws: a page without currentScript just stays English", () => {
    expect(() => new Function("document", "navigator", offlineLocaleScript(["en"]))({ cookie: "" }, {})).not.toThrow();
  });
});
