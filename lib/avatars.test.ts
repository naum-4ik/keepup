import { describe, expect, it } from "vitest";
import {
  AVATAR_COLOR_LABEL, AVATAR_COLORS, AVATAR_EMOJI, GROUP_AVATAR_EMOJI, initialOf, isAvatarColor, isAvatarEmoji, isGroupAvatarEmoji, parseAvatar,
} from "@/lib/avatars";

describe("avatars", () => {
  it("offers 24 distinct emoji and six pastel colors", () => {
    expect(AVATAR_EMOJI).toHaveLength(24);
    expect(new Set(AVATAR_EMOJI).size).toBe(24);
    expect(Object.keys(AVATAR_COLORS)).toEqual(["peach", "sage", "sky", "lilac", "butter", "rose"]);
  });
  it("names every color for people", () => {
    expect(Object.values(AVATAR_COLOR_LABEL)).toEqual(["Peach", "Sage", "Sky", "Lilac", "Butter", "Rose"]);
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
  it("offers groups the people set plus six group emoji", () => {
    expect(GROUP_AVATAR_EMOJI).toHaveLength(30);
    expect(new Set(GROUP_AVATAR_EMOJI).size).toBe(30);
    expect(GROUP_AVATAR_EMOJI.slice(0, 6)).toEqual(["🏡", "🍕", "⚽", "🎉", "🌳", "🎵"]);
    expect(isGroupAvatarEmoji("🏡")).toBe(true);
    expect(isGroupAvatarEmoji("🐼")).toBe(true);
    expect(isGroupAvatarEmoji("💩")).toBe(false);
    expect(isAvatarEmoji("🏡")).toBe(false); // people keep their own set
  });
  it("reads an avatar from a form, emoji optional", () => {
    const fd = (emoji: string, color: string) => {
      const f = new FormData();
      f.set("avatarEmoji", emoji);
      f.set("avatarColor", color);
      return f;
    };
    expect(parseAvatar(fd("🐼", "sage"), isAvatarEmoji)).toEqual({ ok: true, emoji: "🐼", color: "sage" });
    expect(parseAvatar(fd("", "peach"), isAvatarEmoji)).toEqual({ ok: true, emoji: null, color: "peach" });
    expect(parseAvatar(fd("🏡", "sage"), isAvatarEmoji)).toEqual({ ok: false, message: "Pick one of these avatars." });
    expect(parseAvatar(fd("🏡", "sage"), isGroupAvatarEmoji)).toEqual({ ok: true, emoji: "🏡", color: "sage" });
    expect(parseAvatar(fd("🐼", "neon"), isAvatarEmoji)).toEqual({ ok: false, message: "Pick a color." });
  });
});
