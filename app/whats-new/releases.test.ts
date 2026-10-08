import { describe, expect, it } from "vitest";
import { compareVersions, RELEASES, releaseLabel } from "./releases";

describe("What's new releases", () => {
  it("are newest first, with only the newest allowed to be undated", () => {
    for (let i = 1; i < RELEASES.length; i++) {
      expect(compareVersions(RELEASES[i - 1].version, RELEASES[i].version)).toBeGreaterThan(0);
      expect(RELEASES[i].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
  it("read as notes for people: no PR numbers, hashes or internals", () => {
    for (const note of RELEASES.flatMap((r) => r.notes)) {
      expect(note).not.toMatch(/#\d+|\b[0-9a-f]{7,}\b|\bRLS\b|\bCI\b|passkey|Face ID|https?:/i);
    }
  });
});

describe("releaseLabel", () => {
  it("shows the date, or Coming soon for a version newer than the app", () => {
    expect(releaseLabel({ version: "0.3.0", date: "2026-09-29", notes: [] }, "0.3.0")).toBe("29 September 2026");
    expect(releaseLabel({ version: "0.4.0", notes: [] }, "0.3.0")).toBe("Coming soon");
    expect(releaseLabel({ version: "0.4.0", notes: [] }, "0.4.0")).toBe("");
    expect(compareVersions("0.10.0", "0.9.1")).toBeGreaterThan(0);
  });
});
