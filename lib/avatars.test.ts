import { describe, expect, it } from "vitest";
import { AVATAR_COLORS, AVATAR_EMOJI, initialOf, isAvatarColor } from "@/lib/avatars";

describe("avatars", () => {
  it("offers 24 distinct emoji and six pastel colors", () => {
    expect(AVATAR_EMOJI).toHaveLength(24);
    expect(new Set(AVATAR_EMOJI).size).toBe(24);
    expect(Object.keys(AVATAR_COLORS)).toEqual(["peach", "sage", "sky", "lilac", "butter", "rose"]);
  });
  it("validates colors", () => {
    expect(isAvatarColor("sage")).toBe(true);
    expect(isAvatarColor("red")).toBe(false);
  });
  it("uses the first character as the initial, emoji-safe", () => {
    expect(initialOf("anna")).toBe("A");
    expect(initialOf("  ")).toBe("?");
    expect(initialOf("Élodie")).toBe("É");
  });
});
