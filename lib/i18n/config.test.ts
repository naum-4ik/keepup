import { describe, expect, it } from "vitest";
import { asLocale, enabledLocales, pickLocale } from "@/i18n/config";
import { isolate, isRtl } from "@/supabase/functions/_shared/i18n";

describe("pickLocale", () => {
  const all = ["en", "ru", "he"] as const;
  it("takes the first supported language", () => {
    expect(pickLocale("ru-RU,ru;q=0.9,en;q=0.8", [...all])).toBe("ru");
    expect(pickLocale("fr-FR,he;q=0.5", [...all])).toBe("he");
  });
  it("maps the old Hebrew code iw", () => expect(pickLocale("iw-IL", [...all])).toBe("he"));
  it("ignores languages that are not enabled", () => expect(pickLocale("ru-RU", ["en"])).toBe("en"));
  it("falls back to English", () => {
    expect(pickLocale(null, [...all])).toBe("en");
    expect(pickLocale("de-DE", [...all])).toBe("en");
  });
});

describe("enabledLocales", () => {
  it("defaults to English and always keeps it", () => {
    expect(enabledLocales(undefined)).toEqual(["en"]);
    expect(enabledLocales("ru,he")).toEqual(["en", "ru", "he"]);
    expect(enabledLocales(" en , ru ,xx")).toEqual(["en", "ru"]);
  });
});

describe("asLocale / isRtl / isolate", () => {
  it("accepts only enabled codes", () => {
    expect(asLocale("ru", ["en", "ru"])).toBe("ru");
    expect(asLocale("he", ["en", "ru"])).toBeNull();
    expect(asLocale(undefined, ["en"])).toBeNull();
  });
  it("only Hebrew is right-to-left", () => expect([isRtl("en"), isRtl("ru"), isRtl("he")]).toEqual([false, false, true]));
  it("wraps user text in first-strong isolates", () => expect(isolate("Read")).toBe("⁨Read⁩"));
});
