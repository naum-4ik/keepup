import { describe, expect, it } from "vitest";
import { cityOf, describeZone, listTimezones, pickTimezone, timeChoices } from "./timezones";

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

describe("cityOf", () => {
  it.each([
    ["Asia/Jerusalem", "Jerusalem"],
    ["America/New_York", "New York"],
    ["America/Argentina/Buenos_Aires", "Buenos Aires"],
    ["UTC", "UTC"],
    // Browsers still list some cities under their old names.
    ["Asia/Calcutta", "Kolkata"],
    ["Europe/Kiev", "Kyiv"],
    ["Asia/Saigon", "Ho Chi Minh City"],
  ])("%s → %s", (tz, city) => {
    expect(cityOf(tz)).toBe(city);
  });
});

describe("describeZone", () => {
  const summer = new Date("2026-07-01T12:00:00Z");
  const winter = new Date("2026-01-15T12:00:00Z");

  it("gives the city, region, offset and local time at that instant", () => {
    expect(describeZone("Asia/Tokyo", summer)).toEqual({
      id: "Asia/Tokyo", city: "Tokyo", region: "Asia", offset: "GMT+9", offsetMinutes: 540, time: "21:00",
    });
  });

  it("follows daylight saving time", () => {
    expect(describeZone("Europe/London", winter)).toMatchObject({ offset: "GMT", offsetMinutes: 0, time: "12:00" });
    expect(describeZone("Europe/London", summer)).toMatchObject({ offset: "GMT+1", offsetMinutes: 60, time: "13:00" });
  });

  it("handles half-hour and negative offsets", () => {
    expect(describeZone("Asia/Kolkata", winter)).toMatchObject({ offset: "GMT+5:30", offsetMinutes: 330, time: "17:30" });
    expect(describeZone("America/New_York", winter)).toMatchObject({ offset: "GMT-5", offsetMinutes: -300, time: "07:00" });
  });

  it("describes UTC without a region", () => {
    expect(describeZone("UTC", winter)).toMatchObject({ city: "UTC", region: "", offset: "GMT", time: "12:00" });
  });
});

describe("timeChoices", () => {
  const summer = new Date("2026-07-01T12:00:00Z");
  const winter = new Date("2026-01-15T12:00:00Z");
  const zones = [
    "UTC", "Europe/London", "Europe/Moscow", "Asia/Jerusalem", "Europe/Berlin", "Europe/Paris",
    "Asia/Seoul", "Asia/Tokyo", "Asia/Calcutta", "Pacific/Chatham",
  ];
  const rows = (now: Date, preferred: string[] = []) =>
    timeChoices(zones, now, preferred).map((c) => `${c.time} ${c.city}`);

  it("gives one row per local time now, sorted, each with a well-known city", () => {
    expect(rows(summer)).toEqual([
      "12:00 UTC", "13:00 London", "14:00 Paris", "15:00 Jerusalem", "17:30 Kolkata", "21:00 Tokyo", "00:45 Chatham",
    ]);
  });

  it("regroups when clocks change: in winter Jerusalem is an hour apart from Moscow", () => {
    expect(rows(winter)).toEqual([
      "12:00 London", "13:00 Paris", "14:00 Jerusalem", "15:00 Moscow", "17:30 Kolkata", "21:00 Tokyo", "01:45 Chatham",
    ]);
  });

  it("uses a preferred zone (the saved one or the device's) for its row", () => {
    expect(rows(summer, ["Europe/Moscow", "Europe/Berlin"])).toContain("15:00 Moscow");
    expect(rows(summer, ["Europe/Moscow", "Europe/Berlin"])).toContain("14:00 Berlin");
    expect(rows(summer, ["Asia/Seoul"])).toContain("21:00 Seoul");
  });

  it("returns the zone id to save for each row", () => {
    expect(timeChoices(zones, summer, []).find((c) => c.time === "21:00")?.id).toBe("Asia/Tokyo");
  });
});
