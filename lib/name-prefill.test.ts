import { describe, expect, it } from "vitest";
import { suggestDisplayName } from "./name-prefill";

describe("suggestDisplayName", () => {
  it("prefers the Google full_name, then name", () => {
    expect(suggestDisplayName({ fullName: "  Ana Example ", name: "Ana", email: "a@x.com" })).toBe("Ana Example");
    expect(suggestDisplayName({ fullName: "  ", name: "Ana", email: "a@x.com" })).toBe("Ana");
  });

  it("falls back to the email local part, capitalised, dots and underscores as spaces", () => {
    expect(suggestDisplayName({ email: "ana.maria_x@example.com" })).toBe("Ana Maria X");
    expect(suggestDisplayName({ email: "bob@example.com" })).toBe("Bob");
    expect(suggestDisplayName({ email: "..ana..@example.com" })).toBe("Ana");
  });

  it("drops an email's +tag (plus-addressing)", () => {
    expect(suggestDisplayName({ email: "naumchas00+keepup-qa-202610081103-1@gmail.com" })).toBe("Naumchas00");
    expect(suggestDisplayName({ email: "ana.maria+news@example.com" })).toBe("Ana Maria");
    expect(suggestDisplayName({ email: "ana+@example.com" })).toBe("Ana");
    expect(suggestDisplayName({ email: "+tag@example.com" })).toBe("");
  });

  it("returns empty when there's nothing usable", () => {
    expect(suggestDisplayName({})).toBe("");
    expect(suggestDisplayName({ fullName: 42, email: "@example.com" })).toBe("");
    expect(suggestDisplayName({ email: "._@example.com" })).toBe("");
  });

  it("copes with no email (a demo login is anonymous)", () => {
    expect(suggestDisplayName({ email: null })).toBe("");
    expect(suggestDisplayName({ email: "" })).toBe("");
    expect(suggestDisplayName({ name: "Sam", email: null })).toBe("Sam");
  });

  it("cuts to 40 characters and trims after the cut", () => {
    expect(suggestDisplayName({ fullName: "x".repeat(60) })).toBe("x".repeat(40));
    expect(suggestDisplayName({ fullName: `${"m".repeat(39)} zzzzz` })).toBe("m".repeat(39));
  });
});
