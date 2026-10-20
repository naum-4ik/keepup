import { describe, expect, it } from "vitest";
import { errorText } from "@/lib/field-error";
import { tEn } from "@/lib/i18n/test-t";
import { exportFileName, parseChildName, parseGender, parseGoal } from "@/lib/kid-schema";

describe("kid schema", () => {
  it("reads the optional boy/girl choice; anything else is not set", () => {
    expect(parseGender("boy")).toBe("boy");
    expect(parseGender("girl")).toBe("girl");
    expect(parseGender("")).toBeNull();
    expect(parseGender("x")).toBeNull();
    expect(parseGender(null)).toBeNull();
  });
  it("takes a trimmed nickname of 1–40 characters", () => {
    expect(parseChildName("  Mary ")).toEqual({ ok: true, value: "Mary" });
    expect(parseChildName(" ").ok).toBe(false);
    expect(parseChildName("x".repeat(41)).ok).toBe(false);
  });
  it("says what is wrong, in the catalog's English", () => {
    const say = (r: { ok: boolean; error?: Parameters<typeof errorText>[1] }) => (r.error ? errorText(tEn, r.error) : null);
    expect(say(parseChildName(" "))).toBe("Enter a nickname.");
    expect(say(parseChildName("x".repeat(41)))).toBe("Keep it to 40 characters.");
    expect(say(parseGoal({ title: "", emoji: "🦁", target: "3" }))).toBe("Name the treat.");
    expect(say(parseGoal({ title: "x".repeat(41), emoji: "🦁", target: "3" }))).toBe("Keep it to 40 characters.");
    expect(say(parseGoal({ title: "Zoo", emoji: "ab", target: "3" }))).toBe("Pick one emoji.");
    expect(say(parseGoal({ title: "Zoo", emoji: "🦁", target: "201" }))).toBe("Pick 1–200 stars.");
  });
  it("takes a goal of 1–200 stars with a title and one emoji", () => {
    expect(parseGoal({ title: " Ice cream ", emoji: "🍦", target: "20" })).toEqual({ ok: true, value: { title: "Ice cream", emoji: "🍦", target: 20 } });
    expect(parseGoal({ title: "Zoo", emoji: "", target: "5" })).toEqual({ ok: true, value: { title: "Zoo", emoji: "🎁", target: 5 } });
    expect(parseGoal({ title: "Zoo", emoji: "🦁", target: "0" }).ok).toBe(false);
    expect(parseGoal({ title: "Zoo", emoji: "🦁", target: "201" }).ok).toBe(false);
    expect(parseGoal({ title: "", emoji: "🦁", target: "3" }).ok).toBe(false);
  });
  it("names the field a goal is refused for, so the form shows the message beside it", () => {
    const field = (r: ReturnType<typeof parseGoal>) => (r.ok ? null : r.field);
    expect(field(parseGoal({ title: " ", emoji: "🦁", target: "3" }))).toBe("title");
    expect(field(parseGoal({ title: "x".repeat(41), emoji: "🦁", target: "3" }))).toBe("title");
    expect(field(parseGoal({ title: "Zoo", emoji: "ab", target: "3" }))).toBe("emoji");
    expect(field(parseGoal({ title: "Zoo", emoji: "🦁", target: "" }))).toBe("target");
    expect(field(parseGoal({ title: "Zoo", emoji: "🦁", target: "201" }))).toBe("target");
    expect(field(parseGoal({ title: "Zoo", emoji: "🦁", target: "20" }))).toBeNull();
  });
  it("names the export keepup-{nickname}-{date}.json", () => {
    expect(exportFileName("Mary", new Date(2026, 8, 30))).toBe("keepup-Mary-2026-09-30.json");
    expect(exportFileName("Anna Lou/1", new Date(2026, 0, 2))).toBe("keepup-Anna-Lou-1-2026-01-02.json");
  });
  it("dates the kid export by the person's own date, not UTC's", () => {
    expect(exportFileName("Mary", new Date("2026-10-07T23:30:00Z"), "Europe/Rome")).toBe("keepup-Mary-2026-10-08.json");
    expect(exportFileName("Mary", new Date("2026-10-08T03:00:00Z"), "America/Los_Angeles")).toBe("keepup-Mary-2026-10-07.json");
  });
});
