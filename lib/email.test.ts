import { describe, expect, it } from "vitest";
import { isValidEmail } from "./email";

describe("isValidEmail", () => {
  it.each(["ana@example.com", "a.b+tag@sub.example.co"])("accepts %s", (v) => {
    expect(isValidEmail(v)).toBe(true);
  });

  it.each(["", "ana", "ana@", "@example.com", "ana @example.com", "ana@example"])("rejects %j", (v) => {
    expect(isValidEmail(v)).toBe(false);
  });
});
