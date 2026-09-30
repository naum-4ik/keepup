import { describe, expect, it } from "vitest";
import { GOAL_TITLE_MAX } from "@/lib/kid-schema";
import { TREAT_EMOJI, TREAT_IDEAS } from "@/lib/treat-ideas";

describe("treat ideas", () => {
  it("offers a dozen or more distinct ideas that fit the title limit", () => {
    expect(TREAT_IDEAS.length).toBeGreaterThanOrEqual(12);
    expect(new Set(TREAT_IDEAS.map((i) => i.title)).size).toBe(TREAT_IDEAS.length);
    expect(TREAT_IDEAS.every((i) => [...i.title].length <= GOAL_TITLE_MAX)).toBe(true);
  });
  it("lets every idea's emoji be picked by hand too, the default gift first", () => {
    expect(TREAT_EMOJI[0]).toBe("🎁");
    expect(TREAT_IDEAS.every((i) => TREAT_EMOJI.includes(i.emoji))).toBe(true);
    expect(new Set(TREAT_EMOJI).size).toBe(TREAT_EMOJI.length);
  });
});
