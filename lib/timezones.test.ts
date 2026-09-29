import { describe, expect, it } from "vitest";
import { cityOf, describeZone, listTimezones, pickTimezone, searchZones } from "./timezones";

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

describe("searchZones", () => {
  const now = new Date("2026-01-15T12:00:00Z");
  const zones = ["UTC", "Europe/London", "Asia/Tokyo", "Asia/Kolkata", "America/New_York", "Europe/Berlin", "Asia/Seoul"];
  const ids = (q: string) => searchZones(zones, q, now).map((z) => z.id);

  it("lists everything by offset, then city, when the query is empty", () => {
    expect(ids("")).toEqual([
      "America/New_York", "Europe/London", "UTC", "Europe/Berlin", "Asia/Kolkata", "Asia/Seoul", "Asia/Tokyo",
    ]);
  });

  it("matches the city, ignoring case, spaces and underscores", () => {
    expect(ids("lon")).toEqual(["Europe/London"]);
    expect(ids("new york")).toEqual(["America/New_York"]);
  });

  it("puts cities that start with the query first", () => {
    const list = ["America/Blanc-Sablon", "America/Miquelon", "Europe/London", "America/Argentina/Buenos_Aires"];
    expect(searchZones(list, "lon", now).map((z) => z.city)).toEqual(["London", "Blanc-Sablon", "Miquelon"]);
    expect(searchZones(list, "aires", now).map((z) => z.city)).toEqual(["Buenos Aires"]); // a later word counts as a start
  });

  it("finds a renamed city by its modern name", () => {
    expect(searchZones(["Asia/Calcutta"], "kolkata", now).map((z) => z.id)).toEqual(["Asia/Calcutta"]);
  });

  it("matches the region", () => {
    expect(ids("asia")).toEqual(["Asia/Kolkata", "Asia/Seoul", "Asia/Tokyo"]);
  });

  it("matches an exact offset, with or without GMT", () => {
    expect(ids("+9")).toEqual(["Asia/Seoul", "Asia/Tokyo"]);
    expect(ids("GMT+9")).toEqual(["Asia/Seoul", "Asia/Tokyo"]);
    expect(ids("+5:30")).toEqual(["Asia/Kolkata"]);
    expect(ids("+5")).toEqual([]);
    expect(ids("-5")).toEqual(["America/New_York"]);
  });
});
