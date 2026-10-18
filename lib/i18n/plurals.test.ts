import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isPluralElement, isSelectElement, isTagElement, parse, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";
import { tFor } from "@/lib/i18n/test-t";

const ru = tFor("ru");

describe("Russian plurals", () => {
  it.each([[1, "1 день"], [2, "2 дня"], [5, "5 дней"], [11, "11 дней"], [14, "14 дней"], [21, "21 день"], [22, "22 дня"], [0, "0 дней"]])(
    "units.day %i", (n, s) => expect(ru("units.day", { n })).toBe(s));

  it.each([[1, "1 неделя"], [3, "3 недели"], [12, "12 недель"], [31, "31 неделя"]])(
    "units.week %i", (n, s) => expect(ru("units.week", { n })).toBe(s));

  it.each([[1, "1 активная привычка"], [4, "4 активные привычки"], [7, "7 активных привычек"]])(
    "overview.activeHabits %i", (n, s) => expect(`${n} ${ru("overview.activeHabits", { n })}`).toBe(s));

  it.each([[1, "1 участник"], [2, "2 участника"], [25, "25 участников"]])(
    "groups.card.counts %i members", (members, s) => expect(ru("groups.card.counts", { members, withChildren: "no", children: 0 })).toBe(s));

  it("groups.card.counts with children", () =>
    expect(ru("groups.card.counts", { members: 3, withChildren: "yes", children: 5 })).toBe("3 участника · 5 детей"));

  it.each([[1, "1 отметка ждёт вас"], [3, "3 отметки ждут вас"], [11, "11 отметок ждут вас"]])(
    "today.approvalsWaiting %i", (n, s) => expect(ru("today.approvalsWaiting", { n })).toBe(s));

  it("push.restDayUsed keeps the streak length ungrouped", () =>
    expect(ru("push.restDayUsed", { period: "day", n: 1234 })).toBe("Использован день отдыха. Ваша серия в 1234 дня сохранена 💤"));
});

// Global constraint: every ru plural has one, few, many and other.
describe("ru.json plural forms", () => {
  const cat = JSON.parse(readFileSync(join(process.cwd(), "supabase/functions/_shared/messages/ru.json"), "utf8")) as Record<string, unknown>;
  const flat = (o: Record<string, unknown>, p = ""): [string, string][] =>
    Object.entries(o).flatMap(([k, v]) => (typeof v === "string" ? [[p + k, v] as [string, string]] : flat(v as Record<string, unknown>, `${p}${k}.`)));
  const lacking = (els: MessageFormatElement[]): string[] =>
    els.flatMap((el) => {
      if (isTagElement(el)) return lacking(el.children);
      if (!isPluralElement(el) && !isSelectElement(el)) return [];
      const own = isPluralElement(el) ? ["one", "few", "many", "other"].filter((f) => !(f in el.options)) : [];
      return [...own.map((f) => `${el.value}:${f}`), ...Object.values(el.options).flatMap((o) => lacking(o.value))];
    });
  it("has one/few/many/other in every plural", () => {
    const bad = flat(cat).flatMap(([k, msg]) => lacking(parse(msg)).map((x) => `${k} ${x}`));
    expect(bad).toEqual([]);
  });
});
