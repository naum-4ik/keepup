import { describe, expect, it } from "vitest";
import { fromWeekStart, weekdayLabels } from "@/lib/weekdays";

describe("weekdayLabels (en)", () => {
  it("narrow is one letter, Sunday first", () => {
    expect(weekdayLabels("en", "narrow")).toEqual(["S", "M", "T", "W", "T", "F", "S"]);
  });
  it("short is the en-GB short name", () => {
    expect(weekdayLabels("en", "short")).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
  });
  it("two is short cut to two letters", () => {
    expect(weekdayLabels("en", "two")).toEqual(["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]);
  });
  it("two uses narrow outside English", () => {
    expect(weekdayLabels("ru", "two")).toEqual(weekdayLabels("ru", "narrow"));
  });
});

describe("fromWeekStart", () => {
  it("rotates to Monday", () => {
    expect(fromWeekStart(["S", "M", "T"], 1)).toEqual(["M", "T", "S"]);
    expect(fromWeekStart(["S", "M", "T"], 0)).toEqual(["S", "M", "T"]);
  });
});
