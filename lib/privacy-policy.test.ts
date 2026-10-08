import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const policy = readFileSync(path.join(process.cwd(), "docs/privacy-policy.md"), "utf8");

describe("privacy policy", () => {
  it("has no unfilled [placeholders]", () => {
    // Square brackets not followed by "(" are placeholders; Markdown links are [text](url).
    expect(policy.match(/\[[^\]\n]+\](?!\()/g) ?? []).toEqual([]);
  });

  it("carries no internal notes: PR markers, checkmarks or lawyer remarks", () => {
    expect(policy.match(/#\d+/g) ?? []).toEqual([]);
    expect(policy).not.toContain("✅");
    expect(policy).not.toMatch(/lawyer/i);
  });

  it("states an effective date and the contact", () => {
    expect(policy).toMatch(/\*\*Effective date:\*\* \S/);
    expect(policy).toContain("naumchas00@gmail.com");
  });

  it("keeps its promises in writing (change the app, the policy and this test together)", () => {
    expect(policy).toContain("60 days"); // Inbox: keepup-feed-retention cron
    expect(policy).toContain("62 days"); // recap_runs purge
    expect(policy).toContain("24 hours"); // demo cleanup
    expect(policy).toContain("30 days"); // encrypted backups
    expect(policy).toContain("14 days"); // Grafana Cloud: traces, events and browser reports
    expect(policy).toMatch(/no analytics/i);
    expect(policy).toContain("**Sign-in history (Supabase Auth):** until you delete your account"); // delete_account_impl purges auth.audit_log_entries
    expect(policy).not.toContain("except the sign-in history");
  });

  it("tells what the browser reports and what every action records (components/observability/faro.tsx, lib/log.ts track)", () => {
    expect(policy).toMatch(/In your browser, on every Keepup page/);
    expect(policy).toMatch(/errors in the page/);
    expect(policy).toMatch(/page speed measurements \(Web Vitals/);
    expect(policy).toMatch(/Grafana Labs also receives your IP address/);
    expect(policy).toMatch(/session storage \(not a cookie\)/); // Faro's session ID
    expect(policy).toMatch(/On our servers, for each action/);
    expect(policy).not.toMatch(/no analytics or advertising services/i);
  });

  it("names every service provider", () => {
    for (const name of ["Supabase", "Vercel", "Grafana Labs", "GitHub", "Google", "Apple", "Mozilla"]) expect(policy).toContain(name);
  });

  it("covers all 13 sections", () => {
    for (let n = 1; n <= 13; n++) expect(policy).toMatch(new RegExp(`^## ${n}\\. `, "m"));
  });
});
