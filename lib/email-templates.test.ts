// Guards supabase/templates: every [auth.email.template.*] entry in config.toml has a Keepup-branded file.
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BANNED_PATTERNS, BANNED_WORDS } from "./notification-copy";

const root = resolve(__dirname, "..");
const config = readFileSync(resolve(root, "supabase/config.toml"), "utf8");
const entries = [...config.matchAll(/^\[auth\.email\.template\.(\w+)\]\nsubject = "([^"]+)"\ncontent_path = "([^"]+)"/gm)].map(
  ([, name, subject, path]) => ({ name, subject, path: resolve(root, path) }),
);

describe("auth email templates", () => {
  it("wires all six Supabase auth emails", () => {
    expect(entries.map((e) => e.name).sort()).toEqual(["confirmation", "email_change", "invite", "magic_link", "reauthentication", "recovery"]);
  });

  describe.each(entries)("$name", ({ name, subject, path }) => {
    it("has a Keepup subject and a template file", () => {
      expect(subject).toMatch(/Keepup/);
      expect(existsSync(path)).toBe(true);
    });

    const html = existsSync(path) ? readFileSync(path, "utf8") : "";

    it("carries the Keepup signature and the ignore line", () => {
      expect(html).toContain("Keepup · Habits, together.");
      expect(html).toContain("{{ .SiteURL }}");
      expect(html).toContain("If this wasn't you, you can ignore this email.");
    });

    it(name === "reauthentication" ? "shows the code, with no link" : "links with a token hash to /auth/confirm", () => {
      if (name === "reauthentication") {
        expect(html).toContain("{{ .Token }}");
        expect(html).not.toContain("/auth/confirm");
      } else {
        expect(html).toContain("/auth/confirm?token_hash={{ .TokenHash }}&type=");
        expect(html).not.toContain(".ConfirmationURL");
      }
    });

    it("uses no external assets and no banned words", () => {
      expect(html).not.toMatch(/<(img|link|script)\b|@import|url\(/i);
      const text = `${subject} ${html}`.toLowerCase();
      for (const word of BANNED_WORDS) expect(text).not.toContain(word);
      for (const pattern of BANNED_PATTERNS) expect(text).not.toMatch(pattern);
    });
  });
});
