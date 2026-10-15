import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTranslator } from "use-intl/core";

const dir = join(process.cwd(), "supabase/functions/_shared/messages");
const load = (f: string) => JSON.parse(readFileSync(join(dir, f), "utf8")) as Record<string, unknown>;
const en = load("en.json");
const others = readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "en.json");

function flat(o: Record<string, unknown>, p = ""): Record<string, string> {
  return Object.entries(o).reduce<Record<string, string>>((acc, [k, v]) => {
    const key = p ? `${p}.${k}` : k;
    return typeof v === "string" ? { ...acc, [key]: v } : { ...acc, ...flat(v as Record<string, unknown>, key) };
  }, {});
}
// Placeholder names and their kinds, e.g. {n, plural, …} → n:plural; {name} → name:text.
function args(msg: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of msg.matchAll(/\{\s*(\w+)\s*(?:,\s*(plural|select|selectordinal|number|date|time))?/g)) out[m[1]] ??= m[2] ?? "text";
  return out;
}
const sample = (kind: string) =>
  kind === "plural" || kind === "number" || kind === "selectordinal" ? 2 : kind === "date" || kind === "time" ? new Date(0) : kind === "select" ? "other" : "x";
const tags = (msg: string) => [...new Set([...msg.matchAll(/<(\w+)>/g)].map((m) => m[1]))].sort();

const enFlat = flat(en);

describe.each(["en.json", ...others])("%s", (file) => {
  const locale = file.replace(".json", "");
  const cat = flat(load(file));
  it("has exactly the English keys", () => {
    if (locale !== "en") expect(Object.keys(cat).sort()).toEqual(Object.keys(enFlat).sort());
  });
  it("uses the same placeholders and tags as English", () => {
    for (const [k, msg] of Object.entries(cat)) {
      expect(Object.keys(args(msg)).sort(), k).toEqual(Object.keys(args(enFlat[k] ?? "")).sort());
      expect(tags(msg), k).toEqual(tags(enFlat[k] ?? ""));
    }
  });
  it("every message formats, and every plural/select has an other branch", () => {
    const t = createTranslator({ locale, messages: load(file), onError: (e) => { throw e; } });
    for (const [k, msg] of Object.entries(cat)) {
      if (/(plural|select),/.test(msg)) expect(msg, k).toMatch(/other\s*\{/);
      const values = Object.fromEntries(Object.entries(args(msg)).map(([a, kind]) => [a, sample(kind)]));
      const tagFns = Object.fromEntries(tags(msg).map((tag) => [tag, (c: string) => c]));
      expect(() => t.markup(k as never, { ...values, ...tagFns } as never), k).not.toThrow();
    }
  });
});
