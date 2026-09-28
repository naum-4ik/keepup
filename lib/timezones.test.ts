import { describe, expect, it } from "vitest";
import { listTimezones, pickTimezone } from "./timezones";

describe("listTimezones", () => {
  it("always includes UTC and real IANA zones", () => {
    const zones = listTimezones();
    expect(zones).toContain("UTC");
    expect(zones).toContain("Europe/Rome");
  });
});

describe("pickTimezone", () => {
  const allowed = ["UTC", "Europe/Rome"];

  it("keeps a known zone", () => {
    expect(pickTimezone("Europe/Rome", allowed)).toBe("Europe/Rome");
  });

  it.each([undefined, null, "", "Mars/Base"])("falls back to UTC for %j", (v) => {
    expect(pickTimezone(v, allowed)).toBe("UTC");
  });
});
