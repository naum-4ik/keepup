import { describe, expect, it } from "vitest";
import { isPrefetch } from "./prefetch";

describe("isPrefetch", () => {
  it("a router prefetch is not a view", () => {
    expect(isPrefetch(new Headers({ rsc: "1", "next-router-prefetch": "1" }))).toBe(true);
  });

  it("a page load or a client navigation (RSC without prefetch) is a view", () => {
    expect(isPrefetch(new Headers({ accept: "text/html" }))).toBe(false);
    expect(isPrefetch(new Headers({ rsc: "1" }))).toBe(false);
  });
});
