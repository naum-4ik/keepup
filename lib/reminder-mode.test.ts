import { describe, expect, it } from "vitest";
import { QUARTER_HOURS, reminderError, reminderHint, reminderMode } from "./reminder-mode";

describe("reminderMode", () => {
  it("no row means the daily summary", () => {
    expect(reminderMode(null)).toEqual({ mode: "summary", remindAt: null });
  });
  it("a time, trimmed to HH:MM", () => {
    expect(reminderMode({ reminders: true, remind_at: "08:00:00" })).toEqual({ mode: "time", remindAt: "08:00" });
  });
  it("off wins over a stale time", () => {
    expect(reminderMode({ reminders: false, remind_at: "08:00:00" })).toEqual({ mode: "off", remindAt: null });
  });
});

describe("reminderHint", () => {
  it("says when, in plain words", () => {
    expect(reminderHint({ mode: "summary", remindAt: null, reminderHour: 20, muted: false })).toBe("In your daily summary at 20:00");
    expect(reminderHint({ mode: "time", remindAt: "07:30", reminderHour: 20, muted: false })).toBe("At 07:30");
    expect(reminderHint({ mode: "off", remindAt: null, reminderHour: 20, muted: false })).toBe("No reminders");
    expect(reminderHint({ mode: "summary", remindAt: null, reminderHour: 7, muted: true })).toBe("Muted");
  });
});

describe("reminderError", () => {
  it("accepts quarter hours only, and only for a time", () => {
    expect(reminderError("time", "08:00")).toBeNull();
    expect(reminderError("time", "23:45")).toBeNull();
    expect(reminderError("summary", null)).toBeNull();
    expect(reminderError("off", null)).toBeNull();
    expect(reminderError("time", "08:05")).toBe("Pick a time on the quarter hour.");
    expect(reminderError("time", "24:00")).toBe("Pick a time on the quarter hour.");
    expect(reminderError("time", null)).toBe("Pick a time on the quarter hour.");
    expect(reminderError("loud", null)).toBe("Pick when to remind you.");
  });
  it("offers 96 slots, all valid", () => {
    expect(QUARTER_HOURS).toHaveLength(96);
    expect(QUARTER_HOURS[0]).toBe("00:00");
    expect(QUARTER_HOURS[95]).toBe("23:45");
    expect(QUARTER_HOURS.every((q) => reminderError("time", q) === null)).toBe(true);
  });
});
