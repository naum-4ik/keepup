import { describe, expect, it } from "vitest";
import { isOneEmoji, isUuid, parseHabit, parseHabitDetails, readHabitForm, type HabitFormValues } from "./habit-schema";

const valid: HabitFormValues = { title: "  Read  ", emoji: "📖", category: "mind", targetCount: "1", period: "day", startsOn: "2026-10-05" };

describe("parseHabit", () => {
  it("accepts valid input and trims the title", () => {
    expect(parseHabit(valid)).toEqual({
      ok: true,
      value: { title: "Read", emoji: "📖", category: "mind", targetCount: 1, period: "day", startsOn: "2026-10-05" },
    });
  });

  it("leaves the start date to the database when it's empty (today)", () => {
    expect(parseHabit({ ...valid, startsOn: "" })).toEqual({
      ok: true,
      value: { title: "Read", emoji: "📖", category: "mind", targetCount: 1, period: "day" },
    });
  });

  it("rejects a malformed start date", () => {
    expect(parseHabit({ ...valid, startsOn: "5 Oct" })).toEqual({ ok: false, errors: { startsOn: "Pick a start date." } });
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
  it("validates title, emoji and category", () => {
    expect(parseHabitDetails({ title: " Walk ", emoji: " 🚶 ", category: "fitness" })).toEqual({
      ok: true,
      value: { title: "Walk", emoji: "🚶", category: "fitness" },
    });
    expect(parseHabitDetails({ title: "", emoji: "ab", category: "x" })).toEqual({
      ok: false,
      errors: { title: "Enter a title.", emoji: "Pick one emoji.", category: "Pick a category." },
    });
  });
});

describe("emoji", () => {
  it("an empty emoji falls back to the category default", () => {
    expect(parseHabitDetails({ title: "Walk", emoji: "  ", category: "fitness" })).toEqual({
      ok: true,
      value: { title: "Walk", emoji: "👟", category: "fitness" },
    });
    expect(parseHabitDetails({ title: "Budget", emoji: "", category: "work_money" })).toMatchObject({ value: { emoji: "💼" } });
  });

  it.each(["😀", "🧘‍♀️", "👍🏽", "🇮🇹", "✈️", "☕", "1️⃣", "👨‍👩‍👧‍👦"])("accepts one emoji: %s", (e) => {
    expect(isOneEmoji(e)).toBe(true);
    expect(parseHabitDetails({ title: "Walk", emoji: e, category: "fitness" })).toMatchObject({ ok: true, value: { emoji: e } });
  });

  it.each(["😀😀", "a", "ab", "1", "😀 ", "é", "a\u20E3", "🇮", "😀\u0301"])("rejects anything but one emoji: %j", (e) => {
    expect(isOneEmoji(e)).toBe(false);
  });

  it("rejects one grapheme longer than the database allows (16 code points)", () => {
    expect(isOneEmoji("😀" + "\u0301".repeat(16))).toBe(false);
    expect(parseHabit({ ...valid, emoji: "🙂🙂" })).toEqual({ ok: false, errors: { emoji: "Pick one emoji." } });
  });
});

describe("readHabitForm", () => {
  it("reads strings, missing fields as empty", () => {
    const fd = new FormData();
    fd.set("title", "Read");
    fd.set("period", "day");
    fd.set("emoji", "📖");
    expect(readHabitForm(fd)).toEqual({ title: "Read", emoji: "📖", category: "", targetCount: "", period: "day", startsOn: "" });
  });
});

describe("isUuid", () => {
  it("accepts UUIDs and rejects anything else", () => {
    expect(isUuid("00000000-0000-0000-0000-0000000000d1")).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("00000000-0000-0000-0000-0000000000d1; drop")).toBe(false);
  });
});
