import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTranslator } from "use-intl/core";
import { tFor } from "./test-t";
import type { Locale } from "@/supabase/functions/_shared/i18n";
import {
  isDateElement, isLiteralElement, isNumberElement, isPluralElement, isPoundElement,
  isSelectElement, isTagElement, isTimeElement, parse, type MessageFormatElement,
} from "@formatjs/icu-messageformat-parser";

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
type Info = { args: Record<string, string>; tags: string[]; noOther: string[] };
// Walks the ICU AST: placeholder names with their kinds (plural/select branch text is not one),
// tag names, and the plural/select nodes that lack an `other` branch.
function analyze(msg: string): Info {
  const info: Info = { args: {}, tags: [], noOther: [] };
  const walk = (els: MessageFormatElement[]) => {
    for (const el of els) {
      if (isLiteralElement(el) || isPoundElement(el)) continue;
      if (isTagElement(el)) {
        if (!info.tags.includes(el.value)) info.tags.push(el.value);
        walk(el.children);
        continue;
      }
      const kind = isPluralElement(el)
        ? el.pluralType === "ordinal" ? "selectordinal" : "plural"
        : isSelectElement(el) ? "select" : isNumberElement(el) ? "number" : isDateElement(el) ? "date" : isTimeElement(el) ? "time" : "text";
      info.args[el.value] ??= kind;
      if (isPluralElement(el) || isSelectElement(el)) {
        if (!("other" in el.options)) info.noOther.push(el.value);
        for (const o of Object.values(el.options)) walk(o.value);
      }
    }
  };
  walk(parse(msg, { requiresOtherClause: false }));
  info.tags.sort();
  return info;
}
const sample = (kind: string) =>
  kind === "plural" || kind === "number" || kind === "selectordinal" ? 2 : kind === "date" || kind === "time" ? new Date(0) : kind === "select" ? "other" : "x";

const enFlat = flat(en);

describe.each(["en.json", ...others])("%s", (file) => {
  const locale = file.replace(".json", "");
  const cat = flat(load(file));
  it("has exactly the English keys", () => {
    if (locale !== "en") expect(Object.keys(cat).sort()).toEqual(Object.keys(enFlat).sort());
  });
  it("uses the same placeholders and tags as English", () => {
    for (const [k, msg] of Object.entries(cat)) {
      const want = analyze(enFlat[k] ?? "");
      const got = analyze(msg);
      expect(got.args, k).toEqual(want.args);
      expect(got.tags, k).toEqual(want.tags);
    }
  });
  it("every message formats, and every plural/select has an other branch", () => {
    const t = createTranslator({ locale: locale as Locale, messages: load(file), onError: (e) => { throw e; } });
    for (const [k, msg] of Object.entries(cat)) {
      const { args, tags, noOther } = analyze(msg);
      expect(noOther, `${k}: plural/select without other`).toEqual([]);
      const values = Object.fromEntries(Object.entries(args).map(([a, kind]) => [a, sample(kind)]));
      const tagFns = Object.fromEntries(tags.map((tag) => [tag, (c: string) => c]));
      expect(() => t.markup(k as never, { ...values, ...tagFns } as never), k).not.toThrow();
    }
  });
});

describe("analyze (guard regressions)", () => {
  const same = (a: string, b: string) => expect(analyze(b).args).toEqual(analyze(a).args);
  it("ignores plural branch text, so translations are judged by placeholders only", () =>
    same("{n, plural, one {day} other {days}}", "{n, plural, one {день} few {дня} many {дней} other {дня}}"));
  it("ignores select branch text", () => same("{g, select, boy {Boy} other {They}}", "{g, select, boy {Мальчик} other {Они}}"));
  it("still finds placeholders nested in branches and tags", () =>
    expect(analyze("<b>{n, plural, one {{name} day} other {# days}}</b>")).toMatchObject({ args: { n: "plural", name: "text" }, tags: ["b"] }));
  it("flags a plural without other", () => expect(analyze("{n, plural, one {x}}").noOther).toEqual(["n"]));
  it("flags only the node that lacks other", () =>
    expect(analyze("{a, select, x {1} other {2}} {b, select, y {3}}").noOther).toEqual(["b"]));
});

// Count messages are ICU plurals (so ru/he can add their forms); English reads the same for every n.
describe("count messages (English)", () => {
  const t = tFor("en");
  it.each([
    ["nav.inboxUnread", ["Inbox, 0 unread", "Inbox, 1 unread", "Inbox, 2 unread"]],
    ["overview.waiting", ["0 waiting", "1 waiting", "2 waiting"]],
    ["recaps.page.restDays", ["Rest days: 0 (dashed)", "Rest days: 1 (dashed)", "Rest days: 2 (dashed)"]],
  ])("%s for 0, 1, 2", (key, lines) => {
    expect([0, 1, 2].map((n) => t(key, { n }))).toEqual(lines);
  });
  it("keeps the unread count ungrouped", () => expect(t("nav.inboxUnread", { n: 1234 })).toBe("Inbox, 1234 unread"));
});
