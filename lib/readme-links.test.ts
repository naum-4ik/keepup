import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Every relative link and picture in README.md points at something that exists: a file or folder
// in the repo, and a heading for a #fragment (GitHub's anchor rules). External links aren't
// fetched here: a site being down shouldn't fail a unit test.
const root = resolve(__dirname, "..");
const readme = join(root, "README.md");

function targets(markdown: string): string[] {
  const text = markdown.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, (m) => (m.includes("](") ? m : ""));
  const out: string[] = [];
  for (const [, t] of text.matchAll(/\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) out.push(t);
  for (const [, , t] of text.matchAll(/\b(src|href)\s*=\s*"([^"]+)"/g)) out.push(t);
  return out;
}

// GitHub: lowercase, drop punctuation but keep letters, digits, spaces, - and _, spaces to -.
const slug = (heading: string) =>
  heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N} _-]/gu, "")
    .replace(/ /g, "-");

function anchors(file: string): Set<string> {
  const seen = new Map<string, number>();
  const out = new Set<string>();
  for (const [, heading] of readFileSync(file, "utf8").replace(/```[\s\S]*?```/g, "").matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
    const base = slug(heading.replace(/`/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1"));
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    out.add(n ? `${base}-${n}` : base);
  }
  return out;
}

function broken(file: string): string[] {
  const problems: string[] = [];
  for (const target of targets(readFileSync(file, "utf8"))) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue; // https:, mailto:
    const [pathPart, fragment] = target.split("#");
    const path = decodeURI(pathPart.split("?")[0]);
    const resolved = path ? resolve(dirname(file), path) : file;
    if (!existsSync(resolved)) {
      problems.push(`${target}: no such file`);
      continue;
    }
    if (fragment && statSync(resolved).isFile() && resolved.endsWith(".md") && !anchors(resolved).has(fragment)) {
      problems.push(`${target}: no heading #${fragment}`);
    }
  }
  return problems;
}

describe("README links", () => {
  it("finds the links and pictures it checks", () => {
    const found = targets(readFileSync(readme, "utf8"));
    expect(found).toContain("docs/screenshots/today.png");
    expect(found).toContain("#try-it");
    expect(found.length).toBeGreaterThan(30);
  });

  it("makes GitHub's heading anchors", () => {
    expect(slug("How it's built")).toBe("how-its-built");
    expect(slug("XP, levels, badges and rest days")).toBe("xp-levels-badges-and-rest-days");
  });

  it("every relative link and picture exists", () => {
    expect(broken(readme)).toEqual([]);
  });
});
