import { describe, expect, it } from "vitest";
import { childrenDeletionNotice, inviteUrl, parseGroupName, purposeForGroupKind } from "@/lib/group-schema";

describe("group name", () => {
  it("trims and accepts 1–40 characters", () => {
    expect(parseGroupName("  Family ")).toEqual({ ok: true, value: "Family" });
    expect(parseGroupName("")).toEqual({ ok: false, error: "Give the group a name." });
    expect(parseGroupName("x".repeat(41))).toEqual({ ok: false, error: "Keep it to 40 characters." });
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
    expect(childrenDeletionNotice(["Mary"])).toBe("Mary's profile and history will be deleted.");
    expect(childrenDeletionNotice(["Mary", "Leo"])).toBe("Mary and Leo's profiles and history will be deleted.");
    expect(childrenDeletionNotice(["Mary", "Leo", "Ada"])).toBe("Mary, Leo and Ada's profiles and history will be deleted.");
    expect(childrenDeletionNotice([])).toBe("The children's profiles and history will be deleted.");
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
