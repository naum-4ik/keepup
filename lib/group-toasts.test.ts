import { describe, expect, it } from "vitest";
import { tFor } from "@/lib/i18n/test-t";
import { createdFlash, deletedFlash, GROUP_FLASH_KEYS, leftFlash } from "@/lib/group-toasts";
import { parseFlash, serializeFlash, type Flash } from "@/lib/toast";
import type { Locale } from "@/supabase/functions/_shared/i18n";

const LOCALES: Locale[] = ["en", "ru", "he"];
const say = (f: Omit<Flash, "id" | "at">, locale: Locale = "en") => tFor(locale)(f.text, f.values);

describe("group flash toasts", () => {
  it("names only keys that every catalog has (the Toaster drops unknown ones silently)", () => {
    for (const locale of LOCALES)
      for (const key of Object.values(GROUP_FLASH_KEYS)) expect(() => tFor(locale)(key, { group: "x", alone: "no", invite: "yes" })).not.toThrow();
  });

  it("survives the cookie", () => {
    const f = leftFlash("Family", false);
    expect(parseFlash(serializeFlash({ id: "f", at: 1, ...f }))).toEqual({ id: "f", at: 1, ...f });
  });

  it("created: where the invite link is and how long it works; a demo login only hears it was created", () => {
    expect(say(createdFlash("Family", true))).toBe("Created ⁨Family⁩. Share its invite link below: it works for 7 days.");
    expect(say(createdFlash("Family", false))).toBe("Created ⁨Family⁩.");
  });

  it("left: own habits stay; alone, the group is gone", () => {
    expect(say(leftFlash("Family", false))).toBe("Left ⁨Family⁩. Your own habits stay with you.");
    expect(say(leftFlash("Family", true))).toBe("Left ⁨Family⁩. You were its only member, so the group is deleted.");
  });

  it("deleted: the group and its shared habits", () => {
    expect(say(deletedFlash("Family"))).toBe("Deleted ⁨Family⁩ and its shared habits.");
  });

  it("ru keeps the name in brackets (never declined)", () => {
    expect(say(leftFlash("Семья", false), "ru")).toBe("Вы вышли из группы (⁨Семья⁩). Ваши личные привычки остались с вами.");
    expect(say(deletedFlash("Семья"), "ru")).toBe("Группа удалена (⁨Семья⁩) вместе с общими привычками.");
    expect(say(createdFlash("Семья", true), "ru")).toContain("(⁨Семья⁩)");
  });

  it("he isolates the name", () => {
    for (const f of [createdFlash("Family", true), leftFlash("Family", true), deletedFlash("Family")]) expect(say(f, "he")).toContain("⁨Family⁩");
  });
});

describe("groups.detail.noHabits", () => {
  it("names how many must check in; alone, it's you", () => {
    const en = tFor("en");
    expect(en("groups.detail.noHabits", { n: 1 })).toBe("Add a group habit: it's done when you check in. Invite people to do it together.");
    expect(en("groups.detail.noHabits", { n: 3 })).toBe("Add a group habit: it's done when all 3 members check in.");
    const ru = tFor("ru");
    expect(ru("groups.detail.noHabits", { n: 3 })).toContain("все 3 участника");
    expect(ru("groups.detail.noHabits", { n: 5 })).toContain("все 5 участников");
    expect(ru("groups.detail.noHabits", { n: 21 })).toContain("21 участника");
    expect(tFor("he")("groups.detail.noHabits", { n: 2 })).toContain("שני");
  });
});
