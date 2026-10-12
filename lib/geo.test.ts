import { describe, expect, it, vi } from "vitest";

const sent = new Headers();
vi.mock("next/headers", () => ({ headers: async () => sent }));
const { whereFrom } = await import("./geo");

describe("whereFrom: the visitor's IP and place, from Vercel's request headers", () => {
  it("reads the IP, country, region and city (decoded)", async () => {
    sent.set("x-real-ip", "203.0.113.7");
    sent.set("x-vercel-ip-country", "DE");
    sent.set("x-vercel-ip-country-region", "BE");
    sent.set("x-vercel-ip-city", "Frankfurt%20am%20Main");
    expect(await whereFrom()).toEqual({
      "client.address": "203.0.113.7",
      "geo.country.iso_code": "DE",
      "geo.region.iso_code": "BE",
      "geo.locality.name": "Frankfurt am Main",
    });
  });

  it("falls back to the first x-forwarded-for address, and leaves out what isn't there", async () => {
    for (const key of [...sent.keys()]) sent.delete(key);
    sent.set("x-forwarded-for", "198.51.100.4, 10.0.0.1");
    expect(await whereFrom()).toEqual({ "client.address": "198.51.100.4" });
  });
});
