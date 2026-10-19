import { describe, expect, it } from "vitest";
import { isLandingVisit } from "./landing-visit";

const PHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

describe("isLandingVisit", () => {
  it("a page load or a client navigation (RSC without prefetch) is a visit", () => {
    expect(isLandingVisit(new Headers({ "user-agent": PHONE, accept: "text/html" }))).toBe(true);
    expect(isLandingVisit(new Headers({ "user-agent": PHONE, rsc: "1" }))).toBe(true);
  });

  it("a router prefetch is not", () => {
    expect(isLandingVisit(new Headers({ "user-agent": PHONE, rsc: "1", "next-router-prefetch": "1" }))).toBe(false);
  });

  it("a browser prefetch or prerender is not (Sec-Purpose, or the older Purpose)", () => {
    expect(isLandingVisit(new Headers({ "user-agent": PHONE, "sec-purpose": "prefetch" }))).toBe(false);
    expect(isLandingVisit(new Headers({ "user-agent": PHONE, "sec-purpose": "prefetch;prerender" }))).toBe(false);
    expect(isLandingVisit(new Headers({ "user-agent": PHONE, purpose: "prefetch" }))).toBe(false);
  });

  it("a crawler is not", () => {
    const googlebot = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
    expect(isLandingVisit(new Headers({ "user-agent": googlebot }))).toBe(false);
  });
});
