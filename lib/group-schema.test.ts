import { describe, expect, it } from "vitest";
import { errorText } from "@/lib/field-error";
import { tEn } from "@/lib/i18n/test-t";
import { childrenDeletionNotice, inviteUrl, parseGroupName, purposeForGroupKind } from "@/lib/group-schema";

describe("group name", () => {
  it("trims and accepts 1–40 characters", () => {
    expect(parseGroupName("  Family ")).toEqual({ ok: true, value: "Family" });
    expect(parseGroupName("")).toEqual({ ok: false, error: { key: "validation.groupName" } });
    expect(errorText(tEn, { key: "validation.groupName" })).toBe("Give the group a name.");
    expect(parseGroupName("x".repeat(41))).toEqual({ ok: false, error: { key: "validation.maxChars", values: { max: 40 } } });
    expect(errorText(tEn, { key: "validation.maxChars", values: { max: 40 } })).toBe("Keep it to 40 characters.");
  });
  it("counts emoji as one character, like Postgres", () => {
    expect(parseGroupName("👨‍👩‍👧".repeat(5)).ok).toBe(true);
  });
});

describe("invite url", () => {
  it("builds the landing link", () => {
    expect(inviteUrl("https://keepup-murex.vercel.app", "abc-_1")).toBe("https://keepup-murex.vercel.app/invite/abc-_1");
  });
});

describe("children deletion notice", () => {
  it("names the children whose profiles would go", () => {
    expect(childrenDeletionNotice(tEn, "en", ["Mary"])).toBe("\u2068Mary\u2069's profile and history will be deleted.");
    expect(childrenDeletionNotice(tEn, "en", ["Mary", "Leo"])).toBe("\u2068Mary\u2069 and \u2068Leo\u2069's profiles and history will be deleted.");
    expect(childrenDeletionNotice(tEn, "en", ["Mary", "Leo", "Ada"])).toBe("\u2068Mary\u2069, \u2068Leo\u2069 and \u2068Ada\u2069's profiles and history will be deleted.");
    expect(childrenDeletionNotice(tEn, "en", [])).toBe("The children's profiles and history will be deleted.");
  });
});

describe("purpose for group kind", () => {
  it("derives the invited user's purpose from the group", () => {
    expect(purposeForGroupKind("family")).toBe("family");
    expect(purposeForGroupKind("couple")).toBe("family");
    expect(purposeForGroupKind("friends")).toBe("friends");
    expect(purposeForGroupKind("roommates")).toBe("friends");
    expect(purposeForGroupKind("other")).toBe("friends");
  });
});
