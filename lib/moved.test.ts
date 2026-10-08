import { describe, expect, it } from "vitest";
import { isOldHost, movedUrl, NEW_ORIGIN, withoutMoved } from "./moved";

describe("isOldHost", () => {
  it.each(["keepup-murex.vercel.app", "KEEPUP-MUREX.vercel.app", "keepup-murex.vercel.app:443"])("%s is the old address", (h) => {
    expect(isOldHost(h)).toBe(true);
  });

  it.each(["keepuphabits.vercel.app", "localhost:3000", "", null, undefined, "evil-keepup-murex.vercel.app"])("%s is not", (h) => {
    expect(isOldHost(h)).toBe(false);
  });
});

describe("movedUrl", () => {
  it("keeps the path and adds moved=1", () => {
    expect(movedUrl("/today", "")).toBe(`${NEW_ORIGIN}/today?moved=1`);
  });

  it("keeps the existing query", () => {
    expect(movedUrl("/login", "?next=%2Ftoday&x=1")).toBe(`${NEW_ORIGIN}/login?next=%2Ftoday&x=1&moved=1`);
  });

  it("adds moved=1 only once", () => {
    expect(movedUrl("/", "?moved=1")).toBe(`${NEW_ORIGIN}/?moved=1`);
  });

  it("keeps encoded paths and stays on the new origin", () => {
    expect(movedUrl("/kids/a%20b/play", "")).toBe(`${NEW_ORIGIN}/kids/a%20b/play?moved=1`);
    expect(new URL(movedUrl("//evil.com/x", "")).origin).toBe(NEW_ORIGIN);
  });
});

describe("withoutMoved", () => {
  it("drops moved=1 and keeps the rest", () => {
    expect(withoutMoved("https://x.app/login?next=%2Ftoday&moved=1#a")).toBe("/login?next=%2Ftoday#a");
    expect(withoutMoved("https://x.app/?moved=1")).toBe("/");
  });

  it("is null when there is nothing to strip", () => {
    expect(withoutMoved("https://x.app/today")).toBeNull();
  });
});
