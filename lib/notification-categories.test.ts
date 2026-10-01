import { describe, expect, it } from "vitest";
import { deliveryByCategory, validDelivery } from "./notification-categories";

describe("validDelivery", () => {
  it("takes the three choices for a known category", () => {
    expect(["sound", "silent", "inbox"].every((d) => validDelivery("nudges", d))).toBe(true);
  });
  it("refuses anything else", () => {
    expect(validDelivery("nudges", "loud")).toBe(false);
    expect(validDelivery("nudges", null)).toBe(false);
    expect(validDelivery("marketing", "silent")).toBe(false);
    expect(validDelivery("always", "inbox")).toBe(false);
    expect(validDelivery("achievements", "silent")).toBe(false); // not offered until M5
  });
});

describe("deliveryByCategory", () => {
  it("is Silent everywhere without rows", () => {
    expect(deliveryByCategory(null)).toEqual({
      reminders: "silent", group_activity: "silent", approvals: "silent", nudges: "silent", group_updates: "silent",
    });
  });
  it("reads each row, skipping ones it doesn't know", () => {
    const d = deliveryByCategory([
      { category: "nudges", delivery: "inbox" },
      { category: "approvals", delivery: "sound" },
      { category: "reminders", delivery: "vibrate" },
      { category: "achievements", delivery: "inbox" },
    ]);
    expect(d).toMatchObject({ nudges: "inbox", approvals: "sound", reminders: "silent" });
    expect(d).not.toHaveProperty("achievements");
  });
});
