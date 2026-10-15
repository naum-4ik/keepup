import { describe, expect, it } from "vitest";
import { compareVersions, notesFor, RELEASES, releaseLabel, type Release } from "@/app/whats-new/releases";
import { tEn } from "@/lib/i18n/test-t";
import { LOCALES } from "@/supabase/functions/_shared/i18n";

describe("What's new releases", () => {
  it("are newest first, with only the newest allowed to be undated", () => {
    for (let i = 1; i < RELEASES.length; i++) {
      expect(compareVersions(RELEASES[i - 1].version, RELEASES[i].version)).toBeGreaterThan(0);
      expect(RELEASES[i].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
  it("read as notes for people in every language: no PR numbers, hashes or internals", () => {
    for (const note of RELEASES.flatMap((r) => LOCALES.flatMap((l) => notesFor(r, l)))) {
      expect(note).not.toMatch(/#\d+|\b[0-9a-f]{7,}\b|\bRLS\b|\bCI\b|passkey|Face ID|https?:/i);
    }
  });
});

describe("notesFor", () => {
  const plain: Release = { version: "1.0.0", notes: ["a"] };
  const perLang: Release = { version: "1.5.0", notes: { en: ["hello"], ru: ["привет"] } };
  it("returns a plain array for any language", () => {
    expect(notesFor(plain, "ru")).toEqual(["a"]);
  });
  it("picks the language, falling back to English", () => {
    expect(notesFor(perLang, "ru")).toEqual(["привет"]);
    expect(notesFor(perLang, "he")).toEqual(["hello"]);
    expect(notesFor(perLang, "en")).toEqual(["hello"]);
  });
});

describe("releaseLabel", () => {
  it("shows the date, or Coming soon for a version newer than the app", () => {
    expect(releaseLabel({ version: "0.3.0", date: "2026-09-29", notes: [] }, "0.3.0", "en", tEn)).toBe("29 September 2026");
    expect(releaseLabel({ version: "1.4.0", date: "2026-10-08", notes: [] }, "1.4.0", "en", tEn)).toBe("8 October 2026");
    expect(releaseLabel({ version: "0.4.0", notes: [] }, "0.3.0", "en", tEn)).toBe("Coming soon");
    expect(releaseLabel({ version: "0.4.0", notes: [] }, "0.4.0", "en", tEn)).toBe("");
    expect(compareVersions("0.10.0", "0.9.1")).toBeGreaterThan(0);
  });
  it("formats the date in the language", () => {
    expect(releaseLabel({ version: "1.4.0", date: "2026-10-08", notes: [] }, "1.4.0", "ru", tEn)).toBe("8 октября 2026 г.");
  });
});
