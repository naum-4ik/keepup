import { describe, expect, it } from "vitest";
import { deepMerge } from "@/i18n/merge-messages";

describe("deepMerge", () => {
  it("nested override wins", () => {
    expect(deepMerge({ a: { b: "en" } }, { a: { b: "ru" } })).toEqual({ a: { b: "ru" } });
  });
  it("missing nested key keeps English", () => {
    expect(deepMerge({ a: { b: "en", c: "en2" }, d: "x" }, { a: { b: "ru" } })).toEqual({ a: { b: "ru", c: "en2" }, d: "x" });
  });
  it("does not mutate English", () => {
    const en = { a: { b: "en" } };
    deepMerge(en, { a: { b: "ru" } });
    expect(en).toEqual({ a: { b: "en" } });
  });
  it("replaces arrays and strings", () => {
    expect(deepMerge({ l: ["a", "b"], s: "x" }, { l: ["c"], s: "y" })).toEqual({ l: ["c"], s: "y" });
  });
});
