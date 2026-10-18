// supabase/functions/_shared/habit-title.test.ts
import { assertEquals } from "jsr:@std/assert@1";
import en from "./messages/en.json" with { type: "json" };
import { habitTitle, templateIdsIn } from "./habit-title.ts";
import { translatorFor } from "../send-push/i18n.ts";

const ids = templateIdsIn(en.templates);
const enabled = ["en", "ru", "he"] as const;

Deno.test("a known template shows the catalog's title in the recipient's language", () => {
  assertEquals(habitTitle(translatorFor("en", [...enabled]).t, "Drink water", "water", ids), "Drink water");
  assertEquals(habitTitle(translatorFor("ru", [...enabled]).t, "Drink water", "water", ids), "Пить воду");
  assertEquals(habitTitle(translatorFor("he", [...enabled]).t, "Brush teeth", "kid.brush-teeth", ids), "לצחצח שיניים");
});

Deno.test("no template, or an unknown one, keeps the stored title", () => {
  const { t } = translatorFor("ru", [...enabled]);
  assertEquals(habitTitle(t, "Мой бег", null, ids), "Мой бег");
  for (const forged of ["nope", "kid", "treat", "treat.zoo", "kidGroup.healthy"]) assertEquals(habitTitle(t, "Typed", forged, ids), "Typed");
});
