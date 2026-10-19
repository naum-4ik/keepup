import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const terms = readFileSync(path.join(process.cwd(), "docs/terms-of-use.md"), "utf8");
const policy = readFileSync(path.join(process.cwd(), "docs/privacy-policy.md"), "utf8");

describe("terms of use", () => {
  it("has no unfilled [placeholders]", () => {
    expect(terms.match(/\[[^\]\n]+\](?!\()/g) ?? []).toEqual([]);
  });

  it("carries no internal notes: PR markers, checkmarks or lawyer remarks", () => {
    expect(terms.match(/#\d+/g) ?? []).toEqual([]);
    expect(terms).not.toContain("✅");
    expect(terms).not.toMatch(/lawyer/i);
  });

  it("states an effective date and the same operator and contact as the privacy policy", () => {
    expect(terms).toMatch(/\*\*Effective date:\*\* \S/);
    expect(terms).toContain("**Ilya Naumenko**");
    expect(terms).toContain("naumchas00@gmail.com");
    expect(policy).toContain("**Ilya Naumenko**");
    expect(policy).toContain("naumchas00@gmail.com");
  });

  it("has every section", () => {
    for (const h of ["Who we are", "Using Keepup", "Your content", "Kids", "Your account", "Availability and changes", "Liability", "Contact"]) {
      expect(terms).toMatch(new RegExp(`^## ${h}$`, "m"));
    }
  });

  it("matches the privacy policy on age and links both ways", () => {
    expect(terms).toContain("18 or older");
    expect(policy).toContain("**18 or older**");
    expect(terms).toContain("(/privacy)");
    expect(policy).toContain("(/terms)");
  });
});
