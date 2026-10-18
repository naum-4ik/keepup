// Shared by the app (Node) and send-push (Deno): keep it import-free.
export type Locale = "en" | "ru" | "he";
export const LOCALES: readonly Locale[] = ["en", "ru", "he"];
// en-GB keeps the app's existing date output.
export const INTL_LOCALE: Record<Locale, string> = { en: "en-GB", ru: "ru-RU", he: "he-IL" };
// Which languages are live: always en; unknown codes ignored. raw is the KEEPUP_LOCALES list.
export function enabledLocales(raw: string | undefined): Locale[] {
  const asked = (raw ?? "").split(",").map((s) => s.trim());
  return LOCALES.filter((l) => l === "en" || asked.includes(l));
}
export const isRtl = (l: Locale) => l === "he";
// A translator: next-intl's t in the app, use-intl's createTranslator in Deno and tests.
export type T = (key: string, values?: Record<string, string | number | Date>) => string;
// First-strong isolate: an English title inside a Hebrew sentence keeps its own direction.
export const isolate = (s: string) => `⁨${s}⁩`;
