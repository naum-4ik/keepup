import { describe, expect, it } from "vitest";
import { isUuid, parseHabit, parseHabitDetails, readHabitForm, type HabitFormValues } from "./habit-schema";

const valid: HabitFormValues = { title: "  Read  ", category: "mind", targetCount: "1", period: "day", startsOn: "2026-10-05" };

describe("parseHabit", () => {
  it("accepts valid input and trims the title", () => {
    expect(parseHabit(valid)).toEqual({
      ok: true,
      value: { title: "Read", category: "mind", targetCount: 1, period: "day", startsOn: "2026-10-05" },
    });
  });

  it("needs a start date", () => {
    expect(parseHabit({ ...valid, startsOn: "" })).toEqual({ ok: false, errors: { startsOn: "Pick a start date." } });
  });

  it("rejects a blank title", () => {
    expect(parseHabit({ ...valid, title: "   " })).toEqual({ ok: false, errors: { title: "Enter a title." } });
  });

  it("allows 60 characters and rejects 61, counting like Postgres", () => {
    expect(parseHabit({ ...valid, title: "x".repeat(60) }).ok).toBe(true);
    expect(parseHabit({ ...valid, title: "😀".repeat(60) }).ok).toBe(true);
    expect(parseHabit({ ...valid, title: "x".repeat(61) })).toEqual({
      ok: false,
      errors: { title: "Keep it to 60 characters." },
    });
  });

  it("rejects unknown categories and periods", () => {
    expect(parseHabit({ ...valid, category: "sport" })).toEqual({ ok: false, errors: { category: "Pick a category." } });
    expect(parseHabit({ ...valid, period: "year" })).toEqual({ ok: false, errors: { period: "Pick how often." } });
  });

  it.each([
    ["day", "51", "Pick 1–50 times a day."],
    ["week", "8", "Pick 1–7 times a week."],
    ["month", "32", "Pick 1–31 times a month."],
    ["day", "0", "Pick 1–50 times a day."],
    ["week", "2.5", "Pick 1–7 times a week."],
    ["week", "", "Pick 1–7 times a week."],
  ])("rejects %s × %s", (period, count, message) => {
    expect(parseHabit({ ...valid, period, targetCount: count })).toEqual({ ok: false, errors: { targetCount: message } });
  });

  it("accepts the limits", () => {
    expect(parseHabit({ ...valid, period: "day", targetCount: "50" }).ok).toBe(true);
    expect(parseHabit({ ...valid, period: "week", targetCount: "7" }).ok).toBe(true);
    expect(parseHabit({ ...valid, period: "month", targetCount: "31" }).ok).toBe(true);
  });
});

describe("parseHabitDetails", () => {
  it("validates only title and category", () => {
    expect(parseHabitDetails({ title: " Walk ", category: "fitness" })).toEqual({
      ok: true,
      value: { title: "Walk", category: "fitness" },
    });
    expect(parseHabitDetails({ title: "", category: "x" })).toEqual({
      ok: false,
      errors: { title: "Enter a title.", category: "Pick a category." },
    });
  });
});

describe("readHabitForm", () => {
  it("reads strings, missing fields as empty", () => {
    const fd = new FormData();
    fd.set("title", "Read");
    fd.set("period", "day");
    expect(readHabitForm(fd)).toEqual({ title: "Read", category: "", targetCount: "", period: "day", startsOn: "" });
  });
});

describe("isUuid", () => {
  it("accepts UUIDs and rejects anything else", () => {
    expect(isUuid("00000000-0000-0000-0000-0000000000d1")).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("00000000-0000-0000-0000-0000000000d1; drop")).toBe(false);
  });
});
