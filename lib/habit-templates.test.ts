import { describe, expect, it } from "vitest";
import { CATEGORY_ORDER } from "./categories";
import { EMOJI_SUGGESTIONS_MAX, emojiSuggestions, HABIT_TEMPLATES, onboardingTemplates } from "./habit-templates";
import { isOneEmoji, parseHabit } from "./habit-schema";

describe("HABIT_TEMPLATES", () => {
  it("has 48 templates with unique ids", () => {
    expect(HABIT_TEMPLATES).toHaveLength(48);
    expect(new Set(HABIT_TEMPLATES.map((t) => t.id)).size).toBe(48);
  });

  it("every category has exactly 6 templates (the new-habit screen is a fixed 2×3 grid)", () => {
    for (const c of CATEGORY_ORDER) expect(HABIT_TEMPLATES.filter((t) => t.category === c), c).toHaveLength(6);
  });

  it("Popular is the same 6 as before", () => {
    expect(HABIT_TEMPLATES.filter((t) => t.popular).map((t) => t.title)).toEqual([
      "Drink water", "Sleep by 23:00", "Walk 10,000 steps", "Work out", "Meditate", "Read 20 min",
    ]);
  });

  it("emoji are unique within a tab", () => {
    const tabs = [HABIT_TEMPLATES.filter((t) => t.popular), ...CATEGORY_ORDER.map((c) => HABIT_TEMPLATES.filter((t) => t.category === c))];
    for (const list of tabs) expect(new Set(list.map((t) => t.emoji)).size).toBe(list.length);
  });

  it("the removed templates are gone", () => {
    const titles = HABIT_TEMPLATES.map((t) => t.title);
    expect(titles).not.toContain("Skincare routine");
    expect(titles).not.toContain("Take the stairs");
  });

  it("every template passes the habit rules, its emoji included", () => {
    for (const t of HABIT_TEMPLATES) {
      expect(isOneEmoji(t.emoji), t.id).toBe(true);
      const r = parseHabit({ title: t.title, emoji: t.emoji, category: t.category, targetCount: String(t.targetCount), period: t.period, startsOn: "2026-10-05" });
      expect(r.ok, t.id).toBe(true);
      if (r.ok) expect(r.value.emoji).toBe(t.emoji);
    }
  });
});

describe("emojiSuggestions", () => {
  it("offers 30 unique emoji: the category's own first, then the general set", () => {
    for (const c of CATEGORY_ORDER) {
      const list = emojiSuggestions(c);
      expect(list, c).toHaveLength(EMOJI_SUGGESTIONS_MAX);
      expect(new Set(list).size).toBe(list.length);
      for (const t of HABIT_TEMPLATES.filter((t) => t.category === c)) expect(list).toContain(t.emoji);
      for (const e of ["⭐", "🌱", "💪", "🎨", "🐶", "✈️", "🧠", "❤️", "🎵", "🎯"]) expect(list).toContain(e);
      expect(list.every(isOneEmoji)).toBe(true);
    }
    expect(emojiSuggestions("work_money")[0]).toBe("💼");
  });
});

describe("onboardingTemplates", () => {
  it("is the 6 Popular templates for me or no answer", () => {
    for (const p of ["me", null] as const) {
      expect(onboardingTemplates(p).map((t) => t.id)).toEqual(HABIT_TEMPLATES.filter((t) => t.popular).map((t) => t.id));
    }
  });

  it("adds People and Home for family and friends, Popular first, no repeats", () => {
    for (const p of ["family", "friends"] as const) {
      const list = onboardingTemplates(p);
      expect(list.slice(0, 6).every((t) => t.popular)).toBe(true);
      expect(list.slice(6).map((t) => t.category)).toEqual([...Array(6).fill("people"), ...Array(6).fill("home")]);
      expect(new Set(list.map((t) => t.id)).size).toBe(list.length);
    }
  });
});
