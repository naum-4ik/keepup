import { describe, expect, it } from "vitest";
import { defaultDelivery, deliveryByCategory, reminderHourHint, reminderStatus, validDelivery } from "./notification-categories";

describe("validDelivery", () => {
  it("takes the three choices for a known category", () => {
    expect(["sound", "silent", "inbox"].every((d) => validDelivery("nudges", d))).toBe(true);
  });
  it("refuses anything else", () => {
    expect(validDelivery("nudges", "loud")).toBe(false);
    expect(validDelivery("nudges", null)).toBe(false);
    expect(validDelivery("marketing", "silent")).toBe(false);
    expect(validDelivery("always", "inbox")).toBe(false);
    expect(validDelivery("achievements", "silent")).toBe(true);
  });
});

describe("deliveryByCategory", () => {
  it("is Silent everywhere without rows, except Achievements: Inbox only", () => {
    expect(deliveryByCategory(null)).toEqual({
      reminders: "silent", group_activity: "silent", approvals: "silent", nudges: "silent", group_updates: "silent", achievements: "inbox",
    });
    expect(defaultDelivery("achievements")).toBe("inbox");
    expect(defaultDelivery("nudges")).toBe("silent");
  });
  it("reads each row, skipping ones it doesn't know", () => {
    const d = deliveryByCategory([
      { category: "nudges", delivery: "inbox" },
      { category: "approvals", delivery: "sound" },
      { category: "reminders", delivery: "vibrate" },
      { category: "achievements", delivery: "sound" },
      { category: "marketing", delivery: "sound" },
    ]);
    expect(d).toMatchObject({ nudges: "inbox", approvals: "sound", reminders: "silent", achievements: "sound" });
    expect(d).not.toHaveProperty("marketing");
  });
});

describe("Settings: the reminder line for this device", () => {
  const on = { pausedUntil: null, delivery: "silent" as const, arrivesAt: null };
  it("on, and just turned on with the hour", () => {
    expect(reminderStatus(on)).toBe("Reminders are on for this device ✓");
    expect(reminderStatus({ ...on, arrivesAt: "07:00" })).toBe("Reminders are on for this device ✓ Your daily summary arrives at 07:00.");
  });
  it("Pause all says until when, even over Inbox only", () => {
    expect(reminderStatus({ ...on, pausedUntil: "Mon 08:00" })).toBe("Reminders are paused until Mon 08:00.");
    expect(reminderStatus({ ...on, pausedUntil: "you turn them back on", delivery: "inbox" })).toBe("Reminders are paused until you turn them back on.");
  });
  it("Inbox only says where they go", () => {
    expect(reminderStatus({ ...on, delivery: "inbox" })).toBe("Reminders go to your Inbox.");
  });
  it("without a device, the hour applies once reminders are on", () => {
    expect(reminderHourHint(false)).toBe("When your daily summary arrives, once reminders are on.");
    expect(reminderHourHint(true)).toBe("When your daily summary arrives.");
  });
});
