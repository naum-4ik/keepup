import { describe, expect, it } from "vitest";
import { FEED_KINDS, isFeedKind } from "./feed-copy";

describe("feed kinds", () => {
  it("knows every kind it has a line for", () => {
    expect(isFeedKind("group_check_in")).toBe(true);
    expect(isFeedKind("kid_garden_full")).toBe(true);
    expect(FEED_KINDS).toContain("nudge");
  });

  it("skips a kind a newer database writes before the app knows it", () => {
    expect(isFeedKind("some_future_kind")).toBe(false);
  });
});
