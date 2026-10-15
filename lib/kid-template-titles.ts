import "server-only";
import en from "@/supabase/functions/_shared/messages/en.json";
import { LOCALES } from "@/supabase/functions/_shared/i18n";
import { kidTemplateTitlesIn } from "@/lib/kid-templates";

const isMissingModule = (e: unknown) =>
  typeof e === "object" && e !== null && ((e as { code?: string }).code === "MODULE_NOT_FOUND" || /Cannot find module/.test(String((e as { message?: string }).message)));

// The kid template titles in every language whose catalog exists (en today; ru and he once their JSON lands).
export async function kidTemplateTitlesAllLocales() {
  const catalogs: Record<string, unknown> = { en };
  for (const locale of LOCALES) {
    if (locale === "en") continue;
    try {
      catalogs[locale] = (await import(`../supabase/functions/_shared/messages/${locale}.json`)).default;
    } catch (e) {
      // No catalog for this language yet; anything else is a real error.
      if (!isMissingModule(e)) throw e;
    }
  }
  return kidTemplateTitlesIn(catalogs);
}
