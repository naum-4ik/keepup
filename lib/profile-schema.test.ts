import { describe, expect, it } from "vitest";
import {
  parseOnboarding, parseProfile, parsePurpose, readOnboardingForm, readProfileForm, type ProfileFormValues,
} from "./profile-schema";

const zones = new Set(["UTC", "Europe/Rome", "Asia/Tokyo"]);
const valid: ProfileFormValues = {
  displayName: "  Ana  ",
  timezone: "Europe/Rome",
  reminderHour: "21",
  weekStart: "1",
};

describe("parseProfile", () => {
  it("accepts valid input and trims the name", () => {
    expect(parseProfile(valid, zones)).toEqual({
      ok: true,
      value: { displayName: "Ana", timezone: "Europe/Rome", reminderHour: 21, weekStart: 1 },
    });
  });

  it("rejects a blank name", () => {
    const r = parseProfile({ ...valid, displayName: "   " }, zones);
    expect(r).toEqual({ ok: false, errors: { displayName: "Enter a name." } });
  });

  it("allows 40 characters and rejects 41", () => {
    expect(parseProfile({ ...valid, displayName: "x".repeat(40) }, zones).ok).toBe(true);
    expect(parseProfile({ ...valid, displayName: "x".repeat(41) }, zones)).toEqual({
      ok: false,
      errors: { displayName: "Keep it to 40 characters." },
    });
  });

  it("counts characters like Postgres, not UTF-16 units", () => {
    expect(parseProfile({ ...valid, displayName: "😀".repeat(40) }, zones).ok).toBe(true);
    expect(parseProfile({ ...valid, displayName: "😀".repeat(41) }, zones).ok).toBe(false);
  });

  it("rejects an unknown time zone", () => {
    expect(parseProfile({ ...valid, timezone: "Mars/Base" }, zones)).toEqual({
      ok: false,
      errors: { timezone: "Pick a time zone from the list." },
    });
  });

  it.each(["24", "-1", "7.5", "", "abc"])("rejects reminder hour %j", (h) => {
    expect(parseProfile({ ...valid, reminderHour: h }, zones)).toEqual({
      ok: false,
      errors: { reminderHour: "Pick an hour between 00:00 and 23:00." },
    });
  });

  it("accepts midnight", () => {
    expect(parseProfile({ ...valid, reminderHour: "0" }, zones).ok).toBe(true);
  });

  it("accepts Sunday or Monday as the first day of the week", () => {
    expect(parseProfile({ ...valid, weekStart: "0" }, zones)).toMatchObject({ ok: true, value: { weekStart: 0 } });
    expect(parseProfile({ ...valid, weekStart: "3" }, zones)).toEqual({
      ok: false,
      errors: { weekStart: "Pick Sunday or Monday." },
    });
  });
});

describe("readProfileForm", () => {
  it("reads the four fields as strings, missing ones as empty", () => {
    const fd = new FormData();
    fd.set("displayName", "Ana");
    fd.set("timezone", "UTC");
    expect(readProfileForm(fd)).toEqual({ displayName: "Ana", timezone: "UTC", reminderHour: "", weekStart: "" });
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
    expect(parsePurpose(p)).toEqual({ ok: false });
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
    expect(parseOnboarding({ ...onboarding, displayName: "", purpose: "work" }, zones)).toEqual({
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
