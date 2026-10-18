import { describe, expect, it } from "vitest";
import en from "@/supabase/functions/_shared/messages/en.json";
import { habitTitle, namedPayload, templateIdsIn } from "@/supabase/functions/_shared/habit-title";
import { tEn, tFor } from "@/lib/i18n/test-t";
import { habitNameFor, isRename, TEMPLATE_IDS, templateKept } from "./habit-title";

const tRu = tFor("ru");
const tHe = tFor("he");

describe("habitTitle", () => {
  it("a known template shows the catalog's title in the viewer's language", () => {
    expect(habitTitle(tEn, "Drink water", "water", TEMPLATE_IDS)).toBe("Drink water");
    expect(habitTitle(tRu, "Drink water", "water", TEMPLATE_IDS)).toBe("Пить воду");
    expect(habitTitle(tHe, "Drink water", "water", TEMPLATE_IDS)).toBe("לשתות מים");
  });

  it("group and kid templates too (kid ids are kid.<id>)", () => {
    expect(habitTitle(tRu, "Family dinner", "g-family-dinner", TEMPLATE_IDS)).toBe("Семейный ужин");
    expect(habitTitle(tHe, "Brush teeth", "kid.brush-teeth", TEMPLATE_IDS)).toBe("לצחצח שיניים");
  });

  it("no template, or one the app doesn't know, keeps the stored title (never a raw key)", () => {
    expect(habitTitle(tRu, "Мой бег", null, TEMPLATE_IDS)).toBe("Мой бег");
    expect(habitTitle(tRu, "Мой бег", undefined, TEMPLATE_IDS)).toBe("Мой бег");
    for (const forged of ["nope", "kid", "treat", "kidGroup", "treat.zoo", "kidGroup.healthy", "kid.nope"]) {
      expect(habitTitle(tRu, "Typed", forged, TEMPLATE_IDS), forged).toBe("Typed");
    }
  });

  it("English output is unchanged for backfilled rows (stored title = the English template title)", () => {
    const name = habitNameFor(tEn);
    for (const id of TEMPLATE_IDS) expect(name(tEn(`templates.${id}`), id)).toBe(tEn(`templates.${id}`));
  });
});

describe("TEMPLATE_IDS", () => {
  it("are exactly the catalog's habit templates (what send-push knows)", () => {
    expect([...TEMPLATE_IDS].sort()).toEqual([...templateIdsIn(en.templates)].sort());
    expect(TEMPLATE_IDS.has("treat.zoo")).toBe(false);
  });
});

describe("namedPayload", () => {
  it("names the daily summary, recap and family recap rows; rows without a template keep theirs", () => {
    const name = habitNameFor(tRu);
    const p = namedPayload(
      {
        todo: [{ title: "Drink water", template: "water", done: 1 }, { title: "Мой бег", template: null }],
        at_risk: [{ title: "Family dinner", template: "g-family-dinner" }],
        longest: { title: "Meditate", template: "meditate", length: 3 },
        top: [{ title: "Meditate", template: "meditate" }, { title: "x" }],
        best: { title: "Family dinner", length: 2 },
        done: 4,
      },
      name,
    );
    expect(p).toEqual({
      todo: [{ title: "Пить воду", template: "water", done: 1 }, { title: "Мой бег", template: null }],
      at_risk: [{ title: "Семейный ужин", template: "g-family-dinner" }],
      longest: { title: tRu("templates.meditate"), template: "meditate", length: 3 },
      top: [{ title: tRu("templates.meditate"), template: "meditate" }, { title: "x" }],
      best: { title: "Family dinner", length: 2 },
      done: 4,
    });
  });

  it("leaves a malformed payload alone", () => {
    expect(namedPayload({ todo: "x", longest: null }, habitNameFor(tRu))).toEqual({ todo: "x", longest: null });
  });
});

describe("isRename", () => {
  const stored = { title: "Drink water", template_id: "water" };
  it("saving the displayed title unchanged is no rename, in any language", () => {
    expect(isRename(habitNameFor(tRu), "Пить воду", stored)).toBe(false);
    expect(isRename(habitNameFor(tEn), "Drink water", stored)).toBe(false);
  });
  it("a different name is a rename (even the stored English title under Russian)", () => {
    expect(isRename(habitNameFor(tRu), "Пить воду утром", stored)).toBe(true);
    expect(isRename(habitNameFor(tRu), "Drink water", stored)).toBe(true);
  });
  it("a typed habit: the same title is no rename, a new one is", () => {
    const typed = { title: "Мой бег", template_id: null };
    expect(isRename(habitNameFor(tRu), "Мой бег", typed)).toBe(false);
    expect(isRename(habitNameFor(tRu), "Бег", typed)).toBe(true);
  });
});

describe("templateKept", () => {
  it("a template picked and left under its own title keeps its id", () => {
    expect(templateKept(tRu, "water", "Пить воду")).toBe("water");
    expect(templateKept(tEn, "g-family-dinner", "Family dinner")).toBe("g-family-dinner");
  });
  it("a name typed over the template, or an unknown id, keeps none", () => {
    expect(templateKept(tRu, "water", "Пить воду утром")).toBeUndefined();
    expect(templateKept(tRu, "treat.zoo", "Trip to the zoo")).toBeUndefined();
    expect(templateKept(tRu, undefined, "Пить воду")).toBeUndefined();
  });
});
