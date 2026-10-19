import { describe, expect, it } from "vitest";
import { tFor } from "@/lib/i18n/test-t";
import { addedFlash, deletedFlash, KID_FLASH_KEYS } from "@/lib/kid-toasts";
import { parseFlash, serializeFlash, type Flash } from "@/lib/toast";
import type { Locale } from "@/supabase/functions/_shared/i18n";

const LOCALES: Locale[] = ["en", "ru", "he"];
const say = (f: Omit<Flash, "id" | "at">, locale: Locale = "en") => tFor(locale)(f.text, f.values);

describe("kid flash toasts", () => {
  it("names only keys that every catalog has (the Toaster drops unknown ones silently)", () => {
    for (const locale of LOCALES)
      for (const key of Object.values(KID_FLASH_KEYS)) expect(() => tFor(locale)(key, { name: "x", habits: 2 })).not.toThrow();
  });

  it("survives the cookie", () => {
    const f = addedFlash("Mary", 3);
    expect(parseFlash(serializeFlash({ id: "f", at: 1, ...f }))).toEqual({ id: "f", at: 1, ...f });
  });

  it("added: how many habits she starts with, and what a check-in earns", () => {
    expect(say(addedFlash("Mary", 3))).toBe("Added ⁨Mary⁩ with 3 habits. Each check-in earns 1 star.");
    expect(say(addedFlash("Mary", 1))).toBe("Added ⁨Mary⁩ with 1 habit. Each check-in earns 1 star.");
    expect(say(addedFlash("Mary", 0))).toBe("Added ⁨Mary⁩. Add a habit below: each check-in earns 1 star.");
  });

  it("added: ru one/few/many with the name in brackets, he one/two", () => {
    expect(say(addedFlash("Маша", 1), "ru")).toBe("Профиль добавлен (⁨Маша⁩): 1 привычка. За каждую отметку — 1 звезда.");
    expect(say(addedFlash("Маша", 3), "ru")).toContain("3 привычки");
    expect(say(addedFlash("Маша", 5), "ru")).toContain("5 привычек");
    expect(say(addedFlash("Mary", 1), "he")).toContain("הרגל אחד");
    expect(say(addedFlash("Mary", 2), "he")).toContain("2 הרגלים");
  });

  it("deleted: her profile and history", () => {
    expect(say(deletedFlash("Mary"))).toBe("Deleted ⁨Mary⁩'s profile and history.");
    expect(say(deletedFlash("Маша"), "ru")).toBe("Профиль удалён (⁨Маша⁩) вместе с историей.");
    expect(say(deletedFlash("Mary"), "he")).toContain("⁨Mary⁩");
  });
});
