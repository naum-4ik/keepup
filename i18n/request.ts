import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import en from "@/supabase/functions/_shared/messages/en.json";
import { deepMerge } from "./merge-messages";
import { LOCALE_COOKIE, asLocale, enabledLocales, pickLocale } from "./config";

// Order: an explicit locale (getTranslations({ locale })) → the device cookie (a cache of
// profiles.locale) → the phone's Accept-Language → English. No URL prefixes.
export default getRequestConfig(async ({ locale: explicit }) => {
  const enabled = enabledLocales();
  const locale =
    asLocale(explicit, enabled) ??
    asLocale((await cookies()).get(LOCALE_COOKIE)?.value, enabled) ??
    pickLocale((await headers()).get("accept-language"), enabled);
  // English underneath every language: the client provider gets only `messages`, not getMessageFallback.
  const messages =
    locale === "en" ? en : deepMerge(en, (await import(`../supabase/functions/_shared/messages/${locale}.json`)).default);
  return {
    locale,
    messages,
    // A missing translation shows English, never a key (Review Focus 1).
    getMessageFallback: ({ namespace, key }) => {
      const path = [namespace, key].filter(Boolean).join(".");
      const hit = path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], en);
      return typeof hit === "string" ? hit : path;
    },
    onError: (e) => { if (e.code !== "MISSING_MESSAGE") console.error(e); },
  };
});
