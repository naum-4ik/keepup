import { describe, expect, it } from "vitest";
import { parseProfile, readProfileForm, type ProfileFormValues } from "./profile-schema";

const zones = new Set(["UTC", "Europe/Rome", "Asia/Tokyo"]);
const valid: ProfileFormValues = { displayName: "  Ana  ", timezone: "Europe/Rome", reminderHour: "21" };

describe("parseProfile", () => {
  it("accepts valid input and trims the name", () => {
    expect(parseProfile(valid, zones)).toEqual({
      ok: true,
      value: { displayName: "Ana", timezone: "Europe/Rome", reminderHour: 21 },
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
});

describe("readProfileForm", () => {
  it("reads the three fields as strings, missing ones as empty", () => {
    const fd = new FormData();
    fd.set("displayName", "Ana");
    fd.set("timezone", "UTC");
    expect(readProfileForm(fd)).toEqual({ displayName: "Ana", timezone: "UTC", reminderHour: "" });
  });
});
