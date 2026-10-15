import { describe, expect, it } from "vitest";
import { localeSync } from "@/lib/locale-sync";
const enabled = ["en", "ru", "he"] as const;

describe("localeSync", () => {
  it("first visit: saves the phone's language to the profile and the cookie", () =>
    expect(localeSync({ profileLocale: null, cookieLocale: null, detected: "ru", requestLocale: "ru", enabled: [...enabled] }))
      .toEqual({ saveToProfile: "ru", setCookie: "ru" }));
  it("first visit while only English is enabled: saves the phone's language, no cookie yet", () =>
    expect(localeSync({ profileLocale: null, cookieLocale: null, detected: "ru", requestLocale: "en", enabled: ["en"] }))
      .toEqual({ saveToProfile: "ru", setCookie: null }));
  it("another device: the profile wins and the cookie follows", () =>
    expect(localeSync({ profileLocale: "he", cookieLocale: "en", detected: "en", requestLocale: "en", enabled: [...enabled] }))
      .toEqual({ saveToProfile: null, setCookie: "he" }));
  it("in sync: nothing to do", () =>
    expect(localeSync({ profileLocale: "ru", cookieLocale: "ru", detected: "ru", requestLocale: "ru", enabled: [...enabled] }))
      .toEqual({ saveToProfile: null, setCookie: null }));
  it("a profile language that isn't enabled here stays saved but the page uses English", () =>
    expect(localeSync({ profileLocale: "he", cookieLocale: null, detected: "he", requestLocale: "en", enabled: ["en"] }))
      .toEqual({ saveToProfile: null, setCookie: null }));
});
