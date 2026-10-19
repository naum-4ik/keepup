import { describe, expect, it } from "vitest";
import { parseOnboarding, parseProfileSetting, parsePurpose, readOnboardingForm } from "./profile-schema";
import { errorText, errorTexts, type FieldError } from "@/lib/field-error";
import { tEn } from "@/lib/i18n/test-t";

// The validators return catalog keys; these tests keep the English they have always shown.
const english = <R extends { ok: boolean }>(r: R): R =>
  (r as { ok: boolean; errors?: Record<string, FieldError> }).ok === false && "errors" in r
    ? ({ ...r, errors: errorTexts(tEn, (r as unknown as { errors: Record<string, FieldError> }).errors) } as R)
    : r;

const zones = new Set(["UTC", "Europe/Rome", "Asia/Tokyo"]);
const say = (r: ReturnType<typeof parseProfileSetting>) => (r.ok ? r : { ok: false, error: errorText(tEn, r.error) });

describe("parseProfileSetting", () => {
  it("trims the name and saves it to display_name", () => {
    expect(parseProfileSetting("displayName", "  Ana  ", zones)).toEqual({ ok: true, update: { display_name: "Ana" } });
  });

  it("rejects a blank name", () => {
    expect(say(parseProfileSetting("displayName", "   ", zones))).toEqual({ ok: false, error: "Enter a name." });
  });

  it("allows 40 characters and rejects 41", () => {
    expect(parseProfileSetting("displayName", "x".repeat(40), zones).ok).toBe(true);
    expect(say(parseProfileSetting("displayName", "x".repeat(41), zones))).toEqual({ ok: false, error: "Keep it to 40 characters." });
  });

  it("counts characters like Postgres, not UTF-16 units", () => {
    expect(parseProfileSetting("displayName", "😀".repeat(40), zones).ok).toBe(true);
    expect(parseProfileSetting("displayName", "😀".repeat(41), zones).ok).toBe(false);
  });

  it("takes a time zone from the list only", () => {
    expect(parseProfileSetting("timezone", "Asia/Tokyo", zones)).toEqual({ ok: true, update: { timezone: "Asia/Tokyo" } });
    expect(say(parseProfileSetting("timezone", "Mars/Base", zones))).toEqual({ ok: false, error: "Pick a time zone from the list." });
  });

  it("accepts Sunday or Monday as the first day of the week", () => {
    expect(parseProfileSetting("weekStart", "0", zones)).toEqual({ ok: true, update: { week_start: 0 } });
    expect(parseProfileSetting("weekStart", "1", zones)).toEqual({ ok: true, update: { week_start: 1 } });
    expect(say(parseProfileSetting("weekStart", "3", zones))).toEqual({ ok: false, error: "Pick Sunday or Monday." });
  });

  it("refuses a field Settings doesn't save this way", () => {
    expect(parseProfileSetting("purpose", "family", zones).ok).toBe(false);
  });
});

describe("parsePurpose", () => {
  it("treats empty as not answered", () => {
    expect(parsePurpose("")).toEqual({ ok: true, value: null });
  });

  it.each(["me", "family", "friends"])("accepts %j", (p) => {
    expect(parsePurpose(p)).toEqual({ ok: true, value: p });
  });

  it.each(["work", "Family", " me"])("rejects %j", (p) => {
    expect(english(parsePurpose(p))).toEqual({ ok: false });
  });
});

describe("parseOnboarding", () => {
  const onboarding = { displayName: " Ana ", timezone: "Europe/Rome", weekStart: "0", purpose: "" };

  it("needs no reminder hour and keeps an unanswered purpose as null", () => {
    expect(parseOnboarding(onboarding, zones)).toEqual({
      ok: true,
      value: { displayName: "Ana", timezone: "Europe/Rome", weekStart: 0, purpose: null },
    });
  });

  it("keeps a chosen purpose", () => {
    expect(parseOnboarding({ ...onboarding, purpose: "family" }, zones)).toMatchObject({ ok: true, value: { purpose: "family" } });
  });

  it("reports an unknown purpose alongside the other field errors", () => {
    expect(english(parseOnboarding({ ...onboarding, displayName: "", purpose: "work" }, zones))).toEqual({
      ok: false,
      errors: { displayName: "Enter a name.", purpose: "Pick one of the options, or none." },
    });
  });

  it("reads the purpose from the form, missing as empty", () => {
    const fd = new FormData();
    fd.set("displayName", "Ana");
    expect(readOnboardingForm(fd)).toEqual({ displayName: "Ana", timezone: "", weekStart: "", purpose: "" });
  });
});
